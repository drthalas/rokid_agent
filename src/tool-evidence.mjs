// Local-only invocation evidence, never arguments/results or provider authentication data.
const identity = value => typeof value === 'string' && /^[a-zA-Z0-9_.:@/-]{1,160}$/.test(value) ? value : null;
export function toolEvidence(method, params, session) {
  if (!['item/started','item/completed'].includes(method) || params?.threadId!==session.threadId ||
      !session.turnId || params.turnId!==session.turnId || params.item?.type!=='mcpToolCall') return null;
  const item=params.item;
  const server=identity(item.server),tool=identity(item.tool),itemId=identity(item.id);
  if(!server||!tool||!itemId)return null;
  const status=['inProgress','completed','failed'].includes(item.status)?item.status:'unknown';
  return {sessionId:session.id,threadId:session.threadId,turnId:session.turnId,itemId,server,tool,status,event:method,at:Date.now()};
}
