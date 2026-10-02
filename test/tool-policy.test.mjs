import test from 'node:test';
import assert from 'node:assert/strict';
import {toolPolicyOverrides} from '../src/tool-policy.mjs';

test('native capabilities remain inherited while approval bypasses are clamped',()=>{
 const config={mcp_servers:{on:{enabled:true,url:'https://secret.invalid',http_headers:{Authorization:'secret-value'},default_tools_approval_mode:'approve',tools:{write:{approval_mode:'approve'}}},off:{enabled:false}},plugins:{'example@market':{enabled:false,mcp_servers:{docs:{enabled:false,tools:{send:{approval_mode:'auto'}}}}}},apps:{_default:{enabled:false},mail:{enabled:true,default_tools_approval_mode:'approve',approvals_reviewer:'auto_review',tools:{send:{approval_mode:'approve',enabled:false}},links:{owner:{approvals_reviewer:'auto_review',default_tools_approval_mode:'approve'}}}}};
 const copy=structuredClone(config),overrides=toolPolicyOverrides(config,[{name:'docs',pluginId:'example@market'}]);
 assert.deepEqual(config,copy);assert.ok(!JSON.stringify(overrides).includes('"enabled"'));
 assert.ok(!JSON.stringify(overrides).includes('secret'));const leaves=o=>Object.values(o).flatMap(v=>typeof v==='object'?leaves(v):[v]);assert.ok(leaves(overrides).every(v=>['writes','prompt','user'].includes(v)));
 assert.equal(overrides.mcp_servers.on.tools.write.approval_mode,'prompt');
 assert.equal(overrides.apps.mail.links.owner.approvals_reviewer,'user');
 assert.equal(overrides.plugins['example@market'].mcp_servers.docs.tools.send.approval_mode,'prompt');
});
test('preserve stricter prompt and preserve arbitrary native config identities with nested RPC tables',()=>{
 const o=toolPolicyOverrides({apps:{_default:{default_tools_approval_mode:'prompt'}},mcp_servers:{'a.b':{default_tools_approval_mode:'prompt',tools:{'x.y':{approval_mode:'prompt'}}}}},[{name:'plugin.server',pluginId:'p@market'}]);
 assert.equal(o.apps._default.default_tools_approval_mode,'prompt');
 assert.equal(o.mcp_servers['a.b'].tools['x.y'].approval_mode,'prompt');
 assert.equal(o.plugins['p@market'].mcp_servers['plugin.server'].default_tools_approval_mode,'prompt');
 assert.equal(o.mcp_servers.codex_apps,undefined);
});
test('refresh derives new capabilities without retaining old approval leaves',()=>{
 const a=toolPolicyOverrides({mcp_servers:{first:{enabled:false}}});
 const b=toolPolicyOverrides({mcp_servers:{second:{enabled:true}}});
 assert.ok(a.mcp_servers.first);assert.equal(b.mcp_servers.first,undefined);assert.ok(b.mcp_servers.second);
});

test('unclassified host bridges fail closed; native apps bridge uses app policy',()=>{
 assert.throws(()=>toolPolicyOverrides({},[{name:'unknown_host_bridge'}]),/unsupported_capability_policy_source/);
 assert.equal(toolPolicyOverrides({},[{name:'codex_apps'}]).apps._default.default_tools_approval_mode,'writes');
});
