import { Fault } from './protocol.mjs';
// Capability enablement/auth belongs to Codex. Only approval leaves are scoped to Jarvis.
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const table = () => Object.create(null);
const mode = value => value === 'prompt' ? 'prompt' : 'writes';
export function toolPolicyOverrides(config = {}, servers = []) {
  const out = {apps:table(),mcp_servers:table(),plugins:table()};
  const toolPolicy = (value, fallback) => {
    const tools=table();
    for(const [name,tool] of Object.entries(object(value)))tools[name]={approval_mode:mode(tool?.approval_mode??fallback)};
    return tools;
  };
  // Opaque MCP code runners may advertise readOnlyHint even for arbitrary code.
  // Require a local decision for every ordinary/plugin MCP call, independent of hints.
  const serverPolicy = (value={}) => {
    const tools=table();for(const name of Object.keys(object(value.tools)))tools[name]={approval_mode:'prompt'};
    return {default_tools_approval_mode:'prompt',tools};
  };
  const apps=object(config.apps);
  out.apps._default={default_tools_approval_mode:mode(apps._default?.default_tools_approval_mode),approvals_reviewer:'user'};
  for(const [name,app] of Object.entries(apps)) {
    if(name==='_default')continue;
    const fallback=app.default_tools_approval_mode??apps._default?.default_tools_approval_mode;
    const value={default_tools_approval_mode:mode(fallback),approvals_reviewer:'user',tools:toolPolicy(app.tools,fallback),links:table()};
    for(const [id,link] of Object.entries(object(app.links)))value.links[id]={default_tools_approval_mode:mode(link?.default_tools_approval_mode??fallback),approvals_reviewer:'user'};
    out.apps[name]=value;
  }
  for(const [name,server] of Object.entries(object(config.mcp_servers)))out.mcp_servers[name]=serverPolicy(server);
  const pluginServers=new Map();
  for(const [id,plugin] of Object.entries(object(config.plugins))) {
    for(const [name,server] of Object.entries(object(plugin.mcp_servers)))pluginServers.set(JSON.stringify([id,name]),server);
  }
  for(const server of servers) {
    // codex_apps is the native connected-app bridge, governed by apps.* above.
    // A new unclassified host bridge must not silently inherit bypass policy.
    if(!server.pluginId && server.name!=='codex_apps' && !Object.hasOwn(object(config.mcp_servers),server.name))throw new Fault('unsupported_capability_policy_source',503);
  }
  for(const server of servers)if(server.pluginId) {
    const id=JSON.stringify([server.pluginId,server.name]);
    if(!pluginServers.has(id))pluginServers.set(id,{});
  }
  for(const [id,server] of pluginServers) {
    const [plugin,name]=JSON.parse(id);
    out.plugins[plugin]??={mcp_servers:table()};
    out.plugins[plugin].mcp_servers[name]=serverPolicy(server);
  }
  // Nested objects merge in app-server. Quoted TOML segments in RPC map keys do NOT:
  // they create literal quote-bearing server names and lose the configured transport.
  return out;
}
