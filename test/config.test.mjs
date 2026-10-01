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
