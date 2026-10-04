import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function createBuildInfo(repo) {
  const gitSha = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:repo, encoding:'utf8'}).trim();
  if (!/^[a-f0-9]{40}$/.test(gitSha)) throw new Error('invalid_git_sha');
  return {gitSha, releaseId:randomUUID()};
}

export function writeBuildInfo(stage, info) {
  const file = path.join(stage, 'lib/build-info.js');
  fs.writeFileSync(file, 'export default ' + JSON.stringify(info) + ';\n');
  return file;
}

export function readAixBuildInfo(aix) {
  const source = execFileSync('/usr/bin/unzip', ['-p', aix, 'lib/build-info.js'], {encoding:'utf8'});
  const raw = /^export default (\{[^\n]+\});\n$/.exec(source);
  const packed = /^export default\{gitSha:`([a-f0-9]{40})`,releaseId:`([a-f0-9-]{36})`\};$/.exec(source);
  if (!raw && !packed) throw new Error('invalid_build_info');
  const info = raw ? JSON.parse(raw[1]) : {gitSha:packed[1],releaseId:packed[2]};
  if (!/^[a-f0-9]{40}$/.test(info.gitSha) || !/^[a-f0-9-]{36}$/.test(info.releaseId)) throw new Error('invalid_build_info');
  return info;
}

export function compareAixBuildInfo(localAix, activeAix, nativeVersion) {
  if (typeof nativeVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(nativeVersion)) throw new Error('invalid_native_version');
  const expected = readAixBuildInfo(localAix);
  const active = readAixBuildInfo(activeAix);
  if (JSON.stringify(active) !== JSON.stringify(expected)) throw new Error('active_build_info_mismatch');
  return {nativeVersion, buildInfo:active};
}
