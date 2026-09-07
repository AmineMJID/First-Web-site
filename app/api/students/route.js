// Students API – GET (list with pagination), POST (create) - hardened
import { getDb, notDeleted } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { json, error, readJson, requireRole, uniqueUsername, tempPassword, nextCode, parsePagination, paginatedResponse, handleValidation } from '@/lib/api';
import { validate, studentCreateSchema } from '@/lib/validators';
import { sanitizeText } from '@/lib/sanitize';
import { logAudit, getClientInfo, AUDIT_ACTIONS } from '@/lib/audit';
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from '@/lib/rateLimit';

export async function GET(request) {
    const { session, response } = requireRole(request, 'admin', 'teacher');
    if (response) return response;

    const db = getDb();
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const className = searchParams.get('class') || '';
    const hasPagination = searchParams.has('page') || searchParams.has('limit');

    // Build WHERE clause
    let where = `WHERE u.role = 'student' AND ${notDeleted('u')} AND ${notDeleted('s')}`;
    const params = [];

    if (pagination.search) {
        where += ' AND (u.full_name LIKE ? OR s.student_id LIKE ? OR u.email LIKE ? OR u.username LIKE ?)';
        const like = `%${pagination.search}%`;
        params.push(like, like, like, like);
    }
    if (className) {
        where += ' AND s.class_name = ?';
        params.push(className);
    }

    let baseSelect = `
    SELECT u.id AS userId, u.username, u.full_name, u.email, u.created_at,
           s.id, s.student_id, s.date_of_birth, s.gender, s.phone, s.address,
           s.class_name, s.enrollment_date, s.parent_name, s.parent_phone,
           (SELECT ROUND(AVG(g.grade * 100.0 / g.max_grade), 1) FROM grades g WHERE g.student_id = s.id AND ${notDeleted('g')}) AS average,
           (SELECT ROUND(100.0 * SUM(a.status = 'present') / COUNT(*)) FROM attendance a WHERE a.student_id = s.id AND ${notDeleted('a')}) AS attendance_rate
    FROM users u
    JOIN students s ON u.id = s.user_id
    ${where}
    ORDER BY u.full_name ASC`;

    if (hasPagination) {
        const countQuery = `SELECT COUNT(*) as total FROM users u JOIN students s ON u.id = s.user_id ${where}`;
        const total = db.prepare(countQuery).get(...params)?.total || 0;
        const data = db.prepare(baseSelect + ` LIMIT ? OFFSET ?`).all(...params, pagination.limit, pagination.offset);
        return json(paginatedResponse(data, total, pagination));
    } else {
        // Backward compat: return array
        const data = db.prepare(baseSelect).all(...params);
        return json(data);
    }
}

export async function POST(request) {
    const { session, response } = requireRole(request, 'admin');
    if (response) return response;

    // Rate limit creation
    const rlKey = rateLimitKey(request, 'student-create');
    const rl = checkRateLimit(rlKey, RATE_LIMITS.create);
    if (!rl.allowed) {
        return json({ error: 'Too many creations, try later' }, 429);
    }

    const body = await readJson(request);
    if (body?.__payloadTooLarge) return error('Payload too large', 413);
    
    const validation = validate(studentCreateSchema, body);
    if (validation.error) return error(validation.error, 400);
    
    const data = validation.data;

    const db = getDb();
    const username = uniqueUsername(db, data.fullName);
    const password = tempPassword();
    const studentCode = nextCode(db, 'students', 'student_id', 'STU');

    try {
        const create = db.transaction(() => {
            const u = db.prepare(
                `INSERT INTO users (username, password, role, full_name, email, must_change_password) VALUES (?, ?, 'student', ?, ?, 1)`
            ).run(username, hashPassword(password), sanitizeText(data.fullName, 100), sanitizeText(data.email, 120) || null);
            db.prepare(
                `INSERT INTO students (user_id, student_id, date_of_birth, gender, phone, address, class_name, parent_name, parent_phone)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
                u.lastInsertRowid, 
                studentCode, 
                data.dateOfBirth || null, 
                sanitizeText(data.gender, 20) || null,
                sanitizeText(data.phone, 30) || null, 
                sanitizeText(data.address, 200) || null,
                sanitizeText(data.className, 50) || 'Class A', 
                sanitizeText(data.parentName, 100) || null, 
                sanitizeText(data.parentPhone, 30) || null
            );
            return u.lastInsertRowid;
        });
        const userId = create();

        // Audit log - never log password
        const { ip, userAgent } = getClientInfo(request);
        logAudit({
            userId: session.id,
            action: AUDIT_ACTIONS.CREATE,
            entityType: 'student',
            entityId: userId,
            details: { fullName: data.fullName, studentId: studentCode, username, className: data.className },
            ip, userAgent
        });

        return json({
            success: true,
            student: { 
                userId, 
                studentId: studentCode, 
                username, 
                password, // Returned once only, must be copied now
                fullName: data.fullName, 
                email: data.email || null, 
                className: data.className || 'Class A',
                _warning: 'This password is shown only once. Copy it now.'
            },
        }, 201);
    } catch (e) {
        console.error('Create student error:', e.message); // Never log password
        return error('Failed to create student', 500);
    }
}
