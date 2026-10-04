import test from 'node:test';
import assert from 'node:assert/strict';
import { answerLines } from '../lib/answer-lines.js';
import { briefAnswer } from '../lib/voice-ui.js';
test('logical lines preserve names, URLs, blank sections and prose without sentence splitting',()=>{
 const text='Готово. Черновик сохранён.';assert.deepEqual(answerLines(text),[{id:0,text,blank:false}]);
 const structured='Linear\r\n\r\n• ALE-470 — Jarvis, Rokid, Codex\rhttps://example.com/AIX?q=Gmail';
 assert.deepEqual(answerLines(structured).map(l=>l.text),['Linear','','• ALE-470 — Jarvis, Rokid, Codex','https://example.com/AIX?q=Gmail']);
 assert.equal(answerLines(structured)[1].blank,true);
 assert.equal(answerLines('x'.repeat(17000))[0].text.length,16000);
 assert.equal(briefAnswer('Задачи\n\n• ALE-470 — **Jarvis**\n1. [Linear](https://example.com)\n---\nГотово.'),'Задачи ALE-470 — Jarvis Linear Готово.');
 assert.equal(briefAnswer(text),text);
});
