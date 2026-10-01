import fs from 'node:fs';
import path from 'node:path';
import { requireValue } from './protocol.mjs';

export function loadConfig(file) {
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  requireValue(c.projects && Object.keys(c.projects).length > 0, 'projects_required');
  c.projects = Object.fromEntries(Object.entries(c.projects).map(([alias, directory]) => {
    requireValue(/^[a-z0-9][a-z0-9_-]{0,39}$/.test(alias) && path.isAbsolute(directory), 'invalid_project');
    const canonical = fs.realpathSync(directory);
    requireValue(fs.statSync(canonical).isDirectory(), 'invalid_project');
    return [alias, canonical];
  }));
  requireValue(Object.hasOwn(c.projects, c.defaultProject), 'invalid_default_project');
  for (const key of ['tokenFile', 'adminTokenFile', 'certFile', 'keyFile', 'stateFile']) {
    requireValue(typeof c[key] === 'string' && path.isAbsolute(c[key]), 'absolute_config_paths_required');
  }
  for (const key of ['tokenFile', 'adminTokenFile', 'keyFile']) {
    requireValue((fs.statSync(c[key]).mode & 0o077) === 0, 'private_file_permissions_required');
  }
  for (const key of ['port', 'adminPort', 'codexPort']) requireValue(Number.isInteger(c[key]) && c[key] > 0 && c[key] < 65536, 'invalid_port');
  c.host ??= '127.0.0.1'; c.codexBinary ??= 'codex';
  return c;
}
export function projectPath(c, alias) {
  requireValue(typeof alias === 'string' && Object.hasOwn(c.projects, alias), 'project_not_allowed', 403);
  const configured = c.projects[alias];
  requireValue(fs.realpathSync(configured) === configured && fs.statSync(configured).isDirectory(), 'project_path_changed', 403);
  return configured;
}
