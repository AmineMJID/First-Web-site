// Students [id] API – GET, PUT, DELETE, POST (reset password)
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { json, error, readJson, requireRole, tempPassword, clampStr, isValidDate } from '@/lib/api';

export async function GET(request, { params }) {
    const { session, response } = requireRole(request);
    if (response) return response;
    const { id } = await params;
    const db = getDb();

    const student = db.prepare(`
        SELECT u.id AS userId, u.username, u.full_name, u.email, s.*
        FROM users u JOIN students s ON u.id = s.user_id WHERE s.id = ?`).get(id);
    if (!student) return error('Student not found', 404);
    if (session.role === 'student' && student.userId !== session.id) return error('Forbidden', 403);

    const grades = db.prepare('SELECT * FROM grades WHERE student_id = ? ORDER BY term, subject').all(id);
    const attendance = db.prepare(`SELECT status, COUNT(*) AS count FROM attendance WHERE student_id = ? GROUP BY status`).all(id);
    return json({ ...student, grades, attendance });
}

export async function PUT(request, { params }) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const body = await readJson(request);
    if (!body) return error('Invalid body');
    if (body.dateOfBirth && !isValidDate(body.dateOfBirth)) return error('Invalid date of birth');

    const db = getDb();
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
    if (!student) return error('Student not found', 404);

    const update = db.transaction(() => {
        db.prepare('UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(clampStr(body.fullName, 100) || null, body.email !== undefined ? clampStr(body.email, 120) : null, student.user_id);
        db.prepare(`
            UPDATE students SET
              date_of_birth = COALESCE(?, date_of_birth), gender = COALESCE(?, gender), phone = COALESCE(?, phone),
              address = COALESCE(?, address), class_name = COALESCE(?, class_name),
              parent_name = COALESCE(?, parent_name), parent_phone = COALESCE(?, parent_phone)
            WHERE id = ?`)
            .run(body.dateOfBirth || null, body.gender ?? null, body.phone ?? null, body.address ?? null,
                clampStr(body.className, 50) || null, body.parentName ?? null, body.parentPhone ?? null, id);
    });
    update();
    return json({ success: true });
}

// POST /api/students/[id]  { action: 'reset-password' }
export async function POST(request, { params }) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const body = await readJson(request);
    if (body?.action !== 'reset-password') return error('Unknown action');

    const db = getDb();
    const student = db.prepare('SELECT user_id FROM students WHERE id = ?').get(id);
    if (!student) return error('Student not found', 404);
    const password = tempPassword();
    db.prepare('UPDATE users SET password = ?, must_change_password = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(hashPassword(password), student.user_id);
    return json({ success: true, password });
}

export async function DELETE(request, { params }) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const db = getDb();
    const student = db.prepare('SELECT user_id FROM students WHERE id = ?').get(id);
    if (!student) return error('Student not found', 404);
    db.prepare('DELETE FROM users WHERE id = ?').run(student.user_id);
    return json({ success: true });
}
