// 共通: schema.js（UMD）の読み込みとファイル入出力
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '..');
const require = createRequire(import.meta.url);
export const S = require(resolve(ROOT, 'js/schema.js'));

export const DATA_PATH = resolve(ROOT, 'data/places.json');
export function readJSON(p) { return JSON.parse(readFileSync(p, 'utf8')); }
export function writeJSON(p, obj) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(obj, null, 1) + '\n'); }
export function today() { return new Date().toISOString().slice(0, 10); }
export function loadPlaces(path = DATA_PATH) {
  const json = readJSON(path);
  return { meta: json.meta || {}, places: (json.places || []).map(S.normalizePlace) };
}
export function stripDerived(p) {
  // 派生値（price_min/max）は保存しない
  const { price_min, price_max, id_generated, ...rest } = p;
  return rest;
}
export function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
