# AGENTS.md — 嬉野温泉 湯どうふマップ（Codex 向け作業ルール）

このリポジトリは、佐賀県嬉野市で「温泉湯どうふ」が食べられる・買える場所を地図で紹介する公開サイトです。
GitHub Pages（`main` への push で自動公開）で配信しています。公開URL: https://sommelintp.github.io/ureshino-onsen-tofu-map/

## あなた（Codex）の担当: フロントエンド
このプロジェクトは **バックエンド＝Claude、フロントエンド＝Codex** で分担しています。役割・担当ファイル・データ API は
`docs/ARCHITECTURE.md` にあります。作業前に必ず読んでください。

- 編集してよい: `index.html`、`css/`、`js/app.js`、`js/illust.js`、新規の `js/ui/`・`assets/`・`docs/mockups/`、`og-image.png`
- 編集しない（読むだけ）: `data/`、`js/schema.js`、`js/data.js`、`scripts/`、`.github/`、`config.js`
- データは `window.TofuData` から取る。項目が足りなければ、PR の最後に「バックエンドへの依頼」として書く
- 最初の大きな依頼（ビジュアル全面リデザイン）は `docs/CODEX_BRIEF.md`。以降の依頼は `docs/requests/frontend-template.md` の形で届く
- 作業前に `git pull`、作業は `codex/<作業名>` ブランチ、終わったら PR（`main` に直接 push しない）

## 変えてはいけないもの
- **データとコンセプト**: `data/` の内容、`js/schema.js`・`js/data.js` のデータ形式と検証ルール（バックエンド担当）。
  表示を変えるのは自由。データの項目名・意味・値は変えない。
- **機能**: 種別・提供形態・使用豆腐・予算での絞り込み、検索、詳細（メニュー表・使用豆腐・使用温泉・リンク・出典）、
  `#place=<id>` の共有URL、情報の追加・修正フォーム（GitHub Issue 事前入力）、位置修正、現在地・近い順、`?check=1` の点検画面、
  Google スプレッドシート読み込み（`config.js` の `SHEET_ID`）、Google マップ（`GOOGLE_MAPS_API_KEY`）と無料地図へのフォールバック。
- **出典表示**: すべての価格・情報に出典リンクを出す方針。口コミ本文やグルメサイトのロゴ・写真は転載しない。
- **ビルド不要の静的サイト**であること（`index.html` + `css/` + `js/` を GitHub Pages がそのまま配信）。
  ライブラリは CDN（unpkg / cdnjs / jsdelivr）から **バージョン固定 + integrity（SRI）付き** で読む。
  SRI 値は推測で書かず、npm パッケージの実ファイルから算出する（過去に誤った SRI で地図が全く表示されない事故あり）。

## 確認コマンド（push 前に必ず）
```bash
node --check js/app.js && node --check js/schema.js
npm run validate        # データ検証（エラー0であること）
npm run serve           # http://localhost:8080/ で目視確認（PC幅とスマホ幅390px）
```
- スマホ幅で横スクロールが出ないこと、コンソールエラーが無いこと。
- `config.js` の Google マップ API キーは公開前提のキー（サイト制限付き）。削除・変更しない。

## コミット
- 日本語のコミットメッセージで、何をなぜ変えたかを書く。
- `main` へ push すると自動で公開される。大きな変更はブランチで作業して PR を出し、オーナーの確認後にマージ。
