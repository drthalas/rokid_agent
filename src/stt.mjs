import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Fault, requireValue } from './protocol.mjs';
const run = promisify(execFile);
export const MAX_AUDIO = 960044; // 30 s, mono 16 kHz signed PCM16 + canonical WAV header.
export function validateSttConfig(config) {
  if (config === undefined) return;
  requireValue(config !== null && typeof config === 'object' && !Array.isArray(config), 'invalid_stt_config');
  if (Object.hasOwn(config, 'gpu')) requireValue(typeof config.gpu === 'boolean', 'invalid_stt_gpu');
  if (Object.hasOwn(config, 'prompt')) requireValue(typeof config.prompt === 'string' && config.prompt.length <= 512 && !/[\u0000-\u001f\u007f]/.test(config.prompt), 'invalid_stt_prompt');
}
export function validateWav(b) {
  requireValue(b.length > 3244 && b.length <= MAX_AUDIO && b.length % 2 === 0, 'invalid_audio_size');
  requireValue(b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE' &&
    b.toString('ascii', 12, 16) === 'fmt ' && b.readUInt32LE(16) === 16 && b.readUInt16LE(20) === 1 &&
    b.readUInt16LE(22) === 1 && b.readUInt32LE(24) === 16000 && b.readUInt32LE(28) === 32000 &&
    b.readUInt16LE(32) === 2 && b.readUInt16LE(34) === 16 && b.toString('ascii', 36, 40) === 'data' &&
    b.readUInt32LE(40) === b.length - 44 && b.readUInt32LE(4) === b.length - 8, 'invalid_wav');
}
export class Stt {
  constructor(config) { validateSttConfig(config); this.config = config; this.running = false; }
  async transcribe(bytes) {
    validateWav(bytes);
    requireValue(this.config?.binary && this.config?.model, 'stt_not_configured', 503);
    requireValue(!this.running, 'stt_busy', 429); this.running = true;
    let dir; const T3 = Date.now();
    try {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rokid-stt-'));
      const input = path.join(dir, 'input.wav'), out = path.join(dir, 'result');
      await fs.writeFile(input, bytes, { mode: 0o600 });
      const processStart = Date.now();
      const { stderr } = await run(this.config.binary, ['-m', this.config.model, '-f', input, '-l', this.config.language ?? 'auto', '-otxt', '-of', out, '-nt', ...(this.config.gpu === true ? [] : ['-ng']), ...(this.config.prompt?.trim() ? ['--prompt', this.config.prompt.trim()] : [])],
        { timeout: 90000, maxBuffer: 1024 * 1024, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR }, shell: false });
      const processEnd = Date.now();
      const text = (await fs.readFile(out + '.txt', 'utf8')).trim();
      requireValue(text.length > 0 && text.length <= 8000, 'no_speech', 422);
      const T4 = Date.now();
      // Extract only known numeric profiler fields. Never retain/emit raw stdout/stderr.
      const parse = label => {
        const m = stderr.match(new RegExp('whisper_print_timings:\\s+' + label + ' time\\s*=\\s*([0-9.]+) ms'));
        const n = m ? Number(m[1]) : NaN; return Number.isFinite(n) && n >= 0 ? n : undefined;
      };
      return { text, timing: { T3, T4, sttPrepareMs: processStart - T3, sttProcessMs: processEnd - processStart,
        sttReadMs: T4 - processEnd, sttLoadMs: parse('load'), sttInternalMs: parse('total') } };
    } catch (e) { throw e instanceof Fault ? e : new Fault('stt_failed', 502); }
    finally { this.running = false; if (dir) await fs.rm(dir, { recursive: true, force: true }); }
  }
}
