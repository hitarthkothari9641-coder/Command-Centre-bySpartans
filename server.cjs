#!/usr/bin/env node
/**
 * Big Boss · Command Center — production static server.
 *
 * Zero dependencies. Designed for Render (or any Node host / container):
 *   • binds 0.0.0.0 and honours $PORT,
 *   • GET /healthz → liveness + readiness JSON (Render healthCheckPath),
 *   • gzip, ETag/304 revalidation, immutable caching for /vendor and /assets,
 *   • correct MIME types (including .webmanifest for the PWA manifest),
 *   • SPA fallback only for app routes — never for asset extensions,
 *   • path-traversal protection and graceful SIGTERM shutdown.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const STARTED_AT = Date.now();
const VERSION = require('./package.json').version;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|xml|manifest)|image\/svg)/;

/** Extensions that mean "this is a file, not an app route" — 404 instead of HTML. */
const ASSET_EXTENSIONS = new Set([
  '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif',
  '.ico', '.woff', '.woff2', '.ttf', '.map', '.txt', '.xml', '.mp4', '.webm',
]);

/** Long-lived caching for build-time assets; HTML always revalidates. */
function cacheControl(urlPath, ext) {
  if (ext === '.html') return 'no-cache';
  if (urlPath.startsWith('/vendor/') || urlPath.startsWith('/assets/')) return 'public, max-age=604800, stale-while-revalidate=86400';
  if (ext === '.ico' || ext === '.webmanifest') return 'public, max-age=86400';
  return 'public, max-age=3600';
}

function send(res, status, headers, body) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function healthPayload() {
  return JSON.stringify({
    status: 'ok',
    service: 'bigboss-command-center',
    version: VERSION,
    env: NODE_ENV,
    render: Boolean(process.env.RENDER),
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });
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

  /* ── Health check (Render pings this) ─────────────────────────────── */
  if (urlPath === '/healthz' || urlPath === '/health') {
    const payload = healthPayload();
    return send(res, 200, { 'Content-Type': 'application/json; charset=utf-8' }, req.method === 'HEAD' ? '' : payload);
  }

  /* ── Path traversal protection ────────────────────────────────────── */
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(ROOT, safe);
  if (!filePath.startsWith(ROOT)) {
    return send(res, 403, { 'Content-Type': 'text/plain' }, 'Forbidden');
  }
  if (urlPath === '/' || urlPath.endsWith('/')) filePath = path.join(filePath, 'index.html');
  // Normalise "/favicon.ico" & friends that live under /assets in the source tree.
  if (urlPath === '/favicon.ico') filePath = path.join(ROOT, 'favicon.ico');

  const ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, (err, stat) => {
    const missing = err || !stat.isFile();

    if (missing) {
      // Asset-like requests must 404 — never fall back to HTML (an HTML body
      // served as .ico/.png is what makes browsers show a blank icon).
      if (ASSET_EXTENSIONS.has(ext)) {
        return send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found');
      }
      // SPA fallback for app routes (/, /#dashboard, deep links).
      return fs.readFile(path.join(ROOT, 'index.html'), (readErr, buffer) => {
        if (readErr) return send(res, 404, { 'Content-Type': 'text/plain' }, 'Not Found');
        send(res, 200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' }, req.method === 'HEAD' ? '' : buffer);
      });
    }

    const type = MIME[ext] || 'application/octet-stream';
    const etag = `W/"${stat.size}-${Number(stat.mtimeMs).toString(36)}"`;

    if (req.headers['if-none-match'] === etag) {
      return send(res, 304, { ETag: etag, 'Cache-Control': cacheControl(urlPath, ext) }, '');
    }

    fs.readFile(filePath, (readErr, buffer) => {
      if (readErr) return send(res, 500, { 'Content-Type': 'text/plain' }, 'Internal Server Error');

      const headers = {
        'Content-Type': type,
        ETag: etag,
        'Cache-Control': cacheControl(urlPath, ext),
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Last-Modified': stat.mtime.toUTCString(),
      };

      if (req.method === 'HEAD') return send(res, 200, headers, '');

      const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      if (acceptsGzip && COMPRESSIBLE.test(type) && buffer.length > 512) {
        return zlib.gzip(buffer, (gzipErr, gzipped) => {
          if (gzipErr) return send(res, 200, headers, buffer);
          send(res, 200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }, gzipped);
        });
      }
      send(res, 200, headers, buffer);
    });
  });
});

/* ── Keep-alive tuning (Render sits behind a proxy) ──────────────────── */
server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;

server.listen(PORT, HOST, () => {
  const url = process.env.RENDER_EXTERNAL_URL || `http://${HOST}:${PORT}`;
  console.log(`🏛️  Big Boss · Command Center v${VERSION} listening on ${HOST}:${PORT}`);
  console.log(`    → ${url}  (env: ${NODE_ENV}${process.env.RENDER ? ', Render' : ''})`);
  console.log(`    → health check: ${url.replace(/\/$/, '')}/healthz`);
});

/* ── Graceful shutdown so deploys never drop requests ───────────────── */
function shutdown(signal) {
  console.log(`\n${signal} received — draining connections…`);
  server.close(() => {
    console.log('✓ Server closed. Big Boss is watching from the shadows.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 8000).unref();
}
['SIGTERM', 'SIGINT'].forEach((signal) => process.on(signal, () => shutdown(signal)));
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
