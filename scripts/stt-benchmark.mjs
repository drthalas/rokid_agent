// Controlled synthetic speech only: never point this harness at private recordings.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { validateWav } from '../src/stt.mjs';
const run = promisify(exec);
export const vocabulary = 'Jarvis, Rokid, Codex, Gmail, Google Drive, Linear, GitHub, AIX, Computer Use, Mac mini.';
export const russianVocabulary = 'Русская речь. Названия: ' + vocabulary;
export const commands = [
  'Открой Калькулятор и посчитай двадцать плюс тридцать',
  'Создай черновик Gmail самому себе и ничего не отправляй',
  'Покажи задачи, которые сейчас находятся в работе в Linear',
  'Открой Google Drive и найди последний документ',
  'Продолжай работу в Codex',
  'Обнови ресурсы Jarvis на очках Rokid',
  'Найди задачу ALE-470',
  'Открой GitHub и найди AIX для Jarvis',
  'Проверь Computer Use на Mac mini',
  'Покажи список задач и ничего не изменяй',
];
export function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1)));
    row = next;
  }
  return row[b.length];
}
export function score(expected, actual) {
  const normalize = s => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const a = normalize(expected), b = normalize(actual), words = a.split(' ');
  return { wordErrors: distance(words, b.split(' ')), words: words.length, charErrors: distance([...a], [...b]), chars: [...a].length };
}
async function main() {
  const [mode, directory, binary, model, gpu, prompt] = process.argv.slice(2);
  const dir = path.resolve(directory); await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  if (mode === 'generate') {
    const samples = [];
    for (const [i, text] of commands.entries()) {
      const aiff = path.join(dir, i + '.aiff');
      await run('/usr/bin/say', ['-v', 'Milena', '-r', '165', '-o', aiff, text], { timeout: 30000 });
      const { stdout: pcm } = await run('ffmpeg', ['-loglevel', 'error', '-i', aiff, '-ar', '16000', '-ac', '1', '-f', 's16le', 'pipe:1'], { encoding: 'buffer', maxBuffer: 1000000 });
      const b = Buffer.alloc(44 + pcm.length); b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
      b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(pcm.length, 40); pcm.copy(b, 44);
      validateWav(b); await fs.writeFile(path.join(dir, i + '.wav'), b, { mode: 0o600 }); await fs.unlink(aiff);
      samples.push({ expected:text, sha256:createHash('sha256').update(b).digest('hex') });
    }
    await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ source:'synthetic-Milena-165', samples }, null, 2), { mode:0o600 });
    console.log('Generated 10 controlled Milena WAVs; not RV101 microphone speech.'); return;
  }
  if (mode !== 'run' || !binary || !model) throw Error('usage: generate DIR | run DIR BINARY MODEL cpu|metal [prompt]');
  if (!['cpu','metal'].includes(gpu) || (prompt && !['prompt','russian'].includes(prompt))) throw Error('invalid_candidate');
  const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'));
  if (manifest.source !== 'synthetic-Milena-165') throw Error('controlled_synthetic_manifest_required');
  const results = [];
  for (const [i, expected] of commands.entries()) {
    const input = path.join(dir, i + '.wav'), out = path.join(dir, 'result'); const wav = await fs.readFile(input); validateWav(wav);
    if (manifest.samples?.[i]?.expected !== expected || manifest.samples[i].sha256 !== createHash('sha256').update(wav).digest('hex')) throw Error('controlled_input_mismatch');
    const start = performance.now();
    try {
      const { stderr } = await run('/usr/bin/time', ['-l', binary, '-m', model, '-f', input, '-l', 'ru', '-otxt', '-of', out, '-nt', ...(gpu === 'metal' ? [] : ['-ng']), ...(prompt ? ['--prompt', prompt === 'russian' ? russianVocabulary : vocabulary] : [])], { timeout: 90000, maxBuffer: 1048576 });
      const wallMs = performance.now() - start, actual = (await fs.readFile(out + '.txt', 'utf8')).trim();
      const timing = label => Number(stderr.match(new RegExp('whisper_print_timings:\\s+' + label + ' time\\s*=\\s*([0-9.]+) ms'))?.[1]) || null;
      const metal = /whisper_backend_init_gpu: using MTL\d+ backend/.test(stderr) && /whisper_model_load:.*MTL\d+ total size/.test(stderr);
      results.push({ i, expected, actual, ...score(expected, actual), wallMs, loadMs: timing('load'), internalMs: timing('total'), maxRssBytes: Number(stderr.match(/(\d+)\s+maximum resident set size/)?.[1]) || null, metal, seconds: (wav.length - 44) / 32000, sha256: createHash('sha256').update(wav).digest('hex') });
      // Synthetic-only evidence; no production process output or private speech is retained.
      await fs.writeFile(path.join(dir, `runtime-${gpu}-${prompt || 'plain'}.txt`), stderr, { mode: 0o600 });
      console.log(JSON.stringify(results.at(-1)));
    } finally { await fs.rm(out + '.txt', { force: true }); }
  }
  await fs.writeFile(path.join(dir, `results-${path.basename(model)}-${gpu}-${prompt || 'plain'}.json`), JSON.stringify(results, null, 2), { mode: 0o600 });
}
if (process.argv[1] === import.meta.filename) await main();
