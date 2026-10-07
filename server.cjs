#!/usr/bin/env node
/**
 * Big Boss Command Centre — static production server.
 * Zero dependencies. Serves the app on 0.0.0.0 with correct MIME types,
 * gzip compression, caching and SPA fallback.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml)|image\/svg)/;

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, { 'Content-Type': 'text/plain', Allow: 'GET, HEAD' }, 'Method Not Allowed');
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, { 'Content-Type': 'text/plain' }, 'Bad Request');
  }

  // Prevent path traversal
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(ROOT, safe);

  if (!filePath.startsWith(ROOT)) {
    return send(res, 403, { 'Content-Type': 'text/plain' }, 'Forbidden');
  }
  if (urlPath === '/' || urlPath.endsWith('/')) filePath = path.join(filePath, 'index.html');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback for unknown app routes
      const fallback = path.join(ROOT, 'index.html');
      return fs.readFile(fallback, (e2, buf) => {
        if (e2) return send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found');
        return send(
          res,
          200,
          { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' },
          req.method === 'HEAD' ? '' : buf,
        );
      });
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const etag = `W/"${stat.size}-${Number(stat.mtimeMs).toString(36)}"`;

    if (req.headers['if-none-match'] === etag) return send(res, 304, { ETag: etag }, '');

    fs.readFile(filePath, (e3, buf) => {
      if (e3) return send(res, 500, { 'Content-Type': 'text/plain' }, 'Internal Server Error');

      const headers = {
        'Content-Type': type,
        'ETag': etag,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      };

      if (req.method === 'HEAD') return send(res, 200, headers, '');

      const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      if (acceptsGzip && COMPRESSIBLE.test(type) && buf.length > 512) {
        return zlib.gzip(buf, (ge, gz) => {
          if (ge) return send(res, 200, headers, buf);
          send(res, 200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }, gz);
        });
      }
      send(res, 200, headers, buf);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Big Boss Command Centre running on http://${HOST}:${PORT}`);
});
