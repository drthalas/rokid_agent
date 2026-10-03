import path from 'node:path';
import os from 'node:os';
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
    if (!only(p.network, ['enabled']) || (p.network.enabled!=null&&typeof p.network.enabled !== 'boolean')) return null;
    if(p.network.enabled!=null)out.network = { enabled: p.network.enabled };
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
// Native request-class router. Display values are bounded and never silently truncated.
// Reject any request whose material target/scope cannot fit this review surface.
const SENSITIVE = /(?:bearer|password|passwd|authorization|cookie|credential|secret|api[_ -]?key|token|private[_ -]?key)/i;
function display(value,limit=96) {
  return typeof value==='string' && value.length>0 && value.length<=limit &&
    !/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value) && !SENSITIVE.test(value) &&
    !/[A-Za-z0-9_-]{40,}/.test(value) ? value : null;
}
function identifier(value,limit=80) {return display(value,limit)&&/^[A-Za-z][A-Za-z0-9_.-]*$/.test(value)?value:null;}
function safePath(value,cwd) {
  if(!literalPath(value)||path.posix.normalize(value)!==value||/(^|\/)(?:\.ssh|\.aws|\.codex|\.git|\.env(?:\.[^/]*)?|credentials?|secrets?)(\/|$)/i.test(value))return null;
  if(/^\/(?:System|Library|etc|Applications)(?:\/|$)/.test(value))return null;
  const home=os.homedir();
  let shown=cwd&&value.startsWith(cwd+'/')?value.slice(cwd.length+1):value.startsWith(home+'/')?'~/'+value.slice(home.length+1):value;
  if(shown===value&&value.split('/').filter(Boolean).length<2)return null;
  return display(shown);
}
function descriptor(kind,title,action,target,risk='high',scope='once') {
  if(!display(action,72)||!display(target))return null;
  return {kind,title,action,target,risk,scope,allowOnGlasses:true};
}
const COMPUTER_ACTIONS=Object.freeze({get_app_state:'Просмотр окна / снимок',type_text:'Ввод текста',press_key:'Нажатие клавиши',click:'Нажатие элемента',set_value:'Изменение значения',select_text:'Выбор текста',scroll:'Прокрутка',drag:'Перетаскивание'});
function permissionTarget(permissions,cwd) {
  const parts=[];
  if(permissions.network?.enabled===true)parts.push('Весь сетевой доступ');
  const f=permissions.fileSystem??{};
  const entries=[...(f.read??[]).map(p=>({p,access:'read'})),...(f.write??[]).map(p=>({p,access:'write'})),...(f.entries??[]).map(e=>({p:e.path.path,access:e.access}))];
  if(entries.length>3)return null;
  for(const e of entries){const p=safePath(e.p,cwd);if(!p)return null;parts.push((e.access==='read'?'Чтение: ':'Запись: ')+p)}
  return display(parts.join('; '));
}
function patchPreview(diff) {
  const lines=diff.split('\n'),hasHunks=lines.some(line=>line.startsWith('@@ '));let inHunk=false;const material=[];
  for(const line of lines){
    if(line==='')continue;
    if(/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(line)){inHunk=true;material.push(line);continue;}
    if(hasHunks&&!inHunk&&(/^(--- |\+\+\+ |diff --git )/.test(line)||/^index [a-f0-9]+\.\.[a-f0-9]+(?: \d{6})?$/.test(line)))continue;
    if(/^[+-]/.test(line)){material.push(line);continue;}
    if(inHunk&&line.startsWith(' '))continue;
    return null;
  }
  return material.join('; ');
}
export function deviceApproval(method,params,context={}) {
  if(!plain(params)||!supportedApproval(method,params))return null;
  if(method==='item/permissions/requestApproval'){
    if(params.environmentId!=null)return null;
    const p=requestedPermissions(params),target=p&&permissionTarget(p,context.cwd);
    return target?descriptor('permissions','Разрешения','Доступ до конца текущего запроса',target,'high','turn'):null;
  }
  if(method==='item/fileChange/requestApproval'){
    const item=context.item;
    if(params.grantRoot!=null||!item||item.id!==params.itemId||item.type!=='fileChange'||!Array.isArray(item.changes)||!item.changes.length||item.changes.length>3)return null;
    const targets=[];
    for(const change of item.changes){
      const target=safePath(change.path,context.cwd),type=change.kind?.type;
      if(!only(change,['path','kind','diff'])||typeof change.diff!=='string'||!target||!['add','delete','update'].includes(type))return null;
      const move=change.kind.move_path==null?null:safePath(change.kind.move_path,context.cwd);
      if(change.kind.move_path!=null&&!move)return null;
      const changed=type==='delete'?'':patchPreview(change.diff);
      if(changed===null)return null;
      if(type!=='delete'&&!changed&&!move)return null;
      targets.push(({add:'Создать ',delete:'Удалить ',update:'Изменить '})[type]+target+(move?' → '+move:'')+(changed?': '+changed:''));
    }
    return descriptor('file-change','Файлы','Применить указанное изменение',targets.join('; '));
  }
  if(method==='item/commandExecution/requestApproval'){
    if(params.environmentId!=null||(params.kind??'command')!=='command'||params.networkApprovalContext!=null||!context.cwd||params.cwd!==context.cwd||
      (params.availableDecisions!=null&&(!Array.isArray(params.availableDecisions)||!params.availableDecisions.includes('accept'))))return null;
    let command=params.command;
    if(typeof command!=='string')return null;
    const wrapper=/^\/(?:bin\/(?:zsh|bash|sh)) -lc '([^']+)'$/.exec(command);if(wrapper)command=wrapper[1];
    // Full simple argv remains visible; shell programs/substitutions/env/stdin are not summarized away.
    if(/(?:^|\/)(?:\.ssh|\.aws|\.codex|\.git|\.env)(?:\/|\s|$)/.test(command)||!/^[A-Za-z0-9_./@:+-]+(?: +[A-Za-z0-9_./@:+-]+)*$/.test(command)||/(?:^| )(-c|-e|--eval|-Command)(?: |$)/i.test(command)||!display(command))return null;
    const argv=command.split(/ +/),binary=argv[0].replace(/^\/(?:usr\/)?bin\//,'');
    const programs=['cat','ls','pwd','head','tail','stat','file','wc','du','mkdir','touch','cp','mv','rm','git','screencapture'];
    if(!programs.includes(binary)||(/\//.test(argv[0])&&!/^\/(?:usr\/)?bin\//.test(argv[0]))||/:\/\/[^ ]*@/.test(command)||argv.some(a=>['-u','--user','--password','--token','--header','--cookie','--oauth2-bearer'].includes(a)))return null;
    if(binary==='git'&&!['status','diff','log','show','add','commit','restore','checkout','switch','branch','push','fetch','pull','merge','rebase'].includes(argv[1]))return null;
    let target=command;
    if(params.additionalPermissions!=null){const p=requestedPermissions({turnId:params.turnId,permissions:params.additionalPermissions});const extra=p&&permissionTarget(p,context.cwd);if(!extra)return null;target+='; '+extra;}
    return descriptor('command','Команда','Выполнить команду один раз',target);
  }
  const m=params._meta;
  if(params.serverName==='cua_repl'&&only(m.tool_params,['app'])&&identifier(m.tool_params.app)&&
    Object.hasOwn(COMPUTER_ACTIONS,m.tool_name)&&Array.isArray(m.persist)&&m.persist.length===2&&new Set(m.persist).size===2&&m.persist.every(v=>['session','always'].includes(v))){
    const risk=['low','medium','high'].includes(m.riskLevel)?m.riskLevel:'high';
    // Native app-access class: proven omitted-persist responses re-prompt per native operation.
    return descriptor('computer-use','Computer Use',COMPUTER_ACTIONS[m.tool_name],m.tool_params.app,risk);
  }
  if(m.persist!=null||!identifier(params.serverName)||!identifier(m.tool_name,64)||!plain(m.tool_params))return null;
  const entries=Object.entries(m.tool_params);if(!entries.length||entries.length>3)return null;
  const targetKeys=new Set(['app','target','target_id','resource','resource_id','record','record_id','id','name','new_name','filename','path','destination','destination_id','to','recipient','project','project_id','document','document_id','title','label','label_id','folder','folder_id','url','operation']);
  const targets=[];
  for(const [key,value] of entries){
    if(!targetKeys.has(key)||!identifier(key,24)||/code|script|command|environment|headers|payload|body|sql/i.test(key)||SENSITIVE.test(key))return null;
    if(!['string','number','boolean'].includes(typeof value)||(typeof value==='number'&&!Number.isFinite(value))||!display(String(value),64)||/[<>`$;{}\[\]\\]/.test(String(value)))return null;
    if(key==='url'){try{const url=new URL(String(value));if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)return null}catch{return null}}
    targets.push(key+'='+String(value));
  }
  return descriptor('mcp-tool','Интеграция',m.tool_name.replaceAll('_',' '),params.serverName+(targets.length?': '+targets.join(', '):''),'high');
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
