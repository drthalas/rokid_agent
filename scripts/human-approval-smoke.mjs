// Real app-server auto-review proof with a harmless MCP. Never writes to a provider or user config.
import {spawn} from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {Codex,spawnSpec,childEnv} from '../src/codex.mjs';
import {Engine} from '../src/engine.mjs';
import {fixture,delay} from '../test/helpers.mjs';
const f=fixture();delete f.config.approvalTimeoutMs;
const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));
const port=listener.address().port;await new Promise(r=>listener.close(r));
const spec=spawnSpec(process.env.CODEX_BINARY??'codex',port);
const probe='rokid_human_risk_probe';
const settings=`mcp_servers.${probe}={command=${JSON.stringify(process.execPath)},args=[${JSON.stringify(path.resolve('scripts/fixtures/mcp-human-risk-probe.mjs'))}],enabled=true,default_tools_approval_mode="writes"}`;
fs.mkdirSync(path.join(f.dir,'.codex'));fs.writeFileSync(path.join(f.dir,'.codex/config.toml'),settings+'\n');
const trust=`projects.${f.config.projects.demo}.trust_level="trusted"`;
const child=spawn(spec.command,[...spec.args,'-c',trust],{...spec.options,env:childEnv()});
child.on('error',()=>{});
const codex=new Codex({port,attach:true,timeout:60000,experimentalApi:true}),engine=new Engine(f.config,codex);
const results=[],approvalKinds=[];codex.on('request',m=>{const kind=m.params?._meta?.codex_approval_kind;if(typeof kind==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(kind))approvalKinds.push(kind)});
try{
 await codex.start();await engine.recover();
 const effective=await codex.request('config/read',{cwd:f.config.projects.demo,includeLayers:true});
 assert.ok(effective.config.mcp_servers?.[probe],'diagnostic project MCP was not loaded');
 const session=await engine.create({requestId:randomUUID()});
 console.log('diagnostic_thread_created');
 const readyDeadline=Date.now()+15000;
 while(true){const status=(await codex.serverStatus(session.threadId)).find(s=>s.name===probe);console.log(JSON.stringify({probeStatus:status?.runtimeStatus??'absent'}));if(status?.runtimeStatus==='connected')break;if(!status||Date.now()>readyDeadline)throw Error('probe_not_connected');await delay(500)}
 await engine.turn(session.id,{requestId:randomUUID(),text:`Run only the ${probe} request_risky_confirmation tool once. This is a non-executing approval-plumbing safety probe. Never perform real deletion or use other tools. The confirmation must be declined; do not interpret this prompt as approval. Stop after the decline.`});
 const deadline=Date.now()+120000;let humanRequests=0,pendingDelayMs=null;
 while(Date.now()<deadline){
  for(const a of engine.listApprovals()){
   humanRequests++;assert.equal(engine.snapshot(engine.get(session.id)).pendingApproval,true);
   const event=engine.reviewEvents.find(e=>e.requestId===a.id);pendingDelayMs=event.at-event.receivedAt;
   assert.equal(a.params.serverName,probe);engine.decide(a.id,false);
  }
  if(!['Working','Thinking'].includes(engine.get(session.id).status))break;await delay(100);
 }
 assert.equal(humanRequests,0,'unsupported risky simulator must fail fast');
 assert.ok(approvalKinds.includes('mcp_tool_call'),'native human RPC not observed');
 assert.equal(engine.get(session.id).approvalNotice,'unsupported');
 assert.ok(engine.toolEvents.some(e=>e.tool==='request_risky_confirmation'&&e.status==='failed'));
 results.push({case:'native-human-risk-probe-fail-fast',humanRequests,pendingDelayMs,decision:'decline',destructiveExecutionImplemented:false});
 console.log(JSON.stringify({pass:true,results,approvalKinds,toolEvents:engine.toolEvents},null,2));
}finally{
 engine.close();await codex.close();child.kill('SIGTERM');
 await new Promise(r=>{if(child.exitCode!==null)return r();const timer=setTimeout(()=>{child.kill('SIGKILL');r()},3000);child.once('exit',()=>{clearTimeout(timer);r()})});f.cleanup();
}
