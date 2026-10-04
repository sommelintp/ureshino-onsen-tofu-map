#!/usr/bin/env node
// 住所から座標を付与する（国土地理院 住所検索API）。
// ※ クラウドの開発環境からは外部APIに出られないため、ローカルPCで実行してください。
// 使い方:
//   node scripts/geocode.mjs            座標が無い行だけ付与
//   node scripts/geocode.mjs --approx   「概略」の行も再付与（町丁目の代表点を上書き）
//   node scripts/geocode.mjs --dry      書き込まずに結果を表示
//   node scripts/geocode.mjs --id yokocho   特定の id だけ
import { S, DATA_PATH, readJSON, writeJSON, stripDerived, arg } from './_lib.mjs';

const redoApprox = process.argv.includes('--approx');
const dry = process.argv.includes('--dry');
const onlyId = arg('--id');
const json = readJSON(DATA_PATH);
const places = json.places.map(S.normalizePlace);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cleanAddress(a) {
  return String(a || '')
    .replace(/[（(].*?[)）]/g, '')          // 注記を除く
    .replace(/\s+[^\s]*(ビル|内|階|F).*$/, '')  // 建物名を除く
    .replace(/大字/g, '')
    .replace(/\s+/g, '')
    .trim();
}

let changed = 0, failed = 0;
for (const p of places) {
  if (onlyId && p.id !== onlyId) continue;
  const need = p.lat == null ? true : (redoApprox && p.geo_precision === 'approx');
  if (!need) continue;
  const q = cleanAddress(p.address);
  if (!/嬉野市|武雄市/.test(q) || /番地未取得|オンライン/.test(p.address)) { console.log(`skip  ${p.name}: 住所が不十分 (${p.address})`); continue; }
  const url = 'https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + encodeURIComponent(q);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ureshino-onsen-tofu-map/1.0 (geocode script)' } });
    const feats = await res.json();
    const hit = Array.isArray(feats) && feats.find((f) => /嬉野市|武雄市/.test(f.properties && f.properties.title || ''));
    if (!hit) { failed++; console.log(`miss  ${p.name}: ${q}`); continue; }
    const [lng, lat] = hit.geometry.coordinates;
    const title = hit.properties.title;
    // 番地まで一致したら「正確」、大字・字レベルなら「概略」
    const digits = (q.match(/\d+/g) || []);
    const exact = digits.length && digits.every((d) => title.includes(d));
    console.log(`${exact ? 'exact' : 'approx'} ${p.name}: ${lat}, ${lng}  ← ${title}`);
    if (!dry) { p.lat = lat; p.lng = lng; p.geo_precision = exact ? 'exact' : 'approx'; p.updated_at = new Date().toISOString().slice(0, 10); changed++; }
  } catch (e) {
    failed++; console.log(`error ${p.name}: ${e.message}`);
  }
  await sleep(1000); // 公共APIへの配慮
}
if (!dry && changed) {
  json.places = places.map(stripDerived);
  json.meta = Object.assign({}, json.meta, { updated: new Date().toISOString().slice(0, 10) });
  writeJSON(DATA_PATH, json);
}
console.log(`更新 ${changed} 件 / 失敗 ${failed} 件${dry ? '（dry run）' : ''}`);
