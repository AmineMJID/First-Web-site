// Audit logging - tracks who did what
import { getDb } from './db.js';

export const AUDIT_ACTIONS = {
  LOGIN: 'login',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  RESET_PASSWORD: 'reset_password',
  CHANGE_PASSWORD: 'change_password',
  GRADE_UPSERT: 'grade_upsert',
  ATTENDANCE_RECORD: 'attendance_record',
  MESSAGE_SEND: 'message_send',
  MESSAGE_DELETE: 'message_delete',
  SCHEDULE_CREATE: 'schedule_create',
  SCHEDULE_UPDATE: 'schedule_update',
  SCHEDULE_DELETE: 'schedule_delete',
  TWO_FA_SETUP: '2fa_setup',
  TWO_FA_VERIFY: '2fa_verify',
};

export function logAudit({ userId = null, action, entityType = null, entityId = null, details = null, ip = null, userAgent = null }) {
  try {
    const db = getDb();
    // Never log passwords or secrets
    let safeDetails = null;
    if (details) {
      const copy = typeof details === 'string' ? { message: details } : { ...details };
      // Scrub sensitive fields
      const sensitive = ['password', 'newPassword', 'currentPassword', 'secret', 'two_factor_secret', 'tempToken', 'token'];
      for (const key of sensitive) {
        if (key in copy) copy[key] = '[REDACTED]';
      }
      safeDetails = JSON.stringify(copy).slice(0, 2000);
    }

    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      action,
      entityType,
      entityId ? String(entityId) : null,
      safeDetails,
      ip ? String(ip).slice(0, 100) : null,
      userAgent ? String(userAgent).slice(0, 300) : null
    );
  } catch (e) {
    // Audit log should never break main flow
    console.error('[audit] failed to log:', e.message);
  }
}

export function getClientInfo(request) {
  const ip = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request?.headers.get('x-real-ip') || 'unknown';
  const ua = request?.headers.get('user-agent') || null;
  return { ip, userAgent: ua };
}
