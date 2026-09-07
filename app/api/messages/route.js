// Messages API – GET (inbox + sent), POST (send)
import { getDb } from '@/lib/db';
import { json, error, readJson, requireRole, clampStr } from '@/lib/api';

export async function GET(request) {
    const { session, response } = requireRole(request);
    if (response) return response;
    const db = getDb();
    const box = new URL(request.url).searchParams.get('box') || 'all'; // inbox | sent | all

    const inbox = db.prepare(`
        SELECT m.*, u.full_name AS sender_name, u.role AS sender_role,
               CASE WHEN m.is_announcement = 1
                    THEN EXISTS(SELECT 1 FROM message_reads r WHERE r.message_id = m.id AND r.user_id = ?)
                    ELSE m.is_read END AS is_read,
               0 AS is_sent
        FROM messages m JOIN users u ON m.sender_id = u.id
        WHERE m.sender_id != ? AND (m.recipient_id = ? OR (m.is_announcement = 1 AND m.recipient_role = ?))
        ORDER BY m.created_at DESC`).all(session.id, session.id, session.id, session.role);

    // Sent: group individual copies of the same bulk message together
    const sentRows = db.prepare(`
        SELECT m.*, u.full_name AS sender_name, u.role AS sender_role,
               ru.full_name AS recipient_name, 1 AS is_sent
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN users ru ON m.recipient_id = ru.id
        WHERE m.sender_id = ?
        ORDER BY m.created_at DESC`).all(session.id);

    const sentMap = new Map();
    for (const m of sentRows) {
        const key = m.is_announcement ? `a-${m.id}` : `${m.subject}|${m.body}|${String(m.created_at).slice(0, 19)}`;
        if (!sentMap.has(key)) {
            sentMap.set(key, { ...m, recipients: [], recipient_count: 0, read_count: 0 });
        }
        const entry = sentMap.get(key);
        if (m.recipient_name) entry.recipients.push(m.recipient_name);
        entry.recipient_count += m.is_announcement ? 0 : 1;
        entry.read_count += m.is_read ? 1 : 0;
    }
    const sent = [...sentMap.values()];

    const result = box === 'inbox' ? inbox : box === 'sent' ? sent : [...inbox, ...sent];
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return json(result);
}

export async function POST(request) {
    const { session, response } = requireRole(request, 'admin', 'teacher');
    if (response) return response;

    const body = await readJson(request);
    const subject = clampStr(body?.subject, 150);
    const messageBody = clampStr(body?.messageBody, 5000);
    if (!subject || !messageBody) return error('Subject and body are required');

    const { recipientRole, recipientIds = [], recipientClasses = [], isAnnouncement } = body;
    const db = getDb();

    if (isAnnouncement) {
        if (!['student', 'teacher'].includes(recipientRole)) return error('Invalid recipient role');
        // Teachers may only broadcast to students
        if (session.role === 'teacher' && recipientRole !== 'student') return error('Forbidden', 403);
        db.prepare(`INSERT INTO messages (sender_id, recipient_role, subject, body, is_announcement) VALUES (?, ?, ?, ?, 1)`)
            .run(session.id, recipientRole, subject, messageBody);
        return json({ success: true, count: 1 }, 201);
    }

    const targets = new Set(recipientIds.map(Number).filter(Number.isInteger));
    if (Array.isArray(recipientClasses) && recipientClasses.length > 0) {
        const placeholders = recipientClasses.map(() => '?').join(',');
        db.prepare(`SELECT user_id FROM students WHERE class_name IN (${placeholders})`).all(...recipientClasses)
            .forEach((s) => targets.add(s.user_id));
    }
    targets.delete(session.id);
    if (targets.size === 0) return error('No recipients selected');

    // Make sure all targets exist (and teachers can only message students/admin)
    const placeholders = [...targets].map(() => '?').join(',');
    const users = db.prepare(`SELECT id, role FROM users WHERE id IN (${placeholders})`).all(...targets);
    if (users.length !== targets.size) return error('Unknown recipient');

    const insert = db.prepare(`INSERT INTO messages (sender_id, recipient_id, subject, body, is_announcement) VALUES (?, ?, ?, ?, 0)`);
    const run = db.transaction((ids) => { for (const id of ids) insert.run(session.id, id, subject, messageBody); });
    run([...targets]);
    return json({ success: true, count: targets.size }, 201);
}
