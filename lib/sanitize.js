// XSS Protection + sanitization
// No external dep, pure JS sanitization for messages & user inputs

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
};

export function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'`]/g, (c) => HTML_ESCAPE_MAP[c]);
}

// Strip all HTML tags, keep text content
export function stripHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

// Sanitize message body: allow basic formatting but remove dangerous tags
export function sanitizeMessageBody(input) {
  if (typeof input !== 'string') return '';
  let out = input.trim().slice(0, 5000);
  // Remove script, iframe, object, embed, form, style
  out = out.replace(/<\s*(script|iframe|object|embed|form|style|link|meta|base)[^>]*>.*?<\s*\/\s*\1\s*>/gis, '');
  out = out.replace(/<\s*(script|iframe|object|embed|form|style|link|meta|base)[^>]*\/?>/gi, '');
  // Remove event handlers: on*= 
  out = out.replace(/\s*on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Remove javascript: urls
  out = out.replace(/javascript\s*:/gi, '');
  // Remove data: urls (except images maybe, but block for safety)
  out = out.replace(/data\s*:\s*text\/html/gi, '');
  return out;
}

// Sanitize subject - plain text only, no HTML
export function sanitizeSubject(input) {
  if (typeof input !== 'string') return '';
  return stripHtml(input).slice(0, 200);
}

// General text sanitization for names, etc - no HTML, trimmed
export function sanitizeText(input, maxLen = 500) {
  if (typeof input !== 'string') return '';
  return stripHtml(input).trim().slice(0, maxLen);
}

// Validate payload size (bytes)
export function checkPayloadSize(jsonString, maxBytes = 1024 * 1024) {
  const size = new TextEncoder().encode(jsonString).length;
  return size <= maxBytes;
}
