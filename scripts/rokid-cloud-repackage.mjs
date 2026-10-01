/** Deterministic cloud-only fallback for an already uploaded project.
 * Adapter: the documented Browser/CDP tab API (or equivalent Playwright/CDP wrapper).
 * No filesystem/editor interaction, source mutation, permission edits or Review submission.
 */
export async function repackageCloud(tab, {agentId, openingMessage='Нажмите на дужку и говорите.'}) {
  const cdp=await tab.capabilities.get('cdp');
  const read=async()=>{
    const expression=`(async()=>{const m=document.cookie.match(/(?:^|;\\s*)ROKID_ACCOUNT_SESSION=([^;]*)/);if(!m)throw Error('account_session_missing');const r=await fetch('https://rcs-internal.rokid.com/metis/agent/getAIUIAgentList',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',access_token:decodeURIComponent(m[1])},body:JSON.stringify({pageNum:1,pageSize:100})});const b=await r.json();const a=b.data?.list?.find(x=>x.agentId===${JSON.stringify(agentId)});if(!a)throw Error('agent_not_found');return {id:a.agentId,name:a.agentName,version:a.nativeVersion,status:a.displayStatus,permissions:a.permissions,filePath:a.filePath?.split('?')[0],fileMd5:a.fileMd5};})()`;
    const response=await cdp.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},{timeoutMs:15000});
    if(response.exceptionDetails||!response.result?.value)throw Error('metadata_read_failed');
    return response.result.value;
  };
  const before=await read();
  if(before.status!=='draft')throw Error('private_draft_required');
  if(!await tab.playwright.getByRole('dialog',{name:'Build & Review',exact:true}).isVisible())await tab.playwright.getByRole('button',{name:'Build & Review',exact:true}).click();
  await tab.playwright.getByRole('tab',{name:'Basic Information',exact:true}).click();
  const active=await tab.playwright.getByRole('textbox',{name:'Agent ID',exact:true}).evaluate(e=>e.value);
  if(active!==agentId)throw Error('wrong_active_agent');
  await tab.playwright.getByRole('textbox',{name:'*Opening Message',exact:true}).fill(openingMessage);
  await tab.playwright.getByRole('tab',{name:'AIX Packaging',exact:true}).click();
  await tab.playwright.getByRole('button',{name:'Repackage AIX',exact:true}).click();
  await tab.playwright.getByRole('button',{name:'Repackage AIX',exact:true}).waitFor({state:'visible',timeoutMs:120000});
  await tab.playwright.getByRole('button',{name:'Save Details',exact:true}).click();
  for(let i=0;i<20;i++){
    const after=await read();
    if(after.version!==before.version&&after.fileMd5!==before.fileMd5){
      if(after.status!=='draft'||after.permissions!==before.permissions)throw Error('cloud_policy_changed');
      return {before,after};
    }
    await new Promise(r=>setTimeout(r,1000));
  }
  throw Error('cloud_save_not_confirmed');
}
