import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixture } from './helpers.mjs';
import { loadConfig, projectPath } from '../src/config.mjs';
test('canonical project allowlist rejects aliases, symlink replacement and weak secret permissions', t => {
  const f = fixture(); t.after(f.cleanup);
  const a = path.join(f.dir, 'a'), b = path.join(f.dir, 'b'), link = path.join(f.dir, 'link');
  fs.mkdirSync(a); fs.mkdirSync(b); fs.symlinkSync(a, link);
  const c = { ...f.config, port: 8443, adminPort: 8791, codexPort: 8390, projects: { demo: link } };
  const file = path.join(f.dir, 'config.json'); fs.writeFileSync(file, JSON.stringify(c));
  const loaded = loadConfig(file); assert.equal(loaded.projects.demo, fs.realpathSync(a));
  assert.throws(() => projectPath(loaded, '__proto__'));
  fs.rmdirSync(a); fs.symlinkSync(b, a); assert.throws(() => projectPath(loaded, 'demo'), /project_path_changed/);
  fs.chmodSync(c.tokenFile, 0o644); assert.throws(() => loadConfig(file), /private_file_permissions/);
});

test('STT GPU and vocabulary prompt are bounded private configuration', t => {
  const f = fixture(); t.after(f.cleanup);
  const file = path.join(f.dir, 'config.json');
  const load = stt => { fs.writeFileSync(file, JSON.stringify({ ...f.config, port:8443, adminPort:8791, codexPort:8390, stt })); return loadConfig(file); };
  assert.equal(load(undefined).stt, undefined);
  const prompt = 'Русская речь. Названия: Jarvis, Rokid, Codex, Gmail, Google Drive, Linear, GitHub, AIX, Computer Use, Mac mini.';
  assert.deepEqual(load({ gpu:true, prompt }).stt, { gpu:true, prompt });
  for (const stt of [null, [], 'x', {gpu:'true'}, {gpu:1}, {prompt:42}, {prompt:'a'.repeat(513)}, {prompt:'line\nbreak'}, {prompt:'bad\0value'}]) assert.throws(() => load(stt), /invalid_stt/);
  assert.equal(load({prompt:''}).stt.prompt, '');
});
