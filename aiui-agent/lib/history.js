// Conversation content stays in bounded agent-local storage, never telemetry.
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
    if (!e || !/^[a-f0-9-]{36}$/i.test(e.requestId) || seen.has(e.requestId)) return false;
    seen.add(e.requestId); return true;
  }).map(e => ({ requestId: e.requestId, turnId: typeof e.turnId === 'string' ? e.turnId.slice(0, 100) : '',
    user: safeText(e.user, token, 8000), assistant: safeText(e.assistant, token, 16000), completed: e.completed === true }));
  return { sessionId, threadId: value.threadId.slice(0, 100), exchanges };
}
export function addQuestion(history, requestId, text, token) {
  if (!history.exchanges.some(e => e.requestId === requestId)) history.exchanges.push({ requestId, turnId: '', user: safeText(text, token, 8000), assistant: '', completed: false });
  history.exchanges = history.exchanges.slice(-HISTORY_LIMIT);
}
export function applyAnswer(history, snapshot, token, requestId) {
  if (history.sessionId !== snapshot.id) return false;
  history.threadId = snapshot.threadId;
  const entry = history.exchanges.find(e => requestId ? e.requestId === requestId : snapshot.turnId && e.turnId === snapshot.turnId);
  if (!entry) return false;
  if (snapshot.turnId) entry.turnId = snapshot.turnId;
  if (snapshot.status === 'Done' && snapshot.turnId) { entry.assistant = safeText(snapshot.text, token, 16000); entry.completed = true; }
  return true;
}
