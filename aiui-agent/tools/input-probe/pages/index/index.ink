<script def>
{"navigationBarTitleText":"RV101 Input Probe","description":"Diagnostic-only raw event trace. No microphone or Codex tasks.","schema":{"data":{"type":"object","properties":{}}}}
</script>
<script setup>
import {InputTrace,ACTIONS} from '../../lib/trace.js';
const KEY='rokid-input-probe-v1';
export default {
 data:{title:'Подготовка: 3 секунды',hint:'Затем повторите показанный жест 3 раза',traceText:'',remaining:3},
 onLoad(){this.step=0;this.review=false;this.visible=false;this.trace=new InputTrace();this.restore=null;
  try{const s=wx.getStorageSync(KEY);if(s?.complete){this.trace=new InputTrace({rows:s.rows||[],start:s.start});this.review=true;}else if(s&&Number.isInteger(s.step)&&s.step>=0&&s.step<ACTIONS.length){this.step=s.step;this.trace=new InputTrace({rows:s.rows||[],start:s.start});}}catch{}
 },
 onShow(){this.visible=true;this.trace.record(this.step,'lifecycle',{code:'PageShow'});this.seconds=this.review?8:3;this.preparing=!this.review;this.paint();this.tickTimer=setInterval(()=>this.tick(),1000);},
 tick(){if(!this.visible)return;this.seconds--;if(this.seconds<=0){
  if(this.preparing){this.preparing=false;this.seconds=10;}
  else{this.step++;if(this.step>=ACTIONS.length){this.step=0;this.review=true;}this.preparing=!this.review;this.seconds=this.review?8:3;}
  this.save();}this.paint();},
 paint(){this.setData({title:this.preparing?'Подготовка':`${this.review?'Результат':'Тест'} ${this.step+1}/9 · ${ACTIONS[this.step]}`,
  hint:this.review?'Запишите коды с экрана; результаты листаются автоматически. Back — выход.':'Повторите жест 3 раза. Микрофон выключен.',remaining:this.seconds,traceText:this.trace.text(this.step)});},
 record(edge,event){if(!this.visible||this.review||this.preparing)return;this.trace.record(this.step,edge,event);this.save();this.paint();},
 onKeyDown(event){this.record('down',event);},
 onKeyUp(event){this.record('up',event);if(!this.review)event.preventDefault?.();},
 onVoiceWakeup(event){this.record('wakeup',{code:event.keyword==='clickAiAssist'?'AIShortcut':'VoiceWakeup'});},
 save(){try{wx.setStorageSync(KEY,{step:this.step,complete:this.review,start:this.trace.start,rows:this.trace.snapshot()});}catch{}},
 onHide(){this.trace.record(this.step,'lifecycle',{code:'PageHide'});this.save();this.visible=false;clearInterval(this.tickTimer);},
 onUnload(){this.onHide();}
};
</script>
<page>
 <view class="screen">
  <text class="title">{{title}} · {{remaining}}s</text>
  <text class="hint">{{hint}}</text>
  <scroll-view class="trace" scroll-y="true"><text class="codes">{{traceText}}</text></scroll-view>
 </view>
</page>
<style>
.screen { width:480px; height:352px; padding:12px; box-sizing:border-box; display:flex; flex-direction:column; gap:8px; background-color:#000000; color:#40ff5e; }
.title { font-size:20px; font-weight:700; }
.hint { font-size:15px; color:rgba(64,255,94,0.6); }
.trace { flex-grow:1; flex-shrink:1; flex-basis:0px; width:100%; }
.codes { font-family:monospace; font-size:15px; white-space:pre-wrap; }
</style>
