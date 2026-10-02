import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {InputTrace,LIMIT} from '../tools/input-probe/lib/trace.js';
test('raw trace observes codes outside production filter without copying content',()=>{
 let now=100;const t=new InputTrace({now:()=>now});t.record(0,'down',{code:'GlobalHook',key:'secret',text:'speech',token:'credential'});now=220;t.record(0,'up',{code:'ArrowLeft'});
 assert.deepEqual(t.snapshot(),[{step:0,edge:'down',code:'GlobalHook',ms:0,repeat:false},{step:0,edge:'up',code:'ArrowLeft',ms:120,repeat:false}]);
 assert.ok(!JSON.stringify(t.snapshot()).includes('secret'));
 t.record(0,'up',{code:'not allowed: arbitrary content'});assert.equal(t.snapshot().at(-1).code,'Unknown');
 for(let n=0;n<LIMIT+20;n++)t.record(1,'up',{code:'Enter'});assert.equal(t.snapshot().length,LIMIT);
});
test('stored trace validates fields and diagnostic page cannot record audio or call gateway',()=>{
 const t=new InputTrace({rows:[{step:0,edge:'up',code:'Enter',ms:1,repeat:false,token:'secret'}]});assert.deepEqual(t.snapshot(),[]);
 const page=fs.readFileSync(new URL('../tools/input-probe/pages/index/index.ink',import.meta.url),'utf8');
 assert.ok(!/getRecorderManager|createTransport|\/v1\/|config\.js|console\./.test(page));
});
test('trace resumes a shared time origin and still discards unknown fields',()=>{
 const first=new InputTrace({now:()=>100});first.record(0,'down',{code:'GlobalHook'});
 const restored=new InputTrace({now:()=>800,rows:first.snapshot(),start:first.start});restored.record(0,'up',{code:'ArrowDown'});
 assert.equal(restored.snapshot()[1].ms,700);assert.equal(restored.snapshot()[0].ms,0);
});
