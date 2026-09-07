// GET /api/audit - admin only, view audit logs with pagination
import { getDb } from '@/lib/db';
import { json, requireRole, parsePagination, paginatedResponse } from '@/lib/api';

export async function GET(request) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;

    const db = getDb();
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const action = searchParams.get('action');
    const entityType = searchParams.get('entityType');
    const userId = searchParams.get('userId');

    let where = [];
    let params = [];
    let countParams = [];

    if (action) { where.push('action = ?'); params.push(action); countParams.push(action); }
    if (entityType) { where.push('entity_type = ?'); params.push(entityType); countParams.push(entityType); }
    if (userId) { where.push('user_id = ?'); params.push(userId); countParams.push(userId); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const total = db.prepare(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`).get(...countParams)?.total || 0;

    const logs = db.prepare(`
        SELECT a.*, u.full_name, u.username, u.role
        FROM audit_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, pagination.limit, pagination.offset);

    return json(paginatedResponse(logs, total, pagination));
}
