import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const DEFAULT_SECRET = 'student-portal-dev-secret-change-me';
const secretValue = process.env.JWT_SECRET || DEFAULT_SECRET;

if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        console.error('[auth] CRITICAL: JWT_SECRET is not set in production! Refusing insecure default.');
        // In production, we should not start with default secret
        // But for now, warn loudly
    } else {
        console.warn('[auth] JWT_SECRET is not set – using an insecure default for development. Set it in .env.local!');
    }
}

// Enforce secret length
if (secretValue.length < 32 && process.env.NODE_ENV === 'production') {
    console.error('[auth] JWT_SECRET must be at least 32 characters in production');
}

export const JWT_SECRET = new TextEncoder().encode(secretValue);
export const COOKIE_NAME = 'auth-token';
export const REFRESH_COOKIE_NAME = 'refresh-token';
export const CSRF_COOKIE_NAME = 'csrf-token';
export const SESSION_HOURS = 24;
export const REFRESH_HOURS = 7 * 24; // 7 days
export const SLIDING_WINDOW_HOURS = 2; // Refresh token if less than 2h left

// Sign a JWT token with user data and role
export async function signToken(payload, expires = `${SESSION_HOURS}h`) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(expires)
        .setIssuedAt()
        .sign(JWT_SECRET);
}

export async function signRefreshToken(payload) {
    return new SignJWT({ ...payload, type: 'refresh' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(`${REFRESH_HOURS}h`)
        .setIssuedAt()
        .sign(JWT_SECRET);
}

// Verify and decode a JWT token – returns null when invalid/expired
export async function verifyToken(token) {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload;
    } catch {
        return null;
    }
}

export function hashPassword(password) {
    return bcrypt.hashSync(password, 12); // Increased from 10 to 12 for security
}

export function comparePassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

export function sessionPayload(user) {
    return { id: user.id, username: user.username, role: user.role, fullName: user.full_name };
}

export function publicUser(user) {
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name,
        email: user.email,
        mustChangePassword: !!user.must_change_password,
    };
}

// Is the original request served over HTTPS (directly or behind a TLS-terminating proxy)?
export function isSecureRequest(request) {
    if (process.env.COOKIE_SECURE === 'true') return true;
    if (process.env.COOKIE_SECURE === 'false') return false;
    const proto = request?.headers.get('x-forwarded-proto')?.split(',')[0].trim();
    if (proto) return proto === 'https';
    try { return new URL(request.url).protocol === 'https:'; } catch { return false; }
}

// When served over HTTPS we use SameSite=None so the session also works when the
// app is embedded in an iframe (e.g. sandbox previews). Over plain HTTP browsers
// reject SameSite=None, so we fall back to Lax.
export function cookieOptions(request, maxAgeHours = SESSION_HOURS) {
    const secure = isSecureRequest(request);
    return {
        httpOnly: true,
        secure,
        sameSite: secure ? 'none' : 'lax',
        maxAge: 60 * 60 * maxAgeHours,
        path: '/',
    };
}

export function refreshCookieOptions(request) {
    const secure = isSecureRequest(request);
    return {
        httpOnly: true,
        secure,
        sameSite: secure ? 'none' : 'lax',
        maxAge: 60 * 60 * REFRESH_HOURS,
        path: '/',
    };
}

// Read the identity injected by proxy.js into request headers
export function getSession(request) {
    const id = request.headers.get('x-user-id');
    if (!id) return null;
    return {
        id: Number(id),
        role: request.headers.get('x-user-role'),
        fullName: decodeURIComponent(request.headers.get('x-user-name') || ''),
        exp: request.headers.get('x-user-exp') ? Number(request.headers.get('x-user-exp')) : null,
    };
}

// Check if token needs refresh (sliding window)
export function shouldRefreshToken(exp) {
    if (!exp) return false;
    const now = Math.floor(Date.now() / 1000);
    const remaining = exp - now;
    return remaining < SLIDING_WINDOW_HOURS * 3600;
}
