// Students [id] API – GET, PUT, DELETE (soft), POST (reset password) - hardened
import { getDb, notDeleted } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { json, error, readJson, requireRole, tempPassword, handleValidation } from '@/lib/api';
import { validate, studentUpdateSchema } from '@/lib/validators';
import { sanitizeText } from '@/lib/sanitize';
import { logAudit, getClientInfo, AUDIT_ACTIONS } from '@/lib/audit';

export async function GET(request, { params }) {
    const { session, response } = requireRole(request);
    if (response) return response;
    const { id } = await params;
    const db = getDb();

    const student = db.prepare(`
        SELECT u.id AS userId, u.username, u.full_name, u.email, s.*
        FROM users u JOIN students s ON u.id = s.user_id 
        WHERE s.id = ? AND ${notDeleted('u')} AND ${notDeleted('s')}`).get(id);
    if (!student) return error('Student not found', 404);
    if (session.role === 'student' && student.userId !== session.id) return error('Forbidden', 403);

    const grades = db.prepare(`SELECT * FROM grades WHERE student_id = ? AND ${notDeleted()} ORDER BY term, subject`).all(id);
    const attendance = db.prepare(`SELECT status, COUNT(*) AS count FROM attendance WHERE student_id = ? AND ${notDeleted()} GROUP BY status`).all(id);
    return json({ ...student, grades, attendance });
}

export async function PUT(request, { params }) {
    const { session, response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const body = await readJson(request);
    if (!body) return error('Invalid body');
    if (body?.__payloadTooLarge) return error('Payload too large', 413);

    const validation = validate(studentUpdateSchema, body);
    if (validation.error) return error(validation.error, 400);
    const data = validation.data;

    const db = getDb();
    const student = db.prepare(`SELECT * FROM students WHERE id = ? AND ${notDeleted()}`).get(id);
    if (!student) return error('Student not found', 404);

    const old = db.prepare(`SELECT u.full_name, s.class_name FROM users u JOIN students s ON u.id = s.user_id WHERE s.id = ?`).get(id);

    const update = db.transaction(() => {
        db.prepare('UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(data.fullName ? sanitizeText(data.fullName, 100) : null, data.email !== undefined ? sanitizeText(data.email, 120) : null, student.user_id);
        db.prepare(`
            UPDATE students SET
              date_of_birth = COALESCE(?, date_of_birth), gender = COALESCE(?, gender), phone = COALESCE(?, phone),
              address = COALESCE(?, address), class_name = COALESCE(?, class_name),
              parent_name = COALESCE(?, parent_name), parent_phone = COALESCE(?, parent_phone),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`)
            .run(
                data.dateOfBirth || null, 
                data.gender ? sanitizeText(data.gender, 20) : null, 
                data.phone ? sanitizeText(data.phone, 30) : null, 
                data.address ? sanitizeText(data.address, 200) : null,
                data.className ? sanitizeText(data.className, 50) : null, 
                data.parentName ? sanitizeText(data.parentName, 100) : null, 
                data.parentPhone ? sanitizeText(data.parentPhone, 30) : null, 
                id
            );
    });
    update();

    const { ip, userAgent } = getClientInfo(request);
    logAudit({
        userId: session.id,
        action: AUDIT_ACTIONS.UPDATE,
        entityType: 'student',
        entityId: id,
        details: { before: old, after: data },
        ip, userAgent
    });

    return json({ success: true });
}

// POST /api/students/[id]  { action: 'reset-password' }
export async function POST(request, { params }) {
    const { session, response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const body = await readJson(request);
    if (body?.__payloadTooLarge) return error('Payload too large', 413);
    if (body?.action !== 'reset-password') return error('Unknown action');

    const db = getDb();
    const student = db.prepare(`SELECT user_id, student_id FROM students WHERE id = ? AND ${notDeleted()}`).get(id);
    if (!student) return error('Student not found', 404);
    const password = tempPassword();
    db.prepare('UPDATE users SET password = ?, must_change_password = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(hashPassword(password), student.user_id);

    const { ip, userAgent } = getClientInfo(request);
    logAudit({
        userId: session.id,
        action: AUDIT_ACTIONS.RESET_PASSWORD,
        entityType: 'student',
        entityId: id,
        details: { studentId: student.student_id, userId: student.user_id },
        ip, userAgent
    });

    return json({ 
        success: true, 
        password,
        _warning: 'This password is shown only once. Copy it now.'
    });
}

export async function DELETE(request, { params }) {
    const { session, response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const db = getDb();
    const student = db.prepare(`SELECT user_id, student_id FROM students WHERE id = ? AND ${notDeleted()}`).get(id);
    if (!student) return error('Student not found', 404);

    // Soft delete
    const now = new Date().toISOString();
    db.transaction(() => {
        db.prepare(`UPDATE students SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, id);
        db.prepare(`UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, student.user_id);
        db.prepare(`UPDATE grades SET deleted_at = ? WHERE student_id = ? AND ${notDeleted()}`).run(now, id);
        db.prepare(`UPDATE attendance SET deleted_at = ? WHERE student_id = ? AND ${notDeleted()}`).run(now, id);
    })();

    const { ip, userAgent } = getClientInfo(request);
    logAudit({
        userId: session.id,
        action: AUDIT_ACTIONS.DELETE,
        entityType: 'student',
        entityId: id,
        details: { studentId: student.student_id, softDelete: true },
        ip, userAgent
    });

    return json({ success: true, softDeleted: true });
}
