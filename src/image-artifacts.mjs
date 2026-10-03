import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const LIMIT=8*1024*1024;
// Copies only an already-returned native screenshot. No capture, remote fetch or arbitrary paths.
export class ImageArtifacts {
  constructor(){this.files=new Map();this.directory=null;this.closed=false;}
  capture(sessionId,turnId,item){
    if(this.closed)return null;
    if(item?.type!=='mcpToolCall'||item.server!=='cua_repl'||item.status!=='completed'||item.error||item.result?.isError)return null;
    const images=item.result?.content?.filter(c=>c.type==='image');
    if(!images?.length||!images.every(i=>i.mimeType===images[0].mimeType&&i.data===images[0].data))return null;
    const image=images[0];
    if(!['image/jpeg','image/png'].includes(image.mimeType)||typeof image.data!=='string'||image.data.length>Math.ceil(LIMIT/3)*4||image.data.length%4!==0||!/^([A-Za-z0-9+/]+)={0,2}$/.test(image.data))return null;
    const bytes=Buffer.from(image.data,'base64');
    const valid=image.mimeType==='image/png'?bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    if(!valid||!bytes.length||bytes.length>LIMIT)return null;
    const digest=createHash('sha256').update(bytes).digest('hex');
    const owned=[...this.files.values()].filter(f=>f.sessionId===sessionId&&f.turnId===turnId);
    if(owned.some(f=>f.digest===digest)||owned.length>=2||this.files.size>=8)return null;
    if(!this.directory){this.directory=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-images-'));fs.chmodSync(this.directory,0o700);}
    const id=randomUUID(),file=path.join(this.directory,id+(image.mimeType==='image/png'?'.png':'.jpg'));
    let fd;try{fd=fs.openSync(file,'wx',0o600);fs.writeFileSync(fd,bytes);}catch(error){if(fd!==undefined){try{fs.unlinkSync(file)}catch{}}throw error;}finally{if(fd!==undefined){try{fs.closeSync(fd)}catch{}}}
    const record={sessionId,turnId,digest,path:file};record.timer=setTimeout(()=>this.remove(id),600000);record.timer.unref?.();this.files.set(id,record);
    return {path:file,mimeType:image.mimeType,bytes:bytes.length};
  }
  remove(id){
    const f=this.files.get(id);if(!f)return;clearTimeout(f.timer);
    try{fs.unlinkSync(f.path)}catch(error){if(error.code!=='ENOENT'){
      f.retries=(f.retries??0)+1;
      if(!this.closed&&f.retries<=3){f.timer=setTimeout(()=>this.remove(id),10000);f.timer.unref?.();}
      return; // Retain ownership/cap accounting; never pretend a failed deletion succeeded.
    }}
    this.files.delete(id);
  }
  clearTurn(sessionId,turnId){for(const [id,f] of this.files)if(f.sessionId===sessionId&&f.turnId===turnId)this.remove(id);}
  clear(){for(const id of this.files.keys())this.remove(id);if(this.directory&&this.files.size===0){try{fs.rmdirSync(this.directory);this.directory=null;}catch{}}}
  close(){this.closed=true;this.clear();}
}
