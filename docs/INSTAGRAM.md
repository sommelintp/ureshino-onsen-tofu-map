# Instagram 自動収集のセットアップ

毎朝 6時ごろ、GitHub が自動で Instagram を調べ、温泉湯どうふの投稿をサイトに追加します。

## 何を集めるか
1. **ハッシュタグ**（`data/instagram-config.json` の `hashtags`。#嬉野温泉湯どうふ、#温泉湯豆腐、#宗庵よこ長 など12種）の最新投稿と人気投稿
2. **各店・宿の公式アカウント**の投稿（店のデータに Instagram の URL があるもの。いま11アカウント）

## どう判定するか
| 投稿の本文 | 扱い |
| --- | --- |
| 「湯どうふ」系の語 ＋ 店の呼び名（よこ長、平川屋 嬉野、大村屋…） | その店に紐づけてサイトに表示 |
| 公式アカウントの投稿で「湯どうふ」系の語あり | その店に紐づけてサイトに表示 |
| 「嬉野」＋「湯どうふ」だが店が分からない | `data/media-candidates.json` に入れて**表示しない**（編集者が確認） |
| 湯どうふと関係ない・嬉野以外 | 無視 |

- 画像は保存しません。Instagram の公式埋め込みで表示します（投稿が削除されれば自動で消えます）。
- 呼び名の追加・修正は `data/instagram-config.json` の `aliases`。
- Instagram の制限: ハッシュタグは **7日間で30種類まで**、最新投稿は**直近24時間分**しか取れないので毎日動かします。

## セットアップ（最初の1回・30〜60分）

Instagram の API を使うには、Meta（Facebook）側で「アプリ」を作り、検索の権限を申請する必要があります。

### 1. Instagram をプロアカウントにする
- スマホの Instagram アプリ → プロフィール → 右上の三本線 → 「アカウントの種類とツール」→「プロアカウントに切り替える」→ **ビジネス**
- 既にソムリンなどのビジネスアカウントがあればそれを使えます（このサイト専用に作ってもOK）

### 2. Facebook ページとつなぐ
- Instagram アプリ → プロフィールを編集 →「ページ」→ Facebook ページを選ぶ（なければ新規作成。中身は空でよい）

### 3. Meta のアプリを作る
1. https://developers.facebook.com/apps を開き、Facebook でログイン
2. 「アプリを作成」→ ユースケースは **「その他」** → アプリタイプ **「ビジネス」**
3. アプリ名: `ureshino-tofu-map-collector`、連絡先メール: 自分のメール →「アプリを作成」
4. アプリのダッシュボードで「製品を追加」→ **Instagram Graph API**（「Instagram」）の「設定」

### 4. アクセストークンを取る（期限なしのトークン）
1. https://business.facebook.com/settings → 「ユーザー」→「システムユーザー」→「追加」
   - 名前: `tofu-map-bot`、役割: **管理者**
2. 作ったシステムユーザー →「アセットを追加」→ 2 の Facebook ページと 3 のアプリにフルコントロールを付ける
3. 「新しいトークンを生成」→ アプリ `ureshino-tofu-map-collector` を選び、有効期限 **「期限なし」**、権限は次の4つにチェック
   - `instagram_basic` / `pages_show_list` / `pages_read_engagement` / `business_management`
4. 表示されたトークン（`EAA` で始まる長い文字列）をコピー → これが **IG_ACCESS_TOKEN**

### 5. Instagram のアカウント ID を調べる
ブラウザで次を開く（`<トークン>` を置き換え）:
```
https://graph.facebook.com/v21.0/me/accounts?fields=name,instagram_business_account&access_token=<トークン>
```
表示された `instagram_business_account` の `id`（`1784…` の数字）→ これが **IG_USER_ID**

### 6. ハッシュタグ検索の権限を申請する（ここだけ審査あり）
- アプリのダッシュボード →「アプリレビュー」→「権限と機能」→ **Instagram Public Content Access** →「アドバンスアクセスをリクエスト」
- 説明の例:「嬉野市の名物『温泉湯どうふ』を紹介する公開マップで、関連ハッシュタグの投稿を公式埋め込みで表示するために使用します。画像の保存・転載はしません。」
- 審査は数日〜2週間。**承認前でも公式アカウントの収集は動きます**（ハッシュタグ部分だけエラーとして飛ばされます）

### 7. GitHub に登録する
1. https://github.com/sommelintp/ureshino-onsen-tofu-map/settings/secrets/actions →「New repository secret」
2. Name: `IG_ACCESS_TOKEN` / Secret: 4 のトークン →「Add secret」
3. もう一度「New repository secret」→ Name: `IG_USER_ID` / Secret: 5 の数字 →「Add secret」
4. Actions タブ →「Collect Instagram posts」→「Run workflow」で初回を手動実行。緑になれば完了

トークンはチャットに貼らず、GitHub の Secrets にだけ入れてください。

## 運用
- 毎日自動で動き、新しい投稿があれば `data/media.json` に追加してサイトを更新します
- 候補（`data/media-candidates.json`）は週1回くらい見て、店が分かるものは `place_id` を入れて `verified: true` にし、`media.json` に移す（Claude に「候補を確認して」と頼んでもOK）
- 載せたくない投稿は `media.json` から行を消すか `verified: false` に
