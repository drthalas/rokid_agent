import test from 'node:test';import assert from 'node:assert/strict';import {toolEvidence} from '../src/tool-evidence.mjs';
test('local evidence admits only correlated bounded identifiers, never credentials/results',()=>{
 const session={id:'s',threadId:'t',turnId:'u'};
 const p={threadId:'t',turnId:'u',item:{id:'i',type:'mcpToolCall',server:'codex_apps',tool:'gmail.create_draft',status:'completed',arguments:{secret:'provider-secret'},result:{content:'personal-content'},error:{message:'private-error'}}};
 const e=toolEvidence('item/completed',p,session);assert.equal(e.tool,'gmail.create_draft');
 assert.ok(!/secret|personal|private/.test(JSON.stringify(e)));
 assert.equal(toolEvidence('item/completed',{...p,turnId:'other'},session),null);
 assert.equal(toolEvidence('item/completed',{...p,item:{...p.item,tool:'x'.repeat(161)}},session),null);
});
