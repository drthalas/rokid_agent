// Local synthetic/profile input only. Prints numeric timings, never the transcript or process logs.
import fs from 'node:fs';
import { Stt } from '../src/stt.mjs';
import { summarize } from './latency-report.mjs';
try {
  if(!process.argv[2])throw Error();
  const config=JSON.parse(fs.readFileSync(process.env.ROKID_CONFIG??'.local/config.json'));
  const audio=fs.readFileSync(process.argv[2]),stt=new Stt(config.stt),samples=[];
  for(let i=0;i<3;i++){const r=await stt.transcribe(audio);samples.push(r.timing);}
  console.log(JSON.stringify({source:'local_wav_not_physical',samples,metrics:summarize(samples)},null,2));
}catch{console.error('stt_profile_failed');process.exitCode=1}
