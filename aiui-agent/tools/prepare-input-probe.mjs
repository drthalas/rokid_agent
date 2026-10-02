// ALE-461 measurement-only staging. Production source/config and gateway remain untouched.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(root,'../.local/aiui-private');process.umask(0o077);
fs.mkdirSync(output,{recursive:true,mode:0o700});
for(const n of ['AGENTS.md','app.js','app.json','config.js','package.json','.aixignore','pages','lib','licenses'])fs.cpSync(path.join(root,n),path.join(output,n),{recursive:true});
const route='pages/input-probe/index';fs.mkdirSync(path.join(output,'pages/input-probe'),{recursive:true});
const page=fs.readFileSync(path.join(root,'tools/input-probe/pages/index/index.ink'),'utf8').replace("../../lib/trace.js","../../lib/input-trace.js");
fs.writeFileSync(path.join(output,route+'.ink'),page);
fs.copyFileSync(path.join(root,'tools/input-probe/lib/trace.js'),path.join(output,'lib/input-trace.js'));
const app=JSON.parse(fs.readFileSync(path.join(root,'app.json')));app.pages.push(route);
app.agentPrompt+=' Only when explicitly asked for "input probe" or "тест жестов", open pages/input-probe/index for diagnostics. Otherwise open the normal voice terminal.';
fs.writeFileSync(path.join(output,'app.json'),JSON.stringify(app,null,2)+'\n');
fs.appendFileSync(path.join(output,'AGENTS.md'),'\n## Temporary ALE-461 diagnostic route\nFor an explicit "input probe" or «тест жестов» request, open pages/input-probe/index. Otherwise keep the normal voice terminal. Probe captures code/edge/timing only, no audio or network.\n');
fs.chmodSync(path.join(output,'config.js'),0o600);
console.log('Prepared private staging with additional input-probe page; default production page and private config preserved');
