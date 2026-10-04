import net from 'node:net';
import {Codex} from '../src/codex.mjs';

// The original app-server must be closed before this separate owner archives a restart test.
export async function archiveReleasedDiagnostic(threadId, cwd) {
  const listener = net.createServer();
  await new Promise((resolve, reject) => listener.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const codex = new Codex({port});
  try {
    await codex.start();
    const {thread} = await codex.request('thread/read', {threadId, includeTurns:false});
    if (thread?.id !== threadId || thread.cwd !== cwd || !thread.name?.startsWith('rokid-test ') || thread.status?.type === 'active') throw Error('diagnostic_archive_identity_unverified');
    await codex.request('thread/archive', {threadId});
  } finally { await codex.close(); }
}
