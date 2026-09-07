// Teachers [id] API – PUT, DELETE (soft), POST (reset password / reset 2FA) - hardened
import { getDb, notDeleted } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { json, error, readJson, requireRole, tempPassword } from '@/lib/api';
import { validate, teacherUpdateSchema } from '@/lib/validators';
import { sanitizeText } from '@/lib/sanitize';
import { logAudit, getClientInfo, AUDIT_ACTIONS } from '@/lib/audit';

export async function PUT(request, { params }) {
    const { session, response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const body = await readJson(request);
    if (!body) return error('Invalid body');
    if (body?.__payloadTooLarge) return error('Payload too large', 413);

    const validation = validate(teacherUpdateSchema, body);
    if (validation.error) return error(validation.error, 400);
    const data = validation.data;

    const db = getDb();
    const teacher = db.prepare(`SELECT * FROM teachers WHERE id = ? AND ${notDeleted()}`).get(id);
    if (!teacher) return error('Teacher not found', 404);

    const update = db.transaction(() => {
        db.prepare('UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(data.fullName ? sanitizeText(data.fullName, 100) : null, data.email !== undefined ? sanitizeText(data.email, 120) : null, teacher.user_id);
        db.prepare(`UPDATE teachers SET subject = COALESCE(?, subject), department = COALESCE(?, department), phone = COALESCE(?, phone), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(data.subject ? sanitizeText(data.subject, 60) : null, data.department ? sanitizeText(data.department, 60) : null, data.phone ? sanitizeText(data.phone, 30) : null, id);
    });
    update();

    const { ip, userAgent } = getClientInfo(request);
    logAudit({ userId: session.id, action: AUDIT_ACTIONS.UPDATE, entityType: 'teacher', entityId: id, details: data, ip, userAgent });

    return json({ success: true });
}

export async function POST(request, { params }) {
    const { session, response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const body = await readJson(request);
    if (body?.__payloadTooLarge) return error('Payload too large', 413);

    const db = getDb();
    const teacher = db.prepare(`SELECT user_id, teacher_id FROM teachers WHERE id = ? AND ${notDeleted()}`).get(id);
    if (!teacher) return error('Teacher not found', 404);

    const { ip, userAgent } = getClientInfo(request);

    if (body?.action === 'reset-password') {
        const password = tempPassword();
        db.prepare('UPDATE users SET password = ?, must_change_password = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(hashPassword(password), teacher.user_id);

        logAudit({ userId: session.id, action: AUDIT_ACTIONS.RESET_PASSWORD, entityType: 'teacher', entityId: id, details: { teacherId: teacher.teacher_id }, ip, userAgent });

        return json({ success: true, password, _warning: 'Copy now, shown only once' });
    }
    if (body?.action === 'reset-2fa') {
        db.prepare('UPDATE users SET two_factor_secret = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(teacher.user_id);
        logAudit({ userId: session.id, action: AUDIT_ACTIONS.UPDATE, entityType: 'teacher', entityId: id, details: { action: 'reset-2fa' }, ip, userAgent });
        return json({ success: true });
    }
    return error('Unknown action');
}

export async function DELETE(request, { params }) {
    const { session, response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const db = getDb();
    const teacher = db.prepare(`SELECT user_id, teacher_id FROM teachers WHERE id = ? AND ${notDeleted()}`).get(id);
    if (!teacher) return error('Teacher not found', 404);

    const now = new Date().toISOString();
    db.transaction(() => {
        db.prepare(`UPDATE teachers SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, id);
        db.prepare(`UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, teacher.user_id);
    })();

    const { ip, userAgent } = getClientInfo(request);
    logAudit({ userId: session.id, action: AUDIT_ACTIONS.DELETE, entityType: 'teacher', entityId: id, details: { teacherId: teacher.teacher_id, softDelete: true }, ip, userAgent });

    return json({ success: true, softDeleted: true });
}
