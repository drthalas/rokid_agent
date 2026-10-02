import test from 'node:test';import assert from 'node:assert/strict';import {toolEvidence,reviewEvidence} from '../src/tool-evidence.mjs';
test('local evidence admits only correlated bounded identifiers, never credentials/results',()=>{
 const session={id:'s',threadId:'t',turnId:'u'};
 const p={threadId:'t',turnId:'u',item:{id:'i',type:'mcpToolCall',server:'codex_apps',tool:'gmail.create_draft',status:'completed',arguments:{secret:'provider-secret'},result:{content:'personal-content'},error:{message:'private-error'}}};
 const e=toolEvidence('item/completed',p,session);assert.equal(e.tool,'gmail.create_draft');
 assert.ok(!/secret|personal|private/.test(JSON.stringify(e)));
 assert.equal(toolEvidence('item/completed',{...p,turnId:'other'},session),null);
 assert.equal(toolEvidence('item/completed',{...p,item:{...p.item,tool:'x'.repeat(161)}},session),null);
});

test('auto-review evidence never includes rationale, command, paths, arguments or credentials',()=>{
 const p={threadId:'t',turnId:'u',reviewId:'r',startedAtMs:123,completedAtMs:456,action:{type:'command',command:'sensitive-command'},review:{status:'approved',riskLevel:'low',rationale:'private-reason'}};
 const e=reviewEvidence('item/autoApprovalReview/completed',p,{id:'s',threadId:'t',turnId:'u'});
 assert.equal(e.status,'approved');assert.equal(e.actionType,'command');assert.ok(!/sensitive|private/.test(JSON.stringify(e)));
 assert.equal(reviewEvidence('item/autoApprovalReview/completed',{...p,turnId:'other'},{id:'s',threadId:'t',turnId:'u'}),null);
});
