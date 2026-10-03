import test from 'node:test';import assert from 'node:assert/strict';
import {ApprovalCard,approvalDescriptor} from '../lib/approval-ui.js';
const a={id:'a'.repeat(36),turnId:'turn',kind:'computer-use',title:'Computer Use',action:'Просмотр окна / снимок',target:'com.apple.calculator',scope:'once',risk:'low',allowOnGlasses:true,expiresAt:100000};
function harness(decide=async()=>({ok:true})){let tick;const calls=[],views=[],speech=[];const card=new ApprovalCard({decide:async(...args)=>{calls.push(args);return decide(...args)},render:(s,done)=>{views.push(s);done?.()},speak:s=>speech.push(s),now:()=>1000,schedule:(f,ms)=>{if(ms===650)tick=f;return ms},unschedule:id=>{if(id===650)tick=null}});return{card,calls,views,speech,flush:async()=>{const f=tick;tick=null;await f?.()}}}
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

test('unconfirmed decision keeps the current card for a new explicit choice instead of hiding it',async()=>{
 const h=harness(async()=>{throw Error('network_or_tls_error')});h.card.show(a);h.card.move(1);h.card.tap();await h.flush();
 assert.equal(h.card.current?.id,a.id);assert.equal(h.card.choice,false);assert.equal(h.card.submitting,false);
 assert.ok(h.views.at(-1).approvalFeedback.includes('не подтверждено'));assert.equal(h.calls.length,1);
 h.card.tap();await h.flush();assert.equal(h.calls[1][1],'decline');
});
test('expired card cannot send a delayed accept; visible deadline and reason stay explicit',async()=>{
 let now=1000;const h=harness();h.card.now=()=>now;h.card.show({...a,expiresAt:now+30000});
 assert.equal(h.views.at(-1).approvalRemainingSeconds,30);h.card.move(1);h.card.tap();now+=30000;await h.flush();
 assert.equal(h.calls.length,0);assert.equal(h.card.armed,false);assert.ok(h.views.at(-1).approvalFeedback.includes('истекло'));
});

test('countdown expires visibly once, cancels on replacement and never sends or extends approval',()=>{
 let now=1000,seq=0;const timers=new Map(),views=[],speech=[],calls=[];
 const card=new ApprovalCard({now:()=>now,decide:async(...x)=>calls.push(x),render:(v,done)=>{views.push(v);done?.()},speak:x=>speech.push(x),schedule:f=>{timers.set(++seq,f);return seq},unschedule:id=>timers.delete(id)});
 card.show({...a,remainingMs:2000});now+=1000;let [id,f]=[...timers][0];timers.delete(id);f();assert.equal(views.at(-1).approvalRemainingSeconds,1);
 now+=1000;[id,f]=[...timers][0];timers.delete(id);f();card.move(1);card.tap();assert.equal(card.armed,false);assert.equal(calls.length,0);assert.equal(speech.filter(x=>x.includes('истекло')).length,1);
 card.show({...a,id:'b'.repeat(36),remainingMs:30000});assert.equal(card.choice,false);assert.equal(views.at(-1).approvalRemainingSeconds,30);card.clear();assert.equal(timers.size,0);
});
test('old decision rejection cannot hide or reset a newly refreshed second card',async()=>{
 let reject;const h=harness(()=>new Promise((_,j)=>reject=j));h.card.show(a);h.card.move(1);h.card.tap();const pending=h.flush();
 const second={...a,id:'b'.repeat(36)};h.card.show(second);h.card.move(1);reject(Error('network_or_tls_error'));await pending;
 assert.equal(h.card.current.id,second.id);assert.equal(h.card.choice,true);assert.equal(h.calls.length,1);
});
