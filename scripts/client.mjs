import fs from 'node:fs';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
const c = JSON.parse(fs.readFileSync(process.env.ROKID_CONFIG ?? '.local/config.json', 'utf8'));
const [cmd, id, ...words] = process.argv.slice(2);
const call = (route, body, contentType = 'application/json') => new Promise((resolve, reject) => {
  const req = https.request({ hostname: c.host === '0.0.0.0' ? '127.0.0.1' : c.host, port: c.port, servername: 'rokid-mac-gateway', ca: fs.readFileSync(c.certFile), path: route, method: body ? 'POST' : 'GET',
    headers: { authorization: 'Bearer ' + fs.readFileSync(c.tokenFile, 'utf8').trim(), 'content-type': contentType } }, res => {
    const parts = []; res.on('data', b => parts.push(b)); res.on('end', () => {
      const result = JSON.parse(Buffer.concat(parts)); if (res.statusCode !== 200) reject(new Error(result.error)); else resolve(result);
    });
  }); req.on('error', reject); req.end(Buffer.isBuffer(body) ? body : body ? JSON.stringify(body) : undefined);
});
try {
  let result;
  if (cmd === 'health' || cmd === 'projects') result = await call('/v1/' + cmd);
  else if (cmd === 'stt') result = await call('/v1/stt', fs.readFileSync(id), 'audio/wav');
  else if (cmd === 'new') result = await call('/v1/sessions', { requestId: randomUUID(), ...(id ? { project: id } : {}) });
  else if (cmd === 'ask') result = await call(`/v1/sessions/${id}/turns`, { requestId: randomUUID(), text: words.join(' ') });
  else if (cmd === 'stop') result = await call(`/v1/sessions/${id}/stop`, {});
  else if (cmd === 'show' || cmd === 'watch') {
    do { result = await call(`/v1/sessions/${id}`); console.log(JSON.stringify(result, null, 2));
      if (cmd === 'show' || !['Working', 'Thinking'].includes(result.status)) break;
      await new Promise(r => setTimeout(r, 1000));
    } while (true);
    result = null;
  } else throw new Error('Usage: health|projects|new [PROJECT]|ask SESSION TEXT|show SESSION|watch SESSION|stop SESSION');
  if (result) console.log(JSON.stringify(result, null, 2));
} catch (e) { console.error(e.message); process.exitCode = 1; }
