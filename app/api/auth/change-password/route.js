// POST /api/auth/change-password
import { getDb } from '@/lib/db';
import { hashPassword, comparePassword } from '@/lib/auth';
import { json, error, readJson, requireRole } from '@/lib/api';

export async function POST(request) {
    const { session, response } = requireRole(request);
    if (response) return response;

    const body = await readJson(request);
    const currentPassword = String(body?.currentPassword || '');
    const newPassword = String(body?.newPassword || '');
    if (!currentPassword || !newPassword) return error('Both passwords are required');
    if (newPassword.length < 8) return error('New password must be at least 8 characters');

    const db = getDb();
    const user = db.prepare('SELECT id, password FROM users WHERE id = ?').get(session.id);
    if (!user || !comparePassword(currentPassword, user.password)) return error('Current password is incorrect', 401);

    db.prepare('UPDATE users SET password = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(hashPassword(newPassword), session.id);
    return json({ success: true });
}
