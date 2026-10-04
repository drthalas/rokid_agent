import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import {createBuildInfo, writeBuildInfo, readAixBuildInfo} from './build-info.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privatePackage = process.argv.includes('--private-package');
if (privatePackage) process.umask(0o077);
const source = privatePackage ? path.resolve(root, '../.local/aiui-private') : root;
const output = privatePackage ? path.resolve(root, '../dist/mac-codex-aiui-private.aix') : path.resolve(root, '../dist/mac-codex-aiui.aix');
if (!privatePackage) {
  const config = (await import('../config.js')).default;
  if (config.token) throw new Error('Public/template packaging refuses embedded credentials. Use the separate private project.');
}
fs.mkdirSync(path.dirname(output), { recursive: true });
const input = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-pack-'));
const info = createBuildInfo(path.resolve(root, '..'));
try {
  for (const name of ['AGENTS.md','app.json','app.js','config.js','package.json','.aixignore','pages','lib','licenses']) fs.cpSync(path.join(source,name), path.join(input,name), {recursive:true});
  writeBuildInfo(input,info);
  execFileSync(path.join(root, 'node_modules/.bin/aix'), ['pack', input, '-o', output], { stdio: 'inherit' });
} finally { fs.rmSync(input,{recursive:true,force:true}); }
fs.chmodSync(output, privatePackage ? 0o600 : 0o644);
const listing = execFileSync(path.join(root, 'node_modules/.bin/aix'), ['list', output], { encoding: 'utf8' });
for (const required of ['AGENTS.md', 'app.json', 'app.js', 'config.js', 'pages/index/index.ink', 'lib/gateway.js', 'lib/approval-ui.js', 'lib/voice-ui.js', 'lib/build-info.js', 'lib/build-query.js', 'lib/answer-lines.js', 'lib/history.js', 'lib/latency.js', 'lib/wav.js', 'lib/one-shot-audio.js', 'licenses/rokid-personal-ai-MIT.txt']) if (!listing.includes(required)) throw new Error('package_missing_' + required);
if (JSON.stringify(readAixBuildInfo(output)) !== JSON.stringify(info)) throw new Error('package_build_info_mismatch');
if (/node_modules\/|tools\/|test\/|\.local\//.test(listing)) throw new Error('package_contains_dev_files');
fs.writeFileSync(output + '.sha256', createHash('sha256').update(fs.readFileSync(output)).digest('hex') + '  ' + path.basename(output) + '\n');
console.log('Package contents verified: ' + output);
