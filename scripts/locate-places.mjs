#!/usr/bin/env node
// 店の正確な位置を自動で調べる（GitHub Actions 上で実行。.github/workflows/locate-places.yml）
//   1) OpenStreetMap（Overpass API）に店名で照合 … 名前が一致し、今の位置から 4km 以内の地物
//   2) 見つからなければ 国土地理院 住所検索 … 番地まで一致したときだけ採用
//   結果は data/places.json に書き、一覧を scripts/out/locate-report.txt に出す
// オプション: --all（正確な位置の店も調べ直す） --dry（書き込まない）
import { writeFileSync, mkdirSync } from 'node:fs';
import { S, DATA_PATH, readJSON, writeJSON, stripDerived } from './_lib.mjs';

const all = process.argv.includes('--all');
const dry = process.argv.includes('--dry');
const UA = 'ureshino-yudofu-map/1.0 (https://ureshino-yudofu-map.github.io/)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = readJSON(DATA_PATH);
const places = json.places.map(S.normalizePlace);
const today = new Date().toISOString().slice(0, 10);

// 名前の比較用: 表記をそろえ、宿・店の一般的な語と括弧書きを除く
const GENERIC = /(佐賀県|嬉野市|嬉野町|嬉野温泉|うれしのおんせん|嬉野|うれしの|温泉|おんせん|旅館|りょかん|ほてる|ホテル|お宿|御宿|宿|の宿|料理|割烹|かっぽう|食事処|お食事処|しょくじどころ|レストラン|れすとらん|店|本店|支店|株式会社|\s|・|「|」|『|』|&|＆|-|ー|･)/g;
const key = (s) => S.normalizeSearch(String(s || '').replace(/[（(][^）)]*[)）]/g, '')).replace(GENERIC, '');
function bigrams(s) { const a = []; for (let i = 0; i < s.length - 1; i++) a.push(s.slice(i, i + 2)); return a; }
function similar(a, b) {
  const x = key(a), y = key(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if ((x.length >= 2 && y.includes(x)) || (y.length >= 2 && x.includes(y))) return 0.9;
  const bx = bigrams(x), by = bigrams(y); if (!bx.length || !by.length) return 0;
  const set = new Set(by); const hit = bx.filter((g) => set.has(g)).length;
  return (2 * hit) / (bx.length + by.length);
}
function km(a, b) {
  const R = 6371, d = Math.PI / 180;
  const dl = (b[0] - a[0]) * d, dn = (b[1] - a[1]) * d;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * d) * Math.cos(b[0] * d) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 1) OpenStreetMap の地物（嬉野市一帯）をまとめて取得
const BBOX = '33.02,129.90,33.20,130.13';
const q = `[out:json][timeout:60];(nwr["name"]["tourism"](${BBOX});nwr["name"]["amenity"](${BBOX});nwr["name"]["shop"](${BBOX});nwr["name"]["leisure"](${BBOX});nwr["name"]["craft"](${BBOX});nwr["name"]["building"](${BBOX}););out center tags;`;
let osm = [];
for (const ep of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
  try {
    const res = await fetch(ep, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const NOISE = /^(shelter|parking|parking_entrance|toilets|bench|bicycle_parking|waste_basket|vending_machine|post_box|atm|telephone)$/;
    osm = j.elements.filter((e) => !NOISE.test(e.tags.amenity || '')).map((e) => ({ name: e.tags.name, alt: [e.tags['name:ja'], e.tags.alt_name, e.tags.old_name, e.tags.official_name].filter(Boolean), lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, id: e.type + '/' + e.id })).filter((e) => e.lat && e.lng);
    break;
  } catch (e) { console.log('Overpass 失敗', ep, e.message); }
}
console.log('OSM 地物', osm.length, '件');

const CENTER = [33.098, 129.988];
const lines = [];
let changed = 0;
for (const p of places) {
  if (p.status === 'hidden') continue;
  if (!all && p.geo_precision === 'exact') { lines.push(`keep   ${p.id}\t${p.name}`); continue; }
  if (!p.address || /オンライン|番地未取得のみ/.test(p.address) || p.category === 'other' && !p.lat) { lines.push(`skip   ${p.id}\t${p.name}\t住所なし`); continue; }
  const here = p.lat != null ? [p.lat, p.lng] : CENTER;
  // 1) OSM
  const cands = osm.map((o) => ({ o, s: Math.max(similar(p.name, o.name), ...o.alt.map((a) => similar(p.name, a))), d: km(here, [o.lat, o.lng]) }))
    .filter((c) => c.s >= 0.75 && c.d <= 4).sort((a, b) => b.s - a.s || a.d - b.d);
  if (cands.length) {
    const c = cands[0];
    lines.push(`osm    ${p.id}\t${p.name}\t→ ${c.o.name} (${c.o.id}) 類似${c.s.toFixed(2)} ${c.d.toFixed(2)}km  ${c.o.lat.toFixed(6)},${c.o.lng.toFixed(6)}`);
    if (!dry) { p.lat = +c.o.lat.toFixed(6); p.lng = +c.o.lng.toFixed(6); p.geo_precision = 'exact'; p.updated_at = today; p.editor_note = [p.editor_note, `位置: OpenStreetMap ${c.o.id}「${c.o.name}」(${today})`].filter(Boolean).join(' / '); changed++; }
    continue;
  }
  // 2) 国土地理院（番地まで一致したときだけ）
  const addr = String(p.address).replace(/[（(].*?[)）]/g, '').replace(/大字/g, '').replace(/\s+/g, '');
  try {
    const res = await fetch('https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + encodeURIComponent(addr), { headers: { 'User-Agent': UA } });
    const feats = await res.json();
    const hit = Array.isArray(feats) && feats.find((f) => /嬉野市/.test(f.properties?.title || ''));
    const digits = addr.match(/\d+/g) || [];
    if (hit && digits.length && digits.every((dg) => hit.properties.title.includes(dg))) {
      const [lng, lat] = hit.geometry.coordinates;
      lines.push(`gsi    ${p.id}\t${p.name}\t→ ${hit.properties.title}  ${lat},${lng}`);
      if (!dry) { p.lat = +(+lat).toFixed(6); p.lng = +(+lng).toFixed(6); p.geo_precision = 'exact'; p.updated_at = today; p.editor_note = [p.editor_note, `位置: 国土地理院 住所検索「${hit.properties.title}」(${today})`].filter(Boolean).join(' / '); changed++; }
    } else {
      const near = osm.map((o) => ({ o, s: similar(p.name, o.name), d: km(here, [o.lat, o.lng]) })).sort((a, b) => b.s - a.s)[0];
      lines.push(`miss   ${p.id}\t${p.name}\t住所: ${addr}  地理院: ${hit ? hit.properties.title : 'なし'}  OSM最類似: ${near ? near.o.name + ' ' + near.s.toFixed(2) + ' ' + near.d.toFixed(1) + 'km' : '-'}`);
    }
  } catch (e) { lines.push(`error  ${p.id}\t${p.name}\t${e.message}`); }
  await sleep(800);
}
const summary = `更新 ${changed} 件 / 対象 ${places.length} 件 / OSM 地物 ${osm.length} 件 (${new Date().toISOString()})`;
console.log(lines.join('\n') + '\n' + summary);
mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
writeFileSync(new URL('./out/locate-report.txt', import.meta.url), lines.join('\n') + '\n' + summary + '\n');
if (!dry && changed) {
  json.places = places.map(stripDerived);
  json.meta = Object.assign({}, json.meta, { updated: today });
  writeJSON(DATA_PATH, json);
}
