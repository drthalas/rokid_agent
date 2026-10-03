export const APPROVAL_NOTICES={
  unsupported:'Для этого действия требуется подтверждение на Mac. Через очки его подтвердить нельзя. Действие не выполнено.',
  declined:'Разрешение отклонено. Действие не выполнено.',
  timeout:'Подтверждение не получено. Действие отменено.'
};
// Device-only deliberate choices; no voice path can invoke these decisions.
export function approvalDescriptor(a,turnId) {
  if (!a || typeof a!=='object' || !/^[a-f0-9-]{36}$/.test(a.id) || a.turnId!==turnId ||
      a.kind!=='computer-use' || a.title!=='Calculator' || a.description!=='Прочитать окно Calculator один раз' ||
      !['low','medium','high'].includes(a.risk) || a.allowOnGlasses!==true || !Number.isFinite(a.expiresAt)) return null;
  return {id:a.id,turnId:a.turnId,kind:a.kind,title:a.title,description:a.description,risk:a.risk,expiresAt:a.expiresAt};
}
export class ApprovalCard {
  constructor({decide,render,speak,schedule=setTimeout,unschedule=clearTimeout}) {
    Object.assign(this,{decide,render,speak,schedule,unschedule});this.current=null;this.timer=null;this.epoch=0;this.announced=[];
  }
  show(a) {
    if(this.current?.id===a.id)return;
    this.clear();this.current=a;this.choice=false;this.second=false;this.confirmation=undefined;this.submitting=false;this.armed=false;
    const epoch=this.epoch;this.draw(()=>{if(this.epoch===epoch&&this.current?.id===a.id)this.armed=true});
    if(!this.announced.includes(a.id)){this.announced.push(a.id);this.announced=this.announced.slice(-16);this.speak('Требуется подтверждение.');}
  }
  draw(done) {const epoch=this.epoch,id=this.current?.id;this.render({approval:this.current,approvalAllow:this.choice,approvalSecond:this.second,approvalSubmitting:this.submitting},()=>{if(this.epoch===epoch&&this.current?.id===id&&!this.submitting)this.armed=true;done?.()})}
  move(direction) {if(!this.current||this.submitting)return;this.cancelTap();this.choice=direction>0;this.draw()}
  cancelTap(){if(this.timer!==null)this.unschedule(this.timer);this.timer=null;this.epoch++}
  tap() {
    if(!this.current||!this.armed||this.submitting||this.timer!==null)return;
    const id=this.current.id,epoch=++this.epoch,decision=this.choice?'accept':'decline';
    // Enter followed by native Backspace must not deliver an accidental acceptance.
    this.timer=this.schedule(async()=>{
      this.timer=null;if(!this.current||this.current.id!==id||epoch!==this.epoch)return;
      this.submitting=true;this.draw();
      try {
        const result=await this.decide(id,decision,decision==='accept'?this.confirmation:undefined);
        if(!this.current||this.current.id!==id||epoch!==this.epoch)return;
        if(result?.requiresConfirmation){this.confirmation=result.confirmation;this.second=true;this.choice=false;this.submitting=false;this.armed=false;this.draw();}
        else this.clear();
      } catch (_) {if(this.current?.id===id){this.clear();}}
    },650);
  }
  clear(){this.cancelTap();this.current=null;this.armed=false;this.confirmation=undefined;this.render({approval:null,approvalAllow:false,approvalSecond:false,approvalSubmitting:false})}
  exit(){const a=this.current;try{this.clear()}catch(_){}if(a)this.decide(a.id,'decline',undefined,true).catch(()=>{})}
}
