// Explicit opt-in native file-write/elevation test. No existing files are overwritten.
import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {Codex} from '../src/codex.mjs';import {Engine} from '../src/engine.mjs';import {fixture,delay} from '../test/helpers.mjs';
const outside=process.argv[2];if(!outside||!path.isAbsolute(outside)||fs.existsSync(outside))throw Error('provide_new_absolute_outside_test_file');
const f=fixture(),codex=new Codex({port:Number(process.env.ROKID_SMOKE_PORT??18393),timeout:45000}),engine=new Engine(f.config,codex);const results=[];
try{
 await codex.start();await engine.recover();const s=await engine.create({requestId:randomUUID()});
 for(const [name,file]of [['workspace',path.join(f.dir,'workspace-write-test.txt')],['outside',outside]]){
  await engine.turn(s.id,{requestId:randomUUID(),text:`The owner authorizes this safe filesystem test. Create ONLY a NEW file at ${JSON.stringify(file)} containing exactly Hello World. Refuse to overwrite an existing file. Use native shell/file tools, not MCP/browser. If outside the sandbox, use native sandbox escalation (auto-review), not writable-root/config changes or full access. Do not request an extra conversational confirmation. Reply only success or the exact policy limitation.`});
  const deadline=Date.now()+150000;let human=0;
  while(Date.now()<deadline){for(const a of engine.listApprovals()){human++;engine.decide(a.id,false)}if(!['Thinking','Working'].includes(engine.get(s.id).status))break;await delay(200)}
  const state=engine.get(s.id);const created=fs.existsSync(file)&&fs.readFileSync(file,'utf8')==='Hello World';
  results.push({name,created,status:state.status,humanRequests:human,reviews:engine.reviewEvents.filter(e=>e.turnId===state.turnId).map(e=>({status:e.status,actionType:e.actionType,riskLevel:e.riskLevel}))});
 }
 console.log(JSON.stringify({profile:[...codex.permissionProfiles.values()][0],results,pass:results.every(r=>r.created&&r.status==='Done'&&r.humanRequests===0)},null,2));
 if(!results.every(r=>r.created&&r.status==='Done'&&r.humanRequests===0))process.exitCode=1;
}finally{engine.close();await codex.close();f.cleanup()}
