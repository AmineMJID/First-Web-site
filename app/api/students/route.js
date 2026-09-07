// Students API – GET (list), POST (create)
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { json, error, readJson, requireRole, uniqueUsername, tempPassword, nextCode, clampStr, isValidDate } from '@/lib/api';

export async function GET(request) {
    const { response } = requireRole(request, 'admin', 'teacher');
    if (response) return response;

    const db = getDb();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const className = searchParams.get('class') || '';

    let query = `
    SELECT u.id AS userId, u.username, u.full_name, u.email, u.created_at,
           s.id, s.student_id, s.date_of_birth, s.gender, s.phone, s.address,
           s.class_name, s.enrollment_date, s.parent_name, s.parent_phone,
           (SELECT ROUND(AVG(g.grade * 100.0 / g.max_grade), 1) FROM grades g WHERE g.student_id = s.id) AS average,
           (SELECT ROUND(100.0 * SUM(a.status = 'present') / COUNT(*)) FROM attendance a WHERE a.student_id = s.id) AS attendance_rate
    FROM users u
    JOIN students s ON u.id = s.user_id
    WHERE u.role = 'student'`;
    const params = [];
    if (search) {
        query += ' AND (u.full_name LIKE ? OR s.student_id LIKE ? OR u.email LIKE ? OR u.username LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (className) {
        query += ' AND s.class_name = ?';
        params.push(className);
    }
    query += ' ORDER BY u.full_name ASC';
    return json(db.prepare(query).all(...params));
}

export async function POST(request) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;

    const body = await readJson(request);
    const fullName = clampStr(body?.fullName, 100);
    if (!fullName) return error('Full name is required');
    if (body?.dateOfBirth && !isValidDate(body.dateOfBirth)) return error('Invalid date of birth');

    const db = getDb();
    const username = uniqueUsername(db, fullName);
    const password = tempPassword();
    const studentCode = nextCode(db, 'students', 'student_id', 'STU');

    try {
        const create = db.transaction(() => {
            const u = db.prepare(
                `INSERT INTO users (username, password, role, full_name, email, must_change_password) VALUES (?, ?, 'student', ?, ?, 1)`
            ).run(username, hashPassword(password), fullName, clampStr(body.email, 120) || null);
            db.prepare(
                `INSERT INTO students (user_id, student_id, date_of_birth, gender, phone, address, class_name, parent_name, parent_phone)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(u.lastInsertRowid, studentCode, body.dateOfBirth || null, clampStr(body.gender, 20) || null,
                clampStr(body.phone, 30) || null, clampStr(body.address, 200) || null,
                clampStr(body.className, 50) || 'Class A', clampStr(body.parentName, 100) || null, clampStr(body.parentPhone, 30) || null);
            return u.lastInsertRowid;
        });
        const userId = create();
        return json({
            success: true,
            student: { userId, studentId: studentCode, username, password, fullName, email: body.email || null, className: body.className || 'Class A' },
        }, 201);
    } catch (e) {
        console.error('Create student error:', e);
        return error('Failed to create student', 500);
    }
}
