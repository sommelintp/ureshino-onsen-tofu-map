/*
 * 嬉野温泉 湯どうふマップ — データの窓口（バックエンド担当: Claude）
 *
 * フロントエンド（画面・装飾）はデータを直接 fetch せず、必ずこの TofuData を使ってください。
 * データ形式・取得元（同梱JSON / Google スプレッドシート）・検証ルールが変わっても、画面側を直さずに済みます。
 * API の説明は docs/ARCHITECTURE.md の「データ API」を参照。
 *
 * 依存: config.js（window.TOFU_CONFIG）, js/schema.js（window.TofuSchema）
 */
(function (root) {
  'use strict';
  // ブラウザでは window.TofuSchema、Node（検証スクリプト）では require で読む
  const S = root.TofuSchema || (typeof require === 'function' ? require('./schema.js') : null);
  const CFG = function () {
    return Object.assign({
      SHEET_ID: '', SHEET_NAME: '', DATA_URL: 'data/places.json', MEDIA_URL: 'data/media.json',
      BACKGROUND_URL: 'data/background.json', GITHUB_REPO: '',
    }, root.TOFU_CONFIG || {});
  };

  const MEDIA_PLATFORMS = ['instagram', 'tiktok', 'youtube', 'x'];

  function fetchWithTimeout(url, ms) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ctrl && ctrl.abort(), ms);
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' }).finally(() => clearTimeout(t));
  }
  async function getJSON(url, embedded) {
    if (embedded) return embedded;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(url + ' の取得に失敗しました (HTTP ' + res.status + ')');
    return res.json();
  }

  function makeDataset(places, source, meta, extra) {
    const all = places.filter((p) => p.status !== 'hidden');
    const byId = {};
    all.forEach((p) => { byId[p.id] = p; });
    return Object.assign({ raw: places, all, byId, source, meta: meta || {} }, extra || {});
  }

  // 同梱スナップショット（data/places.json）
  async function loadLocalPlaces() {
    const json = await getJSON(CFG().DATA_URL, root.__TOFU_DATA__);
    return makeDataset((json.places || []).map(S.normalizePlace), 'json', json.meta || {});
  }

  // Google スプレッドシート（正本）。失敗時は null と理由を返す
  async function loadSheetPlaces() {
    const c = CFG();
    if (!c.SHEET_ID) return { dataset: null, error: '' };
    try {
      const url = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(c.SHEET_ID) +
        '/gviz/tq?tqx=out:csv&headers=1' + (c.SHEET_NAME ? '&sheet=' + encodeURIComponent(c.SHEET_NAME) : '');
      const res = await fetchWithTimeout(url, 10000);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rows = S.csvToObjects(await res.text());
      if (!rows.length || !('名称' in rows[0])) throw new Error('シートの見出し行（名称 など）が見つかりません');
      const places = rows.map(S.rowToPlace).filter((p) => p.name);
      if (!places.length) throw new Error('シートに行がありません');
      return { dataset: makeDataset(places, 'sheet', { updated: new Date().toISOString().slice(0, 10) }), error: '' };
    } catch (e) {
      console.warn('スプレッドシートの取得に失敗したため同梱データを表示しています:', e);
      return { dataset: null, error: String((e && e.message) || e) };
    }
  }

  /**
   * 店舗データを読み込む。まず同梱データで onData を呼び、シートが設定されていれば
   * 取得できた時点でもう一度 onData を呼ぶ（2回目は source === 'sheet'）。
   * 戻り値: 最終的な dataset。dataset = { all, byId, raw, source: 'json'|'sheet', meta, sheetError }
   */
  async function loadPlaces(onData) {
    let ds = await loadLocalPlaces();
    if (onData) onData(ds);
    const r = await loadSheetPlaces();
    if (r.dataset) { ds = r.dataset; if (onData) onData(ds); }
    else if (r.error) ds.sheetError = r.error;
    return ds;
  }

  function normalizeMedia(m) {
    const url = S.trim(m && m.url);
    let platform = S.trim(m && m.platform).toLowerCase();
    if (!platform) platform = /instagram\.com/.test(url) ? 'instagram' : /tiktok\.com/.test(url) ? 'tiktok' : /youtu\.?be/.test(url) ? 'youtube' : /(x|twitter)\.com/.test(url) ? 'x' : '';
    return {
      place_id: S.trim(m && m.place_id), platform, url,
      caption: S.trim(m && m.caption), verified: !!(m && m.verified),
      focus: S.trim(m && m.focus) === 'place' ? 'place' : 'yudofu',   // yudofu=湯どうふが主題（ヒーロー向き）/ place=店・宿の紹介
      embed_ok: m && m.embed_ok === false ? false : (m && m.embed_ok === true ? true : null),   // false=再生できない（自動チェック）
      added_by: S.trim(m && m.added_by), added_at: S.trim(m && m.added_at),
      youtube_id: platform === 'youtube' ? ((url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/) || [])[1] || '') : '',
    };
  }
  function validateMedia(items, placeIds) {
    const errs = [];
    items.forEach((m, i) => {
      const w = '[media ' + i + '] ';
      if (!S.isUrl(m.url)) errs.push(w + 'URL が不正です: ' + m.url);
      if (MEDIA_PLATFORMS.indexOf(m.platform) < 0) errs.push(w + '対応していない種類です（instagram / tiktok / youtube / x）: ' + m.url);
      if (m.place_id && placeIds && !placeIds[m.place_id]) errs.push(w + 'place_id「' + m.place_id + '」に該当する店がありません');
    });
    return errs;
  }

  /**
   * 写真・動画（SNS 投稿の埋め込み）を読み込む。確認済み（verified）のみ返す。
   * 戻り値: { items: [...], byPlace: { place_id: [...] }, general: [...]（店に紐づかない投稿） }
   */
  async function loadMedia() {
    let json = { items: [] };
    try { json = await getJSON(CFG().MEDIA_URL, root.__TOFU_MEDIA__); } catch (e) { console.warn('media を読み込めませんでした', e); }
    const items = (json.items || []).map(normalizeMedia).filter((m) => m.verified && m.embed_ok !== false && S.isUrl(m.url) && MEDIA_PLATFORMS.indexOf(m.platform) >= 0);
    const byPlace = {}; const general = [];
    items.forEach((m) => { if (m.place_id) (byPlace[m.place_id] = byPlace[m.place_id] || []).push(m); else general.push(m); });
    const yudofu = items.filter((m) => m.focus === 'yudofu');   // ヒーロー・ギャラリーで優先して見せる投稿
    return { items, byPlace, general, yudofu, updated: json.updated || '' };
  }

  // 「温泉湯どうふとは」の読み物
  async function loadBackground() {
    return getJSON(CFG().BACKGROUND_URL, root.__TOFU_BACKGROUND__);
  }

  /**
   * 投稿（情報の追加・修正）用の GitHub Issue URL を作る。
   * d = { mode: 'new'|'fix', placeId, name, category, address, menu, tofu, onsen, notes, sources, media, lat, lng, contributor }
   */
  function issueUrl(d) {
    const c = CFG();
    const label = (k) => (S.CATEGORIES[k] ? S.CATEGORIES[k].label : k || '');
    const base = 'https://github.com/' + c.GITHUB_REPO + '/issues/new';
    const q = new URLSearchParams();
    q.set('template', d.mode === 'fix' ? 'fix-place.yml' : 'new-place.yml');
    q.set('title', (d.mode === 'fix' ? '[修正] ' : '[追加] ') + (d.name || '（店名未入力）'));
    if (d.mode === 'fix') q.set('place', (d.name || '') + (d.placeId ? ' (id: ' + d.placeId + ')' : ''));
    q.set('name', d.name || ''); q.set('category', label(d.category)); q.set('address', d.address || '');
    q.set('menu', d.menu || ''); q.set('tofu', d.tofu || ''); q.set('onsen', d.onsen || '');
    q.set('notes', d.notes || ''); q.set('sources', d.sources || ''); q.set('media', d.media || '');
    q.set('coords', d.lat && d.lng ? d.lat + ', ' + d.lng : ''); q.set('contributor', d.contributor || '');
    let url = base + '?' + q.toString();
    if (url.length > 7500) {
      const q2 = new URLSearchParams(); q2.set('title', q.get('title')); q2.set('labels', d.mode === 'fix' ? '修正提案' : '追加提案');
      q2.set('body', issueBody(d).slice(0, 6000)); url = base + '?' + q2.toString();
    }
    return url;
  }
  function issueBody(d) {
    const label = (k) => (S.CATEGORIES[k] ? S.CATEGORIES[k].label : k || '');
    const L = [];
    if (d.mode === 'fix' && d.placeId) L.push('対象: ' + d.name + ' (id: ' + d.placeId + ')', '');
    L.push('## お店・施設', d.name || '（未入力）', '', '## 種別', label(d.category), '', '## 住所', d.address || '（未入力）', '',
      '## 温泉湯どうふのメニューと価格', d.menu || '（未入力）', '', '## 使っている豆腐', d.tofu || '（未入力）', '', '## 使っている温泉', d.onsen || '（未入力）', '',
      '## 写真・動画の投稿URL（Instagram / TikTok / YouTube）', d.media || '（未入力）', '',
      '## 特徴・修正内容・コメント', d.notes || '（未入力）', '', '## 出典URL', d.sources || '（未入力）', '',
      '## 位置（緯度, 経度）', d.lat && d.lng ? d.lat + ', ' + d.lng : '（未入力）', '', '## 投稿者', d.contributor || '（匿名）');
    return L.join('\n');
  }

  root.TofuData = { loadPlaces, loadLocalPlaces, loadSheetPlaces, loadMedia, loadBackground, normalizeMedia, validateMedia, issueUrl, issueBody, MEDIA_PLATFORMS, schema: S };
})(typeof self !== 'undefined' ? self : this);
if (typeof module === 'object' && module.exports) module.exports = (typeof self !== 'undefined' ? self : this).TofuData;
