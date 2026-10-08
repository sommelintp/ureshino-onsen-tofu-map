#!/usr/bin/env node
// 1ファイル版 dist/index.html を作る（CSS/JS/データを埋め込み、Leaflet は CDN）。
// メール添付やダブルクリックで開く用途向け。地図タイルの表示にはインターネット接続が必要。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './_lib.mjs';

const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
let html = read('index.html');
const css = read('css/style.css');
const config = read('config.js');
const schema = read('js/schema.js');
const app = read('js/app.js');
const illust = read('js/illust.js');
const data = read('data/places.json').trim();
const bg = read('data/background.json').trim();
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

html = html.replace('<link rel="stylesheet" href="css/style.css">', `<style>\n${css}\n</style>`);
html = html.replace('<script src="config.js"></script>', `<script>\n${safe(config)}\nwindow.__TOFU_DATA__ = ${safe(data)};\nwindow.__TOFU_BACKGROUND__ = ${safe(bg)};\n</script>`);
html = html.replace('<script src="js/schema.js"></script>', `<script>\n${safe(schema)}\n</script>`);
html = html.replace('<script src="js/illust.js"></script>', `<script>\n${safe(illust)}\n</script>`);
html = html.replace('<script src="js/app.js"></script>', `<script>\n${safe(app)}\n</script>`);
mkdirSync(resolve(ROOT, 'dist'), { recursive: true });
writeFileSync(resolve(ROOT, 'dist/index.html'), html);
console.log(`dist/index.html を書き出しました (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
