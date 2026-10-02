import test from 'node:test';
import assert from 'node:assert/strict';
import {TempleControls,StatusPulse,ACTIVE_STATES,briefAnswer,errorView} from '../lib/voice-ui.js';

function controls(){
 const actions=[],trace=[],prevented=[];
 const c=new TempleControls({tap:()=>actions.push('tap'),exit:()=>actions.push('exit'),scroll:d=>actions.push(d),trace:e=>trace.push(e)});
 const send=(edge,code,repeat=false)=>c.handle(edge,{code,repeat,preventDefault:()=>prevented.push(code)});
 return{c,actions,trace,prevented,send};
}
test('GlobalHook contact before a swipe never triggers a voice action',()=>{
 const h=controls();
 for(const code of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']){
  h.send('down','GlobalHook');assert.ok(!h.actions.includes('tap'));
  h.send('down',code);h.send('up',code);h.send('up','GlobalHook');
 }
 assert.deepEqual(h.actions,[-1,1,-1,1]);assert.ok(!h.prevented.includes('GlobalHook'));
});
test('only classified Enter key-up taps, with no added classification timer',()=>{
 const h=controls();h.send('down','GlobalHook');h.send('up','GlobalHook');h.send('down','Enter');
 assert.deepEqual(h.actions,[]);h.send('up','Enter');assert.deepEqual(h.actions,['tap']);
 h.send('up','Enter',true);assert.deepEqual(h.actions,['tap']);
 h.send('up','Enter');assert.deepEqual(h.actions,['tap','tap']); // independent rapid confirmed tap
});
test('Backspace exits once and leaves the native back action intact',()=>{
 const h=controls();h.send('down','GlobalHook');h.send('down','Backspace');h.send('up','Backspace');h.send('up','Enter');
 assert.deepEqual(h.actions,['exit']);assert.deepEqual(h.prevented,[]);
});
test('two-finger/unknown events and disposed controls never invoke voice',()=>{
 const h=controls();for(const code of ['TwoFingerTap','TwoFingerDoubleTap','Settings','F13','Unknown'])h.send('up',code);
 assert.deepEqual(h.actions,[]);h.c.dispose();h.send('up','Enter');h.send('up','ArrowDown');assert.deepEqual(h.actions,[]);
});
test('status pulse is bounded, reused across active phases and stops on static/hide',()=>{
 let tick,scheduled=0,cleared=0;const values=[];
 const pulse=new StatusPulse(v=>values.push(v),{schedule:(f,ms)=>{assert.equal(ms,600);tick=f;scheduled++;return 7},unschedule:id=>{assert.equal(id,7);cleared++}});
 for(const phase of ['READY','DONE','ERROR'])pulse.setActive(ACTIVE_STATES.includes(phase));assert.equal(scheduled,0);
 for(const phase of ['LISTENING','TRANSCRIBING','THINKING','WORKING'])pulse.setActive(ACTIVE_STATES.includes(phase));assert.equal(scheduled,1);
 tick();tick();assert.deepEqual(values,[0.4,1,0.4]);pulse.stop();assert.equal(values.at(-1),1);assert.equal(cleared,1);
 tick();assert.equal(values.length,4);pulse.setActive(true);assert.equal(scheduled,2);pulse.stop();assert.equal(cleared,2);
});
test('brief answer is bounded, plain and extractive; full response is not modified',()=>{
 const short='Я работаю через ваш Mac.';assert.equal(briefAnswer(short),short);
 const long='Первое предложение. Второе предложение. '+ 'Полный ответ. '.repeat(100);
 assert.equal(briefAnswer(long),'Первое предложение. Второе предложение.');assert.ok(long.length>1000);
 assert.ok(briefAnswer('слово '.repeat(300)).length<=300);
 assert.equal(briefAnswer('```js\nconst x = 1;\n```'),'Ответ содержит код. Полный текст ниже.');
 assert.equal(errorView('codex_unavailable').title,'Codex недоступен на Mac');
});
