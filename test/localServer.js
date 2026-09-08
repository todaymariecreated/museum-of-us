// Tiny local HTTP server for end-to-end testing only — NOT what Vercel runs
// in production (Vercel wires up the same api/*.js files itself via its own
// file-system routing). This just lets us drive the real static pages
// against the real route handlers with Playwright, without needing the
// Vercel CLI or a live Supabase project.

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const { makeFakeDb } = require('./fakeDb');
const fakeDb = makeFakeDb();

const supabaseAdminPath = require.resolve('../lib/supabaseAdmin');
require.cache[supabaseAdminPath] = {
  id: supabaseAdminPath,
  filename: supabaseAdminPath,
  loaded: true,
  exports: { supabaseAdmin: () => fakeDb },
};

const createHandler = require('../api/museums/index.js');
const museumHandler = require('../api/museums/[id]/index.js');
const photoHandler = require('../api/museums/[id]/photo.js');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function makeVercelStyleRes(res) {
  return {
    status(code) {
      this._code = code;
      return this;
    },
    json(obj) {
      sendJson(res, this._code || 200, obj);
    },
    setHeader(k, v) {
      res.setHeader(k, v);
    },
  };
}

function readBody(req) {
  return new Promise((resolve) => {
    let chunks = '';
    req.on('data', (c) => (chunks += c));
    req.on('end', () => {
      if (!chunks) return resolve({});
      try {
        resolve(JSON.parse(chunks));
      } catch (e) {
        resolve({});
      }
    });
  });
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // --- API routing (mirrors Vercel's file-system routing for our api/ dir) ---
  if (pathname === '/api/museums' && req.method === 'POST') {
    const body = await readBody(req);
    return createHandler({ method: 'POST', body, query: {} }, makeVercelStyleRes(res));
  }

  const museumMatch = pathname.match(/^\/api\/museums\/([^/]+)$/);
  if (museumMatch) {
    const id = museumMatch[1];
    const query = Object.assign({ id }, parsed.query);
    if (req.method === 'GET') {
      return museumHandler({ method: 'GET', query }, makeVercelStyleRes(res));
    }
    if (req.method === 'PATCH') {
      const body = await readBody(req);
      return museumHandler({ method: 'PATCH', query, body }, makeVercelStyleRes(res));
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      return museumHandler({ method: 'POST', query, body }, makeVercelStyleRes(res));
    }
  }

  const photoMatch = pathname.match(/^\/api\/museums\/([^/]+)\/photo$/);
  if (photoMatch && req.method === 'POST') {
    const id = photoMatch[1];
    const body = await readBody(req);
    return photoHandler({ method: 'POST', query: { id }, body }, makeVercelStyleRes(res));
  }

  // --- Static files ---
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(PUBLIC_DIR, filePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const PORT = process.env.PORT || 4173;
server.listen(PORT, () => {
  console.log(`local test server on http://localhost:${PORT}`);
});
