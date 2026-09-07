// Small helpers shared by API route handlers - hardened version
import { NextResponse } from 'next/server';
import { getSession } from './auth.js';
import { checkPayloadSize } from './sanitize.js';

export const json = (data, status = 200, extraHeaders = {}) => {
  const response = NextResponse.json(data, { status });
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  Object.entries(extraHeaders).forEach(([k, v]) => response.headers.set(k, v));
  return response;
};

export const error = (message, status = 400, extra = {}) => {
  return json({ error: message, ...extra }, status);
};

// Ensure the request comes from an authenticated user with one of the given roles
export function requireRole(request, ...roles) {
    const session = getSession(request);
    if (!session) return { response: error('Unauthorized', 401) };
    if (roles.length && !roles.includes(session.role)) return { response: error('Forbidden', 403) };
    return { session };
}

// Read JSON with payload size limit (1MB default)
export async function readJson(request, maxBytes = 1024 * 1024) {
    try {
        const text = await request.text();
        if (!checkPayloadSize(text, maxBytes)) {
            return { __payloadTooLarge: true };
        }
        if (!text) return null;
        return JSON.parse(text);
    } catch {
        return null;
    }
}

// Pagination helper
export function parsePagination(searchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
  const offset = (page - 1) * limit;
  const search = (searchParams.get('search') || '').trim().slice(0, 200);
  const sortBy = (searchParams.get('sortBy') || '').trim().slice(0, 50);
  const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'DESC' : 'ASC';
  return { page, limit, offset, search, sortBy, sortOrder };
}

export function paginatedResponse(data, total, pagination) {
  const totalPages = Math.ceil(total / pagination.limit);
  return {
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    }
  };
}

// Legacy helpers kept for compatibility but now backed by zod
export const isValidDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const isValidTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const clampStr = (s, max = 500) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

// Build a unique, URL-safe username from a full name
export function uniqueUsername(db, fullName) {
    const base = fullName
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user';
    let username = base;
    let n = 1;
    while (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) username = `${base}${n++}`;
    return username;
}

// Generate a readable temporary password - now 12 chars, no ambiguous chars
export function tempPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    for (const b of bytes) out += alphabet[b % alphabet.length];
    return out;
}

// Next sequential code like STU-004 / TCH-002
export function nextCode(db, table, column, prefix) {
    const row = db.prepare(`SELECT ${column} AS code FROM ${table} ORDER BY id DESC LIMIT 1`).get();
    const n = row ? parseInt(row.code.split('-')[1], 10) + 1 : 1;
    return `${prefix}-${String(n).padStart(3, '0')}`;
}

// Validate with zod and return error response if invalid
export function handleValidation(result) {
  if (result.error) {
    return { response: error(result.error, 400), data: null };
  }
  return { response: null, data: result.data };
}
