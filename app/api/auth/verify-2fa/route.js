// POST /api/auth/verify-2fa – validate TOTP code and open the session
import { getDb } from '@/lib/db';
import { verifyToken, signToken, sessionPayload, publicUser, cookieOptions, COOKIE_NAME } from '@/lib/auth';
import { json, error, readJson } from '@/lib/api';
import { verifyCode } from '@/lib/totp';

export async function POST(request) {
    try {
        const body = await readJson(request);
        const tempToken = body?.tempToken;
        const code = String(body?.code || '').replace(/\s+/g, '');
        const setupSecret = body?.setupSecret;
        if (!tempToken || !code) return error('Token and code are required');

        const decoded = await verifyToken(tempToken);
        if (!decoded?.id || !decoded.temp) return error('Invalid or expired temporary token', 401);

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
        if (!user) return error('User not found', 404);

        let secret = user.two_factor_secret;
        const firstSetup = !secret;
        if (firstSetup) {
            if (!setupSecret) return error('Setup secret is missing for first-time configuration');
            secret = setupSecret;
        }

        if (!(await verifyCode(secret, code))) return error('Invalid 2FA code', 401);

        if (firstSetup) db.prepare('UPDATE users SET two_factor_secret = ? WHERE id = ?').run(secret, user.id);

        const token = await signToken(sessionPayload(user));
        const response = json({ success: true, user: publicUser(user) });
        response.cookies.set(COOKIE_NAME, token, cookieOptions(request));
        return response;
    } catch (e) {
        console.error('Verify 2FA error:', e);
        return error('Internal server error', 500);
    }
}
