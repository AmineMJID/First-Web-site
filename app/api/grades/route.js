// Grades API – GET (with pagination), POST (bulk upsert), DELETE (soft) - hardened
import { getDb, notDeleted } from '@/lib/db';
import { json, error, readJson, requireRole, parsePagination, paginatedResponse } from '@/lib/api';
import { validate, gradesBulkSchema } from '@/lib/validators';
import { sanitizeText } from '@/lib/sanitize';
import { logAudit, getClientInfo, AUDIT_ACTIONS } from '@/lib/audit';

const BASE = `SELECT g.*, u.full_name AS student_name, s.student_id AS student_code, s.class_name,
                     tu.full_name AS teacher_name
              FROM grades g
              JOIN students s ON g.student_id = s.id
              JOIN users u ON s.user_id = u.id
              LEFT JOIN teachers t ON g.teacher_id = t.id
              LEFT JOIN users tu ON t.user_id = tu.id`;

export async function GET(request) {
    const { session, response } = requireRole(request);
    if (response) return response;
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const hasPagination = searchParams.has('page') || searchParams.has('limit');
    const studentId = searchParams.get('studentId');
    const term = searchParams.get('term');
    const subject = searchParams.get('subject');
    const className = searchParams.get('class');

    const where = [`${notDeleted('g')}`, `${notDeleted('s')}`, `${notDeleted('u')}`];
    const params = [];
    const countParams = [];

    if (session.role === 'student') {
        const student = db.prepare(`SELECT id FROM students WHERE user_id = ? AND ${notDeleted()}`).get(session.id);
        if (!student) return json(hasPagination ? paginatedResponse([], 0, pagination) : []);
        where.push('g.student_id = ?');
        params.push(student.id);
        countParams.push(student.id);
    } else {
        if (studentId) { where.push('g.student_id = ?'); params.push(studentId); countParams.push(studentId); }
        if (className) { where.push('s.class_name = ?'); params.push(className); countParams.push(className); }
    }
    if (term) { where.push('g.term = ?'); params.push(term); countParams.push(term); }
    if (subject) { where.push('g.subject = ?'); params.push(subject); countParams.push(subject); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    if (hasPagination) {
        const countSql = `SELECT COUNT(*) as total FROM grades g JOIN students s ON g.student_id = s.id JOIN users u ON s.user_id = u.id ${whereClause}`;
        const total = db.prepare(countSql).get(...countParams)?.total || 0;
        const sql = `${BASE} ${whereClause} ORDER BY u.full_name, g.term, g.subject LIMIT ? OFFSET ?`;
        const data = db.prepare(sql).all(...params, pagination.limit, pagination.offset);
        return json(paginatedResponse(data, total, pagination));
    } else {
        const sql = `${BASE} ${whereClause} ORDER BY u.full_name, g.term, g.subject`;
        return json(db.prepare(sql).all(...params));
    }
}

export async function POST(request) {
    const { session, response } = requireRole(request, 'teacher', 'admin');
    if (response) return response;

    const body = await readJson(request);
    if (body?.__payloadTooLarge) return error('Payload too large', 413);

    const validation = validate(gradesBulkSchema, body);
    if (validation.error) return error(validation.error, 400);
    const { grades } = validation.data;

    const db = getDb();
    let teacherId = null;
    if (session.role === 'teacher') {
        teacherId = db.prepare(`SELECT id FROM teachers WHERE user_id = ? AND ${notDeleted()}`).get(session.id)?.id ?? null;
    }

    const upsert = db.prepare(`
        INSERT INTO grades (student_id, teacher_id, subject, grade, max_grade, term, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(student_id, subject, term) DO UPDATE SET
            grade = excluded.grade, max_grade = excluded.max_grade,
            teacher_id = COALESCE(excluded.teacher_id, grades.teacher_id),
            remarks = CASE WHEN excluded.remarks = '' THEN grades.remarks ELSE excluded.remarks END,
            updated_at = CURRENT_TIMESTAMP,
            deleted_at = NULL`);

    const run = db.transaction((items) => {
        for (const g of items) {
            upsert.run(
                Number(g.studentId), 
                teacherId ?? (g.teacherId ?? null), 
                sanitizeText(g.subject, 60), 
                Number(g.grade),
                Number(g.maxGrade ?? 100), 
                sanitizeText(g.term, 30) || 'Term 1', 
                sanitizeText(g.remarks, 500)
            );
        }
    });
    run(grades);

    const { ip, userAgent } = getClientInfo(request);
    logAudit({
        userId: session.id,
        action: AUDIT_ACTIONS.GRADE_UPSERT,
        entityType: 'grade',
        details: { count: grades.length, subjects: [...new Set(grades.map(g => g.subject))] },
        ip, userAgent
    });

    return json({ success: true, count: grades.length });
}

// DELETE /api/grades?id=123 (soft delete)
export async function DELETE(request) {
    const { session, response } = requireRole(request, 'teacher', 'admin');
    if (response) return response;
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return error('id is required');
    const db = getDb();
    const grade = db.prepare(`SELECT * FROM grades WHERE id = ? AND ${notDeleted()}`).get(id);
    if (!grade) return error('Grade not found', 404);
    if (session.role === 'teacher') {
        const teacher = db.prepare(`SELECT id FROM teachers WHERE user_id = ? AND ${notDeleted()}`).get(session.id);
        if (grade.teacher_id && grade.teacher_id !== teacher?.id) return error('Forbidden', 403);
    }
    db.prepare(`UPDATE grades SET deleted_at = ?, updated_at = ? WHERE id = ?`).run(new Date().toISOString(), new Date().toISOString(), id);

    const { ip, userAgent } = getClientInfo(request);
    logAudit({ userId: session.id, action: AUDIT_ACTIONS.DELETE, entityType: 'grade', entityId: id, ip, userAgent });

    return json({ success: true, softDeleted: true });
}
