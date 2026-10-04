/*
 * サイト設定。編集者・管理者が触るのはこのファイルだけです。
 * 変更後は main に push すると GitHub Pages に反映されます。
 */
window.TOFU_CONFIG = {
  // Google スプレッドシートの ID（URL の /d/ と /edit の間）。
  // 空のままなら data/places.json のみを使います。
  // 作成済みのシート「嬉野温泉 湯どうふマップ データ」の ID: 1BlTnAfIig9Zj76Qv0a5tHG7JfKfjU4yrGzZ0DLq9zTo
  // → data/places.csv を取り込み、共有を「リンクを知っている全員が閲覧可」にしてから、この ID を設定してください（編集者は個別に「編集者」で共有）。
  SHEET_ID: '',
  // 読み込むシート（タブ）名。空なら最初のタブを使う
  SHEET_NAME: '',

  // 同梱データ（スプレッドシートが未設定・取得失敗のときに使う）
  DATA_URL: 'data/places.json',
  BACKGROUND_URL: 'data/background.json',

  // 一般の方の投稿先（GitHub Issue フォーム）
  GITHUB_REPO: 'sommelintp/ureshino-onsen-tofu-map',

  // 任意: Google フォームの URL（作成したら貼る。GitHub アカウント不要の投稿導線になります）
  FORM_URL: '',
  // 任意: 連絡先メール（設定するとメールでの投稿ボタンが出ます）
  CONTACT_EMAIL: '',

  // 地図の初期表示（嬉野温泉街）
  MAP_CENTER: [33.098, 129.988],
  MAP_ZOOM: 15,

  // サイト名・運営者表示
  SITE_TITLE: '嬉野温泉 湯どうふマップ',
  OPERATOR: '',
};
