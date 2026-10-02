#!/usr/bin/env node
// Private deployment using the API observed in AIUI Studio 1.1.0 / web bundle 1.4.1.
// Never submit for review, alter permissions, rotate credentials, or touch the gateway.
import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import {createHash,createHmac} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);process.umask(0o077);
const local=path.join(root,'.local');fs.mkdirSync(local,{recursive:true,mode:0o700});
const API='https://rcs-internal.rokid.com/metis';
const STUDIO='https://aiui-global.rokid.com';
const hash=(bytes,alg='sha256')=>createHash(alg).update(bytes).digest('hex');
const safeWrite=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{mode:0o600});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function check(value,reason){if(!value)throw new Error(reason)}
function command(cmd,args){execFileSync(cmd,args,{cwd:root,stdio:'inherit'});}
async function fetchSafe(url,options={}){
 const response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});
 check(response.ok,'http_'+response.status);return response;
}
async function browserToken(endpoint){
 check(endpoint,'auth_source_required');
 const base=new URL(endpoint);check(base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname),'cdp_must_be_loopback');
 const targets=await(await fetchSafe(base.origin+'/json/list')).json();
 const target=targets.find(t=>t.type==='page'&&t.url?.startsWith(STUDIO+'/'));
 check(target?.webSocketDebuggerUrl,'authorized_studio_tab_missing');
 const socketUrl=new URL(target.webSocketDebuggerUrl);check(['127.0.0.1','localhost','[::1]'].includes(socketUrl.hostname),'cdp_must_be_loopback');
 const ws=new WebSocket(socketUrl);
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('cdp_timeout')),10000);ws.once('open',()=>{clearTimeout(timer);resolve()});ws.once('error',()=>{clearTimeout(timer);reject(Error('cdp_unavailable'))})});
  const result=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('cdp_timeout')),10000);
   ws.on('message',bytes=>{const data=JSON.parse(bytes);if(data.id!==1)return;clearTimeout(timer);data.error?reject(Error('cdp_rejected')):resolve(data.result)});
   ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:"(()=>{const m=document.cookie.match(/(?:^|;\\s*)ROKID_ACCOUNT_SESSION=([^;]*)/);return m?decodeURIComponent(m[1]):null})()",returnByValue:true}}));
  });
  const value=result.result?.value;check(typeof value==='string'&&value.length>20,'account_session_missing');return value;
 }finally{ws.close()}
}
async function api(accessToken,route,body){
 const response=await fetchSafe(API+route,{method:'POST',headers:{'content-type':'application/json',access_token:accessToken},body:JSON.stringify(body)});
 const result=await response.json();check(result.code===1,'rokid_api_rejected');return result.data;
}
async function agent(accessToken,id){
 let page=1;
 while(page<=10){const data=await api(accessToken,'/agent/getAIUIAgentList',{pageNum:page,pageSize:100});const found=data.list?.find(a=>a.agentId===id);if(found)return found;if(!data.list?.length||page*100>=data.total)break;page++;}
 throw new Error('agent_not_found');
}
function privateDraft(a,cfg){
 check(a.agentId===cfg.agentId&&a.displayStatus==='draft'&&a.status===-1,'not_expected_private_draft');
 if(cfg.expectedOwnerId)check(a.createdBy===cfg.expectedOwnerId,'owner_mismatch');
 check(a.permissions?.split(',').includes('CAMERA'),'camera_permission_missing');
}
async function upload(sts,key,bytes,type){
 check(sts.bucketName==='rokid-arapp'&&sts.region==='oss-ap-southeast-1','unexpected_upload_destination');
 check(/^[a-zA-Z0-9/_\-.]+$/.test(key)&&!key.includes('..'),'invalid_object_key');
 const date=new Date().toUTCString();
 const stringToSign=`PUT\n\n${type}\n${date}\nx-oss-security-token:${sts.sessionToken}\n/${sts.bucketName}/${key}`;
 const signature=createHmac('sha1',sts.secretKey).update(stringToSign).digest('base64');
 await fetchSafe(`https://${sts.bucketName}.${sts.region}.aliyuncs.com/${key}`,{method:'PUT',headers:{Date:date,'Content-Type':type,'x-oss-security-token':sts.sessionToken,Authorization:`OSS ${sts.accessKey}:${signature}`},body:bytes});
}
function build(){
 console.log('TEST');command('npm',['test']);command('npm',['--prefix','aiui-agent','test']);command('npm',['--prefix','aiui-agent','run','check']);
 const stage=fs.mkdtempSync(path.join(local,'rokid-source-'));
 for(const f of ['AGENTS.md','app.json','app.js','config.js','package.json','.aixignore','pages','lib','licenses'])fs.cpSync(path.join('aiui-agent',f),path.join(stage,f),{recursive:true});
 const aix=path.join(root,'dist/mac-codex-aiui-private.aix');fs.mkdirSync(path.dirname(aix),{recursive:true});
 console.log('BUILD');command(path.join(root,'aiui-agent/node_modules/.bin/aix'),['pack',stage,'-o',aix]);fs.chmodSync(aix,0o600);
 const source=path.join(stage,'../'+path.basename(stage)+'.zip');
 execFileSync('/usr/bin/zip',['-q','-r',source,'.'],{cwd:stage});fs.chmodSync(source,0o600);
 const version=execFileSync('/usr/bin/unzip',['-p',aix,'VERSION'],{encoding:'utf8'}).trim();
 return {aix,source,stage,version};
}
function verify(file,built){
 const names=execFileSync('/usr/bin/unzip',['-Z1',file],{encoding:'utf8'}).trim().split('\n');
 for(const name of ['app.json','AGENTS.md','config.js','pages/index/index.ink','lib/gateway.js','lib/voice-ui.js', 'lib/history.js', 'lib/latency.js','lib/one-shot-audio.js','lib/wav.js'])check(names.includes(name),'cloud_missing_runtime');
 const read=name=>execFileSync('/usr/bin/unzip',['-p',file,name],{encoding:'utf8'});
 const page=read('pages/index/index.ink');check(!page.includes('<button')&&page.includes('TempleControls')&&page.includes('this.speak(ttsText)')&&page.includes('{{item.assistant}}')&&!page.includes('{{summary}}'),'cloud_ux_mismatch');
 const config=read('config.js');const gateway=JSON.parse(fs.readFileSync('.local/config.json'));const token=fs.readFileSync(gateway.tokenFile,'utf8').trim();const endpoint=fs.readFileSync('.local/quick-tunnel-url','utf8').trim();
 check(config.includes(token)&&config.includes(endpoint),'cloud_private_config_mismatch');
 check(read('VERSION').trim()===built.version,'cloud_package_version_mismatch');
 for(const name of ['app.json','AGENTS.md','pages/index/index.ink','lib/gateway.js','lib/voice-ui.js','lib/history.js','lib/latency.js'])check(read(name).trim()===execFileSync('/usr/bin/unzip',['-p',built.aix,name],{encoding:'utf8'}).trim(),'cloud_source_mismatch');
 return {endpointMatches:true,authMatches:true,newUX:true};
}
async function main(){
 const cfg=JSON.parse(fs.readFileSync(path.join(local,'rokid-deploy.json'),'utf8'));
 check(/^[a-f0-9]{32}$/.test(cfg.agentId),'invalid_agent_id');
 const protectedFiles=['aiui-agent/config.js','.local/quick-tunnel-url',...fs.readdirSync('src').map(f=>'src/'+f)];
 const beforeHashes=Object.fromEntries(protectedFiles.map(f=>[f,hash(fs.readFileSync(f))]));
 const built=build();
 let accessToken;
 try{
 if(process.env.ROKID_ACCESS_TOKEN_FILE){const f=process.env.ROKID_ACCESS_TOKEN_FILE;check((fs.statSync(f).mode&0o077)===0,'auth_file_must_be_private');accessToken=fs.readFileSync(f,'utf8').trim();}
 else accessToken=await browserToken(process.env.ROKID_CDP_URL||cfg.cdpUrl);
  const before=await agent(accessToken,cfg.agentId);privateDraft(before,cfg);safeWrite(path.join(local,'rokid-deploy-before.json'),before);
  const sts=await api(accessToken,'/user/oss/getOssSts',null);
  for(const k of ['bucketName','region','directory','accessKey','secretKey','sessionToken'])check(typeof sts[k]==='string'&&sts[k],'missing_upload_credential');
  const dir=sts.directory.replace(/\/+$/,'');check(/^[a-zA-Z0-9/_-]+$/.test(dir)&&!dir.includes('..'),'invalid_upload_prefix');
  const stamp=Date.now();const sourceKey=`${dir}/cache/${cfg.agentId}-cli-${stamp}.zip`,aixKey=`${dir}/${cfg.agentId}-${stamp}.aix`;
  const aixBytes=fs.readFileSync(built.aix),sourceBytes=fs.readFileSync(built.source);
  console.log('UPLOAD_SOURCE');await upload(sts,sourceKey,sourceBytes,'application/zip');
  console.log('UPLOAD_REPACKAGED_AIX');await upload(sts,aixKey,aixBytes,'application/octet-stream');
  const current=await agent(accessToken,cfg.agentId);check(current.nativeVersion===before.nativeVersion&&current.codeFileMd5===before.codeFileMd5&&current.fileMd5===before.fileMd5,'cloud_changed_concurrently');
  const app=JSON.parse(fs.readFileSync('aiui-agent/app.json','utf8'));
  const pages=app.pages.map(route=>{const text=fs.readFileSync('aiui-agent/'+route+'.ink','utf8');const def=JSON.parse(text.match(/<script def>([\s\S]*?)<\/script>/)[1]);return{path:route,title:def.navigationBarTitleText,def}});
  const tools=pages.map(p=>({type:'function',target:'_current',layout:{width:480,height:168},function:{name:p.path,description:p.def.description,parameters:p.def.schema.data}}));
  const cdn=new URL(sts.cdnUrl);check(cdn.protocol==='https:'&&cdn.hostname==='arapp.rokidcdn.com','unexpected_cdn');
  const filePath=cdn.origin+'/'+aixKey;
  const payload={...before,agentName:app.name,prologue:'Нажмите на дужку и говорите.',filePath,fileMd5:hash(aixBytes,'md5'),codeFilePath:sourceKey,codeFileMd5:hash(sourceBytes,'md5'),jsuiTitle:app.name,jsuiVersion:built.version,jsuiPages:JSON.stringify(pages.map(({path,title})=>({path,title}))),jsuiTools:JSON.stringify(tools),cutParamStr:JSON.stringify(tools)};
  console.log('SAVE_PRIVATE_VERSION');
  // Do not retry mutations: after an ambiguous response, reconcile with read-only polling.
  let saveUncertain=false;try{await api(accessToken,'/agent/updateThirdAgent',payload)}catch{saveUncertain=true}
  let after;
  for(let i=0;i<20;i++){const a=await agent(accessToken,cfg.agentId);if(a.fileMd5===payload.fileMd5&&a.filePath===filePath){after=a;break;}await wait(1000)}
  check(after,saveUncertain?'save_outcome_unknown':'cloud_version_not_updated');privateDraft(after,cfg);
  check(after.nativeVersion!==before.nativeVersion,'cloud_version_not_incremented');check(after.permissions===before.permissions,'permissions_changed');
  console.log('DOWNLOAD_CLOUD_AIX');const response=await fetchSafe(after.filePath);const bytes=Buffer.from(await response.arrayBuffer());check(hash(bytes,'md5')===after.fileMd5,'cloud_md5_mismatch');
  const downloaded=path.join(local,'rokid-cloud-verified.aix');fs.writeFileSync(downloaded,bytes,{mode:0o600});
  const verification=verify(downloaded,built);
  for(const [f,h]of Object.entries(beforeHashes))check(hash(fs.readFileSync(f))===h,'protected_file_changed');
  fs.writeFileSync(built.aix+'.sha256',hash(bytes)+'  '+path.basename(built.aix)+'\n',{mode:0o600});
  const report={agentId:cfg.agentId,beforeVersion:before.nativeVersion,cloudVersion:after.nativeVersion,aixVersion:built.version,cloudMd5:after.fileMd5,cloudFilePath:after.filePath,permissions:after.permissions,cloudVerified:true,backendChanged:false,...verification};
  safeWrite(path.join(local,'rokid-deploy-result.json'),report);
  console.log(JSON.stringify({cloudVersion:report.cloudVersion,cloudVerified:true,backendChanged:false}));
 }finally{accessToken='';fs.rmSync(built.stage,{recursive:true,force:true});fs.rmSync(built.source,{force:true});}
}
main().catch(e=>{console.error('DEPLOY_FAILED: '+(/^[a-z0-9_]+$/.test(e.message)?e.message:'operation_failed'));process.exitCode=1});
