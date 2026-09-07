// POST /api/auth/logout - hardened with refresh token cleanup + audit
import { json } from '@/lib/api';
import { COOKIE_NAME, REFRESH_COOKIE_NAME, cookieOptions, refreshCookieOptions } from '@/lib/auth';
import { logAudit, getClientInfo, AUDIT_ACTIONS } from '@/lib/audit';
import { getSession } from '@/lib/auth';

export async function POST(request) {
    const session = getSession(request);
    const { ip, userAgent } = getClientInfo(request);
    if (session?.id) {
        logAudit({ userId: session.id, action: AUDIT_ACTIONS.LOGOUT, ip, userAgent });
    }

    const response = json({ success: true });
    response.cookies.set(COOKIE_NAME, '', { ...cookieOptions(request), maxAge: 0 });
    response.cookies.set(REFRESH_COOKIE_NAME, '', { ...refreshCookieOptions(request), maxAge: 0 });
    response.cookies.set('csrf-token', '', { maxAge: 0, path: '/' });
    return response;
}
