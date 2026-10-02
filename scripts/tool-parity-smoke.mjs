// Real app-server approval proof with a harmless MCP. Never writes to a provider or user config.
import {spawn} from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {Codex,spawnSpec,childEnv} from '../src/codex.mjs';
import {Engine} from '../src/engine.mjs';
import {fixture,delay} from '../test/helpers.mjs';
const f=fixture();f.config.approvalTimeoutMs=10000;
const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));
const port=listener.address().port;await new Promise(r=>listener.close(r));
const spec=spawnSpec(process.env.CODEX_BINARY??'codex',port);
const probe='rokid_parity_probe';
const settings=`mcp_servers.${probe}={command=${JSON.stringify(process.execPath)},args=[${JSON.stringify(path.resolve('scripts/fixtures/mcp-approval-probe.mjs'))}],enabled=true,default_tools_approval_mode="writes"}`;
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
 const counter=async()=>{const r=await codex.request('mcpServer/tool/call',{threadId:session.threadId,server:probe,tool:'read_counter',arguments:{}});return JSON.parse(r.content.find(c=>c.type==='text').text).counter};
 assert.equal(await counter(),0);
 for(const allow of [false,true]){
  console.log(allow?'case_local_accept':'case_decline');
  await engine.turn(session.id,{requestId:randomUUID(),text:`Use only the ${probe} MCP increment_counter tool exactly once. This is a harmless in-memory test. Do not use shell, browser, other tools, or retry. If approval is declined, stop. Reply only Done or Declined.`});
  const deadline=Date.now()+120000;let approvals=0;
  while(Date.now()<deadline){
   for(const a of engine.listApprovals()){
    const expected=a.method==='mcpServer/elicitation/request'&&a.params.serverName===probe;
    assert.equal(await counter(),0,'write executed before local decision');
    engine.decide(a.id,expected&&allow);if(expected)approvals++;
   }
   const s=engine.get(session.id);if(!['Working','Thinking'].includes(s.status))break;await delay(200);
  }
  assert.ok(!['Working','Thinking'].includes(engine.get(session.id).status),'turn timeout');
  assert.equal(approvals,1,'expected exactly one native approval');
  const actual=await counter();assert.equal(actual,allow?1:0);
  results.push({case:allow?'explicit-local-accept':'decline',approvalCount:approvals,counter:actual});
 }
 console.log(JSON.stringify({pass:true,results,approvalKinds,toolEvents:engine.toolEvents},null,2));
}finally{
 engine.close();await codex.close();child.kill('SIGTERM');
 await new Promise(r=>{if(child.exitCode!==null)return r();const timer=setTimeout(()=>{child.kill('SIGKILL');r()},3000);child.once('exit',()=>{clearTimeout(timer);r()})});f.cleanup();
}
