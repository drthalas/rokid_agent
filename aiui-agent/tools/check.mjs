import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json')));
if (app.workers || !app.permissions.includes('RECORD_AUDIO')) throw new Error('invalid_manifest');
for (const p of app.pages) {
  const file = path.join(root, p + '.ink'), text = fs.readFileSync(file, 'utf8');
  for (const tag of ['script def', 'script setup', 'page', 'style']) if ((text.match(new RegExp('<' + tag + '>', 'g')) || []).length !== 1) throw new Error('invalid_block_' + tag);
  if (/\bwx:(?:for|if|elif|else|key)/.test(text)) throw new Error('unsupported_wx_directive_use_ink');
  const def = JSON.parse(text.match(/<script def>([\s\S]*?)<\/script>/)[1]);
  if (!def.schema?.data) throw new Error('missing_page_schema');
  const script = text.match(/<script setup>([\s\S]*?)<\/script>/)[1];
  if (/\b(?:Page|App)\(/.test(script) || !script.includes('export default')) throw new Error('invalid_registration');
  for (const m of script.matchAll(/from ['"]([^'"]+)['"]/g)) if (!fs.existsSync(path.resolve(path.dirname(file), m[1]))) throw new Error('missing_import');
  for (const m of text.matchAll(/bind\w+="(\w+)"/g)) if (!new RegExp('\\b' + m[1] + '\\(').test(script)) throw new Error('missing_handler');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aiui-check-'));
  try { const output = path.join(tmp, 'page.mjs'); fs.writeFileSync(output, script); execFileSync(process.execPath, ['--check', output]); }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
for (const file of ['app.js', 'config.js', ...fs.readdirSync(path.join(root, 'lib')).map(f => 'lib/' + f)]) execFileSync(process.execPath, ['--check', path.join(root, file)]);
console.log('AIUI manifest, Ink blocks, entry/import/handler paths and JavaScript syntax: PASS');
