// Canonical, bounded conversation projection. Never includes tool output or reasoning.
export const HISTORY_LIMIT = 6;
export function redactText(value, secrets = [], limit = 16000) {
  let text = typeof value === 'string' ? value : '';
  for (const secret of secrets) if (secret) text = text.split(secret).join('[скрыто]');
  return text.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [скрыто]')
    .replace(/\b(token|password|secret|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi, '$1: [скрыто]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g, '[скрыто]').slice(0,limit);
}
export function boundHistory(rows, secrets = []) {
  return (Array.isArray(rows) ? rows : []).slice(-HISTORY_LIMIT).filter(e=>e && typeof e.requestId==='string')
    .map(e=>({requestId:e.requestId.slice(0,100),turnId:typeof e.turnId==='string'?e.turnId.slice(0,100):'',
      user:redactText(e.user,secrets,8000),assistant:redactText(e.assistant,secrets,16000),completed:e.completed===true}));
}
export function startExchange(session, requestId, text, secrets) {
  session.history=boundHistory(session.history,secrets);
  if(!session.history.some(e=>e.requestId===requestId))session.history.push({requestId,turnId:'',user:redactText(text,secrets,8000),assistant:'',completed:false});
  session.history=session.history.slice(-HISTORY_LIMIT);
}
export function updateExchange(session, secrets) {
  const rows=session.history || [];
  const entry=rows.find(e=>session.turnId && e.turnId===session.turnId) || rows.findLast(e=>!e.turnId && !e.completed);
  if(!entry)return;
  if(session.turnId)entry.turnId=session.turnId;
  if(session.status==='Done' && session.turnId){entry.assistant=redactText(session.text,secrets);entry.completed=true;}
}
export function hydrateHistory(session, turns, secrets) {
  if(!Array.isArray(turns))return;
  const previous=boundHistory(session.history,secrets);
  const projected=turns.slice(-HISTORY_LIMIT).filter(t=>typeof t.id==='string').map(t=>{
    const prior=previous.find(e=>e.turnId===t.id);
    const items=Array.isArray(t.items)?t.items:[];
    const user=items.filter(i=>i.type==='userMessage').flatMap(i=>Array.isArray(i.content)?i.content:[]).filter(i=>i.type==='text'&&typeof i.text==='string').map(i=>i.text).join('\n');
    const final=items.filter(i=>i.type==='agentMessage'&&i.phase!=='commentary').at(-1);
    const completed=t.status==='completed';
    return {requestId:prior?.requestId || t.id,turnId:t.id,user:user || prior?.user || '',
      assistant:completed?(final?.text ?? prior?.assistant ?? ''):'',completed};
  });
  // A question whose send result is uncertain must not be silently associated with an unrelated turn.
  const pending=previous.filter(e=>!e.turnId);
  const retained=previous.filter(e=>e.turnId && !projected.some(p=>p.turnId===e.turnId));
  session.history=boundHistory([...retained,...projected,...pending],secrets);
}
