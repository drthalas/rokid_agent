import test from 'node:test';
import assert from 'node:assert/strict';
import {TempleControls,briefAnswer,errorView} from '../lib/voice-ui.js';

test('GlobalHook down/up + Enter is one tap; Backspace preserves native close',()=>{
 let time=0,taps=0,exits=0,prevented=0;const trace=[];
 const controls=new TempleControls({tap:()=>taps++,exit:()=>exits++,scroll:()=>{},trace:e=>trace.push(e),now:()=>time});
 const e=code=>({code,preventDefault:()=>prevented++});
 controls.handle('down',e('GlobalHook'));time=30;controls.handle('up',e('GlobalHook'));time=40;controls.handle('up',e('Enter'));
 assert.equal(taps,1);
 time=500;controls.handle('down',e('GlobalHook'));controls.handle('down',e('Backspace'));controls.handle('up',e('Backspace'));
 assert.equal(taps,1);assert.equal(exits,1);assert.equal(prevented,2);assert.deepEqual(Object.keys(trace[0]),['edge','code']);
});
test('Enter only, GlobalHook up-only, long held down/up, repeats and swipe',()=>{
 let time=1000,taps=0,scrolls=[];const c=new TempleControls({tap:()=>taps++,exit:()=>{},scroll:d=>scrolls.push(d),now:()=>time});
 c.handle('down',{code:'Enter'});c.handle('up',{code:'Enter'});assert.equal(taps,1);
 time=2000;c.handle('up',{code:'GlobalHook'});assert.equal(taps,2);
 time=3000;c.handle('down',{code:'GlobalHook'});time=4500;c.handle('up',{code:'GlobalHook'});c.handle('up',{code:'Enter'});assert.equal(taps,3);
 time=5500;c.handle('down',{code:'GlobalHook',repeat:true});assert.equal(taps,3);
 c.handle('up',{code:'ArrowDown'});c.handle('up',{code:'ArrowUp'});assert.deepEqual(scrolls,[1,-1]);
});
test('brief answer is bounded, plain and extractive; full response is not modified',()=>{
 const short='Я работаю через ваш Mac.';assert.equal(briefAnswer(short),short);
 const long='Первое предложение. Второе предложение. '+ 'Полный ответ. '.repeat(100);
 assert.equal(briefAnswer(long),'Первое предложение. Второе предложение.');assert.ok(long.length>1000);
 assert.ok(briefAnswer('слово '.repeat(300)).length<=300);
 assert.equal(briefAnswer('```js\nconst x = 1;\n```'),'Ответ содержит код. Полный текст ниже.');
 assert.equal(errorView('codex_unavailable').title,'Codex недоступен на Mac');
});
