'use client';

// Fetch wrapper for API calls from client components.
// Throws an Error with the server-provided message on non-2xx responses.
export async function api(url, { method = 'GET', body, ...rest } = {}) {
    const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        ...rest,
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (res.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login';
    }
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
    return data;
}

// Download an array of objects as CSV (Excel friendly, UTF-8 BOM)
export function downloadCsv(filename, rows, columns) {
    if (!rows?.length) return;
    const cols = columns || Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
    const esc = (v) => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.map((c) => esc(c.label)).join(';'), ...rows.map((r) => cols.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(';'))];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

export const gradeColor = (g) => (g >= 80 ? '#22c55e' : g >= 60 ? '#f59e0b' : '#ef4444');
export const gradeBadge = (g) => (g >= 80 ? 'badge-success' : g >= 60 ? 'badge-warning' : 'badge-danger');

export const SUBJECT_COLORS = {
    Mathematics: '#3b82f6', English: '#22c55e', Physics: '#f59e0b',
    Chemistry: '#ef4444', Biology: '#8b5cf6', History: '#ec4899',
};
export const subjectColor = (s) => SUBJECT_COLORS[s] || '#64748b';

export const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
