#!/usr/bin/env node
'use strict';
/**
 * Tiny read-only static server for the solution viewer (127.0.0.1 only).
 *
 *   node tools/viewer/serve.js --port 8765 --inputs <folder with spec/solutions/loops json>
 *
 * Routes mirror the game's nginx layout so the viewer loads the game's own files:
 *   /viewer/*  tools/viewer        /js/*, /css/*  web/js, web/css
 *   /img/*     img, img/Stuff, web/img (same fallback order as production)
 *   /data/tiles/*  data/tiles      /lib/*  tools/scripts/lib
 *   /inputs/*  --inputs folder (.gz files are served unzipped)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const REPO = path.resolve(__dirname, '..', '..');
function arg(name, dflt) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : dflt;
}
const port = Number(arg('port', 0));
const inputs = path.resolve(arg('inputs', path.join(REPO, 'tools/viewer')));
const firstUrl = arg('open-path', '/viewer/solution-viewer.html');

const ROUTES = [
  ['/viewer/', [path.join(REPO, 'tools/viewer')]],
  ['/js/', [path.join(REPO, 'web/js')]],
  ['/css/', [path.join(REPO, 'web/css')]],
  ['/img/', [path.join(REPO, 'img'), path.join(REPO, 'img/Stuff'), path.join(REPO, 'web/img')]],
  ['/data/tiles/', [path.join(REPO, 'data/tiles')]],
  ['/lib/', [path.join(REPO, 'tools/scripts/lib')]],
  ['/inputs/', [inputs]],
];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function resolveFile(urlPath) {
  for (const [prefix, roots] of ROUTES) {
    if (!urlPath.startsWith(prefix)) continue;
    const rel = urlPath.slice(prefix.length);
    for (const root of roots) {
      const full = path.resolve(root, rel);
      if (!full.startsWith(root + path.sep)) continue;
      try {
        if (fs.statSync(full).isFile()) return full;
      } catch { /* try next root */ }
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (urlPath === '/') {
    res.writeHead(302, { Location: firstUrl }).end();
    return;
  }
  const file = resolveFile(urlPath);
  if (!file || (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found: ' + urlPath);
    return;
  }
  let body = fs.readFileSync(file);
  let ext = path.extname(file).toLowerCase();
  if (ext === '.gz') {
    body = zlib.gunzipSync(body);
    ext = path.extname(file.slice(0, -3)).toLowerCase();
  }
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(req.method === 'HEAD' ? undefined : body);
});

server.listen(port, '127.0.0.1', () => {
  const p = server.address().port;
  console.log(`TileZilla solution viewer serving on http://127.0.0.1:${p}${firstUrl}`);
  console.log(`inputs: ${inputs}`);
});
