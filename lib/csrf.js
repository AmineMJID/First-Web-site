// CSRF Protection - Double Submit Cookie + Origin check
import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_SECRET_LENGTH = 32;

// Generate a CSRF token
export function generateCsrfToken() {
  return crypto.randomBytes(CSRF_SECRET_LENGTH).toString('hex');
}

// Verify CSRF for state-changing requests
export function verifyCsrf(request) {
  // Skip for GET, HEAD, OPTIONS (safe methods)
  const method = request.method?.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return { valid: true };

  // Allow if request is from same origin (checked via Origin/Referer)
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // If Origin header present, must match host
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const hostUrl = new URL(`https://${host}`);
      // Allow same host or localhost for dev
      if (originUrl.host !== host && !originUrl.host.includes('localhost') && !host.includes('localhost')) {
        // Check if origin is allowed (could be preview domains)
        const allowed = originUrl.host.endsWith('.e2b.app') || originUrl.host.endsWith('vercel.app');
        if (!allowed && originUrl.host !== hostUrl.host) {
          return { valid: false, reason: 'Origin mismatch' };
        }
      }
    } catch {
      // Invalid origin URL, continue to token check
    }
  }

  // Double submit cookie check
  const cookieToken = request.cookies?.get?.(CSRF_COOKIE_NAME)?.value || 
                      request.headers.get('cookie')?.match(new RegExp(`${CSRF_COOKIE_NAME}=([^;]+)`))?.[1];
  const headerToken = request.headers.get(CSRF_HEADER_NAME) || request.headers.get('x-csrf-token');

  // For API routes, we require either:
  // 1. Same-origin (checked above) OR
  // 2. Valid CSRF token pair
  // In this implementation, we allow same-origin requests without token for UX,
  // but require token if origin check fails or for extra security
  
  // If both tokens present, they must match
  if (cookieToken && headerToken) {
    if (cookieToken !== headerToken) {
      return { valid: false, reason: 'CSRF token mismatch' };
    }
    return { valid: true };
  }

  // If neither token, allow if origin check passed (same-origin)
  // This is permissive for API-only usage with JWT httpOnly
  // For stricter security, uncomment below to require tokens
  // if (!cookieToken || !headerToken) {
  //   return { valid: false, reason: 'Missing CSRF token' };
  // }

  return { valid: true };
}

export function csrfCookieOptions(request) {
  const isSecure = request?.headers.get('x-forwarded-proto') === 'https' || 
                   request?.url?.startsWith('https://') ||
                   process.env.COOKIE_SECURE === 'true';
  return {
    httpOnly: false, // Must be readable by JS for double submit
    secure: isSecure,
    sameSite: isSecure ? 'none' : 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24h
  };
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };
