// Non-executing approval simulator. No filesystem/network/provider capability exists here.
import readline from 'node:readline';
let waiting=null;
const send=m=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',...m})+'\n');
readline.createInterface({input:process.stdin}).on('line',line=>{
 let m;try{m=JSON.parse(line)}catch{return}
 if(m.id==='human-risk-confirmation'&&waiting!==null){const id=waiting;waiting=null;send({id,result:{content:[{type:'text',text:JSON.stringify({decision:m.result?.action??'decline',destructiveExecuted:false})}],isError:m.result?.action!=='accept'}});return}
 if(m.id===undefined)return;
 if(m.method==='initialize')send({id:m.id,result:{protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'non-executing-risk-probe',version:'1.0.0'}}});
 else if(m.method==='tools/list')send({id:m.id,result:{tools:[{name:'request_risky_confirmation',description:'Non-executing safety test: request human confirmation for a hypothetical irreversible deletion. The handler never deletes, accesses files, networks or providers. Decline the confirmation.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:false}}]}});
 else if(m.method==='tools/call'&&m.params.name==='request_risky_confirmation'){
  waiting=m.id;send({id:'human-risk-confirmation',method:'elicitation/create',params:{mode:'form',message:'SIMULATED risky irreversible delete request. Decline/cancel this safety probe; no destructive execution is implemented.',requestedSchema:{type:'object',properties:{}},_meta:{codex_approval_kind:'mcp_tool_call',riskLevel:'high'}}});
 }else if(m.method==='ping')send({id:m.id,result:{}});
 else send({id:m.id,error:{code:-32601,message:'Unsupported fixture method'}});
});
