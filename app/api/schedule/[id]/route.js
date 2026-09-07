// Schedule [id] – PUT, DELETE (admin)
import { getDb } from '@/lib/db';
import { json, error, readJson, requireRole } from '@/lib/api';
import { validateSlot } from '@/lib/schedule';

export async function PUT(request, { params }) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const body = await readJson(request);
    const { error: msg, value } = validateSlot(body);
    if (msg) return error(msg);

    const db = getDb();
    if (!db.prepare('SELECT 1 FROM schedules WHERE id = ?').get(id)) return error('Slot not found', 404);
    const clash = db.prepare(`SELECT 1 FROM schedules WHERE id != ? AND class_name = ? AND day_of_week = ? AND start_time < ? AND end_time > ?`)
        .get(id, value.className, value.day, value.end, value.start);
    if (clash) return error('This class already has a lesson in that time slot', 409);

    db.prepare(`UPDATE schedules SET class_name = ?, subject = ?, teacher_id = ?, day_of_week = ?, start_time = ?, end_time = ?, room = ? WHERE id = ?`)
        .run(value.className, value.subject, value.teacherId, value.day, value.start, value.end, value.room, id);
    return json({ success: true });
}

export async function DELETE(request, { params }) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const r = getDb().prepare('DELETE FROM schedules WHERE id = ?').run(id);
    if (!r.changes) return error('Slot not found', 404);
    return json({ success: true });
}
