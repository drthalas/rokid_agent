// Diagnostic-only collector. No free-form text, key value, voice keyword or credentials.
export const ACTIONS = ['1 палец: single tap','1 палец: double tap','1 палец: swipe up','1 палец: swipe down','1 палец: swipe forward','1 палец: swipe back','2 пальца: tap','2 пальца: double tap','2 пальца: long press'];
export const LIMIT = 512;
const EDGES = new Set(['down','up','lifecycle','wakeup']);
const CODE = /^[A-Za-z][A-Za-z0-9]{0,23}$/;
export class InputTrace {
  constructor({now=Date.now,rows=[],start=null}={}) { this.now=now;this.start=Number.isFinite(start)&&start>0&&start<=now()?start:now();this.rows=rows.filter(valid).slice(-LIMIT); }
  record(step,edge,event={}) {
    if(!Number.isInteger(step)||step<0||step>=ACTIONS.length||!EDGES.has(edge))return;
    const code=typeof event.code==='string'&&CODE.test(event.code)?event.code:'Unknown';
    this.rows.push({step,edge,code,ms:Math.max(0,this.now()-this.start),repeat:event.repeat===true});this.rows=this.rows.slice(-LIMIT);
  }
  snapshot(){return this.rows.map(r=>({...r}));}
  text(step){return this.rows.filter(r=>r.step===step).map(r=>`${r.ms} ${r.edge} ${r.code}${r.repeat?' repeat':''}`).join('\n')||'Нет событий страницы';}
}
function valid(r){return r&&Number.isInteger(r.step)&&r.step>=0&&r.step<ACTIONS.length&&EDGES.has(r.edge)&&typeof r.code==='string'&&CODE.test(r.code)&&Number.isFinite(r.ms)&&r.ms>=0&&typeof r.repeat==='boolean'&&Object.keys(r).every(k=>['step','edge','code','ms','repeat'].includes(k));}
