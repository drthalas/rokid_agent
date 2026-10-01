import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const dir = path.resolve('.local');
if (fs.existsSync(path.join(dir, 'config.json'))) throw new Error('Config exists; edit it explicitly. Setup never overwrites credentials.');
fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700);
for (const name of ['device-token', 'admin-token']) fs.writeFileSync(path.join(dir, name), randomBytes(32).toString('base64url') + '\n', { mode: 0o600, flag: 'wx' });
const keyFile = path.join(dir, 'server-key.pem'), certFile = path.join(dir, 'server-cert.pem');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-keyout', keyFile, '-out', certFile, '-days', '365', '-subj', '/CN=rokid-mac-gateway'], { stdio: 'ignore' });
fs.chmodSync(keyFile, 0o600);
const config = { host: '127.0.0.1', port: 8443, adminPort: 8791, codexPort: 8390,
  codexBinary: execFileSync('/usr/bin/which', ['codex'], { encoding: 'utf8' }).trim(),
  projects: { rikid: fs.realpathSync(process.cwd()) }, defaultProject: 'rikid',
  tokenFile: path.join(dir, 'device-token'), adminTokenFile: path.join(dir, 'admin-token'), keyFile, certFile,
  stateFile: path.join(dir, 'state.json') };
fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
const fingerprint = new X509Certificate(fs.readFileSync(certFile)).fingerprint256.replaceAll(':', '').toLowerCase();
fs.writeFileSync(path.join(dir, 'certificate-sha256'), fingerprint + '\n');
console.log('Created .local/config.json. Certificate SHA-256: ' + fingerprint);
console.log('Device token is in .local/device-token; admin token stays on Mac.');
