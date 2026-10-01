import { loadConfig } from './config.mjs';
import { Codex } from './codex.mjs';
import { Engine } from './engine.mjs';
import { serve } from './server.mjs';

const config = loadConfig(process.argv[2] ?? '.local/config.json');
const codex = new Codex({ binary: config.codexBinary, port: config.codexPort });
let engine, servers;
let closing = false;
const close = async () => { closing = true; engine?.close(); await servers?.close(); await codex.close(); };
try {
  engine = new Engine(config, codex);
  await codex.start(); await engine.recover(); servers = await serve(config, engine);
  console.log('gateway_ready');
  codex.on('processExit', () => { if (!closing) { console.error('codex_process_exited'); close().then(() => process.exit(1)); } });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { close().then(() => process.exit(0)); });
} catch { console.error('gateway_start_failed'); await close(); process.exitCode = 1; }
