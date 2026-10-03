import path from 'node:path';
import { approvalResponse } from './protocol.mjs';
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const only = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key));
const literalPath = value => typeof value === 'string' && value.startsWith('/') &&
  value.length <= 4096 && !value.includes('\0') && path.posix.normalize(value) !== '/';

// Human acceptance grants only the represented request for this turn. Complex glob/special
// profiles require their native UI; do not broaden or invent an equivalent filesystem grant.
function requestedPermissions(params) {
  const p = params?.permissions;
  if (typeof params?.turnId !== 'string' || !only(p, ['network', 'fileSystem'])) return null;
  const out = {};
  if (p.network != null) {
    if (!only(p.network, ['enabled']) || typeof p.network.enabled !== 'boolean') return null;
    out.network = { enabled: p.network.enabled };
  }
  if (p.fileSystem != null) {
    const f = p.fileSystem;
    if (!only(f, ['read', 'write', 'entries', 'globScanMaxDepth']) || f.globScanMaxDepth != null) return null;
    const next = {};
    for (const key of ['read', 'write']) if (f[key] != null) {
      if (!Array.isArray(f[key]) || f[key].length > 32 || !f[key].every(literalPath)) return null;
      next[key] = [...f[key]];
    }
    if (f.entries != null) {
      if (!Array.isArray(f.entries) || f.entries.length > 32) return null;
      next.entries = [];
      for (const entry of f.entries) {
        if (!only(entry, ['path', 'access']) || !['read', 'write'].includes(entry.access) ||
            !only(entry.path, ['type', 'path']) || entry.path.type !== 'path' || !literalPath(entry.path.path)) return null;
        next.entries.push({ path: { type: 'path', path: entry.path.path }, access: entry.access });
      }
    }
    out.fileSystem = next;
  }
  return Object.keys(out).length ? out : null;
}
const commands = new Set(['item/commandExecution/requestApproval','item/fileChange/requestApproval']);
// Only this native shape has a real omitted-persist lifetime proof (ALE-465).
// Treat provider message/display metadata as untrusted; return fixed product strings.
export function deviceApproval(method, params) {
  if (!supportedApproval(method, params) || method !== 'mcpServer/elicitation/request') return null;
  const m = params._meta;
  if (params.serverName !== 'cua_repl' || m.tool_name !== 'get_app_state' ||
      !only(m.tool_params, ['app']) || m.tool_params.app !== 'com.apple.calculator' ||
      !['low','medium','high'].includes(m.riskLevel) ||
      !Array.isArray(m.persist) || m.persist.length !== 2 ||
      new Set(m.persist).size !== 2 || !m.persist.every(v => ['session','always'].includes(v))) return null;
  return {kind:'computer-use',title:'Calculator',description:'Прочитать окно Calculator один раз',risk:m.riskLevel,allowOnGlasses:true};
}
export const APPROVAL_NOTICES = Object.freeze({
  unsupported:'Для этого действия требуется подтверждение на Mac. Через очки его подтвердить нельзя. Действие не выполнено.',
  declined:'Разрешение отклонено. Действие не выполнено.',
  timeout:'Подтверждение не получено. Действие отменено.'
});
// Native 0.157.1 MCP tool confirmation observed in a real model turn. Input/auth forms
// need a separate local UI, not fabricated values or a blanket affirmative response.
export function supportedApproval(method, params) {
  if (commands.has(method)) return true;
  if (method==='item/permissions/requestApproval')return requestedPermissions(params)!==null;
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
  if(method==='item/permissions/requestApproval')return {permissions:allow?(requestedPermissions(params)??{}):{},scope:'turn'};
  if (method === 'mcpServer/elicitation/request') {
    return allow && supportedApproval(method, params) ? {action:'accept',content:{}} : {action:'decline',content:null};
  }
  return approvalResponse(method, allow && commands.has(method));
}
