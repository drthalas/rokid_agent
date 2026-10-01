import fs from 'node:fs';
import http from 'node:http';
const c = JSON.parse(fs.readFileSync(process.env.ROKID_CONFIG ?? '.local/config.json', 'utf8'));
const [cmd, arg, extra] = process.argv.slice(2);
let route, data;
if (cmd === 'approvals' || cmd === 'sessions') route = '/admin/' + cmd;
else if (cmd === 'accept' || cmd === 'decline') { route = '/admin/approvals/' + arg; data = { decision: cmd }; }
else if (cmd === 'import') { route = '/admin/import'; data = { project: arg, threadId: extra }; }
else if (cmd === 'reconcile') { route = '/admin/reconcile'; data = {}; }
else throw new Error('Usage: npm run ctl -- approvals|sessions|accept ID|decline ID|import PROJECT THREAD|reconcile');
const req = http.request({ hostname: '127.0.0.1', port: c.adminPort, path: route, method: data ? 'POST' : 'GET',
  headers: { Authorization: 'Bearer ' + fs.readFileSync(c.adminTokenFile, 'utf8').trim(), 'Content-Type': 'application/json' } }, res => {
  const parts = []; res.on('data', b => parts.push(b)); res.on('end', () => {
    // Escape terminal controls in untrusted tool commands; keep output readable.
    console.log(JSON.stringify(JSON.parse(Buffer.concat(parts)), null, 2));
    if (res.statusCode !== 200) process.exitCode = 1;
  });
});
req.on('error', () => { console.error('gateway_unavailable'); process.exitCode = 1; });
req.end(data ? JSON.stringify(data) : undefined);
