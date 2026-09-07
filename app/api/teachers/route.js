// Teachers API – GET (list with pagination), POST (create) - hardened
import { getDb, notDeleted } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { json, error, readJson, requireRole, uniqueUsername, tempPassword, nextCode, parsePagination, paginatedResponse } from '@/lib/api';
import { validate, teacherCreateSchema } from '@/lib/validators';
import { sanitizeText } from '@/lib/sanitize';
import { logAudit, getClientInfo, AUDIT_ACTIONS } from '@/lib/audit';
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from '@/lib/rateLimit';

export async function GET(request) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;

    const db = getDb();
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const hasPagination = searchParams.has('page') || searchParams.has('limit');

    const where = `WHERE u.role = 'teacher' AND ${notDeleted('u')} AND ${notDeleted('t')}`;
    let countParams = [];
    let dataParams = [];

    let searchClause = '';
    if (pagination.search) {
        searchClause = ' AND (u.full_name LIKE ? OR t.teacher_id LIKE ? OR u.email LIKE ?)';
        const like = `%${pagination.search}%`;
        countParams.push(like, like, like);
        dataParams.push(like, like, like);
    }

    const baseQuery = `
        SELECT u.id AS userId, u.username, u.full_name, u.email, u.created_at,
               u.two_factor_secret IS NOT NULL AS has_2fa,
               t.id, t.teacher_id, t.subject, t.phone, t.department, t.hire_date,
               (SELECT COUNT(DISTINCT class_name) FROM schedules sc WHERE sc.teacher_id = t.id AND ${notDeleted('sc')}) AS class_count
        FROM users u JOIN teachers t ON u.id = t.user_id
        ${where} ${searchClause}
        ORDER BY u.full_name ASC`;

    if (hasPagination) {
        const total = db.prepare(`SELECT COUNT(*) as total FROM users u JOIN teachers t ON u.id = t.user_id ${where} ${searchClause}`).get(...countParams)?.total || 0;
        const teachers = db.prepare(baseQuery + ` LIMIT ? OFFSET ?`).all(...dataParams, pagination.limit, pagination.offset);
        return json(paginatedResponse(teachers, total, pagination));
    } else {
        const teachers = db.prepare(baseQuery).all(...dataParams);
        return json(teachers);
    }
}

export async function POST(request) {
    const { session, response } = requireRole(request, 'admin');
    if (response) return response;

    const rlKey = rateLimitKey(request, 'teacher-create');
    const rl = checkRateLimit(rlKey, RATE_LIMITS.create);
    if (!rl.allowed) return json({ error: 'Too many creations' }, 429);

    const body = await readJson(request);
    if (body?.__payloadTooLarge) return error('Payload too large', 413);

    const validation = validate(teacherCreateSchema, body);
    if (validation.error) return error(validation.error, 400);
    const data = validation.data;

    const db = getDb();
    const username = uniqueUsername(db, data.fullName);
    const password = tempPassword();
    const teacherCode = nextCode(db, 'teachers', 'teacher_id', 'TCH');

    try {
        const create = db.transaction(() => {
            const u = db.prepare(
                `INSERT INTO users (username, password, role, full_name, email, must_change_password) VALUES (?, ?, 'teacher', ?, ?, 1)`
            ).run(username, hashPassword(password), sanitizeText(data.fullName, 100), sanitizeText(data.email, 120) || null);
            db.prepare(`INSERT INTO teachers (user_id, teacher_id, subject, department, phone) VALUES (?, ?, ?, ?, ?)`)
                .run(u.lastInsertRowid, teacherCode, sanitizeText(data.subject, 60), sanitizeText(data.department, 60) || 'General', sanitizeText(data.phone, 30) || null);
            return u.lastInsertRowid;
        });
        const userId = create();

        const { ip, userAgent } = getClientInfo(request);
        logAudit({
            userId: session.id,
            action: AUDIT_ACTIONS.CREATE,
            entityType: 'teacher',
            entityId: userId,
            details: { fullName: data.fullName, teacherId: teacherCode, username, subject: data.subject },
            ip, userAgent
        });

        return json({ success: true, teacher: { userId, teacherId: teacherCode, username, password, fullName: data.fullName, subject: data.subject, _warning: 'Copy password now, shown only once' } }, 201);
    } catch (e) {
        console.error('Create teacher error:', e.message);
        return error('Failed to create teacher', 500);
    }
}
