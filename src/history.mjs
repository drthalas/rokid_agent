import { APPROVAL_NOTICES } from './approvals.mjs';
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
      user:redactText(e.user,secrets,8000),assistant:redactText(e.assistant,secrets,16000),completed:e.completed===true,
      outcome:['pending','completed','failed','interrupted','uncertain','no_answer'].includes(e.outcome)?e.outcome:(e.completed?'completed':'pending'),
      approvalNotice:Object.hasOwn(APPROVAL_NOTICES,e.approvalNotice)?e.approvalNotice:null}));
}
export function startExchange(session, requestId, text, secrets) {
  session.history=boundHistory(session.history,secrets);
  if(!session.history.some(e=>e.requestId===requestId))session.history.push({requestId,turnId:'',user:redactText(text,secrets,8000),assistant:'',completed:false});
  session.history=session.history.slice(-HISTORY_LIMIT);
}
const FALLBACK = {
  failed:'Задачу не удалось выполнить. Итоговый ответ от Codex не получен.',
  interrupted:'Задача остановлена. Итоговый ответ от Codex не получен.',
  uncertain:'Состояние задачи неизвестно. Проверьте выполнение на Mac перед повтором.',
  no_answer:'Codex завершил запрос без итогового ответа.',
};
function finalText(text,notice,outcome) {
  const reason=APPROVAL_NOTICES[notice];let value=typeof text==='string'?text.trim():'';
  if(reason&&!value.includes(reason))value=[reason,value].filter(Boolean).join('\n\n');
  if(outcome==='uncertain'&&!value.includes(FALLBACK.uncertain))value=[value,FALLBACK.uncertain].filter(Boolean).join('\n\n');
  return value || FALLBACK[outcome] || FALLBACK.no_answer;
}
export function updateExchange(session, secrets) {
  const rows=session.history || [];
  const entry=rows.find(e=>session.turnId && e.turnId===session.turnId) || rows.findLast(e=>!e.turnId && !e.completed);
  const notice=Object.hasOwn(APPROVAL_NOTICES,session.approvalNotice)?session.approvalNotice:entry?.approvalNotice;
  if(entry){if(session.turnId)entry.turnId=session.turnId;if(notice)entry.approvalNotice=notice;}
  if(!session.turnId||!['Done','Error'].includes(session.status))return;
  const outcome=session.uncertain?'uncertain':session.status==='Done'?(session.text?.trim()||notice?'completed':'no_answer'):session.error==='turn_interrupted'?'interrupted':'failed';
  session.text=redactText(finalText(session.text,notice,outcome),secrets);
  if(entry){entry.assistant=session.text;entry.completed=session.status==='Done';entry.outcome=outcome;}
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
    const terminal=['completed','failed','interrupted'].includes(t.status);
    const nativeText=typeof final?.text==='string'?final.text.trim():'';
    const notice=prior?.approvalNotice;
    const outcome=completed?(nativeText||notice?'completed':'no_answer'):t.status==='failed'?'failed':t.status==='interrupted'?'interrupted':prior?.outcome==='uncertain'?'uncertain':'pending';
    const result=terminal?finalText(nativeText,notice,outcome):(prior?.outcome==='uncertain'?prior.assistant:'');
    return {requestId:prior?.requestId || t.id,turnId:t.id,user:prior?.user || user || '',
      assistant:result,completed,outcome,approvalNotice:notice};
  });
  // A question whose send result is uncertain must not be silently associated with an unrelated turn.
  const pending=previous.filter(e=>!e.turnId);
  const retained=previous.filter(e=>e.turnId && !projected.some(p=>p.turnId===e.turnId));
  session.history=boundHistory([...retained,...projected,...pending],secrets);
}
