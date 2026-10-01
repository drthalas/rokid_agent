import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validConfig } from '../lib/gateway.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
if (!file || !process.argv.includes('--private-package')) throw new Error('Usage: npm run configure -- /absolute/path/aiui.local.json --private-package. This explicitly puts the DEVICE token in a private uploadable project.');
const c = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!path.isAbsolute(c.tokenFile) || (fs.statSync(c.tokenFile).mode & 0o077)) throw new Error('token_file_must_be_absolute_and_mode_0600');
const config = validConfig({ origin: c.origin, token: fs.readFileSync(c.tokenFile, 'utf8').trim(), project: c.project || '', sessionId: c.sessionId || '', tts: c.tts !== false });
const gatewayConfigPath = path.resolve(root, '../.local/config.json');
if (fs.existsSync(gatewayConfigPath)) {
  const gateway = JSON.parse(fs.readFileSync(gatewayConfigPath, 'utf8'));
  if (config.token === fs.readFileSync(gateway.adminTokenFile, 'utf8').trim()) throw new Error('admin_token_forbidden');
}
const output = path.resolve(root, '../.local/aiui-private');
fs.mkdirSync(output, { recursive: true, mode: 0o700 }); fs.chmodSync(output, 0o700);
for (const file of ['app.js', 'app.json', 'AGENTS.md', 'package.json', '.aixignore', 'pages', 'lib', 'licenses']) fs.cpSync(path.join(root, file), path.join(output, file), { recursive: true });
fs.writeFileSync(path.join(output, 'config.js'), 'export default ' + JSON.stringify(config) + ';\n', { mode: 0o600 });
console.log('Private project: ' + output + '\nThe device token will be readable in the AIX and uploaded to Rokid Cloud. Keep the agent private. No upload was performed.');
