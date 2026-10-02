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

export function reviewEvidence(method,params,session) {
  if(!['item/autoApprovalReview/started','item/autoApprovalReview/completed','autoApprovalReview/strictReviewRequired'].includes(method)||params?.threadId!==session.threadId||!session.turnId||params.turnId!==session.turnId)return null;
  const allowedStatus=['inProgress','approved','denied','timedOut','aborted'];
  const status=method==='autoApprovalReview/strictReviewRequired'?'strictReviewRequired':allowedStatus.includes(params.review?.status)?params.review.status:'unknown';
  return {sessionId:session.id,threadId:session.threadId,turnId:session.turnId,event:method,status,
    reviewId:identity(params.reviewId),targetItemId:identity(params.targetItemId),
    actionType:['command','execve','writeStdin','applyPatch','networkAccess','mcpToolCall','requestPermissions'].includes(params.action?.type)?params.action.type:null,
    riskLevel:['low','medium','high','critical'].includes(params.review?.riskLevel)?params.review.riskLevel:null,
    at:Date.now(),...(Number.isFinite(params.startedAtMs)?{startedAtMs:params.startedAtMs}:{}),...(Number.isFinite(params.completedAtMs)?{completedAtMs:params.completedAtMs}:{})};
}
