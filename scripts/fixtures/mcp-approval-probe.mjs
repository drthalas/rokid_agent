// Native-app-server test fixture. The only write changes this process's in-memory counter.
import readline from 'node:readline';
let counter=0;
const tools=[
 {name:'read_counter',description:'Read the diagnostic in-memory counter.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
 {name:'increment_counter',description:'Increment the diagnostic in-memory counter once. This is a write operation.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}}
];
readline.createInterface({input:process.stdin}).on('line',line=>{
 let m;try{m=JSON.parse(line)}catch{return}if(m.id===undefined)return;
 let result;
 if(m.method==='initialize')result={protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'rokid-approval-probe',version:'1.0.0'}};
 else if(m.method==='tools/list')result={tools};
 else if(m.method==='tools/call'&&['read_counter','increment_counter'].includes(m.params.name)){
  if(m.params.name==='increment_counter')counter++;
  result={content:[{type:'text',text:JSON.stringify({counter})}],isError:false};
 }else if(m.method==='ping')result={};
 else {process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'Unsupported diagnostic method'}})+'\n');return}
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\n');
});
