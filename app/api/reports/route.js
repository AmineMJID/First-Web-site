// GET /api/reports – admin analytics
import { getDb } from '@/lib/db';
import { json, requireRole } from '@/lib/api';

export async function GET(request) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;
    const db = getDb();

    const totalStudents = db.prepare('SELECT COUNT(*) AS c FROM students').get().c;
    const totalTeachers = db.prepare('SELECT COUNT(*) AS c FROM teachers').get().c;
    const totalClasses = db.prepare('SELECT COUNT(DISTINCT class_name) AS c FROM students').get().c;

    const attendanceStats = db.prepare(`SELECT status, COUNT(*) AS count FROM attendance WHERE date >= date('now', '-30 day') GROUP BY status`).all();
    const totalAttendance = attendanceStats.reduce((s, r) => s + r.count, 0);
    const presentCount = attendanceStats.find((r) => r.status === 'present')?.count || 0;
    const attendanceRate = totalAttendance ? Math.round((presentCount / totalAttendance) * 100) : 0;

    const avgGrade = db.prepare('SELECT AVG(grade * 100.0 / max_grade) AS avg FROM grades').get().avg || 0;

    const gradesBySubject = db.prepare(`
        SELECT subject, ROUND(AVG(grade * 100.0 / max_grade), 1) AS avg, MIN(grade) AS min, MAX(grade) AS max, COUNT(*) AS count
        FROM grades GROUP BY subject ORDER BY subject`).all();

    const gradesByClass = db.prepare(`
        SELECT s.class_name, ROUND(AVG(g.grade * 100.0 / g.max_grade), 1) AS avg, COUNT(DISTINCT s.id) AS students
        FROM grades g JOIN students s ON g.student_id = s.id GROUP BY s.class_name ORDER BY s.class_name`).all();

    const attendanceByClass = db.prepare(`
        SELECT s.class_name, a.status, COUNT(*) AS count
        FROM attendance a JOIN students s ON a.student_id = s.id
        WHERE a.date >= date('now', '-30 day') GROUP BY s.class_name, a.status ORDER BY s.class_name`).all();

    const attendanceTrend = db.prepare(`
        SELECT date, ROUND(100.0 * SUM(status = 'present') / COUNT(*)) AS rate, COUNT(*) AS total
        FROM attendance WHERE date >= date('now', '-14 day') GROUP BY date ORDER BY date`).all();

    const gradeDistribution = db.prepare(`
        SELECT CASE WHEN pct >= 90 THEN 'A' WHEN pct >= 80 THEN 'B' WHEN pct >= 70 THEN 'C' WHEN pct >= 60 THEN 'D' ELSE 'F' END AS band, COUNT(*) AS count
        FROM (SELECT grade * 100.0 / max_grade AS pct FROM grades) GROUP BY band ORDER BY band`).all();

    const topStudents = db.prepare(`
        SELECT u.full_name, s.student_id, s.class_name, ROUND(AVG(g.grade * 100.0 / g.max_grade), 1) AS avg
        FROM grades g JOIN students s ON g.student_id = s.id JOIN users u ON s.user_id = u.id
        GROUP BY s.id ORDER BY avg DESC LIMIT 5`).all();

    const atRiskStudents = db.prepare(`
        SELECT u.full_name, s.student_id, s.class_name,
               ROUND(AVG(g.grade * 100.0 / g.max_grade), 1) AS avg,
               (SELECT ROUND(100.0 * SUM(a.status = 'present') / COUNT(*)) FROM attendance a WHERE a.student_id = s.id) AS attendance_rate
        FROM grades g JOIN students s ON g.student_id = s.id JOIN users u ON s.user_id = u.id
        GROUP BY s.id HAVING avg < 70 OR attendance_rate < 75 ORDER BY avg ASC LIMIT 5`).all();

    const recentStudents = db.prepare(`
        SELECT u.full_name, s.student_id, s.class_name, u.created_at
        FROM users u JOIN students s ON u.id = s.user_id ORDER BY u.created_at DESC, u.id DESC LIMIT 5`).all();

    return json({
        totalStudents, totalTeachers, totalClasses, attendanceRate,
        avgGrade: Math.round(avgGrade * 10) / 10,
        attendanceStats, gradesBySubject, gradesByClass, attendanceByClass, attendanceTrend,
        gradeDistribution, topStudents, atRiskStudents, recentStudents,
    });
}
