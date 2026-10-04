#!/usr/bin/env node
// ローカル確認用の簡易サーバー: node scripts/serve.mjs [port]  → http://localhost:8080/
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, normalize } from 'node:path';
import { ROOT } from './_lib.mjs';

const port = Number(process.argv[2] || process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8' };
createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = resolve(ROOT, '.' + normalize(p));
    if (!file.startsWith(ROOT)) throw new Error('forbidden');
    const st = await stat(file);
    if (st.isDirectory()) { res.writeHead(302, { Location: p + '/' }); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 Not Found');
  }
}).listen(port, () => console.log(`http://localhost:${port}/  （Ctrl+C で終了）`));
