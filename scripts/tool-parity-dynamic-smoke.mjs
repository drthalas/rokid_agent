// Scope an existing MCP disable/re-enable to a temporary trusted project; never edit user config.
import fs from 'node:fs';import path from 'node:path';import net from 'node:net';
import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
import {Codex,spawnSpec,childEnv} from '../src/codex.mjs';import {policy} from '../src/protocol.mjs';import {fixture,delay} from '../test/helpers.mjs';
const f=fixture(),cwd=f.config.projects.demo,server=process.argv[2]??'node_repl';
if(!/^[A-Za-z0-9_-]+$/.test(server))throw Error('invalid_server_name');
fs.mkdirSync(path.join(cwd,'.codex'));const results=[];
try{
 for(const enabled of [false,true]){
  fs.writeFileSync(path.join(cwd,'.codex/config.toml'),`[mcp_servers.${server}]\nenabled = ${enabled}\n[apps._default]\ndefault_tools_approval_mode = "prompt"\n`);
  const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
  const spec=spawnSpec(process.env.CODEX_BINARY??'codex',port);
  const child=spawn(spec.command,[...spec.args,'-c',`projects.${cwd}.trust_level="trusted"`],{...spec.options,env:childEnv()});child.on('error',()=>{});
  const codex=new Codex({port,attach:true,timeout:60000});
  try{
   await codex.start();const effective=await codex.request('config/read',{cwd});
   assert.equal(effective.config.mcp_servers[server].enabled,enabled);
   assert.equal(effective.config.apps._default.default_tools_approval_mode,'prompt');
   const {thread}=await codex.request('thread/start',{cwd,ephemeral:true,...policy});
   await codex.verifyCapabilities(thread.id,cwd);
   const deadline=Date.now()+20000;let status;
   do{status=(await codex.serverStatus(thread.id)).find(s=>s.name===server);if(status?.runtimeStatus!=='starting')break;await delay(200)}while(Date.now()<deadline);
   assert.equal(status?.runtimeStatus,enabled?'connected':'disabled');assert.equal(Object.keys(status.tools??{}).length>0,enabled);
   results.push({server,enabled,status:status.runtimeStatus,tools:Object.keys(status.tools??{}).length});
  }finally{await codex.close();child.kill('SIGTERM');await new Promise(r=>{if(child.exitCode!==null)return r();const timer=setTimeout(()=>{child.kill('SIGKILL');r()},3000);child.once('exit',()=>{clearTimeout(timer);r()})})}
 }
 console.log(JSON.stringify({pass:true,separateProcessPerPhase:true,userConfigChanged:false,results},null,2));
}finally{f.cleanup()}
