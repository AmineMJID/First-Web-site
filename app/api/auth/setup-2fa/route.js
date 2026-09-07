// GET /api/auth/setup-2fa?tempToken=... – generate a fresh TOTP secret + QR code
import { getDb } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { json, error } from '@/lib/api';
import { createSecret, otpauthUri } from '@/lib/totp';
import QRCode from 'qrcode';

export async function GET(request) {
    try {
        const tempToken = new URL(request.url).searchParams.get('tempToken');
        const decoded = await verifyToken(tempToken);
        if (!decoded?.id || !decoded.temp) return error('Invalid or expired temporary token', 401);

        const user = getDb().prepare('SELECT id, username, two_factor_secret FROM users WHERE id = ?').get(decoded.id);
        if (!user) return error('User not found', 404);
        if (user.two_factor_secret) return error('2FA is already configured', 400);

        const secret = createSecret();
        const qrCodeUrl = await QRCode.toDataURL(otpauthUri(user.username, secret));
        return json({ success: true, secret, qrCodeUrl });
    } catch (e) {
        console.error('Setup 2FA error:', e);
        return error('Internal server error', 500);
    }
}
