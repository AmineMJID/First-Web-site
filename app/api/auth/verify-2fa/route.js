// POST /api/auth/verify-2fa – validate TOTP code and open the session - hardened
import { getDb, notDeleted } from '@/lib/db';
import { verifyToken, signToken, signRefreshToken, sessionPayload, publicUser, cookieOptions, refreshCookieOptions, COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/auth';
import { json, error, readJson } from '@/lib/api';
import { verifyCode } from '@/lib/totp';
import { logAudit, getClientInfo, AUDIT_ACTIONS } from '@/lib/audit';

export async function POST(request) {
    try {
        const body = await readJson(request);
        if (body?.__payloadTooLarge) return error('Payload too large', 413);

        const tempToken = body?.tempToken;
        const code = String(body?.code || '').replace(/\s+/g, '');
        const setupSecret = body?.setupSecret;
        if (!tempToken || !code) return error('Token and code are required');

        const decoded = await verifyToken(tempToken);
        if (!decoded?.id || !decoded.temp) return error('Invalid or expired temporary token', 401);

        const db = getDb();
        const user = db.prepare(`SELECT * FROM users WHERE id = ? AND ${notDeleted()}`).get(decoded.id);
        if (!user) return error('User not found', 404);
        if (user.deleted_at) return error('Account deactivated', 403);

        let secret = user.two_factor_secret;
        const firstSetup = !secret;
        if (firstSetup) {
            if (!setupSecret) return error('Setup secret is missing for first-time configuration');
            secret = setupSecret;
        }

        if (!(await verifyCode(secret, code))) {
            const { ip, userAgent } = getClientInfo(request);
            logAudit({ userId: user.id, action: AUDIT_ACTIONS.LOGIN_FAILED, details: { reason: 'invalid_2fa' }, ip, userAgent });
            return error('Invalid 2FA code', 401);
        }

        if (firstSetup) db.prepare('UPDATE users SET two_factor_secret = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(secret, user.id);

        const token = await signToken(sessionPayload(user));
        const refresh = await signRefreshToken(sessionPayload(user));
        const response = json({ success: true, user: publicUser(user) });
        response.cookies.set(COOKIE_NAME, token, cookieOptions(request));
        response.cookies.set(REFRESH_COOKIE_NAME, refresh, refreshCookieOptions(request));

        const { ip, userAgent } = getClientInfo(request);
        logAudit({ userId: user.id, action: firstSetup ? AUDIT_ACTIONS.TWO_FA_SETUP : AUDIT_ACTIONS.TWO_FA_VERIFY, entityType: 'user', entityId: user.id, ip, userAgent });

        return response;
    } catch (e) {
        console.error('Verify 2FA error:', e.message);
        return error('Internal server error', 500);
    }
}
