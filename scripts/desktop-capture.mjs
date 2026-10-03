import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {captureDesktop,cleanupDesktop,CAPTURE_TTL,CAPTURE_FAILURE} from '../src/desktop-capture.mjs';
const [action,directory,expiry]=process.argv.slice(2);
try{
  if(action==='--cleanup'){
    cleanupDesktop(directory);console.log(JSON.stringify({cleaned:true}));
  }else if(action==='--expire'){
    const delay=Number(expiry)-Date.now();
    if(!Number.isFinite(delay)||delay>CAPTURE_TTL)throw Error('invalid_capture_lease');
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,delay)));
    cleanupDesktop(directory);
  }else if(action===undefined){
    const capture=await captureDesktop();
    try{
      // The bounded lease survives normal caller/turn exit; no persistent image archive.
      const janitor=spawn(process.execPath,[fileURLToPath(import.meta.url),'--expire',capture.directory,String(capture.expiresAt)],{detached:true,stdio:'ignore',env:{PATH:process.env.PATH,TMPDIR:process.env.TMPDIR}});
      await new Promise((resolve,reject)=>{janitor.once('spawn',resolve);janitor.once('error',reject)});
      janitor.unref();
    }catch(e){cleanupDesktop(capture.directory);throw e}
    console.log(JSON.stringify(capture));
  }else throw Error('invalid_action');
}catch{
  console.error(JSON.stringify({stage:action?'cleanup':'capture',message:action?'Не удалось удалить временный снимок':CAPTURE_FAILURE}));process.exitCode=1;
}
