# 役割分担と構成（バックエンド / フロントエンド）

このサイトは2つの担当で作ります。担当ファイルを分けて、同じファイルを同時に触らないようにしています。

| 担当 | 誰が | 作るもの |
| --- | --- | --- |
| バックエンド | Claude（Claude Code） | データ、データの読み込み・検証、スプレッドシート連携、投稿の受け口、自動公開の仕組み |
| フロントエンド | Codex | 画面のデザイン、レイアウト、部品（カード・ボタン・ヒーロー・ギャラリー等）、装飾、アニメーション、写真・動画の見せ方 |

## 担当ファイル

**バックエンド（Claude が編集。Codex は読むだけ）**
- `data/` すべて（`places.json` / `media.json` / `background.json` / `places.csv`）
- `js/schema.js`（データ形式・検証ルール）
- `js/data.js`（データ API。下記）
- `scripts/`、`.github/`、`package.json`
- `config.js`（API キー・シート ID などの設定）
- `docs/editor-guide.md`、`docs/LOCAL_TASKS.md`、`docs/DESIGN.md`

**フロントエンド（Codex が編集。Claude は原則触らない）**
- `index.html`、`css/`、`js/app.js`、`js/illust.js`
- 新しく作る `js/ui/`（部品）、`assets/`（画像・アイコン・フォント）、`docs/mockups/`
- `og-image.png`

**共有（変えるときは相手に一言）**
- `README.md`、`AGENTS.md`、この `docs/ARCHITECTURE.md`

フロントエンドでデータの項目が足りない・形を変えたい場合は、自分でデータを直さず「バックエンドへの依頼」を出す（下記）。

## データ API（`js/data.js` → `window.TofuData`）

画面側はデータを直接 `fetch` せず、必ずこれを使う。読み込み順は `config.js` → `js/schema.js` → `js/data.js` → 画面のスクリプト。

```js
// 店舗データ。同梱データで即1回、シートが設定されていれば取得後にもう1回コールバック
const ds = await TofuData.loadPlaces((ds) => render(ds));
// ds = { all: Place[], byId: {id: Place}, source: 'json'|'sheet', meta, sheetError }

// 写真・動画（確認済みの SNS 投稿のみ）
const media = await TofuData.loadMedia();
// media = { items: Media[], byPlace: { [place_id]: Media[] }, general: Media[], yudofu: Media[]（湯どうふが主題の投稿） }

// 「温泉湯どうふとは」の読み物
const bg = await TofuData.loadBackground();   // { sections: [{ heading, body[], table?, sources[] }] }

// 投稿フォームの送信先（GitHub Issue の事前入力 URL）
location.href = TofuData.issueUrl({ mode: 'new'|'fix', placeId, name, category, address, menu, tofu, onsen, notes, sources, media, lat, lng, contributor });

// 種別・ラベル・検証などの定数
TofuData.schema.CATEGORIES   // { restaurant: { label: '飲食店', color }, hotel, tofu_maker, shop, onsen, other }
TofuData.schema.SERVICES     // ['ランチ','ディナー','朝食','日帰り','テイクアウト','通販','宿泊者限定','食べ比べ','予約制']
TofuData.schema.validateAll(ds.raw)  // 点検画面（?check=1）用
```

### Place（1店舗）
| 項目 | 型 | 内容 |
| --- | --- | --- |
| `id` | string | 固定の識別子。`#place=<id>` の共有 URL に使う |
| `name` / `name_kana` | string | 店名 / よみ |
| `category` | string | `restaurant` `hotel` `tofu_maker` `shop` `onsen` `other` |
| `status` | string | `published` `needs_review`（要確認。白抜き等で区別して表示） |
| `yudofu` | string | `confirmed` `unverified` `none` |
| `address` `tel` `hours` `closed` | string | 基本情報 |
| `lat` `lng` / `geo_precision` | number / string | 座標。`exact` 正確 / `approx` 概略 / `unknown` 座標なし |
| `service` | string[] | 提供形態（上の SERVICES） |
| `menu` | {name, price, price_note, source_url}[] | 温泉湯どうふの料理・セット |
| `other_prices` | 同上 | 入浴料・宿泊・湯どうふ以外の商品 |
| `price_min` `price_max` `price_item` | number / string | 代表価格（湯どうふの定食・セット）と、その品名。表示はこれを使う |
| `tofu_source` | {name, maker_id, note, source_url} | 使っている豆腐。`maker_id` は製造元の店の id |
| `onsen_source` | {name, note, source_url} | 使っている温泉 |
| `features` / `description` | string[] / string | 特徴 / 紹介文 |
| `urls` | {official, tabelog, retty, google_maps, gurunavi, hotpepper, jalan, rakuten, instagram, other[]} | 外部リンク |
| `sources` | {title, url, accessed, note}[] | 出典（必ず画面に出す） |
| `confidence` `updated_at` | string | 確信度 / 最終更新日 |

### Media（写真・動画）
| 項目 | 内容 |
| --- | --- |
| `place_id` | 店の id（空なら温泉湯どうふ全般の投稿） |
| `platform` | `instagram` `tiktok` `youtube` `x` |
| `url` | 元の投稿 URL。表示は各サービスの公式埋め込みで行う（画像の保存・転載はしない） |
| `youtube_id` | YouTube のときの動画 ID |
| `caption` | 短い説明（編集者が書く。自動収集では投稿本文の冒頭） |
| `posted_at` / `media_type` | 自動収集の投稿日 / IMAGE・VIDEO・CAROUSEL_ALBUM（任意） |
| `focus` | `yudofu` 温泉湯どうふが主題（ヒーロー・ギャラリー向き） / `place` 店・宿の紹介（詳細パネル向き） |

## 自動収集
- Instagram: `scripts/instagram-collect.mjs` を GitHub Actions が毎日実行し `data/media.json` に追記（設定は `data/instagram-config.json`、手順は `docs/INSTAGRAM.md`）。画面側は `TofuData.loadMedia()` を使うだけでよい。

## 依頼の出し方

- **フロントエンドの依頼** → Codex に、`docs/requests/frontend-template.md` の形で渡す
- **バックエンドの依頼** → Claude に、`docs/requests/backend-template.md` の形で渡す（Codex からの「この項目が欲しい」もこちら）
- どちらも作業は自分のブランチで行い、PR を出してオーナーが確認してからマージする
  - Codex: `codex/<作業名>`　Claude: `claude/<作業名>`
- 作業を始める前に必ず `git pull` で最新にする
