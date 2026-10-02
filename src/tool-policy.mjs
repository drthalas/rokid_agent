import { Fault } from './protocol.mjs';
// Codex owns capability enablement, auth and approval policy. No Jarvis override table.
export function assertDisabledCapabilities(config={},servers=[]) {
  for(const server of servers) {
    const plugin=server.pluginId&&config.plugins?.[server.pluginId];
    const disabled=config.mcp_servers?.[server.name]?.enabled===false || plugin?.enabled===false || plugin?.mcp_servers?.[server.name]?.enabled===false;
    if(disabled && (server.runtimeStatus!=='disabled'||Object.keys(server.tools??{}).length))throw new Fault('disabled_capability_active',503);
  }
}
