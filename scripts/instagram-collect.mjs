#!/usr/bin/env node
/*
 * Instagram 自動収集（Instagram Graph API）
 *
 * 1) ハッシュタグ検索（#嬉野温泉湯どうふ など）の最新投稿・人気投稿
 * 2) 各店・宿の公式アカウントの投稿（ビジネスディスカバリー）
 * を取得し、本文に「湯どうふ」系の語と店の呼び名がある投稿を data/media.json に追加する。
 *
 *  - 店名と湯どうふの両方が本文にある投稿     → verified: true（サイトに表示）
 *  - 公式アカウントの湯どうふ投稿            → verified: true（その店に紐づけ）
 *  - 嬉野＋湯どうふだが店が特定できない投稿   → data/media-candidates.json（表示しない。編集者が確認）
 *  画像は保存しない（permalink を公式埋め込みで表示する）。
 *
 * 環境変数:
 *   IG_ACCESS_TOKEN  … Instagram Graph API のアクセストークン（長期／システムユーザー）
 *   IG_USER_ID       … 自分の Instagram ビジネス／クリエイターアカウントの ID
 *   GRAPH_VERSION    … 省略時 v21.0
 * オプション:
 *   --dry            書き込まずに結果だけ表示
 *   --mock <file>    API の代わりに JSON（{hashtags:{tag:[media]}, accounts:{username:[media]}}）を使う（テスト用）
 */
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { ROOT, readJSON, writeJSON, today, arg } from './_lib.mjs';

const DRY = process.argv.includes('--dry');
const MOCK = arg('--mock');
const TOKEN = process.env.IG_ACCESS_TOKEN || '';
const IG_USER = process.env.IG_USER_ID || '';
const V = process.env.GRAPH_VERSION || 'v21.0';
const G = 'https://graph.facebook.com/' + V;
const FIELDS = 'id,caption,media_type,permalink,timestamp';

const cfg = readJSON(resolve(ROOT, 'data/instagram-config.json'));
const places = readJSON(resolve(ROOT, 'data/places.json')).places;
const mediaPath = resolve(ROOT, 'data/media.json');
const candPath = resolve(ROOT, 'data/media-candidates.json');
const media = readJSON(mediaPath);
const cands = existsSync(candPath) ? readJSON(candPath) : { note: 'Instagram 自動収集で見つかった「嬉野＋湯どうふ」だが店が特定できない投稿。編集者が確認して media.json に移す。', items: [] };
const mock = MOCK && MOCK !== true ? JSON.parse(readFileSync(MOCK, 'utf8')) : null;

if (!mock && (!TOKEN || !IG_USER)) {
  console.error('IG_ACCESS_TOKEN と IG_USER_ID を設定してください（docs/INSTAGRAM.md）。');
  process.exit(2);
}

const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s　#＃]/g, '');
const has = (text, words) => words.some((w) => norm(text).includes(norm(w)));
const ambiguous = new Set((cfg.skip_aliases_when_ambiguous || []).map(norm));

// 店の呼び名（設定 + 店名から自動生成）
const aliases = {};
places.forEach((p) => {
  const list = new Set(cfg.aliases[p.id] || []);
  const base = p.name.replace(/[（(].*?[)）]/g, '').trim();
  if (base.length >= 3) list.add(base);
  aliases[p.id] = [...list];
});
function matchPlace(caption) {
  const text = norm(caption);
  const hits = [];
  for (const [id, words] of Object.entries(aliases)) {
    for (const w of words) {
      const k = norm(w);
      if (!k || !text.includes(k)) continue;
      // 一般的すぎる呼び名（「花月」「松園」など）は「嬉野」も書かれているときだけ採用
      if (ambiguous.has(k) && !has(caption, cfg.area_keywords)) continue;
      hits.push({ id, len: k.length });
      break;
    }
  }
  if (!hits.length) return '';
  hits.sort((a, b) => b.len - a.len);   // より具体的な呼び名を優先（「佐嘉平川屋 嬉野店」>「平川屋」）
  return hits[0].id;
}

async function api(path, params) {
  const u = new URL(G + path);
  Object.entries(Object.assign({ access_token: TOKEN }, params || {})).forEach(([k, v]) => u.searchParams.set(k, v));
  const res = await fetch(u);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error((j.error && j.error.message) || 'HTTP ' + res.status);
  return j;
}
async function hashtagMedia(tag) {
  if (mock) return (mock.hashtags || {})[tag] || [];
  const s = await api('/ig_hashtag_search', { user_id: IG_USER, q: tag });
  const hid = s.data && s.data[0] && s.data[0].id;
  if (!hid) return [];
  const out = [];
  for (const edge of ['recent_media', 'top_media']) {
    try { const r = await api('/' + hid + '/' + edge, { user_id: IG_USER, fields: FIELDS, limit: 50 }); out.push(...(r.data || [])); }
    catch (e) { console.warn(`  #${tag} ${edge}: ${e.message}`); }
  }
  return out;
}
async function accountMedia(username) {
  if (mock) return (mock.accounts || {})[username] || [];
  const r = await api('/' + IG_USER, { fields: `business_discovery.username(${username}){media.limit(50){${FIELDS}}}` });
  return (r.business_discovery && r.business_discovery.media && r.business_discovery.media.data) || [];
}

const known = new Set([...media.items, ...cands.items].map((m) => (m.url || '').replace(/\/$/, '')));
const added = [], queued = [];
function shortCaption(c) { return String(c || '').replace(/#[^\s#]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60); }
function add(m, placeId, source) {
  const url = (m.permalink || '').replace(/\/$/, '') + '/';
  const key = url.replace(/\/$/, '');
  if (!m.permalink || known.has(key)) return;
  known.add(key);
  const item = { place_id: placeId, platform: 'instagram', url, caption: shortCaption(m.caption) || 'Instagram の投稿', focus: has(m.caption, cfg.yudofu_keywords) ? 'yudofu' : 'place',
    verified: !!placeId || source === 'official', added_by: 'Instagram 自動収集（' + source + '）', added_at: today(), posted_at: (m.timestamp || '').slice(0, 10), media_type: m.media_type || '' };
  if (item.verified) { media.items.push(item); added.push(item); } else { cands.items.push(item); queued.push(item); }
}

// 1) ハッシュタグ
for (const tag of cfg.hashtags.slice(0, 30)) {
  let list = [];
  try { list = await hashtagMedia(tag); } catch (e) { console.warn(`#${tag}: ${e.message}`); continue; }
  for (const m of list) {
    if (!has(m.caption, cfg.yudofu_keywords)) continue;          // 湯どうふの投稿だけ
    const pid = matchPlace(m.caption);
    if (pid) add(m, pid, '#' + tag);
    else if (has(m.caption, cfg.area_keywords)) add(m, '', '#' + tag);  // 嬉野＋湯どうふだが店不明 → 候補
  }
}
// 2) 公式アカウント
if (cfg.official_accounts_from_places) {
  const accounts = {};
  places.forEach((p) => { const u = ((p.urls && p.urls.instagram) || '').match(/instagram\.com\/([\w.]+)/); if (u) (accounts[u[1]] = accounts[u[1]] || []).push(p.id); });
  for (const [username, ids] of Object.entries(accounts)) {
    let list = [];
    try { list = await accountMedia(username); } catch (e) { console.warn(`@${username}: ${e.message}`); continue; }
    for (const m of list) {
      if (!has(m.caption, cfg.yudofu_keywords)) continue;
      const pid = ids.length === 1 ? ids[0] : (matchPlace(m.caption) || ids[0]);   // 共通アカウント（平川屋など）は本文で店を判定
      add(m, pid, 'official');
    }
  }
}

console.log(`追加（サイトに表示）: ${added.length} 件 / 候補（要確認）: ${queued.length} 件`);
added.forEach((m) => console.log(`  + [${m.place_id}] ${m.url}  ${m.caption.slice(0, 30)}`));
queued.forEach((m) => console.log(`  ? ${m.url}  ${m.caption.slice(0, 30)}`));
if (!DRY && (added.length || queued.length)) {
  media.updated = today(); cands.updated = today();
  writeJSON(mediaPath, media); writeJSON(candPath, cands);
}
