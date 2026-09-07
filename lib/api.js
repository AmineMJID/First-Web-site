// Small helpers shared by API route handlers
import { NextResponse } from 'next/server';
import { getSession } from './auth.js';

export const json = (data, status = 200) => NextResponse.json(data, { status });
export const error = (message, status = 400) => NextResponse.json({ error: message }, { status });

// Ensure the request comes from an authenticated user with one of the given roles
export function requireRole(request, ...roles) {
    const session = getSession(request);
    if (!session) return { response: error('Unauthorized', 401) };
    if (roles.length && !roles.includes(session.role)) return { response: error('Forbidden', 403) };
    return { session };
}

export async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

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

// Generate a readable temporary password
export function tempPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    for (const b of bytes) out += alphabet[b % alphabet.length];
    return out;
}

// Next sequential code like STU-004 / TCH-002
export function nextCode(db, table, column, prefix) {
    const row = db.prepare(`SELECT ${column} AS code FROM ${table} ORDER BY id DESC LIMIT 1`).get();
    const n = row ? parseInt(row.code.split('-')[1], 10) + 1 : 1;
    return `${prefix}-${String(n).padStart(3, '0')}`;
}
