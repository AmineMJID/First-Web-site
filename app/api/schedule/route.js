// Schedule API – GET (role aware), POST (admin create)
import { getDb } from '@/lib/db';
import { json, error, readJson, requireRole } from '@/lib/api';
import { DAYS, validateSlot } from '@/lib/schedule';
const ORDER = `CASE sc.day_of_week ${DAYS.map((d, i) => `WHEN '${d}' THEN ${i + 1}`).join(' ')} END, sc.start_time`;
const BASE = `SELECT sc.*, u.full_name AS teacher_name FROM schedules sc
              LEFT JOIN teachers t ON sc.teacher_id = t.id
              LEFT JOIN users u ON t.user_id = u.id`;

export async function GET(request) {
    const { session, response } = requireRole(request);
    if (response) return response;
    const db = getDb();
    const className = new URL(request.url).searchParams.get('class');

    if (session.role === 'student') {
        const student = db.prepare('SELECT class_name FROM students WHERE user_id = ?').get(session.id);
        if (!student) return json([]);
        return json(db.prepare(`${BASE} WHERE sc.class_name = ? ORDER BY ${ORDER}`).all(student.class_name));
    }
    if (session.role === 'teacher' && !className) {
        const teacher = db.prepare('SELECT id FROM teachers WHERE user_id = ?').get(session.id);
        if (!teacher) return json([]);
        return json(db.prepare(`${BASE} WHERE sc.teacher_id = ? ORDER BY ${ORDER}`).all(teacher.id));
    }
    if (className) return json(db.prepare(`${BASE} WHERE sc.class_name = ? ORDER BY ${ORDER}`).all(className));
    return json(db.prepare(`${BASE} ORDER BY sc.class_name, ${ORDER}`).all());
}

export async function POST(request) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;
    const body = await readJson(request);
    const { error: msg, value } = validateSlot(body);
    if (msg) return error(msg);

    const db = getDb();
    const clash = db.prepare(`SELECT 1 FROM schedules WHERE class_name = ? AND day_of_week = ? AND start_time < ? AND end_time > ?`)
        .get(value.className, value.day, value.end, value.start);
    if (clash) return error('This class already has a lesson in that time slot', 409);

    const r = db.prepare(`INSERT INTO schedules (class_name, subject, teacher_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(value.className, value.subject, value.teacherId, value.day, value.start, value.end, value.room);
    return json({ success: true, id: Number(r.lastInsertRowid) }, 201);
}
