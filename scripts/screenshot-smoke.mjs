// Explicitly authorized real local test: Calculator/desktop -> self Gmail drafts, never send.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';
import {randomUUID,createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {Codex} from '../src/codex.mjs';import {Engine} from '../src/engine.mjs';
import {fixture,delay} from '../test/helpers.mjs';
if(!process.argv.includes('--authorized'))throw Error('explicit_screenshot_and_draft_authorization_required');
const startedAt=Date.now();
const proofDir=fs.mkdtempSync(path.join(os.tmpdir(),'ale471-proof-'));fs.chmodSync(proofDir,0o700);
const f=fixture();f.config.model='gpt-6-astra';delete f.config.approvalTimeoutMs;
const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
const codex=new Codex({port}),engine=new Engine(f.config,codex);const rpc=codex.request.bind(codex);
const report={proofDir,model:f.config.model,cases:[],noSend:true,nativeRequests:0};let active,session,selfEmail;
const hash=b=>createHash('sha256').update(b).digest('hex');
const structures=result=>{
 const all=[result?.structuredContent];for(const c of result?.content??[])if(c.type==='text'){try{all.push(JSON.parse(c.text))}catch{}}
 return all.filter(Boolean);
};
codex.request=(method,params)=>{
 if(method==='thread/start')params={...params,ephemeral:true};
 if(method==='turn/steer'&&active){
  const s=params.input[0].text;const data=JSON.parse(s.split('\n')[1]);
  active.sameTurn&&=params.expectedTurnId===engine.get(session.id).turnId&&data.turnId===params.expectedTurnId;
  active.artifacts.push({path:data.path,itemId:data.itemId,sha256:hash(fs.readFileSync(data.path))});
 }
 return rpc(method,params);
};
codex.on('request',()=>{report.nativeRequests++;});
codex.on('notification',m=>{
 if(m.method!=='item/completed'||m.params.threadId!==session?.threadId||!active)return;
 const i=m.params.item;if(i?.type!=='mcpToolCall')return;
 const raw=JSON.stringify(i.result??{});active.tools.push({server:i.server,tool:i.tool,status:i.status,error:!!i.error||!!i.result?.isError});
 if(/send_email|send_draft/.test(i.tool??''))report.noSend=false;
 if(i.server==='cua_repl'){
  active.privateUI||=JSON.stringify(i.arguments??{}).includes('screencaptureui');
  if(/\b50\b/.test(raw)&&/Calculator|Калькулятор|Result|результат|выражение/.test(raw))active.ax50=true;
  const im=i.result?.content?.find(c=>c.type==='image'&&c.data);
  if(im){const bytes=Buffer.from(im.data,'base64'),p=path.join(proofDir,`case-${active.kind}.${im.mimeType==='image/png'?'png':'jpg'}`);fs.writeFileSync(p,bytes,{mode:0o600});active.image={path:p,mimeType:im.mimeType,sha256:hash(bytes),bytes:bytes.length};}
 }
 if(/get_profile$/.test(i.tool??''))selfEmail=raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
 if(/create_draft$/.test(i.tool??'')){
  active.draftCalls=(active.draftCalls??0)+1;
  const a=i.arguments??{},parts=[];const walk=p=>{if(!p||typeof p!=='object')return;if(p.filename)parts.push(p);for(const x of p.parts??[])walk(x)};walk(a.payload);
  const result=structures(i.result).find(x=>x.message?.id);
  active.draft={ok:i.status==='completed'&&!i.result?.isError,toSelf:!!selfEmail&&a.to?.toLowerCase()===selfEmail.toLowerCase(),noCcBcc:!a.cc&&!a.bcc,id:result?.id,messageId:result?.message?.id,attachments:parts.map(p=>{
   const bytes=Buffer.from(p.body?.base64_url_content??'','base64url');const dest=path.join(proofDir,`attached-${active.kind}-${parts.indexOf(p)}.${p.mime_type==='image/png'?'png':'jpg'}`);fs.writeFileSync(dest,bytes,{mode:0o600});return {filename:p.filename,mimeType:p.mime_type,bytes:bytes.length,sha256:hash(bytes),path:dest};})};
 }
 if(/read_email$/.test(i.tool??''))active.readback={ok:i.status==='completed'&&!i.result?.isError,draft:/DRAFT/.test(raw),attachments:active.draft?.attachments.every(a=>raw.includes(a.filename)&&raw.includes(a.mimeType)&&raw.includes(String(a.bytes)))};
});
try{
 await codex.start();await engine.recover();session=await engine.create({requestId:randomUUID()});
 const profile=codex.permissionProfiles.get(session.threadId);report.profile={sandbox:profile.sandbox.type,approvalPolicy:profile.approvalPolicy,reviewer:profile.approvalsReviewer};
 for(const kind of (process.argv.includes('--desktop-only')?['desktop']:['app','desktop'])){
  active={kind,tools:[],artifacts:[],sameTurn:true,privateUI:false};report.cases.push(active);
  const task=kind==='app'?'В Калькуляторе посчитай 20+30 и приложи скриншот результата к черновику Gmail.':'Сделай новый скриншот всего рабочего стола и приложи к черновику Gmail.';
  await engine.turn(session.id,{requestId:randomUUID(),text:task+' Это разрешённая локальная проверка ALE-471. Получатель — я сам: проверь мой адрес через get_profile. Создай ровно один новый НЕОТПРАВЛЕННЫЙ черновик с темой ALE-471 '+kind+' local proof. Проверь его вложение и DRAFT через readback. Ничего не отправляй. Не читай другие письма. Не меняй настройки/permissions. Используй текущий результат, не старые файлы. После передачи удали собственные временные файлы. Репозиторий не редактируй. Если получен отказ native approval, остановись.'});
  const deadline=Date.now()+360000;
  while(Date.now()<deadline&&['Thinking','Working'].includes(engine.get(session.id).status)){
   if(engine.listApprovals().length){active.humanRequired=true;for(const a of engine.listApprovals())engine.decide(a.id,false);}
   await delay(250);
  }
  const s=engine.get(session.id);active.status=s.status;active.captureStageError=/Не удалось сделать снимок/.test(s.text);active.attachmentStageError=/Не удалось прикрепить снимок/.test(s.text);
  active.imagesCleaned=engine.images.files.size===0;active.artifactsRemoved=active.artifacts.every(a=>!fs.existsSync(a.path));
  active.reviews=engine.reviewEvents.map(x=>({status:x.status,risk:x.risk,event:x.event}));
  active.exactNativeImage=kind==='app'&&!!active.image&&active.draft?.attachments.some(a=>a.sha256===active.image.sha256);
  console.log(JSON.stringify({kind,status:active.status,image:!!active.image,draftCreated:active.draft?.ok,readback:active.readback,nativeRequests:report.nativeRequests}));
  if(['Thinking','Working'].includes(s.status)){await engine.stop(session.id).catch(()=>{});break;}
 }
 await rpc('thread/unsubscribe',{threadId:session.threadId}).catch(()=>{});
}catch(e){report.error=e.message;console.log(JSON.stringify({error:e.message}));}
finally{
 engine.close();await codex.close();f.cleanup();report.terminated=true;
 for(const c of report.cases){
  for(const a of c.draft?.attachments??[]){
   try{
    const decoded=path.join(proofDir,'decode.png');execFileSync('/usr/bin/sips',['-s','format','png',a.path,'--out',decoded],{stdio:'ignore',timeout:15000});
    const bytes=fs.readFileSync(decoded);a.width=bytes.readUInt32BE(16);a.height=bytes.readUInt32BE(20);a.validImage=a.width>0&&a.height>0;fs.unlinkSync(decoded);
   }catch{a.validImage=false;}
  }
  c.pass=c.status==='Done'&&c.sameTurn&&!c.privateUI&&c.imagesCleaned&&c.artifactsRemoved&&c.draftCalls===1&&c.draft?.ok&&c.draft.toSelf&&c.draft.noCcBcc&&c.draft.attachments.length>0&&c.draft.attachments.every(a=>a.validImage)&&c.readback?.ok&&c.readback.draft&&c.readback.attachments&&(c.kind!=='app'||(c.ax50&&c.exactNativeImage));
 }
 // Proof copies are not an archive. Keep only safe metadata after decode/verification.
 for(const name of fs.readdirSync(proofDir))if(/\.(png|jpg)$/.test(name))fs.unlinkSync(path.join(proofDir,name));
 report.proofImagesCleaned=!fs.readdirSync(proofDir).some(n=>/\.(png|jpg)$/.test(n));
 report.pass=report.cases.length===(process.argv.includes('--desktop-only')?1:2)&&report.cases.every(c=>c.pass)&&report.noSend&&report.nativeRequests===0&&!report.error&&report.proofImagesCleaned;
 report.elapsedMs=Date.now()-startedAt;if(!report.pass)process.exitCode=1;
 fs.writeFileSync(path.join(proofDir,'evidence.json'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({proofDir,terminated:true,noSend:report.noSend}));
}
