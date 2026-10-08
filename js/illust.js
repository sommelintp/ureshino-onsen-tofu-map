/* 嬉野温泉 湯どうふマップ — 手描き風イラスト（インラインSVG・外部ファイル不要） */
(function (root) {
  'use strict';
  // 土鍋の温泉湯どうふ（ヘッダー用）
  const HERO = `
<svg class="hero-illust" viewBox="0 0 220 140" role="img" aria-label="湯気の立つ土鍋の温泉湯どうふ">
  <g class="steam" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".55">
    <path class="s1" d="M78 52c-8-10 8-16 0-28s6-18 2-22"/>
    <path class="s2" d="M110 46c-8-12 10-18 0-32s6-14 2-18"/>
    <path class="s3" d="M142 52c-8-10 8-16 0-28s6-18 2-22"/>
  </g>
  <ellipse cx="110" cy="128" rx="88" ry="8" fill="#000" opacity=".08"/>
  <path d="M28 78h164c0 30-36 50-82 50S28 108 28 78z" fill="#8a5a3b"/>
  <path d="M28 78h164c0 6-2 11-5 16H33c-3-5-5-10-5-16z" fill="#a8714d"/>
  <rect x="14" y="80" width="18" height="9" rx="4.5" fill="#6e4429"/>
  <rect x="188" y="80" width="18" height="9" rx="4.5" fill="#6e4429"/>
  <ellipse cx="110" cy="78" rx="82" ry="16" fill="#f3ead8"/>
  <ellipse cx="110" cy="78" rx="72" ry="11" fill="#fbf6ea"/>
  <g>
    <path d="M70 70l22-4 10 9-22 5z" fill="#fff" stroke="#e7dcc4" stroke-width="1.5"/>
    <path d="M106 66l24-3 9 9-24 4z" fill="#fff" stroke="#e7dcc4" stroke-width="1.5"/>
    <path d="M128 78l22-3 8 8-22 4z" fill="#fff" stroke="#e7dcc4" stroke-width="1.5"/>
    <path d="M84 82l20-2 7 7-20 3z" fill="#fff" stroke="#e7dcc4" stroke-width="1.5"/>
  </g>
  <path d="M60 74c5-3 9-2 12 1" stroke="#3f8f5f" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M150 70c4-3 8-2 10 1" stroke="#3f8f5f" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="122" cy="84" r="3" fill="#e2b04a"/>
</svg>`;

  // カテゴリのアイコン（24x24, currentColor）
  const ICONS = {
    restaurant: '<path d="M4 13h16a8 6 0 0 1-16 0z"/><path d="M8 9c-1-2 1-3 0-5M12 9c-1-2 1-3 0-5M16 9c-1-2 1-3 0-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M2 13h20" stroke="currentColor" stroke-width="1.6"/>',
    hotel: '<path d="M3 11l9-6 9 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 10h14v10H5z"/><path d="M10 20v-5h4v5" fill="#fff" opacity=".9"/><path d="M1.5 11.5l10.5-7 10.5 7" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    tofu_maker: '<path d="M4 9l8-4 8 4-8 4z" opacity=".55"/><path d="M4 9v7l8 4v-7z"/><path d="M20 9v7l-8 4v-7z" opacity=".8"/>',
    shop: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    onsen: '<path d="M3 15c3-2 15-2 18 0 0 4-4 6-9 6s-9-2-9-6z"/><path d="M8 12c-1.5-2 1.5-3 0-6M12 11c-1.5-2 1.5-3 0-7M16 12c-1.5-2 1.5-3 0-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    other: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  };
  function icon(cat, cls) {
    return '<svg class="' + (cls || 'cat-icon') + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + (ICONS[cat] || ICONS.other) + '</svg>';
  }

  // 詳細パネル上部の挿絵（カテゴリ別の小さな風景）
  function scene(cat) {
    const c = 'var(--cat-' + (ICONS[cat] ? cat : 'other') + ')';
    return '<svg class="detail-scene" viewBox="0 0 400 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<rect width="400" height="90" fill="' + c + '" opacity=".14"/>' +
      '<path d="M0 70 Q60 40 120 62 T240 58 T400 52 V90 H0z" fill="' + c + '" opacity=".18"/>' +
      '<path d="M0 80 Q80 60 170 76 T400 70 V90 H0z" fill="' + c + '" opacity=".26"/>' +
      '<g fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linecap="round" opacity=".55">' +
      '<path d="M300 40c-5-7 5-11 0-19s4-12 1-15"/><path d="M322 44c-5-8 6-12 0-21s4-10 1-13"/><path d="M344 40c-5-7 5-11 0-19s4-12 1-15"/></g>' +
      '<g transform="translate(296 44) scale(2.6)" fill="' + c + '" opacity=".85">' + (ICONS[cat] || ICONS.other) + '</g>' +
      '</svg>';
  }

  // 何も見つからないとき
  const EMPTY = '<svg class="empty-illust" viewBox="0 0 120 80" aria-hidden="true"><ellipse cx="60" cy="72" rx="40" ry="5" fill="currentColor" opacity=".08"/><path d="M22 44h76c0 16-17 26-38 26S22 60 22 44z" fill="currentColor" opacity=".25"/><ellipse cx="60" cy="44" rx="38" ry="8" fill="currentColor" opacity=".12"/><path d="M50 30c-4-6 4-9 0-16M70 30c-4-6 4-9 0-16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".35"/></svg>';

  root.TofuIllust = { HERO, ICONS, icon, scene, EMPTY };
})(typeof self !== 'undefined' ? self : this);
