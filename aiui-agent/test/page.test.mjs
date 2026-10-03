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
function harness({beforeLoad=()=>{},beforeShow=()=>{},rejectStatus=false}={}){
 const db=new Map(),calls=[],states=[],callbacks={},spoken=[],order=[];let time=1000,reads=0;const exchanges=[];
 let session={id:randomUUID(),threadId:randomUUID(),turnId:'old-turn',status:'Done',text:'Old setup advice from an earlier conversation'};
 const wx={getStorageSync:k=>db.get(k),setStorageSync:(k,v)=>db.set(k,structuredClone(v)),
  request(o){calls.push({url:o.url,method:o.method,data:o.data});let aborted=false;queueMicrotask(()=>{
   if(aborted){o.fail({});o.complete();return;}const route=new URL(o.url).pathname;let data;
   if(route==='/v1/health')data={codex:true,loggedIn:true};
   else if(route==='/v1/diagnostics')data={ok:true};
   else if(route==='/v1/stt')data={text:'Скажи одним предложением, что ты работаешь через мой Mac',timing:{T2:Date.now(),T3:Date.now(),T4:Date.now()}};
   else if(route.endsWith('/turns')){reads=0;session={...session,status:'Working',turnId:randomUUID(),text:'',timing:{requestId:o.data.requestId,T5:Date.now(),T6:Date.now(),T7:Date.now()}};exchanges.push({requestId:o.data.requestId,turnId:session.turnId,user:o.data.text,assistant:'',completed:false});data={...session};}
   else if(route.endsWith('/stop')){session={...session,status:'Error',error:'turn_interrupted'};data={...session};}
   else{if(session.status==='Working'&&++reads>=2)session={...session,status:'Done',text:'Я работаю через ваш Mac.',timing:{...session.timing,T8:Date.now()}};data={...session};}
   if(data?.id){if(data.status==='Done'&&exchanges.length){exchanges.at(-1).assistant=data.text;exchanges.at(-1).completed=true;}data.history={sessionId:data.id,threadId:data.threadId,exchanges:structuredClone(exchanges.slice(-6))};}
   o.success({statusCode:200,data});o.complete();});return{abort(){aborted=true}};
  },media:{getRecorderManager:()=>({
   start(){order.push('record');return Promise.resolve()},stop(){callbacks.stop();return Promise.resolve()},
   onStop:f=>callbacks.stop=f,onFrameRecorded:f=>callbacks.frame=f,onError:f=>callbacks.error=f,onInterruptionBegin:f=>callbacks.interrupt=f
  })}};
 globalThis.wx=wx;
 globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 globalThis.speechSynthesis={async synthesize(utterance){spoken.push(utterance.text);return{finished:Promise.resolve(),abort(){order.push('abortTts')}}}};
 globalThis.SpeechAudioPlayer=class{play(){order.push('speak')}destroy(){order.push('stopTts')}};
 const page={...spec,data:{...spec.data},setData(value,done){if(rejectStatus && ('statusActive' in value || 'statusOpacity' in value))throw Error('status bridge unavailable');Object.assign(this.data,value);if(value.phase)states.push(value.phase);done?.()}};
 beforeLoad(page);page.onLoad({prompt:'Open the app'});beforeShow(page);page.onShow();page.controls.now=()=>time;
 page.client.schedule=f=>setTimeout(f,0);
 const event=code=>({code,preventDefault(){}});
 function tap(){time+=1000;page.onKeyDown(event('GlobalHook'));page.onKeyUp(event('GlobalHook'));page.onKeyUp(event('Enter'));}
 function voice(){const bytes=new Uint8Array(16000);const v=new DataView(bytes.buffer);for(let n=0;n<bytes.length;n+=2)v.setInt16(n,2000,true);callbacks.frame({frameBuffer:bytes.buffer});}
 return{page,calls,states,spoken,order,tap,voice,back(){page.onKeyUp(event('Backspace'))}};
}

test('invocation shows READY, two tap-driven turns retain thread, automatic TTS stops before next recording',async()=>{
 const h=harness();try{
  await waitFor(()=>h.page.data.phase==='READY');assert.deepEqual(h.page.data.history,[]);assert.equal(h.calls.filter(c=>c.url.endsWith('/turns')).length,0);
  h.tap();assert.equal(h.page.data.phase,'LISTENING');h.voice();h.tap();assert.equal(h.page.data.phase,'TRANSCRIBING');
  await waitFor(()=>h.page.data.phase==='DONE');await pause(0);
  assert.equal(h.page.data.history[0].assistant,'Я работаю через ваш Mac.');assert.deepEqual(h.spoken,['Я работаю через ваш Mac.']);
  const diagnostic=h.calls.filter(c=>c.url.endsWith('/diagnostics')).at(-1).data;
  for(let i=0;i<=11;i++)assert.ok(Number.isFinite(diagnostic['T'+i]),'missing T'+i);
  assert.ok(!JSON.stringify(diagnostic).includes('Mac'));assert.ok(!('text' in diagnostic));
  assert.ok(h.states.includes('TRANSCRIBING'));assert.ok(h.states.includes('THINKING'));assert.ok(h.states.includes('WORKING'));
  await h.page.client.refresh();assert.equal(h.spoken.length,1);
  h.tap();assert.equal(h.page.data.phase,'LISTENING');assert.equal(h.page.data.history.length,1);assert.ok(h.order.lastIndexOf('stopTts')<h.order.lastIndexOf('record'));
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
 const h=harness();try{await waitFor(()=>h.page.data.phase==='READY');assert.deepEqual(h.page.data.history,[]);assert.equal(h.spoken.length,0);h.back();}finally{h.page.cleanup()}
});

test('HUD renders each assistant once, retains full long answer and scroll position',async()=>{
 const markup=fs.readFileSync(path.join(root,'pages/index/index.ink'),'utf8').match(/<page>([\s\S]*?)<\/page>/)[1];
 assert.equal((markup.match(/>{{item.assistant}}<\/text>/g)||[]).length,1);
 assert.ok(!/summary|fullText|Полный ответ/.test(markup));
 assert.ok(markup.includes('ink:for="{{history}}"'));assert.ok(markup.includes('ink:if="{{item.assistant}}"'));assert.ok(!/wx:(for|if|key)/.test(markup));
 assert.ok(markup.includes('{{item.user}}'));
 const h=harness();try{await waitFor(()=>h.page.data.phase==='READY');
 const answer='Длинный ответ. '.repeat(100),requestId=randomUUID();
 const value={state:'DONE',turnId:'new-turn',history:[{requestId,turnId:'new-turn',user:'Вопрос',assistant:answer,completed:true}]};
 h.page.renderState(value);assert.equal(h.page.data.history[0].assistant,answer);
 assert.equal(h.page.data.scrollTarget,'exchange-'+requestId);
 h.page.handleScroll({detail:{scrollTop:500}});h.page.onKeyUp({code:'ArrowUp',preventDefault(){}});
 assert.equal(h.page.data.scroll,390);assert.equal(h.page.data.scrollTarget,'');
 h.page.renderState(value);assert.equal(h.page.data.scroll,390);assert.equal(h.page.data.scrollTarget,'');
 h.page.showError('Glasses 4060 (sensitive detail)');assert.equal(h.page.safeError,'client_error');
 assert.ok(!h.page.data.errorText.includes('4060'));assert.equal(h.page.data.history.length,1);
 }finally{h.page.cleanup()}
});

test('temple touch and every arrow cannot start or stop recording; Enter release controls voice',async()=>{
 const h=harness();try{await waitFor(()=>h.page.data.phase==='READY');
 const send=(edge,code)=>h.page[edge==='down'?'onKeyDown':'onKeyUp']({code,preventDefault(){}});
 for(const code of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']){send('down','GlobalHook');send('down',code);send('up',code);send('up','GlobalHook');}
 assert.equal(h.order.filter(x=>x==='record').length,0);assert.equal(h.page.data.phase,'READY');
 send('down','Enter');assert.equal(h.page.data.phase,'READY');send('up','Enter');assert.equal(h.page.data.phase,'LISTENING');
 assert.equal(h.page.data.statusActive,true);h.voice();send('down','GlobalHook');send('up','ArrowDown');send('up','GlobalHook');
 assert.equal(h.page.data.phase,'LISTENING');assert.equal(h.calls.filter(c=>c.url.endsWith('/stt')).length,0);
 send('up','Enter');await waitFor(()=>h.page.data.phase==='DONE');assert.equal(h.page.data.statusActive,false);
 assert.equal(h.page.pulse.timer,null);assert.equal(h.page.data.statusOpacity,1);
 h.tap();assert.equal(h.page.data.statusActive,true);h.back();assert.equal(h.page.pulse.timer,null);assert.equal(h.page.data.statusActive,false);
 }finally{h.page.cleanup()}
});
test('Jarvis hierarchy uses one message block and supported lightweight transition motion',()=>{
 const page=fs.readFileSync(path.join(root,'pages/index/index.ink'),'utf8');
 assert.ok(page.includes('class="brand">Jarvis</text>'));
 assert.ok(page.includes('class="speaker">ВЫ</text>'));assert.ok(page.includes('class="speaker">JARVIS</text>'));
 assert.ok(page.includes('font-size:23px; font-weight:700'));assert.ok(page.includes('font-size:19px; font-weight:400'));
 assert.ok(page.includes('border-top:1px solid'));assert.ok(page.includes('transition-property:opacity'));
 assert.ok(!/@keyframes|animation:|spinner/.test(page));
});

for(const fault of ['missing-intervals','pulse-construction','status-render']) {
 test('startup reaches health/READY and preserves voice/cleanup despite '+fault,async()=>{
  const interval=globalThis.setInterval,clear=globalThis.clearInterval;
  let h;
  try {
   if(fault==='missing-intervals'){delete globalThis.setInterval;delete globalThis.clearInterval;}
   h=harness({rejectStatus:fault==='status-render',beforeShow:page=>{
    if(fault==='pulse-construction')Object.defineProperty(page,'pulse',{configurable:true,get(){return null},set(){throw Error('optional initialization failed')}});
   }});
   await waitFor(()=>h.page.data.phase==='READY');
   assert.equal(h.calls.filter(c=>c.url.endsWith('/v1/health')).length,1);
   h.tap();assert.equal(h.page.data.phase,'LISTENING');h.voice();h.tap();
   await waitFor(()=>h.page.data.phase==='DONE');await pause(0);
   assert.equal(h.page.data.history.length,1);assert.equal(h.spoken.length,1);
   const session=h.page.client.saved.sessionId,thread=h.page.client.saved.threadId;
   h.back();assert.equal(h.page.client.active,false);h.page.onShow();
   await waitFor(()=>h.page.data.phase==='READY'&&!h.page.client.operation);
   assert.equal(h.page.client.saved.sessionId,session);assert.equal(h.page.client.saved.threadId,thread);
   assert.equal(h.page.data.history.length,1);assert.equal(h.spoken.length,1);
  }finally{globalThis.setInterval=interval;globalThis.clearInterval=clear;h?.page.cleanup();}
 });
}

test('HUD approval replaces busy controls, defaults decline and announces only once',async()=>{
 const h=harness();try{await waitFor(()=>h.page.data.phase==='READY');
 const approval={id:randomUUID(),turnId:'active',kind:'computer-use',title:'Computer Use',action:'Просмотр окна / снимок',target:'com.apple.calculator',scope:'once',risk:'low',expiresAt:Date.now()+30000};
 const decisions=[];h.page.client.decideApproval=async(...args)=>{decisions.push(args);return{ok:true}};
 const value={state:'APPROVAL',pendingApproval:true,approval,turnId:'active'};h.page.renderState(value);h.page.renderState(value);
 assert.equal(h.page.data.phase,'APPROVAL');assert.equal(h.page.data.approvalAllow,false);assert.equal(h.spoken.filter(s=>s==='Требуется подтверждение.').length,1);
 h.page.onKeyUp({code:'ArrowDown',preventDefault(){}});assert.equal(h.page.data.approvalAllow,true);h.tap();h.back();await pause(700);
 assert.equal(decisions.length,1);assert.equal(decisions[0][1],'decline');assert.equal(h.order.filter(s=>s==='record').length,0);
 }finally{h.page.cleanup()}
});

test('approval keeps choices in compact HUD and restores history projection afterwards',async()=>{
 const h=harness();try{await waitFor(()=>h.page.data.phase==='READY');const history=[{requestId:randomUUID(),turnId:'previous',user:'Question',assistant:'Answer',completed:true}];
 h.page.renderState({state:'APPROVAL',history,approval:{id:randomUUID(),title:'Computer Use',action:'Просмотр окна / снимок',target:'com.apple.calculator',scope:'once',risk:'low',expiresAt:Date.now()+30000}});
 assert.deepEqual(h.page.data.history,history);h.page.renderState({state:'WORKING',history});assert.equal(h.page.data.approval,null);assert.deepEqual(h.page.data.history,history);
 const markup=fs.readFileSync(path.join(root,'pages/index/index.ink'),'utf8');assert.ok(markup.includes('<scroll-view ink:if="{{!approval}}"'));assert.ok(markup.includes('.approval-screen { padding:6px; gap:2px; }'));
 }finally{h.page.cleanup()}
});

test('unsupported feedback is immediate and unsuccessful canonical result renders/speaks once',async()=>{
 const h=harness();try{await waitFor(()=>h.page.data.phase==='READY');const turnId='failed-turn',requestId=randomUUID(),reason='Для этого действия требуется подтверждение на Mac. Через очки его подтвердить нельзя. Действие не выполнено.';
 const history=[{requestId,turnId,user:'Capture',assistant:'',completed:false,outcome:'pending'}];
 h.page.renderState({state:'STOPPING',turnId,busy:true,history,approvalReason:'unsupported',approvalMessage:reason});assert.ok(h.page.data.errorText.includes('Останавливаю'));assert.equal(h.spoken.length,0);
 history[0]={...history[0],assistant:reason,outcome:'interrupted',approvalNotice:'unsupported'};const terminal={state:'CANCELLED',turnId,busy:false,history,approvalMessage:reason};
 h.page.renderState(terminal);h.page.renderState(terminal);assert.equal(h.page.data.phase,'CANCELLED');assert.equal(h.page.data.errorText,reason);assert.equal(h.page.data.history[0].completed,false);assert.equal(h.spoken.length,1);assert.ok(h.spoken[0].includes('Действие не выполнено'));
 h.page.renderState({...terminal,state:'READY',restoring:true});assert.equal(h.spoken.length,1);
 }finally{h.page.cleanup()}
});

test('ERROR always keeps a visible current-turn explanation above long history and speaks once',async()=>{
 const h=harness();try{await waitFor(()=>h.page.data.phase==='READY');const turnId='error-turn',reason='Не удалось выполнить снимок экрана.';
 const history=[{requestId:randomUUID(),turnId,user:'Длинный запрос. '.repeat(100),assistant:reason,completed:false,outcome:'failed'}];
 const value={state:'ERROR',detail:'turn_failed',turnId,busy:false,history};h.page.renderState(value);h.page.renderState(value);
 assert.equal(h.page.data.errorText,reason);assert.equal(h.spoken.filter(x=>x===reason).length,1);
 h.page.renderState({state:'ERROR',detail:'network_or_tls_error',turnId:'other-turn',busy:false,history});
 assert.equal(h.page.data.errorText,'Нет связи с Mac');
 }finally{h.page.cleanup()}
});
