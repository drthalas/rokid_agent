import test from 'node:test';import assert from 'node:assert/strict';
import {ApprovalCard,approvalDescriptor} from '../lib/approval-ui.js';
const a={id:'a'.repeat(36),turnId:'turn',kind:'computer-use',title:'Calculator',description:'Прочитать окно Calculator один раз',risk:'low',allowOnGlasses:true,expiresAt:100000};
function harness(decide=async()=>({ok:true})){let tick;const calls=[],views=[],speech=[];const card=new ApprovalCard({decide:async(...args)=>{calls.push(args);return decide(...args)},render:(s,done)=>{views.push(s);done?.()},speak:s=>speech.push(s),schedule:f=>{tick=f;return 1},unschedule:()=>{tick=null}});return{card,calls,views,speech,flush:async()=>{const f=tick;tick=null;await f?.()}}}
test('descriptor drops arbitrary payloads; unknown shape denied',()=>{assert.equal(approvalDescriptor({...a,token:'secret'},a.turnId).token,undefined);assert.equal(approvalDescriptor({...a,title:'secret'},a.turnId),null);assert.equal(approvalDescriptor(a,'foreign'),null)});
test('default decline, no speech decision, same card TTS once, swipe cancels pending tap',async()=>{
 const h=harness();h.card.show(a);h.card.show(a);assert.equal(h.speech.length,1);assert.equal(h.calls.length,0);
 h.card.tap();h.card.move(1);await h.flush();assert.equal(h.calls.length,0);h.card.move(-1);h.card.tap();await h.flush();assert.equal(h.calls[0][1],'decline');
});
test('high risk first selection is not execution; second screen defaults NO and needs new selection/tap',async()=>{
 const h=harness(async(id,decision,confirmation)=>decision==='accept'&&!confirmation?{requiresConfirmation:true,confirmation:'challenge'}:{ok:true});h.card.show({...a,risk:'high'});h.card.move(1);h.card.tap();await h.flush();assert.equal(h.card.second,true);assert.equal(h.card.choice,false);assert.equal(h.calls.length,1);
 h.card.move(1);h.card.tap();await h.flush();assert.equal(h.calls[1][2],'challenge');
});
test('back cancels delayed allow and immediately declines; stale callbacks cannot accept a replacement',async()=>{
 const h=harness();h.card.show(a);h.card.move(1);h.card.tap();h.card.exit();await h.flush();assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'decline');
 h.card.show(a);h.card.move(1);h.card.tap();h.card.show({...a,id:'b'.repeat(36)});await h.flush();assert.equal(h.calls.length,1);assert.equal(h.card.choice,false);
});
test('tap before render callback and repeated tap cannot approve',async()=>{
 let done;const h=harness();h.card.render=(v,f)=>{done=f};h.card.show(a);h.card.move(1);h.card.tap();await h.flush();assert.equal(h.calls.length,0);
});

test('view failure on exit cannot prevent the decline',async()=>{const h=harness();h.card.show(a);h.card.render=()=>{throw Error('native view unavailable')};assert.doesNotThrow(()=>h.card.exit());assert.equal(h.calls[0][1],'decline')});
