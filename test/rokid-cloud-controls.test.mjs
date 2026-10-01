import test from 'node:test';import assert from 'node:assert/strict';
import {repackageCloud} from '../scripts/rokid-cloud-repackage.mjs';
function fixture(status='draft',wrongAgent=false){
 const actions=[];let saved=false;
 const metadata=()=>({id:'agent',version:saved?'1.0.8':'1.0.6',status,permissions:'INTERNET,CAMERA,RECORD_AUDIO,SPEAKER',fileMd5:saved?'new':'old'});
 const tab={capabilities:{get:async()=>({send:async()=>({result:{value:metadata()}})})},playwright:{getByRole:(role,{name})=>({
   isVisible:async()=>false,
   click:async()=>{actions.push(name);if(name==='Save Details')saved=true},
   fill:async()=>actions.push('fill:'+name),
   waitFor:async()=>{},evaluate:async()=>wrongAgent?'other':'agent'
 })}};
 return{tab,actions};
}
test('cloud fallback only repackages/saves the expected private agent and preserves permissions',async()=>{
 const f=fixture();const result=await repackageCloud(f.tab,{agentId:'agent'});
 assert.equal(result.after.version,'1.0.8');assert.ok(f.actions.includes('Repackage AIX'));assert.ok(f.actions.includes('Save Details'));
 assert.equal(f.actions.some(x=>/Submit|Review$|Delete/.test(x)&&x!=='Build & Review'),false);
});
test('cloud fallback fails closed for public state or a different active agent',async()=>{
 await assert.rejects(repackageCloud(fixture('published').tab,{agentId:'agent'}),/private_draft_required/);
 const f=fixture('draft',true);await assert.rejects(repackageCloud(f.tab,{agentId:'agent'}),/wrong_active_agent/);assert.equal(f.actions.includes('Repackage AIX'),false);
});
