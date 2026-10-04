/*
 * 嬉野温泉 湯どうふマップ — データスキーマ（ブラウザ / Node 共用）
 *
 * ここに「JSON のキー ⇄ スプレッドシートの日本語見出し」の対応と、
 * セル文字列のパース/シリアライズ、検証ルールを一元化しています。
 * ブラウザでは window.TofuSchema、Node では module.exports として使えます。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TofuSchema = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 列挙値 -------------------------------------------------------------
  const CATEGORIES = {
    restaurant: { label: '飲食店', color: '#c2410c', aliases: ['飲食', 'レストラン', '食事処', 'カフェ', 'cafe', '居酒屋', 'izakaya'] },
    hotel: { label: '旅館・ホテル', color: '#1d4ed8', aliases: ['旅館', 'ホテル', '宿', '民宿', 'ryokan'] },
    tofu_maker: { label: '豆腐店・製造元', color: '#b45309', aliases: ['豆腐店', '製造元', '豆腐屋', 'maker', 'tofu'] },
    shop: { label: '物販・土産', color: '#7e22ce', aliases: ['物販', '土産', '売店', '物産館', '道の駅', '通販', 'shop'] },
    onsen: { label: '温泉施設', color: '#0f766e', aliases: ['温泉', '公衆浴場', '日帰り温泉', '足湯', 'spa'] },
    other: { label: 'その他', color: '#4b5563', aliases: ['イベント', 'event', 'その他'] },
  };
  const STATUS = { published: '公開', needs_review: '要確認', hidden: '非公開' };
  const YUDOFU = { confirmed: '確認済み', unverified: '未確認', none: 'なし' };
  const GEO_PRECISION = { exact: '正確', approx: '概略', unknown: '不明' };
  const CONFIDENCE = { high: '高', medium: '中', low: '低' };
  const SERVICES = ['ランチ', 'ディナー', '朝食', '日帰り', 'テイクアウト', '通販', '宿泊者限定', '食べ比べ', '予約制'];

  // ---- 列定義（シートの見出し順） ------------------------------------------
  // type: string | number | enum | list | menu | links | sources
  const COLUMNS = [
    { key: 'id', header: 'id', type: 'string', help: '英数字の識別子（空なら自動生成）。URL共有や豆腐製造元の参照に使う' },
    { key: 'name', header: '名称', type: 'string', required: true },
    { key: 'name_kana', header: 'よみ', type: 'string' },
    { key: 'category', header: '種別', type: 'enum', values: labelMap(CATEGORIES), required: true },
    { key: 'status', header: '公開状態', type: 'enum', values: STATUS, default: 'published' },
    { key: 'yudofu', header: '湯どうふ提供', type: 'enum', values: YUDOFU, default: 'unverified' },
    { key: 'address', header: '住所', type: 'string' },
    { key: 'lat', header: '緯度', type: 'number' },
    { key: 'lng', header: '経度', type: 'number' },
    { key: 'geo_precision', header: '位置精度', type: 'enum', values: GEO_PRECISION, default: 'unknown' },
    { key: 'tel', header: '電話', type: 'string' },
    { key: 'hours', header: '営業時間', type: 'string' },
    { key: 'closed', header: '定休日', type: 'string' },
    { key: 'service', header: '提供形態', type: 'list', help: '改行区切り: ' + SERVICES.join(' / ') },
    { key: 'menu', header: 'メニュー', type: 'menu', help: '1行1品: 品名 | 価格 | 備考 | 出典URL（温泉湯どうふ関連のみ）' },
    { key: 'other_prices', header: 'その他料金', type: 'menu', help: '入浴料・宿泊目安など湯どうふ以外の料金。1行1件: 名称 | 価格 | 備考 | 出典URL' },
    { key: 'tofu_source.name', header: '使用豆腐', type: 'string', help: '自家製 / 製造元名' },
    { key: 'tofu_source.maker_id', header: '使用豆腐ID', type: 'string', help: '製造元の id（このシート内の行）' },
    { key: 'tofu_source.note', header: '使用豆腐メモ', type: 'string' },
    { key: 'tofu_source.source_url', header: '使用豆腐出典URL', type: 'string' },
    { key: 'onsen_source.name', header: '使用温泉', type: 'string' },
    { key: 'onsen_source.note', header: '使用温泉メモ', type: 'string' },
    { key: 'onsen_source.source_url', header: '使用温泉出典URL', type: 'string' },
    { key: 'features', header: '特徴', type: 'list', help: '改行区切り' },
    { key: 'description', header: '説明', type: 'string' },
    { key: 'urls.official', header: '公式URL', type: 'string' },
    { key: 'urls.tabelog', header: '食べログURL', type: 'string' },
    { key: 'urls.retty', header: 'RettyURL', type: 'string' },
    { key: 'urls.google_maps', header: 'GoogleマップURL', type: 'string' },
    { key: 'urls.gurunavi', header: 'ぐるなびURL', type: 'string' },
    { key: 'urls.hotpepper', header: 'ホットペッパーURL', type: 'string' },
    { key: 'urls.jalan', header: 'じゃらんURL', type: 'string' },
    { key: 'urls.rakuten', header: '楽天トラベルURL', type: 'string' },
    { key: 'urls.instagram', header: 'InstagramURL', type: 'string' },
    { key: 'urls.other', header: 'その他URL', type: 'links', help: '1行1件: ラベル | URL' },
    { key: 'ratings.tabelog', header: '食べログ点数', type: 'number' },
    { key: 'ratings.tabelog_reviews', header: '食べログ口コミ数', type: 'number' },
    { key: 'ratings.google', header: 'Google評価', type: 'number' },
    { key: 'ratings.google_reviews', header: 'Google口コミ数', type: 'number' },
    { key: 'sources', header: '出典', type: 'sources', help: '1行1件: タイトル | URL | 確認日 | 備考' },
    { key: 'confidence', header: '確信度', type: 'enum', values: CONFIDENCE, default: 'medium' },
    { key: 'updated_at', header: '最終更新日', type: 'string' },
    { key: 'editor_note', header: '編集メモ', type: 'string' },
  ];
  const HEADERS = COLUMNS.map((c) => c.header);

  const URL_LABELS = {
    official: '公式サイト', tabelog: '食べログ', retty: 'Retty', google_maps: 'Google マップ',
    gurunavi: 'ぐるなび', hotpepper: 'ホットペッパー', jalan: 'じゃらん', rakuten: '楽天トラベル', instagram: 'Instagram',
  };

  function labelMap(obj) {
    const out = {};
    Object.keys(obj).forEach((k) => { out[k] = obj[k].label; });
    return out;
  }

  // ---- 汎用ユーティリティ ---------------------------------------------------
  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const parts = path.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (o[parts[i]] == null || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = value;
  }
  function trim(s) { return s == null ? '' : String(s).replace(/^\s+|\s+$/g, ''); }
  function splitLines(cell) {
    return trim(cell).split(/\r?\n|;|；/).map(trim).filter(Boolean);
  }
  function splitPipe(line) {
    return String(line).split(/\s*[|｜]\s*/).map(trim);
  }
  function toNumber(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v).replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
      .replace(/[,，¥￥円~～\s]/g, '').replace(/円.*$/, '');
    const m = s.match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  function isUrl(s) { return /^https?:\/\/\S+$/i.test(trim(s)); }

  // enum: ラベル・キー・別名から内部キーへ
  function enumFromLabel(colOrValues, text, fallback) {
    const values = colOrValues.values || colOrValues;
    const t = trim(text);
    if (!t) return fallback;
    const lower = t.toLowerCase();
    for (const k of Object.keys(values)) {
      if (k === lower || values[k] === t) return k;
    }
    for (const k of Object.keys(values)) {
      if (t.indexOf(values[k]) >= 0 || values[k].indexOf(t) >= 0) return k;
    }
    if (values === labelMapCache.categories) {
      for (const k of Object.keys(CATEGORIES)) {
        if (CATEGORIES[k].aliases.some((a) => lower.indexOf(a.toLowerCase()) >= 0)) return k;
      }
    }
    return fallback;
  }
  const labelMapCache = { categories: null };
  labelMapCache.categories = COLUMNS.find((c) => c.key === 'category').values;

  // ---- 複合セルのパース / シリアライズ -------------------------------------
  function parseMenu(cell) {
    return splitLines(cell).map((line) => {
      const p = splitPipe(line);
      const price = toNumber(p[1]);
      return {
        name: p[0] || '',
        price: price,
        price_text: price == null && p[1] ? p[1] : undefined,
        price_note: p[2] || '',
        source_url: isUrl(p[3]) ? p[3] : '',
      };
    }).filter((m) => m.name);
  }
  function serializeMenu(items) {
    return (items || []).map((m) => [
      m.name || '', m.price != null ? m.price : (m.price_text || ''), m.price_note || '', m.source_url || '',
    ].join(' | ')).join('\n');
  }
  function parseLinks(cell) {
    return splitLines(cell).map((line) => {
      const p = splitPipe(line);
      if (p.length === 1) return isUrl(p[0]) ? { label: p[0].replace(/^https?:\/\//, '').split('/')[0], url: p[0] } : null;
      return isUrl(p[1]) ? { label: p[0], url: p[1] } : null;
    }).filter(Boolean);
  }
  function serializeLinks(items) {
    return (items || []).map((l) => (l.label || '') + ' | ' + (l.url || '')).join('\n');
  }
  function parseSources(cell) {
    return splitLines(cell).map((line) => {
      const p = splitPipe(line);
      if (p.length === 1) return isUrl(p[0]) ? { title: '', url: p[0], accessed: '', note: '' } : null;
      return { title: p[0] || '', url: isUrl(p[1]) ? p[1] : '', accessed: p[2] || '', note: p[3] || '' };
    }).filter((s) => s && (s.url || s.title));
  }
  function serializeSources(items) {
    return (items || []).map((s) => [s.title || '', s.url || '', s.accessed || '', s.note || ''].join(' | ')).join('\n');
  }

  // ---- 行 ⇄ オブジェクト ------------------------------------------------------
  function rowToPlace(row) {
    const place = {};
    COLUMNS.forEach((col) => {
      const raw = row[col.header];
      let v;
      switch (col.type) {
        case 'number': v = toNumber(raw); break;
        case 'enum': v = enumFromLabel(col, raw, col.default); break;
        case 'list': v = splitLines(raw); break;
        case 'menu': v = parseMenu(raw); break;
        case 'links': v = parseLinks(raw); break;
        case 'sources': v = parseSources(raw); break;
        default: v = trim(raw);
      }
      setPath(place, col.key, v);
    });
    return normalizePlace(place);
  }
  function placeToRow(place) {
    const p = normalizePlace(place);
    const row = {};
    COLUMNS.forEach((col) => {
      const v = getPath(p, col.key);
      let s;
      switch (col.type) {
        case 'number': s = v == null ? '' : String(v); break;
        case 'enum': s = v ? (col.values[v] || v) : ''; break;
        case 'list': s = (v || []).join('\n'); break;
        case 'menu': s = serializeMenu(v); break;
        case 'links': s = serializeLinks(v); break;
        case 'sources': s = serializeSources(v); break;
        default: s = v == null ? '' : String(v);
      }
      row[col.header] = s;
    });
    return row;
  }

  function hashId(name) {
    let h = 5381;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return 'p' + (h >>> 0).toString(36);
  }

  // 欠損の補完・派生値の計算（JSON/シート両方の入口で呼ぶ）
  function normalizePlace(input) {
    const p = JSON.parse(JSON.stringify(input || {}));
    p.name = trim(p.name);
    p.id = trim(p.id) || hashId(p.name);
    p.name_kana = trim(p.name_kana);
    p.category = CATEGORIES[p.category] ? p.category : enumFromLabel(labelMapCache.categories, p.category, 'other');
    p.status = STATUS[p.status] ? p.status : 'published';
    p.yudofu = YUDOFU[p.yudofu] ? p.yudofu : 'unverified';
    p.geo_precision = GEO_PRECISION[p.geo_precision] ? p.geo_precision : (p.lat != null && p.lng != null ? 'approx' : 'unknown');
    p.confidence = CONFIDENCE[p.confidence] ? p.confidence : 'medium';
    p.lat = toNumber(p.lat); p.lng = toNumber(p.lng);
    if (p.lat == null || p.lng == null) { p.lat = null; p.lng = null; p.geo_precision = 'unknown'; }
    ['address', 'tel', 'hours', 'closed', 'description', 'updated_at', 'editor_note'].forEach((k) => { p[k] = trim(p[k]); });
    p.service = Array.isArray(p.service) ? p.service.map(trim).filter(Boolean) : splitLines(p.service);
    p.features = Array.isArray(p.features) ? p.features.map(trim).filter(Boolean) : splitLines(p.features);
    p.menu = Array.isArray(p.menu) ? p.menu.map((m) => ({
      name: trim(m.name), price: toNumber(m.price), price_text: m.price_text || undefined,
      price_note: trim(m.price_note), source_url: isUrl(m.source_url) ? trim(m.source_url) : '',
    })).filter((m) => m.name) : parseMenu(p.menu);
    p.other_prices = Array.isArray(p.other_prices) ? p.other_prices.map((m) => ({
      name: trim(m.name), price: toNumber(m.price), price_text: m.price_text || undefined,
      price_note: trim(m.price_note), source_url: isUrl(m.source_url) ? trim(m.source_url) : '',
    })).filter((m) => m.name) : parseMenu(p.other_prices);
    p.tofu_source = Object.assign({ name: '', maker_id: '', note: '', source_url: '' }, typeof p.tofu_source === 'object' && p.tofu_source ? p.tofu_source : { name: trim(p.tofu_source) });
    p.onsen_source = Object.assign({ name: '', note: '', source_url: '' }, typeof p.onsen_source === 'object' && p.onsen_source ? p.onsen_source : { name: trim(p.onsen_source) });
    const urls = Object.assign({}, p.urls || {});
    Object.keys(URL_LABELS).forEach((k) => { urls[k] = isUrl(urls[k]) ? trim(urls[k]) : ''; });
    urls.other = Array.isArray(urls.other) ? urls.other.filter((l) => l && isUrl(l.url)) : parseLinks(urls.other);
    p.urls = urls;
    const r = Object.assign({}, p.ratings || {});
    ['tabelog', 'tabelog_reviews', 'google', 'google_reviews'].forEach((k) => { r[k] = toNumber(r[k]); });
    p.ratings = r;
    p.sources = Array.isArray(p.sources) ? p.sources.filter((s) => s && (s.url || s.title)).map((s) => ({
      title: trim(s.title), url: isUrl(s.url) ? trim(s.url) : '', accessed: trim(s.accessed), note: trim(s.note),
    })) : parseSources(p.sources);
    // 代表価格: 飲食店・宿などは「料理」の価格から（通販セット・豆腐単品などの物販は除く）。製造元・物販は全品対象
    const PRODUCT_RE = /通販|お取り寄せ|丁入|丁セット|丁\s*セ|持ち帰り|テイクアウト|生ゆば|豆乳|濃い豆腐|ごま豆腐|胡麻豆腐|ぽん酢|ポン酢|調理水|たれ|ごまだれ|返礼|寄付|送料|商品/;
    const LODGING_RE = /宿泊|1泊|一泊|素泊|入浴|泊[0-9０-９]/;
    const YUDOFU_RE = /湯どうふ|湯豆腐|湯とうふ/;
    let items = p.menu.filter((m) => m.price != null && !LODGING_RE.test(m.name));
    if (p.category !== 'tofu_maker' && p.category !== 'shop') {
      const dishes = items.filter((m) => !PRODUCT_RE.test(m.name) && !PRODUCT_RE.test(m.price_note));
      const yudofu = dishes.filter((m) => YUDOFU_RE.test(m.name));
      if (yudofu.length) items = yudofu; else if (dishes.length) items = dishes;
    }
    const prices = items.map((m) => m.price);
    p.price_min = prices.length ? Math.min.apply(null, prices) : null;
    p.price_max = prices.length ? Math.max.apply(null, prices) : null;
    return p;
  }

  // ---- 検証 -------------------------------------------------------------------
  function validatePlace(p, index) {
    const errs = [];
    const where = '[' + (index != null ? index + ': ' : '') + (p.name || p.id || '?') + '] ';
    if (!p.name) errs.push(where + '名称がありません');
    if (!CATEGORIES[p.category]) errs.push(where + '種別が不正です: ' + p.category);
    if (!STATUS[p.status]) errs.push(where + '公開状態が不正です: ' + p.status);
    if (!YUDOFU[p.yudofu]) errs.push(where + '湯どうふ提供が不正です: ' + p.yudofu);
    if ((p.lat == null) !== (p.lng == null)) errs.push(where + '緯度・経度は両方入れてください');
    if (p.lat != null && (p.lat < 32.9 || p.lat > 33.3 || p.lng < 129.8 || p.lng > 130.2)) errs.push(where + '座標が嬉野市周辺ではありません: ' + p.lat + ',' + p.lng);
    p.menu.forEach((m) => {
      if (m.price != null && (m.price < 0 || m.price > 200000)) errs.push(where + 'メニュー価格が不正です: ' + m.name + ' ' + m.price);
      if (m.source_url && !isUrl(m.source_url)) errs.push(where + 'メニュー出典URLが不正です: ' + m.name);
    });
    Object.keys(URL_LABELS).forEach((k) => { if (p.urls[k] && !isUrl(p.urls[k])) errs.push(where + k + ' のURLが不正です'); });
    p.sources.forEach((s, i) => { if (s.url && !isUrl(s.url)) errs.push(where + '出典' + (i + 1) + 'のURLが不正です'); });
    if (p.status === 'published' && p.yudofu === 'confirmed' && p.sources.length === 0 && p.menu.every((m) => !m.source_url)) {
      errs.push(where + '「公開」かつ「確認済み」なのに出典がありません（要確認にするか出典を追加してください）');
    }
    return errs;
  }
  function validateAll(places) {
    const errs = [];
    const ids = {};
    places.forEach((p, i) => {
      errs.push.apply(errs, validatePlace(p, i));
      if (ids[p.id]) errs.push('[' + i + ': ' + p.name + '] id が重複しています: ' + p.id + '（' + ids[p.id] + ' と同じ）');
      ids[p.id] = p.name;
    });
    places.forEach((p, i) => {
      const mid = p.tofu_source && p.tofu_source.maker_id;
      if (mid && !ids[mid]) errs.push('[' + i + ': ' + p.name + '] 使用豆腐ID「' + mid + '」に該当する行がありません');
    });
    return errs;
  }

  // ---- CSV ----------------------------------------------------------------------
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    const s = String(text).replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inQuotes) {
        if (c === '"') {
          if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && s[i + 1] === '\n') i++;
        row.push(field); field = '';
        rows.push(row); row = [];
      } else field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((v) => trim(v) !== ''));
  }
  function csvToObjects(text) {
    const rows = parseCSV(text);
    if (!rows.length) return [];
    const headers = rows[0].map(trim);
    return rows.slice(1).map((r) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = r[i] == null ? '' : r[i]; });
      return o;
    });
  }
  function csvEscape(v) {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function objectsToCSV(objs, headers) {
    const hs = headers || HEADERS;
    const lines = [hs.map(csvEscape).join(',')];
    objs.forEach((o) => { lines.push(hs.map((h) => csvEscape(o[h])).join(',')); });
    return lines.join('\r\n') + '\r\n';
  }

  // Google マップ URL から座標を取り出す（@lat,lng / q=lat,lng / !3dlat!4dlng）
  function coordsFromGoogleMapsUrl(url) {
    const s = String(url || '');
    let m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
  }

  return {
    CATEGORIES, STATUS, YUDOFU, GEO_PRECISION, CONFIDENCE, SERVICES, COLUMNS, HEADERS, URL_LABELS,
    getPath, setPath, trim, splitLines, splitPipe, toNumber, isUrl, enumFromLabel,
    parseMenu, serializeMenu, parseLinks, serializeLinks, parseSources, serializeSources,
    rowToPlace, placeToRow, normalizePlace, validatePlace, validateAll, hashId,
    parseCSV, csvToObjects, objectsToCSV, coordsFromGoogleMapsUrl,
  };
});
