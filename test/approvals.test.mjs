import test from 'node:test';import assert from 'node:assert/strict';
import {supportedApproval,nativeApprovalResponse} from '../src/approvals.mjs';
const method='mcpServer/elicitation/request';
const form={_meta:{codex_approval_kind:'mcp_tool_call'},mode:'form',serverName:'codex_apps',requestedSchema:{type:'object',properties:{}}};
test('only native empty confirmation forms can receive specific local acceptance',()=>{
 assert.equal(supportedApproval(method,form),true);
 assert.deepEqual(nativeApprovalResponse(method,form,true),{action:'accept',content:{}});
 assert.deepEqual(nativeApprovalResponse(method,form,false),{action:'decline',content:null});
});
test('URL, secret/form input, device verification and arbitrary schemas cannot be auto-filled',()=>{
 for(const p of [{...form,_meta:{}},{...form,_meta:{codex_approval_kind:'session_grant'}},{...form,mode:'url'},{...form,mode:'openai/userVerification'},{...form,requestedSchema:{type:'object',properties:{token:{type:'string'}}}},{...form,requestedSchema:{type:'object',properties:{},required:['secret']}},{...form,requestedSchema:{type:'object',properties:{},allOf:[{}]}}]){
 assert.equal(supportedApproval(method,p),false);assert.deepEqual(nativeApprovalResponse(method,p,true),{action:'decline',content:null});
 }
 assert.equal(supportedApproval('item/tool/requestUserInput',{}),false);
 assert.equal(supportedApproval('item/tool/call',{}),false);
});
test('existing command/file approval stays per-request and permission expansion denied',()=>{
 assert.equal(supportedApproval('item/commandExecution/requestApproval',{}),true);
 assert.deepEqual(nativeApprovalResponse('item/fileChange/requestApproval',{},true),{decision:'accept'});
 assert.deepEqual(nativeApprovalResponse('item/permissions/requestApproval',{},true),{permissions:{},scope:'turn'});
});
