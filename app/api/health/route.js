import { getDb } from '@/lib/db';
import { json } from '@/lib/api';

export async function GET() {
    const ok = getDb().prepare('SELECT 1 AS ok').get().ok === 1;
    return json({ status: ok ? 'ok' : 'error', time: new Date().toISOString() });
}
