import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {captureDesktop,cleanupDesktop,pngMetadata,CAPTURE_FAILURE,CAPTURE_TTL} from '../src/desktop-capture.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5xkAAAAASUVORK5CYII=','base64');
const fake=async(binary,args)=>{if(binary==='/usr/sbin/screencapture')fs.writeFileSync(args.at(-1),png);else fs.copyFileSync(args[3],args.at(-1));};
test('desktop capture is noninteractive, validates PNG and owns private lease',async()=>{
 const calls=[];const c=await captureDesktop({run:async(b,a)=>{calls.push([b,a]);return fake(b,a)},now:()=>100});
 try{
  assert.equal(c.source,'full-desktop');assert.equal(c.expiresAt,100+CAPTURE_TTL);assert.equal(c.images.length,1);
  assert.deepEqual(calls[0][1].slice(0,-1),['-x','-t','png']);assert.equal(calls[0][0],'/usr/sbin/screencapture');
  assert.equal(calls[1][0],'/usr/bin/sips');assert.equal(c.images[0].width,1);assert.equal(c.images[0].mimeType,'image/png');
  assert.equal(fs.statSync(c.directory).mode&0o777,0o700);assert.equal(fs.statSync(c.images[0].path).mode&0o777,0o600);
  assert.deepEqual(fs.readFileSync(c.images[0].path),png);
 }finally{cleanupDesktop(c.directory)}assert.equal(fs.existsSync(c.directory),false);cleanupDesktop(c.directory);
});
test('capture/decoder failure gives useful stage error and cleans partial images',async()=>{
 for(const failAt of ['capture','decode','invalid']){
  let directory;await assert.rejects(captureDesktop({run:async(b,a)=>{
   if(b==='/usr/sbin/screencapture'){directory=path.dirname(a.at(-1));fs.writeFileSync(a.at(-1),failAt==='invalid'?'bad':png);if(failAt==='capture')throw Error('private process error');}
   else throw Error('decode failed');
  }}),{message:CAPTURE_FAILURE});assert.equal(fs.existsSync(directory),false);
 }
});
test('all display files are returned and malformed/empty output fails',async()=>{
 const c=await captureDesktop({run:async(b,a)=>{await fake(b,a);if(b==='/usr/sbin/screencapture')fs.writeFileSync(path.join(path.dirname(a.at(-1)),'desktop2.png'),png)}});
 try{assert.equal(c.images.length,2)}finally{cleanupDesktop(c.directory)}
 await assert.rejects(captureDesktop({run:async()=>{}}),{message:CAPTURE_FAILURE});
});
test('cleanup cannot target arbitrary paths or follow a directory symlink',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foreign-'));const link=path.join(fs.realpathSync(os.tmpdir()),'jarvis-desktop-123abc');
 try{fs.symlinkSync(dir,link);assert.throws(()=>cleanupDesktop(dir));assert.throws(()=>cleanupDesktop(link));assert.ok(fs.existsSync(dir));}
 finally{fs.unlinkSync(link);fs.rmdirSync(dir)}
});
test('expired independent lease removes files even without caller handoff',()=>{
 const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'jarvis-desktop-'));fs.chmodSync(dir,0o700);fs.writeFileSync(path.join(dir,'desktop.png'),png,{mode:0o600});
 execFileSync(process.execPath,['scripts/desktop-capture.mjs','--expire',dir,String(Date.now()-1)],{timeout:5000});assert.equal(fs.existsSync(dir),false);
});
