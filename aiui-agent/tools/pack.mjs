import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privatePackage = process.argv.includes('--private-package');
if (privatePackage) process.umask(0o077);
const input = privatePackage ? path.resolve(root, '../.local/aiui-private') : root;
const output = privatePackage ? path.resolve(root, '../dist/mac-codex-aiui-private.aix') : path.resolve(root, '../dist/mac-codex-aiui.aix');
if (!privatePackage) {
  const config = (await import('../config.js')).default;
  if (config.token) throw new Error('Public/template packaging refuses embedded credentials. Use the separate private project.');
}
fs.mkdirSync(path.dirname(output), { recursive: true });
execFileSync(path.join(root, 'node_modules/.bin/aix'), ['pack', input, '-o', output], { stdio: 'inherit' });
fs.chmodSync(output, privatePackage ? 0o600 : 0o644);
const listing = execFileSync(path.join(root, 'node_modules/.bin/aix'), ['list', output], { encoding: 'utf8' });
for (const required of ['AGENTS.md', 'app.json', 'app.js', 'config.js', 'pages/index/index.ink', 'lib/gateway.js', 'lib/voice-ui.js', 'lib/wav.js', 'lib/one-shot-audio.js', 'licenses/rokid-personal-ai-MIT.txt']) if (!listing.includes(required)) throw new Error('package_missing_' + required);
if (/node_modules\/|tools\/|test\/|\.local\//.test(listing)) throw new Error('package_contains_dev_files');
fs.writeFileSync(output + '.sha256', createHash('sha256').update(fs.readFileSync(output)).digest('hex') + '  ' + path.basename(output) + '\n');
console.log('Package contents verified: ' + output);
