// GET /api/auth/me – current user + profile info
import { getDb } from '@/lib/db';
import { json, error, requireRole } from '@/lib/api';

export async function GET(request) {
    const { session, response } = requireRole(request);
    if (response) return response;

    const db = getDb();
    const user = db.prepare('SELECT id, username, role, full_name, email, avatar, must_change_password, two_factor_secret IS NOT NULL AS has_2fa FROM users WHERE id = ?').get(session.id);
    if (!user) return error('User not found', 404);

    let extended = {};
    if (user.role === 'student') extended = db.prepare('SELECT * FROM students WHERE user_id = ?').get(user.id) || {};
    else if (user.role === 'teacher') extended = db.prepare('SELECT * FROM teachers WHERE user_id = ?').get(user.id) || {};
    const { id: profileId, ...rest } = extended;

    const unread = db.prepare(`
        SELECT COUNT(*) AS c FROM messages m
        WHERE (m.recipient_id = ? AND m.is_read = 0)
           OR (m.is_announcement = 1 AND m.recipient_role = ? AND m.sender_id != ?
               AND NOT EXISTS (SELECT 1 FROM message_reads r WHERE r.message_id = m.id AND r.user_id = ?))
    `).get(user.id, user.role, user.id, user.id).c;

    return json({
        ...rest,
        id: user.id,
        profileId: profileId ?? null,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        fullName: user.full_name,
        email: user.email,
        avatar: user.avatar,
        mustChangePassword: !!user.must_change_password,
        has2fa: !!user.has_2fa,
        unreadMessages: unread,
    });
}
