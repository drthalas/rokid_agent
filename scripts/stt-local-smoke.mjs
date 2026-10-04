// Real isolated authenticated HTTPS STT smoke. No production config/account or Codex process.
import fs from 'node:fs';
import os from 'node:os';
import https from 'node:https';
import assert from 'node:assert/strict';
import { fixture } from '../test/helpers.mjs';
import { serve } from '../src/server.mjs';
import { validateWav } from '../src/stt.mjs';
const [sttFile,wavFile]=process.argv.slice(2);
const stt=JSON.parse(fs.readFileSync(sttFile));
const wav=fs.readFileSync(wavFile);validateWav(wav);
const temporary=()=>new Set(fs.readdirSync(os.tmpdir()).filter(n=>n.startsWith('rokid-stt-')));
const before=temporary(), f=fixture();let servers;
try {
 f.config.stt=stt; servers=await serve(f.config,{});
 const request=(audio,token)=>new Promise((resolve,reject)=>{
  const req=https.request({hostname:'127.0.0.1',port:servers.server.address().port,servername:'localhost',ca:fs.readFileSync(f.config.certFile),path:'/v1/stt',method:'POST',headers:{authorization:'Bearer '+token,'content-type':'audio/wav'}},res=>{
   const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks))}));
  });req.on('error',reject);req.end(audio);
 });
 const token=fs.readFileSync(f.config.tokenFile,'utf8');assert.equal((await request(wav,'invalid')).status,401);
 assert.equal((await request(Buffer.alloc(10),token)).status,400);
 const start=Date.now(),result=await request(wav,token);assert.equal(result.status,200);
 assert.equal(typeof result.body.text,'string');assert.ok(result.body.text.length);
 assert.deepEqual(Object.keys(result.body).sort(),['clock','text','timing']);
 assert.ok(!JSON.stringify(result.body).includes('--prompt'));assert.ok(!JSON.stringify(result.body).includes('stderr'));
 // The fixture engine has no turn method: /v1/stt must never execute the transcript.
 assert.ok([...temporary()].every(n=>before.has(n)),'new temporary audio directories must be cleaned');
 console.log(JSON.stringify({pass:true,source:'isolated HTTPS and controlled WAV; no production restart',durationSeconds:(wav.length-44)/32000,wallMs:Date.now()-start,timing:result.body.timing,cleanup:true,auth:true,protocolUnchanged:true}));
} finally {await servers?.close();f.cleanup();}
