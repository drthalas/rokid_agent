import test from 'node:test';import assert from 'node:assert/strict';
import {assertDisabledCapabilities} from '../src/tool-policy.mjs';
import {spawnSpec} from '../src/codex.mjs';import {policy,turnPolicy} from '../src/protocol.mjs';
test('selected Approve-for-me profile does not impose app/MCP reviewer or mode overrides',()=>{
 const args=spawnSpec('codex',8390).args;
 assert.ok(args.includes('sandbox_mode="workspace-write"'));assert.ok(args.includes('approvals_reviewer="auto_review"'));
 assert.ok(!args.some(a=>/apps\.|mcp_servers|features\.(plugins|apps|hooks)|danger-full-access|approval_policy="never"/.test(a)));
 assert.equal(policy.sandbox,'workspace-write');assert.equal(policy.approvalsReviewer,'auto_review');
 assert.equal(turnPolicy.sandboxPolicy,undefined,'turn inherits native thread roots/network');
});
test('native modes/reviewers and credentials are not copied or changed',()=>{
 const c={apps:{_default:{default_tools_approval_mode:'auto'},mail:{default_tools_approval_mode:'approve',approvals_reviewer:'user'}},mcp_servers:{server:{enabled:true,default_tools_approval_mode:'writes',env:{TOKEN:'secret'}}},plugins:{p:{enabled:true,mcp_servers:{x:{default_tools_approval_mode:'auto'}}}}};const copy=structuredClone(c);
 assert.equal(assertDisabledCapabilities(c,[{name:'server',runtimeStatus:'connected',tools:{x:{}}},{name:'new_native_host',runtimeStatus:'connected',tools:{y:{}}}]),undefined);
 assert.deepEqual(c,copy);
});
test('disabled MCP/plugin remains disabled; native unknown bridges do not get a Jarvis policy',()=>{
 assert.doesNotThrow(()=>assertDisabledCapabilities({mcp_servers:{off:{enabled:false}}},[{name:'off',runtimeStatus:'disabled',tools:{}}]));
 assert.throws(()=>assertDisabledCapabilities({mcp_servers:{off:{enabled:false}}},[{name:'off',runtimeStatus:'connected',tools:{x:{}}}]),/disabled_capability_active/);
 assert.throws(()=>assertDisabledCapabilities({plugins:{p:{enabled:false}}},[{name:'x',pluginId:'p',runtimeStatus:'connected',tools:{x:{}}}]),/disabled_capability_active/);
});
