// Read only bounded diagnostic numbers/IDs. Never read gateway conversation state or print text.
import fs from 'node:fs';
import { timingSample } from '../src/diagnostics.mjs';
export function summarize(samples) {
  const values = {};
  const add=(key,value)=>{if(Number.isFinite(value)&&value>=0)(values[key]??=[]).push(value)};
  for(const s of samples){
    const delta=(key,a,b)=>{if(Number.isFinite(s[a])&&Number.isFinite(s[b]))add(key,s[b]-s[a])};
    delta('stopDebounceMs','T0','T1');delta('sttMs','T3','T4');delta('codexTTFTMs','T5','T7');delta('codexTotalMs','T5','T8');
    delta('hudApplyMs','T9','T10');delta('perceivedHUDMs','T0','T10');delta('ttsRequestedMs','T0','T11');
    for(const k of ['sttPrepareMs','sttProcessMs','sttReadMs','sttLoadMs','sttInternalMs','clockUncertaintyMs'])add(k,s[k]);
    if(Number.isFinite(s.clockOffsetMs)){
      add('uploadEstimateMs',s.T2-s.clockOffsetMs-s.T1);
      add('pollAndReturnEstimateMs',s.T9-(s.T8-s.clockOffsetMs));
    }
  }
  return Object.fromEntries(Object.entries(values).map(([k,vs])=>{
    vs.sort((a,b)=>a-b);const n=vs.length,median=n%2?vs[(n-1)/2]:(vs[n/2-1]+vs[n/2])/2;
    return [k,{n,median:Math.round(median),min:Math.round(vs[0]),max:Math.round(vs.at(-1))}];
  }));
}
if(process.argv[1] && import.meta.url === new URL('file://'+process.argv[1]).href){
  try{
    const file=process.argv[2] || JSON.parse(fs.readFileSync(process.env.ROKID_CONFIG??'.local/config.json')).stateFile+'.latency.json';
    const raw=JSON.parse(fs.readFileSync(file));const samples=(Array.isArray(raw)?raw:raw.samples).slice(-32).map(timingSample);
    console.log(JSON.stringify({samples,metrics:summarize(samples),physicalBaseline:samples.filter(s=>s.T0&&s.T10).length>=3?'requires_wearer_provenance_confirmation':'INSUFFICIENT',
      note:'Cross-clock estimates have clockUncertaintyMs; T10 is setData completion, T11 is play() request, not observed photons/sound.'},null,2));
  }catch{console.error('diagnostics_unavailable_or_invalid');process.exitCode=1}
}
