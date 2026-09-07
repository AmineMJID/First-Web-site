// Grades API – GET, POST (bulk upsert)
import { getDb } from '@/lib/db';
import { json, error, readJson, requireRole, clampStr } from '@/lib/api';

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
    const studentId = searchParams.get('studentId');
    const term = searchParams.get('term');
    const subject = searchParams.get('subject');
    const className = searchParams.get('class');

    const where = [];
    const params = [];

    if (session.role === 'student') {
        const student = db.prepare('SELECT id FROM students WHERE user_id = ?').get(session.id);
        if (!student) return json([]);
        where.push('g.student_id = ?');
        params.push(student.id);
    } else {
        if (studentId) { where.push('g.student_id = ?'); params.push(studentId); }
        if (className) { where.push('s.class_name = ?'); params.push(className); }
    }
    if (term) { where.push('g.term = ?'); params.push(term); }
    if (subject) { where.push('g.subject = ?'); params.push(subject); }

    const sql = `${BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.full_name, g.term, g.subject`;
    return json(db.prepare(sql).all(...params));
}

export async function POST(request) {
    const { session, response } = requireRole(request, 'teacher', 'admin');
    if (response) return response;

    const body = await readJson(request);
    const grades = Array.isArray(body?.grades) ? body.grades : null;
    if (!grades || grades.length === 0) return error('grades[] is required');

    const db = getDb();
    let teacherId = null;
    if (session.role === 'teacher') {
        teacherId = db.prepare('SELECT id FROM teachers WHERE user_id = ?').get(session.id)?.id ?? null;
    }

    // Validate everything first
    for (const g of grades) {
        const grade = Number(g.grade);
        const max = Number(g.maxGrade ?? 100);
        if (!Number.isInteger(Number(g.studentId))) return error('Invalid studentId');
        if (!clampStr(g.subject, 60)) return error('Subject is required');
        if (!Number.isFinite(grade) || grade < 0 || grade > max) return error(`Grade must be between 0 and ${max}`);
    }

    const upsert = db.prepare(`
        INSERT INTO grades (student_id, teacher_id, subject, grade, max_grade, term, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(student_id, subject, term) DO UPDATE SET
            grade = excluded.grade, max_grade = excluded.max_grade,
            teacher_id = COALESCE(excluded.teacher_id, grades.teacher_id),
            remarks = CASE WHEN excluded.remarks = '' THEN grades.remarks ELSE excluded.remarks END,
            created_at = CURRENT_TIMESTAMP`);

    const run = db.transaction((items) => {
        for (const g of items) {
            upsert.run(Number(g.studentId), teacherId ?? (g.teacherId ?? null), clampStr(g.subject, 60), Number(g.grade),
                Number(g.maxGrade ?? 100), clampStr(g.term, 30) || 'Term 1', clampStr(g.remarks, 300));
        }
    });
    run(grades);
    return json({ success: true, count: grades.length });
}

// DELETE /api/grades?id=123
export async function DELETE(request) {
    const { session, response } = requireRole(request, 'teacher', 'admin');
    if (response) return response;
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return error('id is required');
    const db = getDb();
    const grade = db.prepare('SELECT * FROM grades WHERE id = ?').get(id);
    if (!grade) return error('Grade not found', 404);
    if (session.role === 'teacher') {
        const teacher = db.prepare('SELECT id FROM teachers WHERE user_id = ?').get(session.id);
        if (grade.teacher_id && grade.teacher_id !== teacher?.id) return error('Forbidden', 403);
    }
    db.prepare('DELETE FROM grades WHERE id = ?').run(id);
    return json({ success: true });
}
