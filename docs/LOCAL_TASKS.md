# ローカルPCで行う作業

クラウドの開発環境（Claude Code on the web）からは、外部サイトの取得やジオコーディングAPIがネットワーク制限で使えませんでした。
以下はローカルPC（ネットワーク制限なし）で行うと早い作業です。同じリポジトリを `git clone` して進めてください。

## 1. 座標の付与（最優先）

初期データ59件のうち、正確な座標があるのは宗庵よこ長の1件のみです。残りは住所の町丁目（例: 下宿乙）の代表点を「概略」として入れています。

```bash
npm run geocode -- --dry      # 結果を確認（書き込まない）
npm run geocode -- --approx   # 概略の行も国土地理院APIで再付与して data/places.json に書き込む
npm run validate
git commit -am "data: 座標を付与" && git push
```

- 国土地理院の住所検索API（`msearch.gsi.go.jp`）を1秒間隔で呼びます
- 「番地未取得」の行はスキップされます。住所を調べて埋めてから再実行してください
- 結果が番地まで一致すれば `正確`、大字レベルなら `概略` になります。地図で明らかにずれている場合は Google マップで店を右クリック → 座標をコピーしてシート/JSON に入れてください

スプレッドシート運用に移行した後は、シートの緯度・経度列を直接編集する運用でも構いません。

## 2. 各店の最新情報の確認（要確認 14件 + 価格の時点が不明な店）

`npm run validate -- --warnings` で、メニューが無い店・座標が無い店が一覧されます。
優先順:

1. 公開状態が `要確認` の店（居酒屋 旬、まねき寿司、やきとり戦国、ダイニング すずしろ、ゆらり亭、RAKUYA、嬉泉館、初音荘、山水グローバルイン、枯淡嬉野、ハミルトン宇礼志野、RIVERPARK HOTEL、フェアフィールド、道の駅うれしの まるく）
2. 住所が「番地未取得」の旅館（一休荘、入船荘、八十八、光陽閣、松園、高砂、ひさご旅館、萬象閣敷島 など）
3. 価格が複数表記の店（宗庵よこ長 850/1,080円、佐嘉平川屋 嬉野店 2,000/2,500円、利休、吉田屋）
4. 使用豆腐の製造元が未確認の旅館（旅館大村屋の note「6社食べ比べ」記事が手がかり）

確認先: 各店公式サイト、食べログ・Retty のメニューページ、嬉野温泉観光協会（spa-u.net）、あそぼーさが。確認したら出典列に `タイトル | URL | 確認日` を追加してください。

## 3. 公開セットアップ（ブラウザ操作）

- GitHub: Settings → Pages → Build and deployment を **GitHub Actions** に
- Google スプレッドシート（[作成済み](https://docs.google.com/spreadsheets/d/1BlTnAfIig9Zj76Qv0a5tHG7JfKfjU4yrGzZ0DLq9zTo/edit)）: `data/places.csv` を「ファイル → インポート → 現在のシートを置換」で取り込む → 共有を「リンクを知っている全員」= 閲覧者に → 編集者をメールアドレスで追加 → ID `1BlTnAfIig9Zj76Qv0a5tHG7JfKfjU4yrGzZ0DLq9zTo` を `config.js` の `SHEET_ID` へ
- GitHub: Settings → Secrets and variables → Actions → Variables に `SHEET_ID`（自動スナップショット用）
- （任意）Google フォームを作成し、`config.js` の `FORM_URL` へ。質問は Issue フォーム（.github/ISSUE_TEMPLATE/new-place.yml）と同じ項目で

## 4. 確認

```bash
npm run serve   # http://localhost:8080/ をブラウザで開く
```

地図タイルは地理院タイル／OpenStreetMap をインターネット経由で読み込みます。
