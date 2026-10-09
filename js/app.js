/* 嬉野温泉 湯どうふマップ — アプリ本体（依存: Leaflet, js/schema.js, config.js） */
(function () {
  'use strict';
  const S = window.TofuSchema;
  const I = window.TofuIllust || { HERO: '', icon: () => '', scene: () => '', EMPTY: '' };
  const CFG = Object.assign({
    SHEET_ID: '', SHEET_NAME: 'places', DATA_URL: 'data/places.json', BACKGROUND_URL: 'data/background.json',
    GITHUB_REPO: '', FORM_URL: '', CONTACT_EMAIL: '', MAP_CENTER: [33.098, 129.988], MAP_ZOOM: 15, SITE_TITLE: '', OPERATOR: '',
    SHOW_RATINGS: false, ORIGINS: [], BASEMAP: 'vector', VECTOR_STYLE_URL: 'https://tiles.openfreemap.org/styles/liberty',
    GOOGLE_MAPS_API_KEY: '', GOOGLE_MAPS_MAP_ID: '',
  }, window.TOFU_CONFIG || {});

  const CAT_ORDER = ['restaurant', 'hotel', 'tofu_maker', 'shop', 'onsen', 'other'];
  const CAT_LETTER = { restaurant: '食', hotel: '宿', tofu_maker: '豆', shop: '店', onsen: '湯', other: '他' };
  const PRICE_MAX = 10000;

  const state = {
    all: [], visible: [], byId: {}, meta: {}, source: 'json', loadError: '',
    map: null, engine: '', mapWarning: '', markers: {}, me: null, selectedId: null, pick: null, background: null,
    filters: { q: '', cats: new Set(), svcs: new Set(), tofu: '', price: PRICE_MAX, unverified: true, bounds: false },
    sort: 'category',
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = (n) => '¥' + Number(n).toLocaleString('ja-JP');
  const catLabel = (c) => (S.CATEGORIES[c] || S.CATEGORIES.other).label;
  const catVar = (c) => 'var(--cat-' + (S.CATEGORIES[c] ? c : 'other') + ')';
  const isConfirmed = (p) => p.yudofu === 'confirmed' && p.status !== 'needs_review';
  const hasGeo = (p) => p.lat != null && p.lng != null;

  // ------------------------------------------------------------------ 起動
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (CFG.SITE_TITLE) { $('#site-title').textContent = CFG.SITE_TITLE; document.title = CFG.SITE_TITLE; }
    if (CFG.OPERATOR) $('#operator-line').textContent = ' · 運営: ' + CFG.OPERATOR;
    if (CFG.GITHUB_REPO) $('#repo-link').href = 'https://github.com/' + CFG.GITHUB_REPO;
    $('#hero-art').innerHTML = I.HERO;
    buildStaticControls();
    await createMap();
    bindEvents();
    state.map.onMoveEnd(() => { if (state.filters.bounds) applyFilters({}); });
    state.map.onClick((lat, lng) => { if (state.pick) finishPick({ lat, lng }); });
    if (state.mapWarning) toast(state.mapWarning);
    try {
      await loadLocalData();          // まず同梱データを即表示
    } catch (e) {
      console.error(e);
      state.loadError = String(e && e.message || e);
    }
    buildDynamicControls();
    readHash();
    applyFilters({ fit: true });
    const sel = new URLSearchParams(location.hash.replace(/^#/, '')).get('place');
    if (sel && state.byId[sel]) selectPlace(sel, { pan: true });
    updateDataBadge();
    if (CFG.SHEET_ID) {              // スプレッドシート（正本）は裏で取得して差し替える
      const ok = await loadSheetData();
      if (ok) {
        const f = state.filters;
        buildDynamicControls();
        $('#tofu-select').value = f.tofu;
        const r = $('#price-range'); if (f.price < Number(r.max)) r.value = f.price; updatePriceOutput();
        applyFilters({});
        if (state.selectedId && state.byId[state.selectedId]) renderDetail(state.byId[state.selectedId]);
        else if (state.selectedId) closeDetail();
        updateDataBadge();
      }
    }
    if (new URLSearchParams(location.search).get('check') === '1') renderCheckPanel();
  }

  // ------------------------------------------------------------------ データ読込
  function fetchWithTimeout(url, ms) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ctrl && ctrl.abort(), ms);
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, cache: 'no-store' }).finally(() => clearTimeout(t));
  }

  function setPlaces(places, source, meta) {
    state.allRaw = places;
    state.all = places.filter((p) => p.status !== 'hidden');
    state.byId = {};
    state.all.forEach((p) => { state.byId[p.id] = p; });
    state.source = source;
    state.meta = meta || {};
  }

  async function loadLocalData() {
    const ds = await window.TofuData.loadLocalPlaces();
    setPlaces(ds.raw, ds.source, ds.meta);
  }

  async function loadSheetData() {
    const r = await window.TofuData.loadSheetPlaces();
    if (r.dataset) { setPlaces(r.dataset.raw, 'sheet', r.dataset.meta); return true; }
    if (r.error) state.sheetError = r.error;
    return false;
  }

  // ?check=1 で開くと、編集者向けにデータの入力エラー・不足を一覧表示する（GitHub 不要の自己点検用）
  function renderCheckPanel() {
    const places = state.allRaw || state.all;
    const errs = S.validateAll(places);
    const warns = [];
    places.forEach((p) => {
      if (p.id_generated) warns.push('[' + p.name + '] id が空です（名称から自動生成: ' + p.id + '）。固定したい場合はシートの id 列に書いてください');
      if (!hasGeo(p)) warns.push('[' + p.name + '] 緯度・経度が空です（地図に出ません）');
      if (p.status === 'published' && p.sources.length === 0) warns.push('[' + p.name + '] 出典がありません');
      if (p.status === 'published' && p.yudofu === 'confirmed' && !p.menu.length && p.category !== 'other') warns.push('[' + p.name + '] メニューがありません');
    });
    const el = document.createElement('div');
    el.className = 'check-panel';
    el.innerHTML = '<h3>データ点検（' + (state.source === 'sheet' ? 'スプレッドシート' : '同梱データ') + '・' + places.length + ' 件）' + (state.sheetError ? ' <span class="badge warn">シート取得失敗: ' + esc(state.sheetError) + '</span>' : '') + '</h3>' +
      '<p><b>エラー ' + errs.length + ' 件</b>（該当行は地図に正しく出ません）</p><ul>' + errs.map((e) => '<li>' + esc(e) + '</li>').join('') + '</ul>' +
      '<p><b>注意 ' + warns.length + ' 件</b></p><ul>' + warns.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>' +
      '<button type="button" class="btn btn-small" id="btn-check-close">閉じる</button>';
    document.body.appendChild(el);
    $('#btn-check-close').addEventListener('click', () => el.remove());
  }

  function updateDataBadge() {
    const b = $('#data-badge');
    if (state.loadError) { b.textContent = 'データを読み込めませんでした'; b.title = state.loadError; return; }
    if (state.source === 'sheet') { b.textContent = 'データ: スプレッドシート（最新）'; b.classList.add('live'); }
    else { b.textContent = 'データ: 同梱スナップショット' + (state.meta.updated ? '（' + state.meta.updated + '）' : ''); if (state.sheetError) b.title = 'スプレッドシートの取得に失敗: ' + state.sheetError; }
  }

  // ------------------------------------------------------------------ 地図（エンジン切替: Google マップ / Leaflet）
  // state.map は共通インターフェース:
  //   setView(lat,lng,zoom) panTo(lat,lng) getZoom() contains(lat,lng) fitBounds(points,{padding,maxZoom})
  //   addMarker({lat,lng,html,title,zIndex,onClick}) -> {setHtml, setZIndex, remove}  clearMarkers()
  //   setMeMarker(lat,lng) invalidateSize() setCursor(css) onMoveEnd(fn) onClick(fn)
  async function createMap() {
    const key = (CFG.GOOGLE_MAPS_API_KEY || '').trim();
    if (key) {
      try {
        await loadGoogleMaps(key);
        state.map = createGoogleMap();
        state.engine = 'google';
        return;
      } catch (e) {
        console.warn('Google マップを読み込めなかったため Leaflet に切り替えます:', e && e.message);
        state.mapWarning = 'Google マップを読み込めませんでした（API キーの設定を確認）。代わりの地図を表示しています。';
      }
    }
    state.map = createLeafletMap();
    state.engine = 'leaflet';
  }

  function loadGoogleMaps(key) {
    return new Promise((resolve, reject) => {
      if (window.google && google.maps && google.maps.marker) return resolve();
      const timer = setTimeout(() => reject(new Error('timeout')), 12000);
      window.__tofuGmReady = () => { clearTimeout(timer); resolve(); };
      window.gm_authFailure = () => {   // キー無効・リファラ制限などで Google 側が拒否したとき（地図生成後に呼ばれることもある）
        clearTimeout(timer);
        if (state.engine === 'google') switchToLeaflet('Google マップの認証に失敗しました（API キーの制限・有効化・請求設定を確認）。代わりの地図を表示しています。');
        else reject(new Error('auth'));
      };
      const sc = document.createElement('script');
      sc.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&libraries=marker&loading=async&callback=__tofuGmReady&language=ja&region=JP&v=weekly';
      sc.async = true;
      sc.onerror = () => { clearTimeout(timer); reject(new Error('script')); };
      document.head.appendChild(sc);
    });
  }

  function switchToLeaflet(message) {
    try {
      const el = $('#map'); el.innerHTML = ''; el.className = '';
      state.map = createLeafletMap();
      state.engine = 'leaflet';
      state.markers = {};
      applyFilters({ fit: true });
      if (state.me) state.map.setMeMarker(state.me[0], state.me[1]);
      if (message) toast(message);
    } catch (e) { console.error('地図の切り替えに失敗', e); }
  }

  // ---- Google マップ -------------------------------------------------------
  function createGoogleMap() {
    const el = $('#map');
    const gmap = new google.maps.Map(el, {
      center: { lat: CFG.MAP_CENTER[0], lng: CFG.MAP_CENTER[1] }, zoom: CFG.MAP_ZOOM,
      mapId: CFG.GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
      clickableIcons: false, gestureHandling: 'greedy',
      mapTypeControl: true, mapTypeControlOptions: { position: google.maps.ControlPosition.TOP_LEFT },
      streetViewControl: false, fullscreenControl: false, cameraControl: false,
      zoomControl: true, zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
    });
    const markers = new Set();
    let me = null;
    const AME = google.maps.marker.AdvancedMarkerElement;
    return {
      engine: 'google',
      setView: (lat, lng, zoom) => { gmap.setCenter({ lat, lng }); if (zoom != null) gmap.setZoom(zoom); },
      panTo: (lat, lng) => gmap.panTo({ lat, lng }),
      getZoom: () => gmap.getZoom() || CFG.MAP_ZOOM,
      contains: (lat, lng) => { const b = gmap.getBounds(); return !b || b.contains({ lat, lng }); },
      fitBounds: (points, opts) => {
        const b = new google.maps.LatLngBounds();
        points.forEach((q) => b.extend({ lat: q[0], lng: q[1] }));
        gmap.fitBounds(b, (opts && opts.padding) || 40);
        const maxZoom = (opts && opts.maxZoom) || 16;
        google.maps.event.addListenerOnce(gmap, 'idle', () => { if (gmap.getZoom() > maxZoom) gmap.setZoom(maxZoom); });
      },
      addMarker: (o) => {
        const content = document.createElement('div');
        content.innerHTML = o.html;
        const mk = new AME({ map: gmap, position: { lat: o.lat, lng: o.lng }, content, title: o.title || '', zIndex: o.zIndex || 0, gmpClickable: true });
        // クリックは DOM と Maps API の両方で受け、二重発火は 300ms で抑止
        let last = 0;
        const handler = () => { const now = Date.now(); if (now - last < 300) return; last = now; if (o.onClick) o.onClick(); };
        content.addEventListener('click', handler);
        try { mk.addListener('gmp-click', handler); } catch (e) { /* 古いバージョン */ }
        markers.add(mk);
        return {
          setHtml: (html) => { content.innerHTML = html; },
          setZIndex: (z) => { mk.zIndex = z; },
          remove: () => { mk.map = null; markers.delete(mk); },
        };
      },
      clearMarkers: () => { markers.forEach((mk) => { mk.map = null; }); markers.clear(); },
      setMeMarker: (lat, lng) => {
        if (me) { me.position = { lat, lng }; return; }
        const c = document.createElement('div'); c.innerHTML = '<div class="me-dot"></div>'; c.style.transform = 'translateY(8px)';
        me = new AME({ map: gmap, position: { lat, lng }, content: c, zIndex: 2000 });
      },
      invalidateSize: () => google.maps.event.trigger(gmap, 'resize'),
      setCursor: (css) => gmap.setOptions({ draggableCursor: css || null }),
      onMoveEnd: (fn) => gmap.addListener('idle', fn),
      onClick: (fn) => gmap.addListener('click', (e) => { if (e.latLng) fn(e.latLng.lat(), e.latLng.lng()); }),
    };
  }

  // ---- Leaflet（OpenFreeMap / 地理院タイル。Google マップ未設定時や読み込み失敗時） ----------
  function createLeafletMap() {
    const map = L.map('map', { zoomControl: false, center: CFG.MAP_CENTER, zoom: CFG.MAP_ZOOM, preferCanvas: false });
    const gsi = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>',
    });
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    });
    const photo = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', {
      maxZoom: 18, attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル（写真）</a>',
    });
    // ベクター地図（OpenFreeMap: 鍵・費用不要）。WebGL が使えない端末や取得失敗時は地理院タイルに切り替える
    const bases = {};
    let vector = null;
    if (CFG.BASEMAP === 'vector' && typeof L.maplibreGL === 'function' && typeof maplibregl !== 'undefined') {
      try {
        vector = L.maplibreGL({
          style: CFG.VECTOR_STYLE_URL,
          attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>',
        });
        let vectorReady = false;
        vector.on('add', () => {
          const gl = vector.getMaplibreMap();
          if (!gl) return;
          gl.once('load', () => { vectorReady = true; });
          gl.on('style.load', () => localizeLabels(gl));
          gl.on('error', (e) => {
            if (vectorReady) return;
            console.warn('ベクター地図の読み込みに失敗。地理院タイルに切り替えます', e && e.error);
            vectorReady = true;
            try { map.removeLayer(vector); } catch (err) { /* noop */ }
            if (!map.hasLayer(gsi)) gsi.addTo(map);
          });
        });
      } catch (e) { console.warn('ベクター地図を初期化できません', e); vector = null; }
    }
    if (vector) bases['標準地図（OpenFreeMap）'] = vector;
    bases['淡色地図（地理院）'] = gsi; bases['OpenStreetMap'] = osm; bases['空中写真（地理院）'] = photo;
    const first = CFG.BASEMAP === 'osm' ? osm : CFG.BASEMAP === 'gsi' ? gsi : (vector || gsi);
    try { first.addTo(map); } catch (e) { console.warn('ベースマップの追加に失敗。地理院タイルを使います', e); gsi.addTo(map); }
    L.control.layers(bases, null, { position: 'topleft' }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    let me = null;
    const divIcon = (html) => L.divIcon({ className: 'pin-icon', iconSize: [30, 30], iconAnchor: [15, 28], tooltipAnchor: [10, -14], html });
    return {
      engine: 'leaflet',
      setView: (lat, lng, zoom) => map.setView([lat, lng], zoom == null ? map.getZoom() : zoom),
      panTo: (lat, lng) => map.panTo([lat, lng]),
      getZoom: () => map.getZoom(),
      contains: (lat, lng) => map.getBounds().contains([lat, lng]),
      fitBounds: (points, opts) => map.fitBounds(points, { padding: [(opts && opts.padding) || 40, (opts && opts.padding) || 40], maxZoom: (opts && opts.maxZoom) || 16 }),
      addMarker: (o) => {
        const m = L.marker([o.lat, o.lng], { icon: divIcon(o.html), keyboard: true, title: o.title || '', zIndexOffset: o.zIndex || 0 });
        if (o.title) m.bindTooltip(o.title, { direction: 'top', opacity: .95 });
        if (o.onClick) m.on('click', o.onClick);
        m.addTo(layer);
        return { setHtml: (html) => m.setIcon(divIcon(html)), setZIndex: (z) => m.setZIndexOffset(z), remove: () => layer.removeLayer(m) };
      },
      clearMarkers: () => layer.clearLayers(),
      setMeMarker: (lat, lng) => {
        if (me) { me.setLatLng([lat, lng]); return; }
        me = L.marker([lat, lng], { icon: L.divIcon({ className: 'pin-icon', html: '<div class="me-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }).addTo(map);
      },
      invalidateSize: () => map.invalidateSize(),
      setCursor: (css) => { $('#map').style.cursor = css || ''; },
      onMoveEnd: (fn) => map.on('moveend', fn),
      onClick: (fn) => map.on('click', (e) => fn(e.latlng.lat, e.latlng.lng)),
    };
  }

  // ベクター地図のラベルを日本語優先にする（name:ja → name）
  function localizeLabels(gl) {
    try {
      const style = gl.getStyle();
      (style.layers || []).forEach((layer) => {
        if (layer.type !== 'symbol' || !layer.layout || !layer.layout['text-field']) return;
        const tf = JSON.stringify(layer.layout['text-field']);
        if (!/name/.test(tf)) return;
        gl.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:ja'], ['get', 'name']]);
      });
    } catch (e) { console.warn('ラベルの日本語化に失敗', e); }
  }

  // ---- マーカー（エンジン共通） ------------------------------------------------
  function pinHtml(p, selected) {
    const cls = ['pin'];
    if (p.geo_precision !== 'exact') cls.push('approx');
    if (!isConfirmed(p)) cls.push('unverified');
    if (selected) cls.push('selected');
    return '<div class="' + cls.join(' ') + '" style="--c:' + catVar(p.category) + '"><div class="pin-body"></div><div class="pin-label">' + CAT_LETTER[p.category] + '</div></div>';
  }
  function setMarkerSelected(id, selected) {
    const h = state.markers[id]; const p = state.byId[id];
    if (!h || !p) return;
    h.setHtml(pinHtml(p, selected));
    h.setZIndex(selected ? 1000 : 0);
  }

  // 同じ座標（町丁目の代表点など）に重なる地点は、見やすさのため小さく散らして表示する（データ自体は変更しない）
  function displayLatLng(p, group) {
    if (!group || group.n <= 1) return [p.lat, p.lng];
    const i = group.i;
    const r = 0.00038 * Math.sqrt(i + 1);           // 約40m × √n
    const t = i * 2.39996;                            // 黄金角で螺旋状に配置
    return [p.lat + r * Math.sin(t), p.lng + (r * Math.cos(t)) / Math.cos((p.lat * Math.PI) / 180)];
  }

  function renderMarkers() {
    if (!state.map) return;
    state.map.clearMarkers();
    state.markers = {};
    const groups = {};
    state.visible.forEach((p) => {
      if (!hasGeo(p)) return;
      const k = p.lat.toFixed(5) + ',' + p.lng.toFixed(5);
      groups[k] = groups[k] || [];
      groups[k].push(p.id);
    });
    state.visible.forEach((p) => {
      if (!hasGeo(p)) return;
      const k = p.lat.toFixed(5) + ',' + p.lng.toFixed(5);
      const g = { n: groups[k].length, i: groups[k].indexOf(p.id) };
      const ll = displayLatLng(p, g);
      const selected = p.id === state.selectedId;
      state.markers[p.id] = state.map.addMarker({
        lat: ll[0], lng: ll[1], html: pinHtml(p, selected), zIndex: selected ? 1000 : 0,
        title: p.name + (p.price_min != null ? '　' + yen(p.price_min) + '〜' : '') + (p.geo_precision !== 'exact' ? '（位置は概略）' : ''),
        onClick: () => selectPlace(p.id, { pan: false }),
      });
    });
  }

  function fitAll(opts) {
    if (!state.map) return;
    let pts = state.visible.filter(hasGeo).map((p) => [p.lat, p.lng]);
    if (opts && opts.core && pts.length > 3) {
      // 市外・遠方の数点で全体が引きで表示されないよう、中央値から 3.5km 以内の地点にフィットする
      const med = (arr) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
      const cLat = med(pts.map((q) => q[0])), cLng = med(pts.map((q) => q[1]));
      const near = pts.filter((q) => Math.hypot((q[0] - cLat) * 111, (q[1] - cLng) * 111 * Math.cos((cLat * Math.PI) / 180)) <= 3.5);
      if (near.length >= 2) pts = near;
    }
    if (pts.length >= 2) state.map.fitBounds(pts, { padding: 40, maxZoom: 16 });
    else if (pts.length === 1) state.map.setView(pts[0][0], pts[0][1], 16);
    else state.map.setView(CFG.MAP_CENTER[0], CFG.MAP_CENTER[1], CFG.MAP_ZOOM);
  }

  function locateMe() {
    if (!navigator.geolocation) return toast('この端末では現在地を取得できません');
    toast('現在地を取得中…');
    navigator.geolocation.getCurrentPosition((pos) => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      state.me = ll;
      state.map.setMeMarker(ll[0], ll[1]);
      state.map.setView(ll[0], ll[1], Math.max(state.map.getZoom(), 15));
      if (state.sort !== 'distance') { state.sort = 'distance'; $('#sort-select').value = 'distance'; }
      applyFilters({});
      toast('現在地を表示しました（近い順に並べ替え）');
    }, () => { toast('現在地を取得できませんでした（位置情報の許可を確認してください）'); if (state.sort === 'distance') { state.sort = 'category'; $('#sort-select').value = 'category'; applyFilters({}); } }, { enableHighAccuracy: true, timeout: 10000 });
  }

  function distanceM(p) {
    const o = state.me;
    if (!o || !hasGeo(p)) return null;
    const R = 6371000, toR = (d) => (d * Math.PI) / 180;
    const dLat = toR(p.lat - o[0]), dLng = toR(p.lng - o[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(o[0])) * Math.cos(toR(p.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmtDistance(m) {
    if (m == null) return '';
    if (m < 2000) return '徒歩約' + Math.max(1, Math.round(m / 80)) + '分・' + Math.round(m / 10) * 10 + 'm';
    return '約' + (m / 1000).toFixed(1) + 'km';
  }

  // ------------------------------------------------------------------ 絞り込み
  function buildStaticControls() {
    const catWrap = $('#cat-chips');
    catWrap.innerHTML = CAT_ORDER.map((c) =>
      '<button type="button" class="chip" data-cat="' + c + '" style="--c:' + catVar(c) + '" aria-pressed="false">' + I.icon(c, 'chip-icon') + esc(catLabel(c)) + ' <span class="n"></span></button>').join('');
    const svcWrap = $('#svc-chips');
    svcWrap.innerHTML = S.SERVICES.map((s) => '<button type="button" class="chip" data-svc="' + esc(s) + '" aria-pressed="false">' + esc(s) + '</button>').join('');
    const fc = $('#f-category');
    fc.innerHTML = CAT_ORDER.map((c) => '<option value="' + c + '">' + esc(catLabel(c)) + '</option>').join('');
    if (!CFG.GITHUB_REPO) $('#btn-send-github').hidden = true;
    if (CFG.FORM_URL) {   // Google フォームがあれば主導線にする（アカウント不要）
      const bf = $('#btn-send-form'); bf.hidden = false; bf.classList.add('btn-primary'); bf.textContent = 'Google フォームで送信（アカウント不要）';
      const bg = $('#btn-send-github'); bg.classList.remove('btn-primary'); bg.textContent = 'GitHub で送信';
      $('#send-help').textContent = '「Google フォームで送信」は内容をコピーしてフォームを開きます。貼り付けて送信してください。送られた情報は編集者が確認してから地図に反映します。';
    }
    if (CFG.CONTACT_EMAIL) $('#btn-send-mail').hidden = false;
  }

  function tofuKey(p) {
    const t = p.tofu_source || {};
    if (t.maker_id && state.byId[t.maker_id]) return 'id:' + t.maker_id;
    const n = (t.name || '').trim();
    return n ? 'n:' + n : '';
  }
  function tofuLabel(key) {
    if (key.startsWith('id:')) { const p = state.byId[key.slice(3)]; return p ? p.name : key.slice(3); }
    return key.slice(2);
  }

  function buildDynamicControls() {
    const counts = {};
    state.all.forEach((p) => { const k = tofuKey(p); if (k) counts[k] = (counts[k] || 0) + 1; });
    const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || tofuLabel(a).localeCompare(tofuLabel(b), 'ja'));
    const sel = $('#tofu-select');
    sel.innerHTML = '<option value="">すべて</option>' + keys.map((k) => '<option value="' + esc(k) + '">' + esc(tofuLabel(k)) + '（' + counts[k] + '）</option>').join('');
    const prices = state.all.map((p) => p.price_min).filter((x) => x != null);
    const maxP = prices.length ? Math.min(PRICE_MAX, Math.ceil(Math.max.apply(null, prices) / 500) * 500) : PRICE_MAX;
    const r = $('#price-range');
    r.max = String(Math.max(1000, maxP)); r.value = r.max;
  }

  function matches(p) {
    const f = state.filters;
    if (!f.unverified && !isConfirmed(p)) return false;
    if (f.cats.size && !f.cats.has(p.category)) return false;
    if (f.svcs.size) { for (const s of f.svcs) if (!p.service.includes(s)) return false; }
    if (f.tofu && tofuKey(p) !== f.tofu) return false;
    const r = $('#price-range');
    if (f.price < Number(r.max) && !(p.price_min != null && p.price_min <= f.price)) return false;
    if (f.q) {
      const hay = [p.name, p.name_kana, p.address, p.description, p.tofu_source.name, p.onsen_source.name, catLabel(p.category)]
        .concat(p.features, p.service, p.menu.map((m) => m.name + ' ' + m.price_note)).join(' ').toLowerCase();
      const terms = f.q.toLowerCase().split(/[\s　]+/).filter(Boolean);
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    if (f.bounds && state.map) { if (!hasGeo(p) || !state.map.contains(p.lat, p.lng)) return false; }
    return true;
  }

  function sortPlaces(list) {
    const s = state.sort;
    const byName = (a, b) => (a.name_kana || a.name).localeCompare(b.name_kana || b.name, 'ja');
    return list.slice().sort((a, b) => {
      if (s === 'name') return byName(a, b);
      if (s === 'price') { const pa = a.price_min == null ? 1e12 : a.price_min, pb = b.price_min == null ? 1e12 : b.price_min; return pa - pb || byName(a, b); }
      if (s === 'updated') return (b.updated_at || '').localeCompare(a.updated_at || '') || byName(a, b);
      if (s === 'distance') { const da = distanceM(a), db = distanceM(b); return (da == null ? 1e12 : da) - (db == null ? 1e12 : db) || byName(a, b); }
      return CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category) || byName(a, b);
    });
  }

  function applyFilters(opts) {
    state.visible = sortPlaces(state.all.filter(matches));
    renderList();
    renderMarkers();
    renderLegend();
    updateCounts();
    writeHash();
    if (opts && opts.fit) fitAll({ core: true });
  }

  function updateCounts() {
    const noGeo = state.visible.filter((p) => !hasGeo(p)).length;
    $('#count-line').textContent = '表示 ' + state.visible.length + ' / 全 ' + state.all.length + ' 件' + (noGeo ? '（うち位置未確定 ' + noGeo + ' 件は一覧のみ）' : '');
    $('#tab-count').textContent = state.visible.length ? '(' + state.visible.length + ')' : '';
    CAT_ORDER.forEach((c) => {
      const n = state.all.filter((p) => p.category === c && matches(Object.assign({}, p, { category: c }))).length;
      const chip = $('[data-cat="' + c + '"]'); if (chip) chip.querySelector('.n').textContent = n ? n : '';
    });
    const f = state.filters;
    const active = [f.svcs.size ? '提供形態' : '', f.tofu ? '豆腐' : '', f.price < Number($('#price-range').max) ? '予算' : '', !f.unverified ? '確認済みのみ' : '', f.bounds ? '範囲' : ''].filter(Boolean);
    $('#active-filters').textContent = active.length ? '（' + active.join('・') + '）' : '';
  }

  function renderLegend() {
    const el = $('#legend');
    const counts = {};
    state.visible.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
    el.innerHTML = CAT_ORDER.filter((c) => state.all.some((p) => p.category === c)).map((c) => {
      const off = state.filters.cats.size && !state.filters.cats.has(c);
      return '<div class="legend-item' + (off ? ' off' : '') + '" data-cat="' + c + '" style="--c:' + catVar(c) + '" role="button" tabindex="0"><span class="dot"></span>' + esc(catLabel(c)) + ' <span class="muted">' + (counts[c] || 0) + '</span></div>';
    }).join('') + '<div class="legend-note">白抜き＝提供未確認／点線＝位置は概略</div>';
  }

  // ------------------------------------------------------------------ 一覧
  function priceLine(p) {
    if (p.price_min != null) return '<span class="card-price">' + yen(p.price_min) + (p.price_max !== p.price_min ? '<small>〜</small>' : '') + (p.price_item ? '<small class="price-item">' + esc(p.price_item.length > 18 ? p.price_item.slice(0, 18) + '…' : p.price_item) + '</small>' : '') + '</span>';
    const t = p.menu.find((m) => m.price_text);
    return '<span class="card-price muted small">' + (t ? esc(t.price_text) : '価格情報なし') + '</span>';
  }

  function renderList() {
    const ol = $('#list');
    if (!state.all.length) {
      ol.innerHTML = '<li class="empty">' + (state.loadError ? 'データを読み込めませんでした。<br><small>' + esc(state.loadError) + '</small>' : 'まだデータがありません。') + '</li>';
      return;
    }
    if (!state.visible.length) {
      ol.innerHTML = '<li class="empty">' + I.EMPTY + '<br>条件に合う場所がありません。<br><button type="button" class="btn btn-small" id="btn-reset-inline">絞り込みを解除</button></li>';
      $('#btn-reset-inline').addEventListener('click', resetFilters);
      return;
    }
    ol.innerHTML = state.visible.map((p) => {
      const menuNames = p.menu.slice(0, 2).map((m) => esc(m.name) + (m.price != null ? ' ' + yen(m.price) : '')).join(' / ');
      const badges = [];
      if (!isConfirmed(p)) badges.push('<span class="badge warn">' + (p.yudofu === 'none' ? '提供なし' : '要確認') + '</span>');
      if (hasGeo(p) && p.geo_precision !== 'exact') badges.push('<span class="badge" title="住所から推定した概略位置です">位置は概略</span>');
      if (!hasGeo(p)) badges.push('<span class="badge" title="座標が未登録のため地図に表示されません">位置未確定</span>');
      const dist = distanceM(p); if (dist != null) badges.push('<span class="badge ok">' + fmtDistance(dist) + '</span>');
      if (p.tofu_source.name) badges.push('<span class="badge tofu">豆腐: ' + esc(p.tofu_source.name) + '</span>');
      p.service.slice(0, 3).forEach((s) => badges.push('<span class="badge">' + esc(s) + '</span>'));
      return '<li class="card' + (p.id === state.selectedId ? ' selected' : '') + '" data-id="' + esc(p.id) + '" style="--c:' + catVar(p.category) + '" tabindex="0" role="button">' +
        '<div class="card-head"><span class="card-icon" style="--c:' + catVar(p.category) + '">' + I.icon(p.category) + '</span><p class="card-name">' + esc(p.name) + (p.name_kana ? '<span class="card-kana">' + esc(p.name_kana) + '</span>' : '') + '</p>' + priceLine(p) + '</div>' +
        '<div class="card-meta"><span class="badge cat" style="--c:' + catVar(p.category) + '">' + esc(catLabel(p.category)) + '</span>' + badges.join('') + '</div>' +
        (menuNames ? '<div class="card-menu">' + menuNames + (p.menu.length > 2 ? ' ほか' + (p.menu.length - 2) + '品' : '') + '</div>' : '') +
        '</li>';
    }).join('');
  }

  // ------------------------------------------------------------------ 詳細
  function selectPlace(id, opts) {
    const p = state.byId[id];
    if (!p) return;
    const prev = state.selectedId;
    state.selectedId = id;
    if (prev && prev !== id) setMarkerSelected(prev, false);
    setMarkerSelected(id, true);
    $$('.card').forEach((c) => c.classList.toggle('selected', c.dataset.id === id));
    renderDetail(p);
    $('#detail').hidden = false;
    $('.layout').classList.add('has-detail');
    if (hasGeo(p) && opts && opts.pan) state.map.setView(p.lat, p.lng, Math.max(state.map.getZoom(), 16));
    else if (hasGeo(p) && !state.map.contains(p.lat, p.lng)) state.map.panTo(p.lat, p.lng);
    setTimeout(() => state.map.invalidateSize(), 50);
    writeHash();
    const card = $('.card[data-id="' + id + '"]');
    if (card && opts && opts.scroll !== false) card.scrollIntoView({ block: 'nearest' });
  }

  function closeDetail() {
    const prev = state.selectedId;
    state.selectedId = null;
    if (prev) setMarkerSelected(prev, false);
    $$('.card.selected').forEach((c) => c.classList.remove('selected'));
    $('#detail').hidden = true;
    $('.layout').classList.remove('has-detail');
    setTimeout(() => state.map.invalidateSize(), 50);
    writeHash();
  }

  function linkOut(url, label) {
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
  }
  function srcLink(url) {
    return url ? ' <a class="src-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" title="出典を開く">出典</a>' : '';
  }
  function gmapsUrl(p) {
    if (p.urls.google_maps) return p.urls.google_maps;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.name + ' ' + (p.address || '嬉野市'));
  }

  function renderDetail(p) {
    const maker = p.tofu_source.maker_id ? state.byId[p.tofu_source.maker_id] : null;
    const users = p.category === 'tofu_maker' ? state.all.filter((q) => q.id !== p.id && (q.tofu_source.maker_id === p.id || (q.tofu_source.name && q.tofu_source.name.indexOf(p.name) >= 0))) : [];
    const badges = ['<span class="badge cat" style="--c:' + catVar(p.category) + '">' + esc(catLabel(p.category)) + '</span>'];
    badges.push(isConfirmed(p) ? '<span class="badge ok">温泉湯どうふ 提供確認済み</span>' : '<span class="badge warn">' + (p.yudofu === 'none' ? '温泉湯どうふの提供なし' : '提供・内容は要確認（情報募集中）') + '</span>');
    if (p.geo_precision !== 'exact') badges.push('<span class="badge">' + (hasGeo(p) ? '位置は概略（住所から推定）' : '位置未確定') + '</span>');
    badges.push('<span class="badge" title="情報の確からしさ">確信度: ' + esc(S.CONFIDENCE[p.confidence] || '中') + '</span>');

    const kv = [];
    if (p.address) kv.push(['住所', esc(p.address) + ' ' + linkOut(gmapsUrl(p), '地図アプリで開く')]);
    if (p.tel) kv.push(['電話', '<a href="tel:' + esc(p.tel.replace(/[^\d+]/g, '')) + '">' + esc(p.tel) + '</a>']);
    if (p.hours) kv.push(['営業時間', esc(p.hours)]);
    if (p.closed) kv.push(['定休日', esc(p.closed)]);
    if (p.service.length) kv.push(['提供形態', p.service.map((s) => '<span class="tag">' + esc(s) + '</span>').join(' ')]);

    const menuRows = p.menu.map((m) =>
      '<tr><td>' + esc(m.name) + '</td><td class="price">' + (m.price != null ? yen(m.price) : esc(m.price_text || '—')) + '</td><td class="note">' + esc(m.price_note) + srcLink(m.source_url) + '</td></tr>').join('');

    const links = Object.keys(S.URL_LABELS).filter((k) => p.urls[k]).map((k) => '<li>' + linkOut(p.urls[k], S.URL_LABELS[k]) + '</li>')
      .concat((p.urls.other || []).map((l) => '<li>' + linkOut(l.url, l.label || l.url) + '</li>'));
    if (!p.urls.google_maps) links.push('<li>' + linkOut(gmapsUrl(p), 'Google マップで検索') + '</li>');

    const ratings = [];
    if (p.ratings.tabelog != null) ratings.push((p.urls.tabelog ? '<a href="' + esc(p.urls.tabelog) + '" target="_blank" rel="noopener noreferrer">' : '<span>') + '食べログ ' + p.ratings.tabelog.toFixed(2) + (p.ratings.tabelog_reviews != null ? '（' + p.ratings.tabelog_reviews + '件）' : '') + (p.urls.tabelog ? '</a>' : '</span>'));
    if (p.ratings.google != null) ratings.push((p.urls.google_maps ? '<a href="' + esc(p.urls.google_maps) + '" target="_blank" rel="noopener noreferrer">' : '<span>') + 'Google ' + p.ratings.google.toFixed(1) + (p.ratings.google_reviews != null ? '（' + p.ratings.google_reviews + '件）' : '') + (p.urls.google_maps ? '</a>' : '</span>'));

    const sources = p.sources.map((s) => '<li>' + (s.url ? linkOut(s.url, s.title || s.url.replace(/^https?:\/\//, '').slice(0, 60)) : esc(s.title)) + (s.accessed ? '<span class="acc">確認日 ' + esc(s.accessed) + '</span>' : '') + (s.note ? '<span class="acc">' + esc(s.note) + '</span>' : '') + '</li>').join('');

    const html = [
      '<button type="button" class="detail-close" id="btn-detail-close" aria-label="閉じる">×</button>',
      '<div class="detail-scene-wrap">' + I.scene(p.category) + '</div>',
      '<div class="detail-top"><div><h2>' + esc(p.name) + '</h2>' + (p.name_kana ? '<div class="kana">' + esc(p.name_kana) + '</div>' : '') + '</div></div>',
      '<div class="detail-badges">' + badges.join('') + '</div>',
      '<div class="detail-actions">',
      '<a class="btn btn-primary" href="' + esc(gmapsUrl(p)) + '" target="_blank" rel="noopener noreferrer">地図アプリで開く</a>',
      hasGeo(p) ? '<a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lng + '" target="_blank" rel="noopener noreferrer">経路</a>' : '',
      p.urls.official ? '<a class="btn" href="' + esc(p.urls.official) + '" target="_blank" rel="noopener noreferrer">公式サイト</a>' : '',
      '<button type="button" class="btn" id="btn-share">共有</button>',
      '</div>',
      !isConfirmed(p) ? '<p class="callout">この場所の温泉湯どうふ情報はまだ確認できていません。メニュー・価格・使っている豆腐をご存じの方は「情報を修正する」から教えてください。</p>' : '',
      kv.length ? '<section><h3>基本情報</h3><dl class="kv">' + kv.map((r) => '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join('') + '</dl></section>' : '',
      '<section><h3>温泉湯どうふのメニュー・価格</h3>' + (menuRows ? '<table class="menu-table"><thead><tr><th>品名</th><th>価格</th><th>備考・出典</th></tr></thead><tbody>' + menuRows + '</tbody></table><p class="muted small">価格は出典の掲載時点のものです。税込/税抜は備考を参照。変更されている場合があります。</p>' : '<p class="muted">メニュー情報はまだありません。</p>') + '</section>',
      p.other_prices.length ? '<section><h3>その他の料金（入浴・宿泊・湯どうふ以外の商品など）</h3><table class="menu-table"><tbody>' + p.other_prices.map((m) => '<tr><td>' + esc(m.name) + '</td><td class="price">' + (m.price != null ? yen(m.price) : esc(m.price_text || '—')) + '</td><td class="note">' + esc(m.price_note) + srcLink(m.source_url) + '</td></tr>').join('') + '</tbody></table></section>' : '',
      '<section><h3>使っている豆腐</h3>' + (p.tofu_source.name ? '<p>' + esc(p.tofu_source.name) + (maker ? ' — <a href="#place=' + esc(maker.id) + '" data-goto="' + esc(maker.id) + '">' + esc(maker.name) + ' の情報を見る</a>' : '') + (p.tofu_source.note ? '<br><span class="muted small">' + esc(p.tofu_source.note) + '</span>' : '') + srcLink(p.tofu_source.source_url) + '</p>' : '<p class="muted">不明（情報募集中）</p>') + '</section>',
      '<section><h3>使っている温泉</h3>' + (p.onsen_source.name ? '<p>' + esc(p.onsen_source.name) + (p.onsen_source.note ? '<br><span class="muted small">' + esc(p.onsen_source.note) + '</span>' : '') + srcLink(p.onsen_source.source_url) + '</p>' : '<p class="muted">不明（情報募集中）</p>') + '</section>',
      p.features.length ? '<section><h3>特徴</h3><div class="tag-list">' + p.features.map((f) => '<span class="tag">' + esc(f) + '</span>').join('') + '</div></section>' : '',
      p.description ? '<section><h3>紹介</h3><p>' + esc(p.description) + '</p></section>' : '',
      users.length ? '<section><h3>この豆腐を使っている場所</h3><ul class="related-list">' + users.map((u) => '<li data-goto="' + esc(u.id) + '">' + esc(u.name) + ' <span class="muted small">' + esc(catLabel(u.category)) + '</span></li>').join('') + '</ul></section>' : '',
      CFG.SHOW_RATINGS && ratings.length ? '<section><h3>各サイトの評価</h3><div class="rating-row">' + ratings.join('') + '</div><p class="muted small">数値は各サイト掲載時点のもの。詳細は各サイトでご確認ください。</p></section>' : '',
      links.length ? '<section><h3>リンク</h3><ul class="link-list">' + links.join('') + '</ul></section>' : '',
      '<section><h3>出典</h3>' + (sources ? '<ul class="source-list">' + sources + '</ul>' : '<p class="muted">出典が登録されていません（要確認）。</p>') + '</section>',
      '<div class="detail-foot"><span>' + (p.updated_at ? '最終更新 ' + esc(p.updated_at) : '') + '</span><span><button type="button" class="btn btn-small" id="btn-fix">情報を修正する</button> <button type="button" class="btn btn-small btn-ghost" id="btn-fix-pos">位置を修正する</button></span></div>',
    ].join('');
    const inner = $('#detail-inner');
    inner.innerHTML = html;
    inner.scrollTop = 0; $('#detail').scrollTop = 0;
    $('#btn-detail-close').addEventListener('click', closeDetail);
    $('#btn-share').addEventListener('click', () => sharePlace(p));
    $('#btn-fix').addEventListener('click', () => openContribute('fix', p));
    $('#btn-fix-pos').addEventListener('click', () => { openContribute('fix', p); startPick(); });
    $$('[data-goto]', inner).forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); selectPlace(el.dataset.goto, { pan: true }); }));
  }

  function sharePlace(p) {
    const url = location.origin + location.pathname + location.search + '#place=' + encodeURIComponent(p.id);
    const text = p.name + ' — ' + (CFG.SITE_TITLE || '嬉野温泉 湯どうふマップ');
    if (navigator.share) navigator.share({ title: text, url: url }).catch(() => {});
    else copyText(url, 'この場所のURLをコピーしました');
  }

  function copyText(text, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(msg || 'コピーしました'), () => fallbackCopy(text, msg));
    else fallbackCopy(text, msg);
  }
  function fallbackCopy(text, msg) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast(msg || 'コピーしました'); } catch (e) { toast('コピーできませんでした'); }
    document.body.removeChild(ta);
  }

  // ------------------------------------------------------------------ URL ハッシュ
  function readHash() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    const f = state.filters;
    f.q = h.get('q') || '';
    f.cats = new Set((h.get('cat') || '').split(',').filter((c) => S.CATEGORIES[c]));
    f.svcs = new Set((h.get('svc') || '').split(',').filter((s) => S.SERVICES.includes(s)));
    f.tofu = h.get('tofu') || '';
    if (h.get('price')) f.price = Number(h.get('price')) || PRICE_MAX;
    if (h.get('unv') === '0') f.unverified = false;
    if (h.get('sort')) state.sort = h.get('sort');
    $('#q').value = f.q;
    $$('[data-cat]', $('#cat-chips')).forEach((c) => { const on = f.cats.has(c.dataset.cat); c.classList.toggle('active', on); c.setAttribute('aria-pressed', on); });
    $$('[data-svc]').forEach((c) => { const on = f.svcs.has(c.dataset.svc); c.classList.toggle('active', on); c.setAttribute('aria-pressed', on); });
    $('#tofu-select').value = f.tofu;
    const r = $('#price-range'); if (f.price < Number(r.max)) r.value = f.price; updatePriceOutput();
    $('#chk-unverified').checked = f.unverified;
    $('#sort-select').value = state.sort;
  }
  function writeHash() {
    const f = state.filters, h = new URLSearchParams();
    if (f.q) h.set('q', f.q);
    if (f.cats.size) h.set('cat', Array.from(f.cats).join(','));
    if (f.svcs.size) h.set('svc', Array.from(f.svcs).join(','));
    if (f.tofu) h.set('tofu', f.tofu);
    if (f.price < Number($('#price-range').max)) h.set('price', String(f.price));
    if (!f.unverified) h.set('unv', '0');
    if (state.sort !== 'category') h.set('sort', state.sort);
    if (state.selectedId) h.set('place', state.selectedId);
    const s = h.toString().replace(/%2C/g, ',');
    history.replaceState(null, '', s ? '#' + s : location.pathname + location.search);
  }
  function updatePriceOutput() {
    const r = $('#price-range');
    $('#price-output').textContent = Number(r.value) >= Number(r.max) ? '上限なし' : '〜' + yen(r.value);
  }
  function resetFilters() {
    const f = state.filters;
    f.q = ''; f.cats.clear(); f.svcs.clear(); f.tofu = ''; f.price = PRICE_MAX; f.unverified = true; f.bounds = false;
    $('#q').value = ''; $('#tofu-select').value = ''; $('#chk-unverified').checked = true; $('#chk-bounds').checked = false;
    const r = $('#price-range'); r.value = r.max; updatePriceOutput();
    $$('.chip.active').forEach((c) => { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
    applyFilters({ fit: true });
  }

  // ------------------------------------------------------------------ 投稿
  function openContribute(mode, p) {
    $('#f-mode').value = mode;
    $('#f-place-id').value = p ? p.id : '';
    $('#contribute-title').textContent = mode === 'fix' && p ? '「' + p.name + '」の情報を修正・追加する' : '新しい場所・情報を追加する';
    $('#f-name').value = p ? p.name : '';
    $('#f-category').value = p ? p.category : 'restaurant';
    $('#f-address').value = p ? p.address : '';
    $('#f-menu').value = p ? S.serializeMenu(p.menu).split('\n').map((l) => l.split(' | ').slice(0, 3).join(' | ')).join('\n') : '';
    $('#f-tofu').value = p ? p.tofu_source.name : '';
    $('#f-onsen').value = p ? p.onsen_source.name : '';
    $('#f-notes').value = '';
    $('#f-sources').value = '';
    $('#f-lat').value = p && hasGeo(p) ? p.lat : '';
    $('#f-lng').value = p && hasGeo(p) ? p.lng : '';
    $('#modal-contribute').hidden = false;
    setTimeout(() => $(mode === 'fix' ? '#f-notes' : '#f-name').focus(), 50);
  }

  function formData() {
    const g = (id) => $(id).value.trim();
    return {
      mode: g('#f-mode'), placeId: g('#f-place-id'), name: g('#f-name'), category: $('#f-category').value, address: g('#f-address'),
      menu: g('#f-menu'), tofu: g('#f-tofu'), onsen: g('#f-onsen'), notes: g('#f-notes'), sources: g('#f-sources'),
      lat: g('#f-lat'), lng: g('#f-lng'), contributor: g('#f-contrib'),
    };
  }
  function bodyText(d) {
    const lines = [];
    if (d.mode === 'fix' && d.placeId) lines.push('対象: ' + d.name + ' (id: ' + d.placeId + ')', '');
    lines.push('## お店・施設', d.name || '（未入力）', '', '## 種別', catLabel(d.category), '', '## 住所', d.address || '（未入力）', '',
      '## 温泉湯どうふのメニューと価格', d.menu || '（未入力）', '', '## 使っている豆腐', d.tofu || '（未入力）', '', '## 使っている温泉', d.onsen || '（未入力）', '',
      '## 特徴・修正内容・コメント', d.notes || '（未入力）', '', '## 出典URL', d.sources || '（未入力）', '',
      '## 位置（緯度, 経度）', d.lat && d.lng ? d.lat + ', ' + d.lng : '（未入力）', '', '## 投稿者', d.contributor || '（匿名）');
    return lines.join('\n');
  }
  function githubIssueUrl(d) { return window.TofuData.issueUrl(d); }

  function submitContribute(e) {
    e.preventDefault();
    const d = formData();
    if (!d.name) { toast('お店・施設の名前を入力してください'); $('#f-name').focus(); return; }
    if (!CFG.GITHUB_REPO) return;
    window.open(githubIssueUrl(d), '_blank', 'noopener');
    toast('GitHub の投稿画面を開きました。内容を確認して「Submit new issue」を押してください');
  }

  function startPick() {
    state.pick = true;
    $('#modal-contribute').hidden = true;
    $('#pick-banner').hidden = false;
    document.body.classList.remove('view-list'); document.body.classList.add('view-map');
    $$('.mobile-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.view === 'map'));
    state.map.setCursor('crosshair');
    setTimeout(() => state.map.invalidateSize(), 50);
  }
  function finishPick(latlng) {
    state.pick = null;
    $('#pick-banner').hidden = true;
    state.map.setCursor('');
    if (latlng) {
      $('#f-lat').value = latlng.lat.toFixed(6); $('#f-lng').value = latlng.lng.toFixed(6);
      toast('位置を取得しました: ' + latlng.lat.toFixed(5) + ', ' + latlng.lng.toFixed(5));
    }
    $('#modal-contribute').hidden = false;
  }

  // ------------------------------------------------------------------ 温泉湯どうふとは
  async function openAbout() {
    $('#modal-about').hidden = false;
    if (state.background) return;
    try {
      const bg = await window.TofuData.loadBackground();
      state.background = bg;
      $('#about-body').innerHTML = (bg.sections || []).map((sec) =>
        '<h3>' + esc(sec.heading) + '</h3>' + (sec.body || []).map((t) => '<p>' + esc(t) + '</p>').join('') +
        (sec.table ? '<table><tbody>' + sec.table.map((r) => '<tr>' + r.map((c, i) => (i === 0 ? '<th>' : '<td>') + esc(c) + (i === 0 ? '</th>' : '</td>')).join('') + '</tr>').join('') + '</tbody></table>' : '') +
        (sec.sources && sec.sources.length ? '<p class="sources">出典: ' + sec.sources.map((s) => linkOut(s.url, s.title || s.url)).join(' / ') + '</p>' : '')
      ).join('') + (bg.updated ? '<p class="muted small">最終更新 ' + esc(bg.updated) + '</p>' : '');
    } catch (e) {
      $('#about-body').innerHTML = '<p class="muted">読み込めませんでした。</p>';
    }
  }

  // ------------------------------------------------------------------ イベント
  function bindEvents() {
    let qTimer;
    $('#q').addEventListener('input', (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.filters.q = e.target.value.trim(); applyFilters({}); }, 150); });
    $('#btn-reset').addEventListener('click', resetFilters);
    $('#cat-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-cat]'); if (!chip) return;
      toggleSet(state.filters.cats, chip.dataset.cat); chip.classList.toggle('active'); chip.setAttribute('aria-pressed', chip.classList.contains('active'));
      applyFilters({});
    });
    $('#svc-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-svc]'); if (!chip) return;
      toggleSet(state.filters.svcs, chip.dataset.svc); chip.classList.toggle('active'); chip.setAttribute('aria-pressed', chip.classList.contains('active'));
      applyFilters({});
    });
    $('#legend').addEventListener('click', (e) => {
      const item = e.target.closest('[data-cat]'); if (!item) return;
      const c = item.dataset.cat; toggleSet(state.filters.cats, c);
      const chip = $('#cat-chips [data-cat="' + c + '"]'); if (chip) { chip.classList.toggle('active', state.filters.cats.has(c)); chip.setAttribute('aria-pressed', state.filters.cats.has(c)); }
      applyFilters({});
    });
    $('#legend').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.click(); } });
    $('#tofu-select').addEventListener('change', (e) => { state.filters.tofu = e.target.value; applyFilters({}); });
    $('#price-range').addEventListener('input', (e) => { state.filters.price = Number(e.target.value); updatePriceOutput(); applyFilters({}); });
    $('#chk-unverified').addEventListener('change', (e) => { state.filters.unverified = e.target.checked; applyFilters({}); });
    $('#chk-bounds').addEventListener('change', (e) => { state.filters.bounds = e.target.checked; applyFilters({}); });
    $('#sort-select').addEventListener('change', (e) => { state.sort = e.target.value; if (state.sort === 'distance' && !state.me) locateMe(); else applyFilters({}); });
    $('#list').addEventListener('click', (e) => { const card = e.target.closest('.card'); if (card) selectPlace(card.dataset.id, { pan: true, scroll: false }); });
    $('#list').addEventListener('keydown', (e) => { const card = e.target.closest('.card'); if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectPlace(card.dataset.id, { pan: true, scroll: false }); } });
    $('#btn-locate').addEventListener('click', locateMe);
    $('#btn-fit').addEventListener('click', () => fitAll({ core: false }));
    $('#btn-contribute').addEventListener('click', () => openContribute('new', null));
    $('#btn-about').addEventListener('click', openAbout);
    $('#form-contribute').addEventListener('submit', submitContribute);
    $('#btn-pick').addEventListener('click', startPick);
    $('#btn-pick-cancel').addEventListener('click', () => finishPick(null));
    $('#btn-copy-body').addEventListener('click', () => copyText(bodyText(formData()), '投稿内容をコピーしました。SNSやメールに貼り付けてお知らせください'));
    $('#btn-send-form').addEventListener('click', () => { copyText(bodyText(formData()), '内容をコピーしました。フォームに貼り付けてください'); window.open(CFG.FORM_URL, '_blank', 'noopener'); });
    $('#btn-send-mail').addEventListener('click', () => {
      const d = formData();
      location.href = 'mailto:' + CFG.CONTACT_EMAIL + '?subject=' + encodeURIComponent('[湯どうふマップ] ' + (d.mode === 'fix' ? '修正: ' : '追加: ') + d.name) + '&body=' + encodeURIComponent(bodyText(d));
    });
    $$('.modal').forEach((m) => {
      m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) m.hidden = true; });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const open = $$('.modal').find((m) => !m.hidden);
      if (open) open.hidden = true; else if (state.pick) finishPick(null); else if (state.selectedId) closeDetail();
    });
    $$('.mobile-tabs .tab').forEach((t) => t.addEventListener('click', () => {
      $$('.mobile-tabs .tab').forEach((x) => x.classList.toggle('active', x === t));
      document.body.classList.toggle('view-map', t.dataset.view === 'map');
      document.body.classList.toggle('view-list', t.dataset.view === 'list');
      setTimeout(() => state.map.invalidateSize(), 50);
    }));
    window.addEventListener('hashchange', () => {
      const id = new URLSearchParams(location.hash.replace(/^#/, '')).get('place');
      if (id && id !== state.selectedId && state.byId[id]) selectPlace(id, { pan: true });
    });
  }
  function toggleSet(set, v) { if (set.has(v)) set.delete(v); else set.add(v); }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }
})();
