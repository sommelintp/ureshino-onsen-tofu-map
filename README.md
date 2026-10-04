# 嬉野温泉 湯どうふマップ

佐賀県嬉野市で名物 **温泉湯どうふ** が食べられる・買える場所を、1枚の地図にまとめた公開サイトです。

- 飲食店・旅館・ホテル・豆腐店（製造元）・物販・温泉施設・イベントを種別ごとに色分け
- 温泉湯どうふの **メニューのバリエーションと価格**、**使っている豆腐（製造元）**、**使っている温泉（源泉）**、特徴
- 公式サイト・食べログ・Retty・Google マップ・ぐるなび・ホットペッパー・じゃらん・楽天トラベル・Instagram へのリンク
- すべての情報に **出典（URL・確認日）** を併記
- 足りない情報は **誰でも追加・修正を提案** できます。嬉野市・観光協会などの **編集者はスプレッドシートで直接編集** できます

公開URL（GitHub Pages を有効化すると表示されます）: `https://sommelintp.github.io/ureshino-onsen-tofu-map/`

> 初期データ（59件）は 2026年10月4日時点の公開情報（公式サイト・観光協会・グルメサイト等の検索結果）から作成し、各項目に出典を付けています。
> 価格・営業時間は掲載時点のものです。座標の多くは住所（町丁目）からの **概略位置** で、地図上では点線のピンで表示しています。正しい位置は `npm run geocode`（ローカル実行）か、地図の「位置を修正する」からの投稿で補正できます。

---

## 仕組み

```
一般の方 ──閲覧──▶ GitHub Pages（静的サイト: index.html / js / css / data）
                     │ 起動時に取得
                     ├─ ① Google スプレッドシート（編集者が直接編集する正本。公開リンクで閲覧可）
                     └─ ② 取得できないときは data/places.json（リポジトリ同梱のスナップショット）

編集者（市職員・観光担当など） ──編集──▶ Google スプレッドシート「places」
一般投稿者 ──提案──▶ GitHub Issue フォーム（サイトの投稿画面から事前入力）／Google フォーム（任意）
GitHub Actions ──毎日──▶ シート → data/places.json をスナップショット（履歴が残る）
```

- ビルド不要・依存ゼロ（地図ライブラリ Leaflet は CDN）。市の担当者が引き継いでも保守できます。
- 設計の詳細は [docs/DESIGN.md](docs/DESIGN.md)、編集者向けの手順は [docs/editor-guide.md](docs/editor-guide.md)。

## 使い方（閲覧）

- 種別チップ・提供形態（ランチ／朝食／日帰り／テイクアウト／通販 など）・使用豆腐・予算で絞り込み
- カードまたはピンをクリックすると詳細（メニュー表・使用豆腐・使用温泉・リンク・出典）
- 白抜きのピン＝湯どうふ提供が未確認（情報募集中）、点線のピン＝位置は概略
- URL の `#place=<id>` で特定の店を直接開けます（詳細の「共有」ボタン）

## 情報を追加・修正したい（一般の方）

1. サイト右上の「＋ 情報を追加・修正」または各店の「情報を修正する」
2. 分かる項目を入力 → 「GitHub で送信」（GitHub アカウントが必要・無料）
   - アカウントがない場合は「内容をコピー」して、運営者の連絡先・SNS・Google フォーム（設定時）へ
3. 編集者が確認してスプレッドシートに反映 → 地図に表示

Issue フォームは [.github/ISSUE_TEMPLATE](.github/ISSUE_TEMPLATE) にあります。出典（公式サイト・メニュー写真・グルメサイトのURL）があると早く反映できます。

## 編集したい（市職員・観光協会・旅館組合などの担当者）

**Google スプレッドシートを「編集者」として共有してもらうだけ** で編集できます（GitHub 不要）。

- 1行 = 1施設。列は日本語の見出し（名称／種別／公開状態／湯どうふ提供／住所／緯度／経度／電話／営業時間／定休日／提供形態／メニュー／その他料金／使用豆腐／使用温泉／特徴／説明／各URL／出典／確信度 …）
- メニューは 1行1品で `品名 | 価格 | 備考 | 出典URL`、出典は `タイトル | URL | 確認日 | 備考`
- 「公開状態」を **非公開** にすると地図から消え、**要確認** にすると白抜きで表示されます（空欄は要確認扱い）
- 保存するとサイトは次の読み込みから新しいデータを表示します（キャッシュなし）

列の意味・入力規則・よくある質問は [docs/editor-guide.md](docs/editor-guide.md) を参照してください。
`config.js` の `SHEET_ID` を設定してシート運用に移行した後は、`data/places.json` は毎日シートから上書きされる **スナップショット（bot 専用）** になります。データの修正は必ずシート側で行ってください（移行前の今は `data/places.json` を直接編集して Pull Request を送っても構いません。CI が検証します）。

## 公開・運用のセットアップ（管理者）

1. **GitHub Pages**: リポジトリの Settings → Pages → Build and deployment を **GitHub Actions** にする。`main` に push すると [pages.yml](.github/workflows/pages.yml) が公開します。
2. **スプレッドシート**（作成済み: [嬉野温泉 湯どうふマップ データ](https://docs.google.com/spreadsheets/d/1BlTnAfIig9Zj76Qv0a5tHG7JfKfjU4yrGzZ0DLq9zTo/edit)、ID `1BlTnAfIig9Zj76Qv0a5tHG7JfKfjU4yrGzZ0DLq9zTo`）:
   - 現在は見出し行＋例1行だけ入っています。[data/places.csv](data/places.csv) をダウンロードし、シートで **ファイル → インポート → アップロード → 「現在のシートを置換」** で全59件を取り込んでください（`npm run csv` で再生成できます）。
   - シートの共有を「**リンクを知っている全員（閲覧者）**」にする（サイトが読み取るため）。編集者は個別にメールアドレスで「編集者」として追加。
   - 取り込みが済んだら [config.js](config.js) の `SHEET_ID` に上記 ID を設定して push。これでサイトはシートを正本として表示します（未設定の間は `data/places.json` を表示）。
3. **自動スナップショット**（任意）: Settings → Secrets and variables → Actions → Variables に `SHEET_ID`（上記 ID）を登録すると、[sync-sheet.yml](.github/workflows/sync-sheet.yml) が毎日 `data/places.json` を更新します（タブ名を変えた場合は `SHEET_NAME` も登録）。
4. **Google フォーム**（任意）: GitHub アカウント不要の投稿導線。質問項目は Issue フォームと同じで構いません。URL を `config.js` の `FORM_URL` に設定。回答シートは編集者が確認して `places` に転記します。
5. **連絡先**（任意）: `config.js` の `CONTACT_EMAIL`、`OPERATOR`。
6. **評価値の表示**: 食べログ点数などの数値は各サイトの規約上グレーなため既定で非表示（リンクのみ）。表示する場合は `config.js` の `SHOW_RATINGS` を `true` に。
7. **データの自己点検**: サイト URL に `?check=1` を付けると、入力エラー・座標なし・出典なしの一覧が画面に出ます（編集者向け）。
8. **非公開行の扱い**: 公開シートは誰でも読めます。閉店情報などを完全に隠したい場合は、編集者ガイドの「公開用タブ」（FILTER 式）を使い `SHEET_NAME` をそのタブ名にします。

## ローカルでの作業

```bash
npm run serve      # http://localhost:8080/ で確認
npm run validate   # データ検証（--warnings で座標・メニュー欠落も表示）
npm run csv        # data/places.json → data/places.csv（シート投入用）
npm run sync -- --sheet <SHEET_ID>   # 公開シート → data/places.json
npm run geocode    # 住所から座標を付与（国土地理院API。ローカルPCで実行）
npm run build      # 1ファイル版 dist/index.html（メール添付・ダブルクリック用）
```

クラウドの開発環境からは外部サイト・ジオコーディングAPIに出られないため、座標付与と各店の最新情報の確認はローカルで行います。手順は [docs/LOCAL_TASKS.md](docs/LOCAL_TASKS.md)。

## データ形式

`data/places.json` の 1 件:

```jsonc
{
  "id": "yokocho", "name": "宗庵よこ長", "name_kana": "そうあん よこちょう",
  "category": "restaurant",          // restaurant | hotel | tofu_maker | shop | onsen | other
  "status": "published",             // published | needs_review | hidden
  "yudofu": "confirmed",             // confirmed | unverified | none
  "address": "佐賀県嬉野市嬉野町大字下宿乙2190", "lat": 33.0969567, "lng": 129.9835744, "geo_precision": "exact",
  "tel": "0954-42-0563", "hours": "…", "closed": "水曜",
  "service": ["ランチ", "ディナー", "テイクアウト", "通販"],
  "menu": [{ "name": "湯どうふ定食", "price": 1080, "price_note": "掲載年不明", "source_url": "https://…" }],
  "other_prices": [],                // 入浴料・宿泊目安など湯どうふ以外の料金
  "tofu_source": { "name": "自家製（豆匠よこ長）", "maker_id": "yokocho", "note": "", "source_url": "" },
  "onsen_source": { "name": "嬉野温泉", "note": "", "source_url": "" },
  "features": ["温泉湯どうふ発祥の店（1957年創業）"], "description": "…",
  "urls": { "official": "…", "tabelog": "…", "retty": "…", "google_maps": "", "other": [{ "label": "…", "url": "…" }] },
  "ratings": { "tabelog": 3.55, "tabelog_reviews": 532, "google": null, "google_reviews": null },
  "sources": [{ "title": "…", "url": "https://…", "accessed": "2026-10-04", "note": "…" }],
  "confidence": "high", "updated_at": "2026-10-04", "editor_note": ""
}
```

JSON のキーとスプレッドシートの日本語見出しの対応・パース規則は [js/schema.js](js/schema.js) に一元化しています（ブラウザと Node スクリプトで共用）。

## 方針

- 出典のない情報は「要確認」にとどめ、価格には確認日・税込/税抜を残す
- グルメサイトの点数・口コミ数は数値とリンクのみ表示し、口コミ本文やロゴは転載しない
- 写真は権利者の許諾があるもののみ（当面は掲載しない）
- 来店前の確認を促す注記をサイトに常設

## ライセンス

- コード: [MIT](LICENSE)
- データ（`data/`）: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)（[data/LICENSE](data/LICENSE)）
- 地図タイル: [地理院タイル](https://maps.gsi.go.jp/development/ichiran.html)、[OpenStreetMap](https://www.openstreetmap.org/copyright)（© OpenStreetMap contributors）
