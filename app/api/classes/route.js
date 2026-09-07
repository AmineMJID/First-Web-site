// GET /api/classes – distinct classes + subjects (for dropdowns)
import { getDb } from '@/lib/db';
import { json, requireRole } from '@/lib/api';

export async function GET(request) {
    const { response } = requireRole(request);
    if (response) return response;
    const db = getDb();
    const classes = db.prepare(`
        SELECT name, SUM(students) AS students FROM (
            SELECT class_name AS name, COUNT(*) AS students FROM students GROUP BY class_name
            UNION ALL
            SELECT DISTINCT class_name, 0 FROM schedules
        ) GROUP BY name ORDER BY name`).all();
    const subjects = db.prepare(`
        SELECT DISTINCT subject FROM (
            SELECT subject FROM grades UNION SELECT subject FROM schedules UNION SELECT subject FROM teachers WHERE subject IS NOT NULL
        ) ORDER BY subject`).all().map((r) => r.subject);
    return json({ classes, subjects });
}
