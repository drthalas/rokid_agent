import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd(), config = path.resolve(process.argv[2] ?? '.local/config.json');
const xml = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const label = 'local.rokid.codex';
const args = [process.execPath, path.join(root, 'src/main.mjs'), config].map(s => `<string>${xml(s)}</string>`).join('');
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array>${args}</array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>15</integer>
<key>StandardOutPath</key><string>${xml(path.join(root, '.local/gateway.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(root, '.local/gateway-error.log'))}</string>
</dict></plist>\n`;
const file = path.join(root, '.local', label + '.plist'); fs.writeFileSync(file, plist, { mode: 0o600 });
console.log(file);
