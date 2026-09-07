// Next.js 16 proxy (formerly middleware.js): route protection + role-based access + security headers + refresh token
import { NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'student-portal-dev-secret-change-me'
);

const PUBLIC_PATHS = new Set([
    '/login',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/setup-2fa',
    '/api/auth/verify-2fa',
    '/api/health',
]);

const SESSION_HOURS = 24;
const REFRESH_HOURS = 7 * 24;

async function signToken(payload, expires) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(expires)
        .setIssuedAt()
        .sign(JWT_SECRET);
}

export async function proxy(request) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get('auth-token')?.value;
    const refreshToken = request.cookies.get('refresh-token')?.value;

    let payload = null;
    let needsRefresh = false;

    if (token) {
        try {
            const verified = await jwtVerify(token, JWT_SECRET);
            payload = verified.payload;
            // Temporary 2FA tokens must never open a session
            if (payload.temp) payload = null;
            else {
                // Check sliding window - if less than 2h left, refresh
                const now = Math.floor(Date.now() / 1000);
                const remaining = (payload.exp || 0) - now;
                if (remaining < 2 * 3600 && remaining > 0) {
                    needsRefresh = true;
                }
            }
        } catch {
            payload = null;
            // Try refresh token if access token expired
            if (refreshToken) {
                try {
                    const refreshVerified = await jwtVerify(refreshToken, JWT_SECRET);
                    const refreshPayload = refreshVerified.payload;
                    if (refreshPayload.type === 'refresh' && !refreshPayload.temp) {
                        // Issue new access token from refresh token
                        payload = {
                            id: refreshPayload.id,
                            username: refreshPayload.username,
                            role: refreshPayload.role,
                            fullName: refreshPayload.fullName,
                        };
                        needsRefresh = true;
                    }
                } catch {
                    // Refresh also invalid
                }
            }
        }
    }

    // Public routes – but bounce already-authenticated users away from /login
    if (PUBLIC_PATHS.has(pathname)) {
        if (pathname === '/login' && payload) {
            const res = NextResponse.redirect(new URL(`/dashboard/${payload.role}`, request.url));
            // Security headers even for redirects
            addSecurityHeaders(res);
            if (needsRefresh) {
                await attachRefreshedTokens(res, payload, request);
            }
            return res;
        }
        const res = NextResponse.next();
        addSecurityHeaders(res);
        return res;
    }

    if (!payload) {
        if (pathname.startsWith('/api/')) {
            const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            addSecurityHeaders(res);
            if (token) res.cookies.delete('auth-token');
            if (refreshToken) res.cookies.delete('refresh-token');
            return res;
        }
        const login = new URL('/login', request.url);
        if (pathname !== '/') login.searchParams.set('next', pathname);
        const response = NextResponse.redirect(login);
        addSecurityHeaders(response);
        if (token) response.cookies.delete('auth-token');
        if (refreshToken) response.cookies.delete('refresh-token');
        return response;
    }

    if (pathname === '/' || pathname === '/dashboard') {
        const res = NextResponse.redirect(new URL(`/dashboard/${payload.role}`, request.url));
        addSecurityHeaders(res);
        if (needsRefresh) {
            await attachRefreshedTokens(res, payload, request);
        }
        return res;
    }

    // Role guard for /dashboard/<role>/...  (shared pages like /dashboard/settings are allowed)
    if (pathname.startsWith('/dashboard/')) {
        const section = pathname.split('/')[2];
        const roles = ['admin', 'teacher', 'student'];
        if (roles.includes(section) && section !== payload.role) {
            const res = NextResponse.redirect(new URL(`/dashboard/${payload.role}`, request.url));
            addSecurityHeaders(res);
            if (needsRefresh) {
                await attachRefreshedTokens(res, payload, request);
            }
            return res;
        }
    }

    // CSRF check for state-changing methods on API routes (except auth)
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
        const method = request.method.toUpperCase();
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            const origin = request.headers.get('origin');
            const referer = request.headers.get('referer');
            const host = request.headers.get('host');
            // Basic origin check - allow same host, localhost, and preview domains
            if (origin) {
                try {
                    const originUrl = new URL(origin);
                    const isLocalhost = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';
                    const isPreview = originUrl.hostname.endsWith('.e2b.app') || originUrl.hostname.endsWith('vercel.app');
                    const sameHost = originUrl.host === host;
                    if (!isLocalhost && !isPreview && !sameHost) {
                        const res = NextResponse.json({ error: 'Forbidden: Invalid origin' }, { status: 403 });
                        addSecurityHeaders(res);
                        return res;
                    }
                } catch {
                    // Invalid origin, block
                    const res = NextResponse.json({ error: 'Forbidden: Invalid origin' }, { status: 403 });
                    addSecurityHeaders(res);
                    return res;
                }
            }
        }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', String(payload.id));
    requestHeaders.set('x-user-role', payload.role);
    requestHeaders.set('x-user-name', encodeURIComponent(payload.fullName || ''));
    if (payload.exp) requestHeaders.set('x-user-exp', String(payload.exp));

    const res = NextResponse.next({ request: { headers: requestHeaders } });
    addSecurityHeaders(res);

    if (needsRefresh) {
        await attachRefreshedTokens(res, payload, request);
    }

    return res;
}

function addSecurityHeaders(response) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // CSP - allow self, inline styles needed for now, but restrict scripts
    response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self';"
    );
}

async function attachRefreshedTokens(response, payload, request) {
    try {
        const isSecure = request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https://') || process.env.COOKIE_SECURE === 'true';
        const newToken = await signToken(
            { id: payload.id, username: payload.username, role: payload.role, fullName: payload.fullName },
            `${SESSION_HOURS}h`
        );
        const newRefresh = await signToken(
            { id: payload.id, username: payload.username, role: payload.role, fullName: payload.fullName, type: 'refresh' },
            `${REFRESH_HOURS}h`
        );

        response.cookies.set('auth-token', newToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: isSecure ? 'none' : 'lax',
            maxAge: 60 * 60 * SESSION_HOURS,
            path: '/',
        });
        response.cookies.set('refresh-token', newRefresh, {
            httpOnly: true,
            secure: isSecure,
            sameSite: isSecure ? 'none' : 'lax',
            maxAge: 60 * 60 * REFRESH_HOURS,
            path: '/',
        });
    } catch (e) {
        console.error('[proxy] Failed to refresh token:', e.message);
    }
}

export const config = {
    matcher: ['/', '/login', '/dashboard/:path*', '/api/:path*'],
};
