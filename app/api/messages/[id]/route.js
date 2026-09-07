// PUT /api/messages/[id] – mark as read ; DELETE – delete own/sent message
import { getDb } from '@/lib/db';
import { json, error, requireRole } from '@/lib/api';

export async function PUT(request, { params }) {
    const { session, response } = requireRole(request);
    if (response) return response;
    const { id } = await params;
    const db = getDb();
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!msg) return error('Message not found', 404);

    if (msg.is_announcement) {
        if (msg.recipient_role !== session.role && msg.sender_id !== session.id) return error('Forbidden', 403);
        db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)').run(msg.id, session.id);
    } else {
        if (msg.recipient_id !== session.id) return error('Forbidden', 403);
        db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(msg.id);
    }
    return json({ success: true });
}

export async function DELETE(request, { params }) {
    const { session, response } = requireRole(request);
    if (response) return response;
    const { id } = await params;
    const db = getDb();
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!msg) return error('Message not found', 404);
    const allowed = session.role === 'admin' || msg.sender_id === session.id || msg.recipient_id === session.id;
    if (!allowed) return error('Forbidden', 403);
    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    return json({ success: true });
}
