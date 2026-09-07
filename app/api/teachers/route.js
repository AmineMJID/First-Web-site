// Teachers API – GET (list), POST (create)
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { json, error, readJson, requireRole, uniqueUsername, tempPassword, nextCode, clampStr } from '@/lib/api';

export async function GET(request) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;
    const teachers = getDb().prepare(`
        SELECT u.id AS userId, u.username, u.full_name, u.email, u.created_at,
               u.two_factor_secret IS NOT NULL AS has_2fa,
               t.id, t.teacher_id, t.subject, t.phone, t.department, t.hire_date,
               (SELECT COUNT(DISTINCT class_name) FROM schedules sc WHERE sc.teacher_id = t.id) AS class_count
        FROM users u JOIN teachers t ON u.id = t.user_id
        WHERE u.role = 'teacher' ORDER BY u.full_name ASC`).all();
    return json(teachers);
}

export async function POST(request) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;

    const body = await readJson(request);
    const fullName = clampStr(body?.fullName, 100);
    const subject = clampStr(body?.subject, 60);
    if (!fullName || !subject) return error('Full name and subject are required');

    const db = getDb();
    const username = uniqueUsername(db, fullName);
    const password = tempPassword();
    const teacherCode = nextCode(db, 'teachers', 'teacher_id', 'TCH');

    try {
        const create = db.transaction(() => {
            const u = db.prepare(
                `INSERT INTO users (username, password, role, full_name, email, must_change_password) VALUES (?, ?, 'teacher', ?, ?, 1)`
            ).run(username, hashPassword(password), fullName, clampStr(body.email, 120) || null);
            db.prepare(`INSERT INTO teachers (user_id, teacher_id, subject, department, phone) VALUES (?, ?, ?, ?, ?)`)
                .run(u.lastInsertRowid, teacherCode, subject, clampStr(body.department, 60) || 'General', clampStr(body.phone, 30) || null);
            return u.lastInsertRowid;
        });
        const userId = create();
        return json({ success: true, teacher: { userId, teacherId: teacherCode, username, password, fullName, subject } }, 201);
    } catch (e) {
        console.error('Create teacher error:', e);
        return error('Failed to create teacher', 500);
    }
}
