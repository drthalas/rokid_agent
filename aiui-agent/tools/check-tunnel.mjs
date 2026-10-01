import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const origin=fs.readFileSync(path.join(root,'.local/quick-tunnel-url'),'utf8').trim();
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin))throw Error('invalid_quick_tunnel_origin');
const config=JSON.parse(fs.readFileSync(path.join(root,'.local/config.json'),'utf8'));
const token=fs.readFileSync(config.tokenFile,'utf8').trim();
function get(route, authorization) {
  return new Promise((resolve,reject)=>{
    // Normal public CA/hostname verification; never pass rejectUnauthorized:false here.
    const req=https.get(origin+route,{headers:authorization?{authorization:'Bearer '+authorization}:{}},res=>{
      const parts=[];res.on('data',x=>parts.push(x));res.on('end',()=>{
        let body;try{body=JSON.parse(Buffer.concat(parts));}catch{body=null;}
        resolve({status:res.statusCode,body,tlsAuthorized:res.socket?.authorized??true});
      });
    });req.setTimeout(15000,()=>req.destroy(new Error('timeout')));req.on('error',reject);
  });
}
let report;
for(let attempt=0;attempt<10;attempt++){
  try{
    const unauthenticated=await get('/v1/health');
    const incorrectToken=await get('/v1/health','invalid-smoke-token');
    const authenticated=await get('/v1/health',token);
    const admin=await get('/admin/approvals',token);
    if(unauthenticated.status!==401||incorrectToken.status!==401||authenticated.status!==200||!authenticated.body?.codex||!authenticated.body?.loggedIn||admin.status!==404)throw Error('unexpected_status');
    report={unauthenticated:unauthenticated.status,incorrectToken:incorrectToken.status,authenticated:authenticated.status,health:authenticated.body,adminUnavailable:admin.status,publicTLSVerified:true};break;
  }catch{if(attempt===9)throw Error('tunnel_check_failed');await new Promise(r=>setTimeout(r,2000));}
}
fs.writeFileSync(path.join(root,'.local/quick-tunnel-check.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(report,null,2));
