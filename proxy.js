// Next.js 16 proxy (formerly middleware.js): route protection + role-based access.
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

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

export async function proxy(request) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get('auth-token')?.value;

    let payload = null;
    if (token) {
        try {
            payload = (await jwtVerify(token, JWT_SECRET)).payload;
            // Temporary 2FA tokens must never open a session
            if (payload.temp) payload = null;
        } catch {
            payload = null;
        }
    }

    // Public routes – but bounce already-authenticated users away from /login
    if (PUBLIC_PATHS.has(pathname)) {
        if (pathname === '/login' && payload) {
            return NextResponse.redirect(new URL(`/dashboard/${payload.role}`, request.url));
        }
        return NextResponse.next();
    }

    if (!payload) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const login = new URL('/login', request.url);
        if (pathname !== '/') login.searchParams.set('next', pathname);
        const response = NextResponse.redirect(login);
        if (token) response.cookies.delete('auth-token');
        return response;
    }

    if (pathname === '/' || pathname === '/dashboard') {
        return NextResponse.redirect(new URL(`/dashboard/${payload.role}`, request.url));
    }

    // Role guard for /dashboard/<role>/...  (shared pages like /dashboard/settings are allowed)
    if (pathname.startsWith('/dashboard/')) {
        const section = pathname.split('/')[2];
        const roles = ['admin', 'teacher', 'student'];
        if (roles.includes(section) && section !== payload.role) {
            return NextResponse.redirect(new URL(`/dashboard/${payload.role}`, request.url));
        }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', String(payload.id));
    requestHeaders.set('x-user-role', payload.role);
    requestHeaders.set('x-user-name', encodeURIComponent(payload.fullName || ''));
    return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
    matcher: ['/', '/login', '/dashboard/:path*', '/api/:path*'],
};
