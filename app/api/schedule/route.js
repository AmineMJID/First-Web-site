// Schedule API – GET (role aware), POST (admin create) - hardened
import { getDb, notDeleted } from '@/lib/db';
import { json, error, readJson, requireRole, parsePagination, paginatedResponse } from '@/lib/api';
import { DAYS, validateSlot } from '@/lib/schedule';
import { logAudit, getClientInfo, AUDIT_ACTIONS } from '@/lib/audit';

const ORDER = `CASE sc.day_of_week ${DAYS.map((d, i) => `WHEN '${d}' THEN ${i + 1}`).join(' ')} END, sc.start_time`;
const BASE = `SELECT sc.*, u.full_name AS teacher_name FROM schedules sc
              LEFT JOIN teachers t ON sc.teacher_id = t.id
              LEFT JOIN users u ON t.user_id = u.id`;

export async function GET(request) {
    const { session, response } = requireRole(request);
    if (response) return response;
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const className = searchParams.get('class');
    const pagination = parsePagination(searchParams);
    const usePagination = searchParams.has('page');

    let data = [];
    let total = 0;

    if (session.role === 'student') {
        const student = db.prepare(`SELECT class_name FROM students WHERE user_id = ? AND ${notDeleted()}`).get(session.id);
        if (!student) return json(usePagination ? paginatedResponse([], 0, pagination) : []);
        const where = `WHERE sc.class_name = ? AND ${notDeleted('sc')}`;
        if (usePagination) {
            total = db.prepare(`SELECT COUNT(*) as total FROM schedules sc ${where}`).get(student.class_name)?.total || 0;
            data = db.prepare(`${BASE} ${where} ORDER BY ${ORDER} LIMIT ? OFFSET ?`).all(student.class_name, pagination.limit, pagination.offset);
            return json(paginatedResponse(data, total, pagination));
        }
        return json(db.prepare(`${BASE} ${where} ORDER BY ${ORDER}`).all(student.class_name));
    }
    if (session.role === 'teacher' && !className) {
        const teacher = db.prepare(`SELECT id FROM teachers WHERE user_id = ? AND ${notDeleted()}`).get(session.id);
        if (!teacher) return json(usePagination ? paginatedResponse([], 0, pagination) : []);
        const where = `WHERE sc.teacher_id = ? AND ${notDeleted('sc')}`;
        if (usePagination) {
            total = db.prepare(`SELECT COUNT(*) as total FROM schedules sc ${where}`).get(teacher.id)?.total || 0;
            data = db.prepare(`${BASE} ${where} ORDER BY ${ORDER} LIMIT ? OFFSET ?`).all(teacher.id, pagination.limit, pagination.offset);
            return json(paginatedResponse(data, total, pagination));
        }
        return json(db.prepare(`${BASE} ${where} ORDER BY ${ORDER}`).all(teacher.id));
    }
    if (className) {
        const where = `WHERE sc.class_name = ? AND ${notDeleted('sc')}`;
        if (usePagination) {
            total = db.prepare(`SELECT COUNT(*) as total FROM schedules sc ${where}`).get(className)?.total || 0;
            data = db.prepare(`${BASE} ${where} ORDER BY ${ORDER} LIMIT ? OFFSET ?`).all(className, pagination.limit, pagination.offset);
            return json(paginatedResponse(data, total, pagination));
        }
        return json(db.prepare(`${BASE} ${where} ORDER BY ${ORDER}`).all(className));
    }
    if (usePagination) {
        total = db.prepare(`SELECT COUNT(*) as total FROM schedules sc WHERE ${notDeleted('sc')}`).get()?.total || 0;
        data = db.prepare(`${BASE} WHERE ${notDeleted('sc')} ORDER BY sc.class_name, ${ORDER} LIMIT ? OFFSET ?`).all(pagination.limit, pagination.offset);
        return json(paginatedResponse(data, total, pagination));
    }
    return json(db.prepare(`${BASE} WHERE ${notDeleted('sc')} ORDER BY sc.class_name, ${ORDER}`).all());
}

export async function POST(request) {
    const { session, response } = requireRole(request, 'admin');
    if (response) return response;
    const body = await readJson(request);
    if (body?.__payloadTooLarge) return error('Payload too large', 413);

    const { error: msg, value } = validateSlot(body);
    if (msg) return error(msg);

    const db = getDb();
    const clash = db.prepare(`SELECT 1 FROM schedules WHERE class_name = ? AND day_of_week = ? AND ${notDeleted()} AND start_time < ? AND end_time > ?`)
        .get(value.className, value.day, value.end, value.start);
    if (clash) return error('This class already has a lesson in that time slot', 409);

    const r = db.prepare(`INSERT INTO schedules (class_name, subject, teacher_id, day_of_week, start_time, end_time, room) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(value.className, value.subject, value.teacherId, value.day, value.start, value.end, value.room);

    const { ip, userAgent } = getClientInfo(request);
    logAudit({ userId: session.id, action: AUDIT_ACTIONS.SCHEDULE_CREATE, entityType: 'schedule', entityId: r.lastInsertRowid, details: value, ip, userAgent });

    return json({ success: true, id: Number(r.lastInsertRowid) }, 201);
}
