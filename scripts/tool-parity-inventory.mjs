// Read-only, sanitized inventory. Separate process/ephemeral thread; never attaches to production.
import net from 'node:net';
import {Codex} from '../src/codex.mjs';
const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));
const port=listener.address().port;await new Promise(r=>listener.close(r));
const codex=new Codex({port,experimentalApi:true,timeout:60000});
const report={at:new Date().toISOString(),surface:'owned isolated app-server',results:{}};
const capture=async(name,fn)=>{try{report.results[name]={available:true,...await fn()}}catch(e){report.results[name]={available:false,reason:['codex_rpc_timeout','codex_rpc_rejected'].includes(e.code)?e.code:'inventory_failed'}}};
const cwd=process.cwd();
try{
 await codex.start();
 await capture('config',async()=>{const {config,layers}=await codex.request('config/read',{cwd,includeLayers:true});return{legacyNotifyConfigured:Array.isArray(config.notify)&&config.notify.length>0,layers:layers?.map(l=>l.name?.type),features:Object.fromEntries(Object.entries(config.features??{}).filter(([,v])=>typeof v==='boolean')),configuredMcp:Object.entries(config.mcp_servers??{}).map(([name,s])=>({name,enabled:s.enabled!==false})),configuredPlugins:Object.entries(config.plugins??{}).map(([name,p])=>({name,enabled:p.enabled!==false}))}});
 await capture('managed',async()=>{const r=await codex.request('configRequirements/read');return{present:!!r.requirements}});
 await capture('hooks',async()=>{const r=await codex.request('hooks/list',{cwds:[cwd]});return{count:r.data.reduce((n,x)=>n+x.hooks.length,0),errors:r.data.reduce((n,x)=>n+x.errors.length,0)}});
 // Creating a thread uses native hook trust. This script never adds trust or changes config.
 const {thread}=await codex.request('thread/start',{cwd,ephemeral:true,sandbox:'read-only',approvalPolicy:'on-request',approvalsReviewer:'user',config:await codex.approvalOverrides(cwd)});
 await codex.verifyToolPolicy(thread.id,cwd);
 await capture('apps',async()=>{const r=await codex.request('app/installed',{threadId:thread.id,forceRefresh:true});return{apps:r.apps.map(a=>({name:a.runtimeName,enabled:a.enabled,callable:a.callable}))}});
 await capture('mcp',async()=>({servers:(await codex.serverStatus(thread.id)).map(s=>({name:s.name,pluginId:s.pluginId,status:s.runtimeStatus,authStatus:s.authStatus,tools:Object.keys(s.tools??{}).length,discoveryFailed:!!s.toolsError}))}));
 await capture('skills',async()=>{const r=await codex.request('skills/list',{cwds:[cwd],forceReload:true});return{skills:r.data.flatMap(x=>x.skills.map(s=>({name:s.name,enabled:s.enabled,scope:s.scope,pluginId:s.pluginId})))}});
 await capture('plugins',async()=>{const r=await codex.request('plugin/list',{cwds:[cwd],forceRefetch:false});return{plugins:r.marketplaces.flatMap(m=>(m.plugins??[]).filter(p=>p.installed).map(p=>({name:p.name,enabled:p.enabled,installed:p.installed,version:p.localVersion??p.version}))),errors:r.marketplaceLoadErrors?.length??0}});
 console.log(JSON.stringify(report,null,2));
}finally{await codex.close()}
