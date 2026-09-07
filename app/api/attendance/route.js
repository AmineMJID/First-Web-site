// Attendance API – GET (paginated), POST (bulk upsert) - hardened
import { getDb, notDeleted } from '@/lib/db';
import { json, error, readJson, requireRole, parsePagination, paginatedResponse } from '@/lib/api';
import { validate, attendanceBulkSchema } from '@/lib/validators';
import { sanitizeText } from '@/lib/sanitize';
import { logAudit, getClientInfo, AUDIT_ACTIONS } from '@/lib/audit';

export async function GET(request) {
    const { session, response } = requireRole(request);
    if (response) return response;
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const hasPagination = searchParams.has('page') || searchParams.has('limit');
    const date = searchParams.get('date');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const className = searchParams.get('class');
    const studentId = searchParams.get('studentId');

    const where = [`${notDeleted('a')}`, `${notDeleted('s')}`, `${notDeleted('u')}`];
    const params = [];
    const countParams = [];

    if (session.role === 'student') {
        const student = db.prepare(`SELECT id FROM students WHERE user_id = ? AND ${notDeleted()}`).get(session.id);
        if (!student) return json(hasPagination ? paginatedResponse([], 0, pagination) : []);
        where.push('a.student_id = ?');
        params.push(student.id);
        countParams.push(student.id);
    } else if (studentId) {
        where.push('a.student_id = ?');
        params.push(studentId);
        countParams.push(studentId);
    }
    if (date) { where.push('a.date = ?'); params.push(date); countParams.push(date); }
    if (from) { where.push('a.date >= ?'); params.push(from); countParams.push(from); }
    if (to) { where.push('a.date <= ?'); params.push(to); countParams.push(to); }
    if (className) { where.push('s.class_name = ?'); params.push(className); countParams.push(className); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    if (hasPagination) {
        const countSql = `SELECT COUNT(*) as total FROM attendance a JOIN students s ON a.student_id = s.id JOIN users u ON s.user_id = u.id ${whereClause}`;
        const total = db.prepare(countSql).get(...countParams)?.total || 0;
        const sql = `SELECT a.*, u.full_name AS student_name, s.student_id AS student_code, s.class_name
                     FROM attendance a
                     JOIN students s ON a.student_id = s.id
                     JOIN users u ON s.user_id = u.id
                     ${whereClause}
                     ORDER BY a.date DESC, u.full_name
                     LIMIT ? OFFSET ?`;
        const data = db.prepare(sql).all(...params, pagination.limit, pagination.offset);
        return json(paginatedResponse(data, total, pagination));
    } else {
        const sql = `SELECT a.*, u.full_name AS student_name, s.student_id AS student_code, s.class_name
                     FROM attendance a
                     JOIN students s ON a.student_id = s.id
                     JOIN users u ON s.user_id = u.id
                     ${whereClause}
                     ORDER BY a.date DESC, u.full_name`;
        return json(db.prepare(sql).all(...params));
    }
}

export async function POST(request) {
    const { session, response } = requireRole(request, 'teacher', 'admin');
    if (response) return response;

    const body = await readJson(request);
    if (body?.__payloadTooLarge) return error('Payload too large', 413);

    const validation = validate(attendanceBulkSchema, body);
    if (validation.error) return error(validation.error, 400);
    const { records } = validation.data;

    const db = getDb();
    let teacherId = null;
    if (session.role === 'teacher') {
        teacherId = db.prepare(`SELECT id FROM teachers WHERE user_id = ? AND ${notDeleted()}`).get(session.id)?.id ?? null;
    }

    const upsert = db.prepare(`
        INSERT INTO attendance (student_id, date, status, recorded_by, notes) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(student_id, date) DO UPDATE SET
            status = excluded.status, recorded_by = excluded.recorded_by, notes = excluded.notes, updated_at = CURRENT_TIMESTAMP, deleted_at = NULL`);
    const run = db.transaction((items) => {
        for (const r of items) upsert.run(Number(r.studentId), r.date, r.status, teacherId, sanitizeText(r.notes, 200));
    });
    run(records);

    const { ip, userAgent } = getClientInfo(request);
    logAudit({
        userId: session.id,
        action: AUDIT_ACTIONS.ATTENDANCE_RECORD,
        entityType: 'attendance',
        details: { count: records.length, date: records[0]?.date },
        ip, userAgent
    });

    return json({ success: true, count: records.length });
}
