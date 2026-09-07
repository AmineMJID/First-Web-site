// Schedule [id] – PUT, DELETE (soft) (admin) - hardened
import { getDb, notDeleted } from '@/lib/db';
import { json, error, readJson, requireRole } from '@/lib/api';
import { validateSlot } from '@/lib/schedule';
import { logAudit, getClientInfo, AUDIT_ACTIONS } from '@/lib/audit';

export async function PUT(request, { params }) {
    const { session, response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const body = await readJson(request);
    if (body?.__payloadTooLarge) return error('Payload too large', 413);
    const { error: msg, value } = validateSlot(body);
    if (msg) return error(msg);

    const db = getDb();
    if (!db.prepare(`SELECT 1 FROM schedules WHERE id = ? AND ${notDeleted()}`).get(id)) return error('Slot not found', 404);
    const clash = db.prepare(`SELECT 1 FROM schedules WHERE id != ? AND class_name = ? AND day_of_week = ? AND ${notDeleted()} AND start_time < ? AND end_time > ?`)
        .get(id, value.className, value.day, value.end, value.start);
    if (clash) return error('This class already has a lesson in that time slot', 409);

    db.prepare(`UPDATE schedules SET class_name = ?, subject = ?, teacher_id = ?, day_of_week = ?, start_time = ?, end_time = ?, room = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(value.className, value.subject, value.teacherId, value.day, value.start, value.end, value.room, id);

    const { ip, userAgent } = getClientInfo(request);
    logAudit({ userId: session.id, action: AUDIT_ACTIONS.SCHEDULE_UPDATE, entityType: 'schedule', entityId: id, details: value, ip, userAgent });

    return json({ success: true });
}

export async function DELETE(request, { params }) {
    const { session, response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const db = getDb();
    const existing = db.prepare(`SELECT * FROM schedules WHERE id = ? AND ${notDeleted()}`).get(id);
    if (!existing) return error('Slot not found', 404);

    const now = new Date().toISOString();
    db.prepare(`UPDATE schedules SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(now, now, id);

    const { ip, userAgent } = getClientInfo(request);
    logAudit({ userId: session.id, action: AUDIT_ACTIONS.SCHEDULE_DELETE, entityType: 'schedule', entityId: id, details: { softDelete: true }, ip, userAgent });

    return json({ success: true, softDeleted: true });
}
