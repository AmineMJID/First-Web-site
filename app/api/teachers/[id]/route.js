// Teachers [id] API – PUT, DELETE, POST (reset password / reset 2FA)
import { getDb } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { json, error, readJson, requireRole, tempPassword, clampStr } from '@/lib/api';

export async function PUT(request, { params }) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const body = await readJson(request);
    if (!body) return error('Invalid body');

    const db = getDb();
    const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id);
    if (!teacher) return error('Teacher not found', 404);

    const update = db.transaction(() => {
        db.prepare('UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(clampStr(body.fullName, 100) || null, body.email !== undefined ? clampStr(body.email, 120) : null, teacher.user_id);
        db.prepare(`UPDATE teachers SET subject = COALESCE(?, subject), department = COALESCE(?, department), phone = COALESCE(?, phone) WHERE id = ?`)
            .run(clampStr(body.subject, 60) || null, clampStr(body.department, 60) || null, body.phone ?? null, id);
    });
    update();
    return json({ success: true });
}

export async function POST(request, { params }) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const body = await readJson(request);
    const db = getDb();
    const teacher = db.prepare('SELECT user_id FROM teachers WHERE id = ?').get(id);
    if (!teacher) return error('Teacher not found', 404);

    if (body?.action === 'reset-password') {
        const password = tempPassword();
        db.prepare('UPDATE users SET password = ?, must_change_password = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(hashPassword(password), teacher.user_id);
        return json({ success: true, password });
    }
    if (body?.action === 'reset-2fa') {
        db.prepare('UPDATE users SET two_factor_secret = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(teacher.user_id);
        return json({ success: true });
    }
    return error('Unknown action');
}

export async function DELETE(request, { params }) {
    const { response } = requireRole(request, 'admin');
    if (response) return response;
    const { id } = await params;
    const db = getDb();
    const teacher = db.prepare('SELECT user_id FROM teachers WHERE id = ?').get(id);
    if (!teacher) return error('Teacher not found', 404);
    db.prepare('DELETE FROM users WHERE id = ?').run(teacher.user_id);
    return json({ success: true });
}
