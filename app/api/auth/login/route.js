// POST /api/auth/login - hardened with persistent rate limit, zod, audit log
import { getDb, ensureSeeded, notDeleted } from '@/lib/db';
import { comparePassword, signToken, signRefreshToken, sessionPayload, publicUser, cookieOptions, refreshCookieOptions, COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/auth';
import { json, error, readJson } from '@/lib/api';
import { checkRateLimit, RATE_LIMITS, rateLimitKey, rateLimitResponse } from '@/lib/rateLimit';
import { logAudit, getClientInfo, AUDIT_ACTIONS } from '@/lib/audit';
import { validate, loginSchema } from '@/lib/validators';

export async function POST(request) {
    try {
        await ensureSeeded();
        const body = await readJson(request);
        if (body?.__payloadTooLarge) return error('Payload too large', 413);
        
        const validation = validate(loginSchema, body);
        if (validation.error) return error(validation.error, 400);
        
        const { username, password } = validation.data;

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
        const key = `login:${username}@${ip}`;
        
        // Persistent rate limiting
        const rateLimit = checkRateLimit(key, RATE_LIMITS.login);
        if (!rateLimit.allowed) {
            const { ip: clientIp, userAgent } = getClientInfo(request);
            logAudit({ action: AUDIT_ACTIONS.LOGIN_FAILED, details: { username, reason: 'rate_limited' }, ip: clientIp, userAgent });
            return json(rateLimitResponse(rateLimit.retryAfter), 429);
        }

        const db = getDb();
        const user = db.prepare(`SELECT * FROM users WHERE lower(username) = ? AND ${notDeleted()}`).get(username);
        
        if (!user || !comparePassword(password, user.password)) {
            const { ip: clientIp, userAgent } = getClientInfo(request);
            logAudit({ action: AUDIT_ACTIONS.LOGIN_FAILED, details: { username, reason: 'invalid_credentials' }, ip: clientIp, userAgent });
            return error('Invalid credentials', 401);
        }

        // Check if user is soft-deleted
        if (user.deleted_at) {
            return error('Account deactivated', 403);
        }

        const { ip: clientIp, userAgent } = getClientInfo(request);
        logAudit({ userId: user.id, action: AUDIT_ACTIONS.LOGIN, entityType: 'user', entityId: user.id, details: { username }, ip: clientIp, userAgent });

        // Admins and teachers must complete 2FA before receiving a session
        if (user.role === 'admin' || user.role === 'teacher') {
            const tempToken = await signToken({ ...sessionPayload(user), temp: true }, '10m');
            return json({
                success: true,
                requires2FA: !!user.two_factor_secret,
                requires2FASetup: !user.two_factor_secret,
                tempToken,
            });
        }

        const token = await signToken(sessionPayload(user));
        const refresh = await signRefreshToken(sessionPayload(user));
        const response = json({ success: true, user: publicUser(user) });
        response.cookies.set(COOKIE_NAME, token, cookieOptions(request));
        response.cookies.set(REFRESH_COOKIE_NAME, refresh, refreshCookieOptions(request));
        return response;
    } catch (e) {
        // Never log password
        console.error('Login error:', e.message);
        return error('Internal server error', 500);
    }
}
