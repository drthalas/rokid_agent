export const APPROVAL_NOTICES={
  unsupported:'Для этого действия требуется подтверждение на Mac. Через очки его подтвердить нельзя. Действие не выполнено.',
  declined:'Разрешение отклонено. Действие не выполнено.',
  timeout:'Подтверждение не получено. Действие отменено.'
};
// Device-only deliberate choices; no voice path can invoke these decisions.
const TITLES={'computer-use':'Computer Use',command:'Команда','file-change':'Файлы',permissions:'Разрешения','mcp-tool':'Интеграция'};
const bounded=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n&&!/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(v)&&!/bearer|password|authorization|cookie|credential|secret|api[_ -]?key|token/i.test(v);
export function approvalDescriptor(a,turnId) {
  if(!a||typeof a!=='object'||!/^[a-f0-9-]{36}$/.test(a.id)||a.turnId!==turnId||!Object.hasOwn(TITLES,a.kind)||
    a.title!==TITLES[a.kind]||!bounded(a.action,72)||!bounded(a.target,96)||!['low','medium','high'].includes(a.risk)||
    !['once','turn'].includes(a.scope)||(a.kind==='permissions')!==(a.scope==='turn')||a.allowOnGlasses!==true||!Number.isFinite(a.expiresAt))return null;
  return {id:a.id,turnId:a.turnId,kind:a.kind,title:a.title,action:a.action,target:a.target,risk:a.risk,scope:a.scope,expiresAt:a.expiresAt};
}
export class ApprovalCard {
  constructor({decide,render,speak,schedule=setTimeout,unschedule=clearTimeout,now=Date.now}) {
    Object.assign(this,{decide,render,speak,schedule,unschedule,now});this.current=null;this.timer=null;this.deadlineTimer=null;this.epoch=0;this.announced=[];
  }
  show(a) {
    if(this.current?.id===a.id)return;
    this.clear();this.current=a;this.choice=false;this.second=false;this.confirmation=undefined;this.submitting=false;this.armed=false;
    this.deadline=this.now()+(Number.isFinite(a.remainingMs)?Math.max(0,Math.min(30000,a.remainingMs)):Number.isFinite(a.expiresAt)?Math.max(0,Math.min(30000,a.expiresAt-this.now())):0);this.feedback='';
    this.draw();this.tickDeadline(a.id);
    if(this.remaining()&&!this.announced.includes(a.id)){this.announced.push(a.id);this.announced=this.announced.slice(-16);this.speak('Требуется подтверждение.');}
  }
  remaining(){return Math.max(0,Math.ceil((this.deadline-this.now())/1000))}
  tickDeadline(id){
    if(this.current?.id!==id)return;
    if(!this.remaining()){this.armed=false;this.feedback='Время подтверждения истекло. Действие не выполнено.';this.draw();this.speak(this.feedback);return;}
    this.deadlineTimer=this.schedule(()=>{this.deadlineTimer=null;if(this.current?.id===id){this.draw();this.tickDeadline(id)}},1000);
  }
  draw(done) {const epoch=this.epoch,id=this.current?.id;this.render({approval:this.current,approvalAllow:this.choice,approvalSecond:this.second,approvalSubmitting:this.submitting,approvalRemainingSeconds:this.remaining(),approvalFeedback:this.feedback},()=>{if(this.epoch===epoch&&this.current?.id===id&&!this.submitting&&this.remaining())this.armed=true;done?.()})}
  move(direction) {if(!this.current||this.submitting)return;this.cancelTap();this.choice=direction>0;this.draw()}
  cancelTap(){if(this.timer!==null)this.unschedule(this.timer);this.timer=null;this.epoch++}
  tap() {
    if(!this.current||!this.armed||this.submitting||this.timer!==null)return;
    const id=this.current.id,epoch=++this.epoch,decision=this.choice?'accept':'decline';
    // Enter followed by native Backspace must not deliver an accidental acceptance.
    this.timer=this.schedule(async()=>{
      this.timer=null;if(!this.current||this.current.id!==id||epoch!==this.epoch)return;
      if(!this.remaining()){this.armed=false;this.feedback='Время подтверждения истекло. Действие не выполнено.';this.draw();return;}
      this.submitting=true;this.draw();
      try {
        const result=await this.decide(id,decision,decision==='accept'?this.confirmation:undefined);
        if(!this.current||this.current.id!==id||epoch!==this.epoch)return;
        if(result?.requiresConfirmation){this.confirmation=result.confirmation;this.second=true;this.choice=false;this.submitting=false;this.armed=false;this.draw();}
        else this.clear();
      } catch (_) {if(this.current?.id===id){this.submitting=false;this.choice=false;this.armed=false;this.feedback=this.remaining()?'Решение не подтверждено. Выберите снова.':'Время подтверждения истекло. Действие не выполнено.';this.draw();}}
    },650);
  }
  clear(){this.cancelTap();if(this.deadlineTimer!==null)this.unschedule(this.deadlineTimer);this.deadlineTimer=null;this.current=null;this.armed=false;this.confirmation=undefined;this.feedback='';this.render({approval:null,approvalAllow:false,approvalSecond:false,approvalSubmitting:false,approvalFeedback:'',approvalRemainingSeconds:0})}
  exit(){const a=this.current;try{this.clear()}catch(_){}if(a)this.decide(a.id,'decline',undefined,true).catch(()=>{})}
}
