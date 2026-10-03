import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {EventEmitter} from 'node:events';import {randomUUID} from 'node:crypto';
import {Engine} from '../src/engine.mjs';import {fixture} from './helpers.mjs';
import {desktopCaptureScript} from '../src/screenshot-instructions.mjs';
test('new and resumed gateway threads receive scoped capture/attachment instructions without policy overrides',async()=>{
 const f=fixture(),codex=new EventEmitter(),calls=[];
 codex.ready=true;codex.verifyCapabilities=async()=>{};codex.recordProfile=()=>{};
 codex.request=async(method,params)=>{calls.push({method,params});return {thread:{id:'capture-thread',cwd:f.dir,status:{type:'idle'},turns:[]}}};
 const e=new Engine(f.config,codex);
 try{
  await e.recover();const s=await e.create({requestId:randomUUID()});await e.recover();
  const instructions=calls.filter(x=>['thread/start','thread/resume'].includes(x.method));assert.equal(instructions.length,2);
  for(const c of instructions){
   assert.equal(c.params.sandbox,'workspace-write');assert.equal(c.params.approvalPolicy,'on-request');assert.equal(c.params.approvalsReviewer,'auto_review');
   const text=c.params.developerInstructions;
   assert.match(text,/app\.getScreenshot\(\)/);assert.match(text,/exact resulting CUA image/);assert.match(text,/FULL DESKTOP.*insufficient/s);
   assert.ok(text.includes(desktopCaptureScript));assert.match(text,/Never open Screenshot utility or private screencaptureui/);
   assert.match(text,/body\.base64_url_content/);assert.match(text,/NEVER send_email\/send_draft/);assert.match(text,/verify DRAFT/);
   assert.match(text,/Не удалось сделать снимок рабочего стола/);assert.match(text,/Не удалось прикрепить снимок к черновику/);
  }
  assert.ok(fs.existsSync(desktopCaptureScript));assert.equal(s.threadId,'capture-thread');
 }finally{e.close();f.cleanup()}
});
