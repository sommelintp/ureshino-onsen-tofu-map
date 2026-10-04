#!/usr/bin/env node
// data/places.json と data/background.json を検証する。CI と push 前に実行。
import { resolve } from 'node:path';
import { S, ROOT, loadPlaces, readJSON } from './_lib.mjs';

const { meta, places } = loadPlaces();
const errs = S.validateAll(places);
const warns = [];
places.forEach((p) => {
  if (p.status === 'published' && p.yudofu === 'confirmed' && p.menu.length === 0 && p.category !== 'other') warns.push(`[${p.name}] 確認済みですがメニュー情報がありません`);
  if (p.lat == null) warns.push(`[${p.name}] 座標がありません（地図に表示されません）`);
  if (p.geo_precision === 'approx') warns.push(`[${p.name}] 位置は概略です（npm run geocode で補完できます）`);
});
let bgErr = '';
try {
  const bg = readJSON(resolve(ROOT, 'data/background.json'));
  if (!Array.isArray(bg.sections)) bgErr = 'background.json: sections が配列ではありません';
} catch (e) { bgErr = 'background.json: ' + e.message; }

const counts = {};
places.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
console.log(`places: ${places.length} 件 (updated ${meta.updated || '?'})`, counts);
console.log(`公開 ${places.filter((p) => p.status === 'published').length} / 要確認 ${places.filter((p) => p.status === 'needs_review').length} / 非公開 ${places.filter((p) => p.status === 'hidden').length}`);
console.log(`座標あり ${places.filter((p) => p.lat != null).length}（正確 ${places.filter((p) => p.geo_precision === 'exact').length}・概略 ${places.filter((p) => p.geo_precision === 'approx').length}）`);
if (process.argv.includes('--warnings')) warns.forEach((w) => console.log('  warn:', w));
else console.log(`warnings: ${warns.length} 件（--warnings で表示）`);
if (bgErr) errs.push(bgErr);
if (errs.length) {
  console.error(`\nエラー ${errs.length} 件:`);
  errs.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log('OK: エラーはありません');
