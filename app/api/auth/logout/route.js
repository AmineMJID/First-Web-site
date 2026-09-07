// POST /api/auth/logout
import { json } from '@/lib/api';
import { COOKIE_NAME, cookieOptions } from '@/lib/auth';

export async function POST(request) {
    const response = json({ success: true });
    response.cookies.set(COOKIE_NAME, '', { ...cookieOptions(request), maxAge: 0 });
    return response;
}
