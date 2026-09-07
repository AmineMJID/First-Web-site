// Messages API – GET (inbox + sent), POST (send) - hardened with XSS protection, pagination, audit
import { getDb, notDeleted } from '@/lib/db';
import { json, error, readJson, requireRole, parsePagination, paginatedResponse } from '@/lib/api';
import { validate, messageCreateSchema } from '@/lib/validators';
import { sanitizeMessageBody, sanitizeSubject } from '@/lib/sanitize';
import { logAudit, getClientInfo, AUDIT_ACTIONS } from '@/lib/audit';
import { checkRateLimit, RATE_LIMITS, rateLimitKey } from '@/lib/rateLimit';

export async function GET(request) {
    const { session, response } = requireRole(request);
    if (response) return response;
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const box = searchParams.get('box') || 'all';
    const hasPagination = searchParams.has('page') || searchParams.has('limit');
    const pagination = parsePagination(searchParams);

    let inbox, sentRows;

    if (hasPagination) {
        inbox = db.prepare(`
            SELECT m.*, u.full_name AS sender_name, u.role AS sender_role,
                   CASE WHEN m.is_announcement = 1
                        THEN EXISTS(SELECT 1 FROM message_reads r WHERE r.message_id = m.id AND r.user_id = ?)
                        ELSE m.is_read END AS is_read,
                   0 AS is_sent
            FROM messages m JOIN users u ON m.sender_id = u.id
            WHERE m.sender_id != ? AND ${notDeleted('m')} AND ${notDeleted('u')} AND (m.recipient_id = ? OR (m.is_announcement = 1 AND m.recipient_role = ?))
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?`).all(session.id, session.id, session.id, session.role, pagination.limit, pagination.offset);
    } else {
        inbox = db.prepare(`
            SELECT m.*, u.full_name AS sender_name, u.role AS sender_role,
                   CASE WHEN m.is_announcement = 1
                        THEN EXISTS(SELECT 1 FROM message_reads r WHERE r.message_id = m.id AND r.user_id = ?)
                        ELSE m.is_read END AS is_read,
                   0 AS is_sent
            FROM messages m JOIN users u ON m.sender_id = u.id
            WHERE m.sender_id != ? AND ${notDeleted('m')} AND ${notDeleted('u')} AND (m.recipient_id = ? OR (m.is_announcement = 1 AND m.recipient_role = ?))
            ORDER BY m.created_at DESC`).all(session.id, session.id, session.id, session.role);
    }

    sentRows = db.prepare(`
        SELECT m.*, u.full_name AS sender_name, u.role AS sender_role,
               ru.full_name AS recipient_name, 1 AS is_sent
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN users ru ON m.recipient_id = ru.id
        WHERE m.sender_id = ? AND ${notDeleted('m')}
        ORDER BY m.created_at DESC
        LIMIT 200`).all(session.id);

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

    if (hasPagination) {
        const paginated = result.slice(0, pagination.limit);
        return json(paginatedResponse(paginated, result.length, pagination));
    }
    return json(result);
}

export async function POST(request) {
    const { session, response } = requireRole(request, 'admin', 'teacher');
    if (response) return response;

    const rlKey = rateLimitKey(request, 'message-send');
    const rl = checkRateLimit(rlKey, RATE_LIMITS.message);
    if (!rl.allowed) return json({ error: 'Too many messages, slow down' }, 429);

    const body = await readJson(request);
    if (body?.__payloadTooLarge) return error('Payload too large', 413);

    const validation = validate(messageCreateSchema, body);
    if (validation.error) return error(validation.error, 400);
    const { subject, messageBody, recipientRole, recipientIds = [], recipientClasses = [], isAnnouncement } = validation.data;

    // Sanitize to prevent XSS
    const safeSubject = sanitizeSubject(subject);
    const safeBody = sanitizeMessageBody(messageBody);
    if (!safeSubject || !safeBody) return error('Subject and body are required');

    const db = getDb();

    if (isAnnouncement) {
        if (!['student', 'teacher'].includes(recipientRole)) return error('Invalid recipient role');
        if (session.role === 'teacher' && recipientRole !== 'student') return error('Forbidden', 403);
        db.prepare(`INSERT INTO messages (sender_id, recipient_role, subject, body, is_announcement) VALUES (?, ?, ?, ?, 1)`)
            .run(session.id, recipientRole, safeSubject, safeBody);

        const { ip, userAgent } = getClientInfo(request);
        logAudit({ userId: session.id, action: AUDIT_ACTIONS.MESSAGE_SEND, entityType: 'message', details: { type: 'announcement', role: recipientRole, subject: safeSubject }, ip, userAgent });

        return json({ success: true, count: 1 }, 201);
    }

    const targets = new Set(recipientIds.map(Number).filter(Number.isInteger));
    if (Array.isArray(recipientClasses) && recipientClasses.length > 0) {
        const placeholders = recipientClasses.map(() => '?').join(',');
        db.prepare(`SELECT user_id FROM students WHERE class_name IN (${placeholders}) AND ${notDeleted()}`).all(...recipientClasses)
            .forEach((s) => targets.add(s.user_id));
    }
    targets.delete(session.id);
    if (targets.size === 0) return error('No recipients selected');

    const placeholders = [...targets].map(() => '?').join(',');
    const users = db.prepare(`SELECT id, role FROM users WHERE id IN (${placeholders}) AND ${notDeleted()}`).all(...targets);
    if (users.length !== targets.size) return error('Unknown recipient');

    const insert = db.prepare(`INSERT INTO messages (sender_id, recipient_id, subject, body, is_announcement) VALUES (?, ?, ?, ?, 0)`);
    const run = db.transaction((ids) => { for (const id of ids) insert.run(session.id, id, safeSubject, safeBody); });
    run([...targets]);

    const { ip, userAgent } = getClientInfo(request);
    logAudit({ userId: session.id, action: AUDIT_ACTIONS.MESSAGE_SEND, entityType: 'message', details: { type: 'direct', count: targets.size, subject: safeSubject }, ip, userAgent });

    return json({ success: true, count: targets.size }, 201);
}
