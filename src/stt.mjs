import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Fault, requireValue } from './protocol.mjs';
const run = promisify(execFile);
export const MAX_AUDIO = 960044; // 30 s, mono 16 kHz signed PCM16 + canonical WAV header.
export function validateWav(b) {
  requireValue(b.length > 3244 && b.length <= MAX_AUDIO && b.length % 2 === 0, 'invalid_audio_size');
  requireValue(b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE' &&
    b.toString('ascii', 12, 16) === 'fmt ' && b.readUInt32LE(16) === 16 && b.readUInt16LE(20) === 1 &&
    b.readUInt16LE(22) === 1 && b.readUInt32LE(24) === 16000 && b.readUInt32LE(28) === 32000 &&
    b.readUInt16LE(32) === 2 && b.readUInt16LE(34) === 16 && b.toString('ascii', 36, 40) === 'data' &&
    b.readUInt32LE(40) === b.length - 44 && b.readUInt32LE(4) === b.length - 8, 'invalid_wav');
}
export class Stt {
  constructor(config) { this.config = config; this.running = false; }
  async transcribe(bytes) {
    validateWav(bytes);
    requireValue(this.config?.binary && this.config?.model, 'stt_not_configured', 503);
    requireValue(!this.running, 'stt_busy', 429); this.running = true;
    let dir;
    try {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rokid-stt-'));
      const input = path.join(dir, 'input.wav'), out = path.join(dir, 'result');
      await fs.writeFile(input, bytes, { mode: 0o600 });
      await run(this.config.binary, ['-m', this.config.model, '-f', input, '-l', this.config.language ?? 'auto', '-otxt', '-of', out, '-nt', ...(this.config.gpu === true ? [] : ['-ng'])],
        { timeout: 90000, maxBuffer: 1024 * 1024, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR }, shell: false });
      const text = (await fs.readFile(out + '.txt', 'utf8')).trim();
      requireValue(text.length > 0 && text.length <= 8000, 'no_speech', 422);
      return { text };
    } catch (e) { throw e instanceof Fault ? e : new Fault('stt_failed', 502); }
    finally { this.running = false; if (dir) await fs.rm(dir, { recursive: true, force: true }); }
  }
}
