import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {isBuildQuery,buildLabel} from '../lib/build-query.js';
import {createBuildInfo,writeBuildInfo,readAixBuildInfo,compareAixBuildInfo} from '../tools/build-info.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('build query matches explicit version requests only',()=>{
 for(const text of ['какая версия','Какая версия Jarvis?','какая сборка Jarvis','какой билд установлен','Джарвис, какая версия?']) assert.equal(isBuildQuery(text),true,text);
 for(const text of ['какая версия Node','проверь версию файла','какая версия и обнови','какой билд установлен на Mac','скажи какая версия']) assert.equal(isBuildQuery(text),false,text);
});
test('unique marker survives AIX packaging and readback exactly',()=>{
 const stage=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-build-test-'));
 try {
  for(const name of ['AGENTS.md','app.json','app.js','package.json','.aixignore','pages','lib','licenses']) fs.cpSync(path.join(root,'aiui-agent',name),path.join(stage,name),{recursive:true});
  fs.copyFileSync(path.join(root,'aiui-agent/config.example.js'),path.join(stage,'config.js'));
  const info=createBuildInfo(root),second=createBuildInfo(root);
  assert.equal(info.gitSha,second.gitSha);assert.notEqual(info.releaseId,second.releaseId);
  writeBuildInfo(stage,info);
  const aix=path.join(stage,'test.aix');
  execFileSync(path.join(root,'aiui-agent/node_modules/.bin/aix'),['pack',stage,'-o',aix]);
  assert.deepEqual(readAixBuildInfo(aix),info);
  assert.equal(buildLabel(readAixBuildInfo(aix)),`Jarvis build ${info.gitSha.slice(0,7)} · resource ${info.releaseId}`);
  assert.deepEqual(compareAixBuildInfo(aix,aix,'1.2.0'),{nativeVersion:'1.2.0',buildInfo:info});
  const other=path.join(stage,'other.aix');writeBuildInfo(stage,second);
  execFileSync(path.join(root,'aiui-agent/node_modules/.bin/aix'),['pack',stage,'-o',other]);
  assert.throws(()=>compareAixBuildInfo(aix,other,'1.2.1'),/active_build_info_mismatch/);
 }finally{fs.rmSync(stage,{recursive:true,force:true})}
});
