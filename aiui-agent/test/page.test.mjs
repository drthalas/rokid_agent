import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
let source=fs.readFileSync(path.join(root,'pages/index/index.ink'),'utf8').match(/<script setup>([\s\S]*?)<\/script>/)[1];
source=source.replace("import config from '../../config.js';", "const config={origin:'https://example.com',token:'a'.repeat(43),tts:true};");
source=source.replace(/from '(\.\.\/\.\.\/lib\/[^']+)'/g,(_,s)=>'from '+JSON.stringify(pathToFileURL(path.resolve(root,'pages/index',s)).href));
const spec=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(check){for(let n=0;n<150;n++){if(check())return;await pause(10);}throw Error('page timeout')}
function harness(){
 const db=new Map(),calls=[],states=[],callbacks={},spoken=[],order=[];let time=1000,reads=0;
 let session={id:randomUUID(),threadId:'same-thread',turnId:'old-turn',status:'Done',text:'Old setup advice from an earlier conversation'};
 const wx={getStorageSync:k=>db.get(k),setStorageSync:(k,v)=>db.set(k,structuredClone(v)),
  request(o){calls.push({url:o.url,method:o.method,data:o.data});let aborted=false;queueMicrotask(()=>{
   if(aborted){o.fail({});o.complete();return;}const route=new URL(o.url).pathname;let data;
   if(route==='/v1/health')data={codex:true,loggedIn:true};
   else if(route==='/v1/stt')data={text:'Скажи одним предложением, что ты работаешь через мой Mac'};
   else if(route.endsWith('/turns')){reads=0;session={...session,status:'Working',turnId:randomUUID(),text:''};data={...session};}
   else if(route.endsWith('/stop')){session={...session,status:'Error',error:'turn_interrupted'};data={...session};}
   else{if(session.status==='Working'&&++reads>=2)session={...session,status:'Done',text:'Я работаю через ваш Mac.'};data={...session};}
   o.success({statusCode:200,data});o.complete();});return{abort(){aborted=true}};
  },media:{getRecorderManager:()=>({
   start(){order.push('record');return Promise.resolve()},stop(){callbacks.stop();return Promise.resolve()},
   onStop:f=>callbacks.stop=f,onFrameRecorded:f=>callbacks.frame=f,onError:f=>callbacks.error=f,onInterruptionBegin:f=>callbacks.interrupt=f
  })}};
 globalThis.wx=wx;
 globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 globalThis.speechSynthesis={async synthesize(utterance){spoken.push(utterance.text);return{finished:Promise.resolve(),abort(){order.push('abortTts')}}}};
 globalThis.SpeechAudioPlayer=class{play(){order.push('speak')}destroy(){order.push('stopTts')}};
 const page={...spec,data:{...spec.data},setData(value){Object.assign(this.data,value);if(value.phase)states.push(value.phase)}};
 page.onLoad({prompt:'Open the app'});page.onShow();page.controls.now=()=>time;
 page.client.schedule=f=>setTimeout(f,0);
 const event=code=>({code,preventDefault(){}});
 function tap(){time+=1000;page.onKeyDown(event('GlobalHook'));page.onKeyUp(event('GlobalHook'));page.onKeyUp(event('Enter'));}
 function voice(){const bytes=new Uint8Array(16000);const v=new DataView(bytes.buffer);for(let n=0;n<bytes.length;n+=2)v.setInt16(n,2000,true);callbacks.frame({frameBuffer:bytes.buffer});}
 return{page,calls,states,spoken,order,tap,voice,back(){page.onKeyUp(event('Backspace'))}};
}

test('invocation shows READY, two tap-driven turns retain thread, automatic TTS stops before next recording',async()=>{
 const h=harness();try{
  await waitFor(()=>h.page.data.phase==='READY');assert.equal(h.page.data.summary,'');assert.equal(h.calls.filter(c=>c.url.endsWith('/turns')).length,0);
  h.tap();assert.equal(h.page.data.phase,'LISTENING');h.voice();h.tap();assert.equal(h.page.data.phase,'TRANSCRIBING');
  await waitFor(()=>h.page.data.phase==='DONE');await pause(0);
  assert.equal(h.page.data.summary,'Я работаю через ваш Mac.');assert.deepEqual(h.spoken,['Я работаю через ваш Mac.']);
  assert.ok(h.states.includes('TRANSCRIBING'));assert.ok(h.states.includes('THINKING'));assert.ok(h.states.includes('WORKING'));
  await h.page.client.refresh();assert.equal(h.spoken.length,1);
  h.tap();assert.equal(h.page.data.phase,'LISTENING');assert.ok(h.order.lastIndexOf('stopTts')<h.order.lastIndexOf('record'));
  h.voice();h.tap();await waitFor(()=>h.page.data.phase==='DONE');
  const turns=h.calls.filter(c=>c.url.endsWith('/turns'));assert.equal(turns.length,2);assert.equal(turns[0].url,turns[1].url);
  h.back();assert.equal(h.page.visible,false);assert.equal(h.page.client.active,false);
 }finally{h.page.cleanup()}
});
test('double tap/Backspace after recording completion cancels delayed upload',async()=>{
 const h=harness();try{await waitFor(()=>h.page.data.phase==='READY');h.tap();h.voice();h.tap();h.back();await pause(700);
 assert.equal(h.calls.filter(c=>c.url.endsWith('/v1/stt')).length,0);assert.equal(h.calls.filter(c=>c.url.endsWith('/turns')).length,0);
 }finally{h.page.cleanup()}
});
test('fresh opening does not display or speak a completed historical response',async()=>{
 const h=harness();try{await waitFor(()=>h.page.data.phase==='READY');assert.equal(h.page.data.fullText,'');assert.equal(h.spoken.length,0);h.back();}finally{h.page.cleanup()}
});
