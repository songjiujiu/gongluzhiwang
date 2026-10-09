'use strict';
// Read-only loopback preview. No package install or bundling required.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.ROAD_KING_PORT || process.argv[2] || 4178);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.wav': 'audio/wav', '.mp3':'audio/mpeg', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.bin':'application/octet-stream' };
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const requested = pathname === '/' ? '/preview/index.html' : pathname;
    const file = path.resolve(root, '.' + requested);
    const relative = path.relative(root, file).replace(/\\/g, '/');
    if (relative.startsWith('../') || path.isAbsolute(relative) || !/^(preview|公路之王)\//.test(relative)) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) { response.writeHead(404); response.end('Not found'); return; }
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(response);
    });
  } catch (_) { response.writeHead(400); response.end('Bad request'); }
});
server.listen(port, '127.0.0.1', () => console.log('Road King preview: http://127.0.0.1:' + port + '/'));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
