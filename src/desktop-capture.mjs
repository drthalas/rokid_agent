import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
const execute=promisify(execFile);
export const CAPTURE_TTL=600000;
export const CAPTURE_FAILURE='Не удалось сделать снимок рабочего стола';
const LIMIT=8*1024*1024;
const fileName=/^desktop(?:\d+)?\.png$/;

// Cleanup accepts only our private, owned system-temp leases, never arbitrary paths.
export function cleanupDesktop(directory){
  const root=fs.realpathSync(os.tmpdir());
  if(path.dirname(directory)!==root||!/^jarvis-desktop-[A-Za-z0-9]{6}$/.test(path.basename(directory)))throw Error('invalid_capture_lease');
  let stat;try{stat=fs.lstatSync(directory)}catch(e){if(e.code==='ENOENT')return;throw e}
  if(!stat.isDirectory()||stat.isSymbolicLink()||stat.uid!==process.getuid()||(stat.mode&0o777)!==0o700)throw Error('invalid_capture_lease');
  const names=fs.readdirSync(directory);
  if(names.some(n=>!fileName.test(n)&&n!=='validated.png'))throw Error('invalid_capture_lease');
  for(const n of names)fs.unlinkSync(path.join(directory,n));
  fs.rmdirSync(directory);
}

export function pngMetadata(file){
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<45||stat.size>LIMIT)throw Error('invalid_capture_image');
  const bytes=fs.readFileSync(file);
  if(!bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))||bytes.toString('ascii',12,16)!=='IHDR')throw Error('invalid_capture_image');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(!width||!height||width>32768||height>32768||width*height>100000000)throw Error('invalid_capture_image');
  return {path:file,mimeType:'image/png',bytes:bytes.length,width,height,sha256:createHash('sha256').update(bytes).digest('hex')};
}

// Called only by the model's native exec tool: normal sandbox and auto_review apply.
// No gateway capture, private Screenshot UI, arbitrary executable, shell or clipboard.
export async function captureDesktop({run=execute,now=Date.now}={}){
  const directory=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'jarvis-desktop-'));
  fs.chmodSync(directory,0o700);
  try{
    await run('/usr/sbin/screencapture',['-x','-t','png',path.join(directory,'desktop.png')],{timeout:15000,maxBuffer:4096});
    const names=fs.readdirSync(directory);
    if(!names.length||names.length>8||names.some(n=>!fileName.test(n)))throw Error('invalid_capture_output');
    const images=[];
    for(const name of names.sort()){
      const file=path.join(directory,name);
      pngMetadata(file); // Bound before decode; sips then verifies the native decoder can read it.
      fs.chmodSync(file,0o600);
      const validated=path.join(directory,'validated.png');
      await run('/usr/bin/sips',['-s','format','png',file,'--out',validated],{timeout:15000,maxBuffer:4096});
      pngMetadata(validated);
      fs.unlinkSync(validated);
      images.push(pngMetadata(file));
    }
    return {source:'full-desktop',directory,expiresAt:now()+CAPTURE_TTL,images};
  }catch{
    try{cleanupDesktop(directory)}catch{}
    throw Error(CAPTURE_FAILURE);
  }
}
