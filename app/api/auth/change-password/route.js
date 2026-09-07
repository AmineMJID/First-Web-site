// POST /api/auth/change-password - hardened
import { getDb, notDeleted } from '@/lib/db';
import { hashPassword, comparePassword } from '@/lib/auth';
import { json, error, readJson, requireRole } from '@/lib/api';
import { validate, changePasswordSchema } from '@/lib/validators';
import { logAudit, getClientInfo, AUDIT_ACTIONS } from '@/lib/audit';

export async function POST(request) {
    const { session, response } = requireRole(request);
    if (response) return response;

    const body = await readJson(request);
    if (body?.__payloadTooLarge) return error('Payload too large', 413);

    const validation = validate(changePasswordSchema, body);
    if (validation.error) return error(validation.error, 400);
    const { currentPassword, newPassword } = validation.data;

    const db = getDb();
    const user = db.prepare(`SELECT id, password FROM users WHERE id = ? AND ${notDeleted()}`).get(session.id);
    if (!user || !comparePassword(currentPassword, user.password)) return error('Current password is incorrect', 401);

    db.prepare('UPDATE users SET password = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(hashPassword(newPassword), session.id);

    const { ip, userAgent } = getClientInfo(request);
    logAudit({ userId: session.id, action: AUDIT_ACTIONS.CHANGE_PASSWORD, entityType: 'user', entityId: session.id, ip, userAgent });

    return json({ success: true });
}
