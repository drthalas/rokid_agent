// ALE-464: read-only inventory. This command never archives or deletes a thread/file.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import {Codex} from '../src/codex.mjs';

const diagnosticCwd = cwd => typeof cwd === 'string' && path.dirname(cwd) === fs.realpathSync(os.tmpdir()) && /^rokid-test-[A-Za-z0-9_-]+$/.test(path.basename(cwd));
const diagnosticName = name => typeof name === 'string' && /^rokid-test [A-Z0-9-]+ [a-z0-9-]{1,48}$/.test(name);
export function classifyThread(thread) {
  const cwdMarker = diagnosticCwd(thread.cwd), nameMarker = diagnosticName(thread.name);
  if (!cwdMarker && !nameMarker) return null;
  const active = thread.status?.type === 'active';
  return {id:thread.id, cwdLabel:cwdMarker ? path.basename(thread.cwd) : null,
    name:nameMarker ? thread.name : null, status:thread.status?.type ?? 'unknown',
    plan:cwdMarker && nameMarker && !active ? 'archive-candidate-review' : 'hold-for-review'};
}
export function classifyTempDir(name) { return /^rokid-test-[A-Za-z0-9_-]+$/.test(name); }

async function audit() {
  if (process.argv.slice(2).some(a => a !== '--dry-run')) throw Error('only_--dry-run_supported');
  const listener=net.createServer();
  await new Promise((resolve,reject)=>listener.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
  const codex=new Codex({port});
  const candidates=[];let scanned=0,cursor=null;
  try {
    await codex.start();
    do {
      const result=await codex.request('thread/list',{limit:100,cursor});
      if (!Array.isArray(result.data)) throw Error('invalid_thread_inventory');
      scanned+=result.data.length;
      for (const thread of result.data) {const row=classifyThread(thread);if(row)candidates.push(row);}
      cursor=result.nextCursor;
    } while (cursor);
  } finally {await codex.close();}
  const tmp=fs.realpathSync(os.tmpdir());
  const temporaryDirectories=fs.readdirSync(tmp,{withFileTypes:true}).filter(d=>d.isDirectory()&&classifyTempDir(d.name)).map(d=>d.name);
  console.log(JSON.stringify({mode:'dry-run',source:'owned read-only app-server',scanned,excluded:scanned-candidates.length,candidates,
    temporaryDirectories:{count:temporaryDirectories.length,sample:temporaryDirectories.slice(0,20),plan:'hold-for-liveness-review'},mutations:0},null,2));
}
if (process.argv[1] && import.meta.url === new URL('file://'+process.argv[1]).href) await audit();
