#!/usr/bin/env node
/*
 * 写真・動画（data/media.json）が埋め込み再生できるかを確認する。
 *  - YouTube: oEmbed（200=埋め込み可 / 401=埋め込み禁止 / 404・400=削除・非公開）
 *  - TikTok : oEmbed（200=可 / それ以外=不可）
 *  - Instagram: IG_ACCESS_TOKEN があれば instagram_oembed で確認（無ければスキップ）
 * 再生できないものは embed_ok: false にしてサイトに出さない（行は残す。復活したら自動で戻る）。
 * ネット接続が必要なので GitHub Actions で実行する（.github/workflows/check-media.yml）。
 *   --dry  書き込まない
 */
import { resolve } from 'node:path';
import { ROOT, readJSON, writeJSON, today } from './_lib.mjs';

const DRY = process.argv.includes('--dry');
const TOKEN = process.env.IG_ACCESS_TOKEN || '';
const path = resolve(ROOT, 'data/media.json');
const media = readJSON(path);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function status(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ureshino-tofu-map media checker' }, redirect: 'follow' });
    return res.status;
  } catch (e) { return 0; }   // ネットワーク不調は判定しない
}
async function check(m) {
  const u = encodeURIComponent(m.url);
  if (m.platform === 'youtube' || /youtu\.?be/.test(m.url)) {
    const s = await status('https://www.youtube.com/oembed?format=json&url=' + u);
    if (s === 200) return { ok: true };
    if (s === 401 || s === 403) return { ok: false, note: '投稿者が埋め込みを禁止' };
    if (s === 404 || s === 400) return { ok: false, note: '削除・非公開' };
    return { ok: null, note: 'HTTP ' + s };
  }
  if (m.platform === 'tiktok' || /tiktok\.com/.test(m.url)) {
    const s = await status('https://www.tiktok.com/oembed?url=' + u);
    if (s === 200) return { ok: true };
    if (s === 0 || s >= 500) return { ok: null, note: 'HTTP ' + s };
    return { ok: false, note: '削除・非公開・埋め込み不可（HTTP ' + s + '）' };
  }
  if (m.platform === 'instagram' || /instagram\.com/.test(m.url)) {
    if (!TOKEN) return { ok: null, note: 'トークン未設定のため未確認' };
    const s = await status('https://graph.facebook.com/v21.0/instagram_oembed?url=' + u + '&access_token=' + encodeURIComponent(TOKEN));
    if (s === 200) return { ok: true };
    if (s === 0 || s >= 500) return { ok: null, note: 'HTTP ' + s };
    return { ok: false, note: '削除・非公開・埋め込み不可（HTTP ' + s + '）' };
  }
  return { ok: null, note: '未対応' };
}

let ng = 0, ok = 0, unknown = 0, changed = 0;
for (const m of media.items) {
  const r = await check(m);
  if (r.ok === null) { unknown++; console.log(`?  ${m.url}  ${r.note}`); }
  else {
    const before = m.embed_ok;
    m.embed_ok = r.ok; m.checked_at = today();
    if (r.ok) { ok++; delete m.check_note; } else { ng++; m.check_note = r.note; console.log(`NG ${m.url}  ${r.note}  (${m.caption})`); }
    if (before !== m.embed_ok) changed++;
  }
  await sleep(300);
}
console.log(`再生可 ${ok} / 再生不可 ${ng} / 未確認 ${unknown}（状態が変わった ${changed} 件）`);
if (!DRY) { media.checked = today(); writeJSON(path, media); }
