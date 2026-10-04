// Optional real Ink WASM check in Node, without a browser or production services.
// Args: extracted @yodaos-pkg/ink package directory, @napi-rs/canvas module, output directory.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { answerLines } from '../aiui-agent/lib/answer-lines.js';
const [runtime, canvasModule, output] = process.argv.slice(2).map(p => path.resolve(p));
const { createCanvas, ImageData } = await import(pathToFileURL(canvasModule));
const canvas = createCanvas(480, 352);
// Only Web host services; layout/text shaping and painting remain real Ink WASM.
Object.assign(globalThis, { HTMLCanvasElement:canvas.constructor, CanvasRenderingContext2D:canvas.getContext('2d').constructor, ImageData, Window:class Window {} });
globalThis.window = new Window();
Object.assign(window, { crypto:globalThis.crypto, performance, setTimeout, clearTimeout, localStorage:{getItem:()=>null,setItem(){},removeItem(){}} });
const { default:init, InkWebView, get_version } = await import(pathToFileURL(path.join(runtime, 'pkg/ink_web.js')));
await init({module_or_path:fs.readFileSync(path.join(runtime, 'pkg/ink_web_bg.wasm'))});
const fixture = JSON.parse(fs.readFileSync(new URL('../test/fixtures/linear-answer.json',import.meta.url)));
const source = fs.readFileSync(new URL('../aiui-agent/pages/index/index.ink',import.meta.url),'utf8');
const styles = source.match(/<style>([\s\S]*?)<\/style>/)[1];
const fixed = source.match(/(<view ink:if="{{item.assistant}}" class="assistant-lines">[\s\S]*?\n          <\/view>)/)[1];
const old = '<text class="body">{{item.assistant}}</text>';
fs.mkdirSync(output,{recursive:true,mode:0o700});
async function render(name, markup, answer) {
 const v=new InkWebView(480,352,1,30,'bounded',undefined,undefined,false,'deny',{},[]);
 try {
  v.bindCanvas(canvas);
  const data={history:[{assistant:answer,assistantLines:answerLines(answer)}]};
  const page=`<script def>{"schema":{"data":{"type":"object","properties":{}}}}</script><script setup>export default {data:${JSON.stringify(data)}}</script><page><view class="probe"><view ink:for="{{history}}">${markup}</view></view></page><style>${styles}\n.probe{display:flex;flex-direction:column;width:448px;color:#40ff5e;background-color:#000000;}</style>`;
  const files=new Map(Object.entries({'app.json':JSON.stringify({pages:['pages/index/index']}),'pages/index/index.ink':page}).map(([k,v])=>[k,new TextEncoder().encode(v)]));
  v.openBundle('layout-'+name,files,'pages/index/index',undefined,{initialTarget:'_blank'});
  for(let i=0;i<4;i++){v.render();await new Promise(r=>setTimeout(r,5));}
  fs.writeFileSync(path.join(output,name+'.png'),canvas.toBuffer('image/png'));
  const pixels=canvas.getContext('2d').getImageData(0,0,480,352).data, bands=[];let active=false;
  for(let y=0;y<352;y++) {let ink=false;for(let x=0;x<480;x++)if(pixels[(y*480+x)*4+1]>50){ink=true;break;}
   if(ink&&!active)bands.push({start:y,end:y});if(ink)bands.at(-1).end=y;active=ink;
  }
  return bands;
 } finally {v.destroy();}
}
const before=await render('before',old,fixture.answer), after=await render('after',fixed,fixture.answer);
const flat=await render('flattened',old,fixture.answer.replace(/\n/g,' '));
assert.deepEqual(before,flat,'old text must reproduce collapsed newlines');
assert.ok(after.length>=4,'heading and three logical items must occupy separate lines');
assert.ok(after[1].start-after[0].end>after.at(-1).start-after.at(-2).end,'blank section adds vertical space');
const prose='Готово. Черновик сохранён.';
assert.deepEqual(await render('prose-before',old,prose),await render('prose-after',fixed,prose),'ordinary prose layout is unchanged');
const result={runtime:get_version(),source:'official Ink WASM under Node canvas host; not physical RV101',before,after,prose:'PASS'};
fs.writeFileSync(path.join(output,'layout.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
