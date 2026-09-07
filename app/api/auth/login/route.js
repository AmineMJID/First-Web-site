// POST /api/auth/login
import { getDb, ensureSeeded } from '@/lib/db';
import { comparePassword, signToken, sessionPayload, publicUser, cookieOptions, COOKIE_NAME } from '@/lib/auth';
import { json, error, readJson } from '@/lib/api';

// Very small in-memory rate limiter (per username+ip): 10 attempts / 15 min
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX = 10;
function tooManyAttempts(key) {
    const now = Date.now();
    const entry = attempts.get(key) || [];
    const recent = entry.filter((t) => now - t < WINDOW);
    attempts.set(key, recent);
    return recent.length >= MAX;
}
function recordAttempt(key) {
    attempts.set(key, [...(attempts.get(key) || []), Date.now()]);
}

export async function POST(request) {
    try {
        await ensureSeeded();
        const body = await readJson(request);
        const username = String(body?.username || '').trim().toLowerCase();
        const password = String(body?.password || '');
        if (!username || !password) return error('Username and password required');

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
        const key = `${username}@${ip}`;
        if (tooManyAttempts(key)) return error('Too many attempts. Try again later.', 429);

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE lower(username) = ?').get(username);
        if (!user || !comparePassword(password, user.password)) {
            recordAttempt(key);
            return error('Invalid credentials', 401);
        }
        attempts.delete(key);

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
        const response = json({ success: true, user: publicUser(user) });
        response.cookies.set(COOKIE_NAME, token, cookieOptions(request));
        return response;
    } catch (e) {
        console.error('Login error:', e);
        return error('Internal server error', 500);
    }
}
