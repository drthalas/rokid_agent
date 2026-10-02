// ALE-452: isolated real Codex proof. Only IDs/booleans/counts leave this process.
import {randomUUID} from 'node:crypto';
import {Codex} from '../src/codex.mjs';
import {Engine} from '../src/engine.mjs';
import {fixture,delay} from '../test/helpers.mjs';
const f=fixture();let codex,engine;
async function start(){codex=new Codex({port:Number(process.env.ROKID_HISTORY_SMOKE_PORT??18391)});engine=new Engine(f.config,codex);await codex.start();await engine.recover();}
async function stop(){engine?.close();await codex?.close();}
try{
 await start();const session=await engine.create({requestId:randomUUID()}),marker='HISTORY_'+randomUUID().slice(0,8);const ids=[];
 const prompts=[`Запомни контрольное слово ${marker}. Ответь только им, без инструментов.`, 'Повтори контрольное слово из предыдущего сообщения, без инструментов.', 'Повтори то же слово снова, без инструментов.'];
 for(let i=0;i<3;i++){
  await engine.turn(session.id,{requestId:randomUUID(),text:prompts[i]});let done=false;
  for(let n=0;n<360;n++){const s=engine.snapshot(engine.get(session.id));if(s.pendingApproval||s.status==='Error')throw Error('turn_failed');if(s.status==='Done'){if(!s.text.includes(marker))throw Error('memory_failed');ids.push(s.turnId);done=true;break}await delay(500)}
  if(!done)throw Error('timeout');
  const s=engine.snapshot(engine.get(session.id));if(s.threadId!==session.threadId||s.history.exchanges.length!==i+1||s.history.exchanges[i].user!==prompts[i]||!s.history.exchanges[i].assistant.includes(marker))throw Error('history_failed');
  console.log(JSON.stringify({turn:i+1,sessionId:s.id,threadId:s.threadId,turnId:s.turnId,visibleExchangeCount:s.history.exchanges.length}));
  if(i===1){await stop();await start();const restored=engine.snapshot(engine.get(session.id));if(restored.history.exchanges.length!==2)throw Error('restart_history_failed');console.log('gateway_and_app_server_restart_history_PASS')}
 }
 if(new Set(ids).size!==3)throw Error('turn_ids_failed');
 // Simulate v1 state without projection; reconstruct existing history without a new turn.
 delete engine.get(session.id).history;engine.save();await stop();await start();
 const restored=engine.snapshot(engine.get(session.id));if(restored.history.exchanges.length!==3||restored.history.exchanges[0].user!==prompts[0])throw Error('legacy_backfill_failed');
 console.log(JSON.stringify({pass:true,semanticMemory:true,persistedHistory:true,legacyBackfill:true,turns:3,threadId:session.threadId}));
}catch{console.error('history_smoke_failed');process.exitCode=1}finally{await stop();f.cleanup()}
