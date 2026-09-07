// Persistent rate limiting using SQLite - survives restarts, works across instances on same DB
// Also includes in-memory LRU for performance
import { getDb } from './db.js';

const memoryCache = new Map();
const MEMORY_CACHE_TTL = 60 * 1000; // 1 min

function getMemory(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > MEMORY_CACHE_TTL) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function setMemory(key, value) {
  memoryCache.set(key, { value, ts: Date.now() });
  // Simple LRU: keep max 1000 entries
  if (memoryCache.size > 1000) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
}

// Configs for different endpoints
export const RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, max: 10 }, // 10 per 15 min
  api: { windowMs: 60 * 1000, max: 100 }, // 100 per minute for general API
  create: { windowMs: 60 * 1000, max: 20 }, // 20 creations per minute
  message: { windowMs: 60 * 1000, max: 30 },
};

function getWindowStart(windowMs) {
  return new Date(Date.now() - windowMs).toISOString();
}

export function checkRateLimit(key, config) {
  const db = getDb();
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  try {
    // Clean old entries (probabilistic, 10% chance)
    if (Math.random() < 0.1) {
      db.prepare(`DELETE FROM rate_limits WHERE created_at < ?`).run(windowStart.toISOString());
    }

    const countRow = db.prepare(`
      SELECT COUNT(*) as c FROM rate_limits 
      WHERE key = ? AND created_at >= ?
    `).get(key, windowStart.toISOString());

    const count = countRow?.c || 0;

    if (count >= config.max) {
      const oldest = db.prepare(`
        SELECT created_at FROM rate_limits 
        WHERE key = ? AND created_at >= ? 
        ORDER BY created_at ASC LIMIT 1
      `).get(key, windowStart.toISOString());

      let retryAfter = config.windowMs;
      if (oldest) {
        const oldestTime = new Date(oldest.created_at).getTime();
        retryAfter = Math.max(0, (oldestTime + config.windowMs) - Date.now());
      }

      return { allowed: false, remaining: 0, retryAfter, count };
    }

    // Record this attempt
    db.prepare(`INSERT INTO rate_limits (key, created_at) VALUES (?, ?)`).run(key, now.toISOString());

    return { allowed: true, remaining: config.max - count - 1, retryAfter: 0, count: count + 1 };
  } catch (e) {
    // Fallback to memory cache if DB fails
    console.error('[rateLimit] DB error, fallback to memory:', e.message);
    const memKey = `rl:${key}`;
    let entries = getMemory(memKey) || [];
    const cutoff = Date.now() - config.windowMs;
    entries = entries.filter(t => t > cutoff);
    if (entries.length >= config.max) {
      const oldest = entries[0];
      const retryAfter = Math.max(0, (oldest + config.windowMs) - Date.now());
      return { allowed: false, remaining: 0, retryAfter, count: entries.length };
    }
    entries.push(Date.now());
    setMemory(memKey, entries);
    return { allowed: true, remaining: config.max - entries.length, retryAfter: 0, count: entries.length };
  }
}

export function rateLimitKey(request, suffix = '') {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'anon';
  return `${ip}:${userId}:${suffix}`.slice(0, 200);
}

export function rateLimitResponse(retryAfter) {
  const seconds = Math.ceil(retryAfter / 1000);
  return {
    error: `Too many requests. Try again in ${seconds}s.`,
    retryAfter: seconds,
  };
}
