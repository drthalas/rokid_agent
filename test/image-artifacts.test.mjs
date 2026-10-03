import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ImageArtifacts} from '../src/image-artifacts.mjs';
const png=Buffer.from('89504e470d0a1a0a00000000','hex');
const item=(bytes=png)=>({id:'item',type:'mcpToolCall',server:'cua_repl',status:'completed',result:{content:[{type:'image',mimeType:'image/png',data:bytes.toString('base64')}]}});
test('native image artifact is private, bounded, deduped and cleaned by owning turn',()=>{
 const a=new ImageArtifacts();try{const image=a.capture('session','turn',item());assert.ok(image);assert.equal(fs.statSync(image.path).mode&0o777,0o600);assert.deepEqual(fs.readFileSync(image.path),png);assert.equal(a.capture('session','turn',item()),null);a.clearTurn('foreign','turn');assert.ok(fs.existsSync(image.path));a.clearTurn('session','turn');assert.equal(fs.existsSync(image.path),false);}finally{a.close()}
});
test('unknown/failed tool content and fake image are never exported',()=>{
 const a=new ImageArtifacts();try{assert.equal(a.capture('s','t',{...item(),server:'other'}),null);assert.equal(a.capture('s','t',{...item(),status:'failed'}),null);assert.equal(a.capture('s','t',item(Buffer.from('not image'))),null);}finally{a.close()}
});
test('artifact TTL removes only generated files even when turn never finishes',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const a=new ImageArtifacts();try{const image=a.capture('s','t',item());t.mock.timers.tick(600000);assert.equal(fs.existsSync(image.path),false);}finally{a.close()}
});
test('duplicate emitted image blocks create one artifact and ambiguous different images are rejected',()=>{
 const a=new ImageArtifacts();try{const i=item();i.result.content.push({...i.result.content[0]});assert.ok(a.capture('s','t',i));const j=item();j.result.content.push({...j.result.content[0],data:Buffer.from('89504e470d0a1a0a00000001','hex').toString('base64')});assert.equal(a.capture('s','next',j),null);}finally{a.close()}
});
test('failed unlink retains ownership for retry instead of forgetting private file',t=>{
 const a=new ImageArtifacts();try{const image=a.capture('s','t',item());const original=fs.unlinkSync;t.mock.method(fs,'unlinkSync',()=>{throw Object.assign(Error('denied'),{code:'EACCES'})});a.clearTurn('s','t');assert.equal(a.files.size,1);assert.ok(fs.existsSync(image.path));fs.unlinkSync=original;a.clearTurn('s','t');assert.equal(a.files.size,0);assert.equal(fs.existsSync(image.path),false);}finally{a.close()}
});
test('third result image replaces oldest same-turn observation and retains exact source identity',()=>{
 const a=new ImageArtifacts();try{
  const first=a.capture('s','t',item());
  const second=a.capture('s','t',item(Buffer.concat([png,Buffer.from([1])])));
  const final=a.capture('s','t',{...item(Buffer.concat([png,Buffer.from([2])])),id:'result50'});
  assert.ok(final);assert.equal(final.turnId,'t');assert.equal(final.itemId,'result50');assert.equal(a.files.size,2);
  assert.equal(fs.existsSync(first.path),false);assert.ok(fs.existsSync(second.path));assert.ok(fs.existsSync(final.path));
 }finally{a.close()}
});
test('failed oldest-image eviction does not exceed per-turn bound',t=>{
 const a=new ImageArtifacts();try{
  a.capture('s','t',item());a.capture('s','t',item(Buffer.concat([png,Buffer.from([1])])));
  const original=fs.unlinkSync;t.mock.method(fs,'unlinkSync',()=>{throw Object.assign(Error('denied'),{code:'EACCES'})});
  assert.equal(a.capture('s','t',item(Buffer.concat([png,Buffer.from([2])]))),null);assert.equal(a.files.size,2);
  fs.unlinkSync=original;
 }finally{a.close()}
});
