import { approvalResponse } from './protocol.mjs';
const commands = new Set(['item/commandExecution/requestApproval','item/fileChange/requestApproval']);
// Native 0.157.1 MCP tool confirmation observed in a real model turn. Input/auth forms
// need a separate local UI, not fabricated values or a blanket affirmative response.
export function supportedApproval(method, params) {
  if (commands.has(method)) return true;
  if (method !== 'mcpServer/elicitation/request' || params?.mode !== 'form' || params?._meta?.codex_approval_kind !== 'mcp_tool_call') return false;
  const schema = params.requestedSchema;
  return !!schema && schema.type === 'object' && schema.properties &&
    typeof schema.properties === 'object' && !Array.isArray(schema.properties) &&
    Object.keys(schema.properties).length === 0 &&
    Object.keys(schema).every(k => ['type','properties','required','additionalProperties'].includes(k)) &&
    (schema.required === undefined || (Array.isArray(schema.required) && schema.required.length === 0)) &&
    (schema.additionalProperties === undefined || schema.additionalProperties === false);
}
export function nativeApprovalResponse(method, params, allow) {
  if (method === 'mcpServer/elicitation/request') {
    return allow && supportedApproval(method, params) ? {action:'accept',content:{}} : {action:'decline',content:null};
  }
  return approvalResponse(method, allow && commands.has(method));
}
