#!/usr/bin/env node
// CSV（スプレッドシートの書き出し、または公開シートの gviz CSV）→ data/places.json
// 使い方:
//   node scripts/csv-to-json.mjs path/to/places.csv
//   node scripts/csv-to-json.mjs --sheet <SHEET_ID> [--name <タブ名>]   （--name 省略時は最初のタブ）
//   オプション: --out data/places.json  --check（書き込まずに差分の有無だけ終了コードで返す: 0=差分なし, 3=差分あり）
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { S, ROOT, DATA_PATH, readJSON, writeJSON, today, stripDerived, arg } from './_lib.mjs';

const sheetId = arg('--sheet');
const sheetName = arg('--name', '');
const outPath = resolve(ROOT, arg('--out', 'data/places.json'));
const check = process.argv.includes('--check');

let csv;
if (sheetId && sheetId !== true) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&headers=1` + (sheetName && sheetName !== true ? `&sheet=${encodeURIComponent(sheetName)}` : '');
  const res = await fetch(url);
  if (!res.ok) { console.error(`シートの取得に失敗: HTTP ${res.status}（シートは「リンクを知っている全員が閲覧可」にしてください）`); process.exit(2); }
  csv = await res.text();
} else {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--') && existsSync(a));
  if (!file) { console.error('CSV ファイルのパス、または --sheet <SHEET_ID> を指定してください'); process.exit(2); }
  csv = readFileSync(file, 'utf8');
}
const rows = S.csvToObjects(csv);
if (!rows.length || !('名称' in rows[0])) { console.error('見出し行に「名称」がありません。シートの1行目が見出しになっているか確認してください'); process.exit(2); }
const places = rows.map(S.rowToPlace).filter((p) => p.name);
places.filter((p) => p.id_generated).forEach((p) => console.warn(`注意: [${p.name}] id が空のため名称から生成しました (${p.id})。名称を変えると id も変わるので、シートの id 列に固定値を入れてください`));
const errs = S.validateAll(places);
if (errs.length) {
  console.error(`検証エラー ${errs.length} 件（修正してから再実行してください）:`);
  errs.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
const prev = existsSync(DATA_PATH) ? readJSON(DATA_PATH) : { meta: {} };
// 「非公開」の行は公開スナップショットに含めない（シートが正本）
const publicPlaces = places.filter((p) => p.status !== 'hidden');
const prevCount = (prev.places || []).length;
if (prevCount && publicPlaces.length < prevCount * 0.7 && !process.argv.includes('--force')) {
  console.error(`件数が大きく減っています（前回 ${prevCount} 件 → 今回 ${publicPlaces.length} 件）。シートの取り違え・タブ名の変更の可能性があるため書き込みません（意図した変更なら --force）`);
  process.exit(4);
}
const next = { meta: Object.assign({}, prev.meta, { updated: today(), source: sheetId ? 'google-sheets' : 'csv' }), places: publicPlaces.map(stripDerived) };
const same = JSON.stringify(prev.places || []) === JSON.stringify(next.places);
if (check) { console.log(same ? '差分なし' : '差分あり'); process.exit(same ? 0 : 3); }
if (same) { console.log('差分なし（書き込みませんでした）'); process.exit(0); }
writeJSON(outPath, next);
console.log(`${places.length} 件を書き込みました: ${outPath}`);
