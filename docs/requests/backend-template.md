# バックエンド依頼（Claude 向け）テンプレート

Claude Code に貼ってください。Codex の PR に「バックエンドへの依頼」があれば、それをそのまま貼っても構いません。

---

## 依頼文（ここから下をコピー）

バックエンド担当として対応してください（docs/ARCHITECTURE.md）。

### 欲しいもの
【例: 店ごとの「おすすめの1枚」用に、media に hero: true の印を付けられるようにしてほしい】

### 使う場所（画面）
【例: トップのヒーロー、一覧カードのサムネイル】

### 期限・優先度（任意）
【例: Codex の codex/redesign の PR より先に】

### 出してほしいもの
- データ API（js/data.js）の追加・変更点を docs/ARCHITECTURE.md に追記
- 検証（npm run validate）が通ること
- 変更を main に入れたら、Codex 側に伝える一言を書く
