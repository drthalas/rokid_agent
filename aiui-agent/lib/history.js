// Read-only frontend projection of gateway-owned history; never uploaded as authority.
export const HISTORY_LIMIT = 6;
export function safeText(value, token, limit) {
  let s = typeof value === 'string' ? value : '';
  if (token) s = s.split(token).join('[скрыто]');
  return s.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [скрыто]')
    .replace(/\b(token|password|secret|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi, '$1: [скрыто]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g, '[скрыто]').slice(0, limit);
}
export function boundedHistory(value, sessionId, token) {
  if (!value || value.sessionId !== sessionId || typeof value.threadId !== 'string') return { sessionId, threadId: '', exchanges: [] };
  const seen = new Set();
  const exchanges = (Array.isArray(value.exchanges) ? value.exchanges : []).slice(-HISTORY_LIMIT).filter(e => {
    if (!e || typeof e.requestId !== 'string' || e.requestId.length > 100 || !/^[a-z0-9-]+$/i.test(e.requestId) || seen.has(e.requestId)) return false;
    seen.add(e.requestId); return true;
  }).map(e => ({ requestId: e.requestId, turnId: typeof e.turnId === 'string' ? e.turnId.slice(0, 100) : '',
    user: safeText(e.user, token, 8000), assistant: safeText(e.assistant, token, 16000), completed: e.completed === true }));
  return { sessionId, threadId: value.threadId.slice(0, 100), exchanges };
}
