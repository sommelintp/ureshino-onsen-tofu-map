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

  // グルメサイトの点数・口コミ数（食べログ点数など）を画面に表示するか。
  // 各サイトの利用規約上グレーなため既定は非表示（リンクのみ表示）。表示する場合は運営者の判断で true に。
  SHOW_RATINGS: false,

  // 「近い順」の出発地候補（現在地のほかに駅・バスセンターなど）。座標を確認して追加してください。
  // 例: { label: '嬉野温泉駅', lat: 33.1187, lng: 130.0060 }
  ORIGINS: [],

  // Google マップを使う場合: Google Cloud の API キー（Maps JavaScript API を有効化し、HTTP リファラを
  // https://sommelintp.github.io/* に制限したもの）を貼ってください。空なら下の無料地図（OpenFreeMap / 地理院）を使います。
  GOOGLE_MAPS_API_KEY: 'AIzaSyBUObjTc6pxhAE8tcEAHMGoo6csrGY3pxg',
  // 任意: Google Cloud「マップ管理」で作ったマップ ID（スタイル用）。空なら Google のデモ ID を使います
  GOOGLE_MAPS_MAP_ID: '',

  // Google マップ未使用時のベースマップ: 'vector'（OpenFreeMap のベクター地図・既定）/ 'gsi'（地理院 淡色）/ 'osm'（OpenStreetMap）
  BASEMAP: 'vector',
  // ベクター地図のスタイル。liberty（標準・カラフル）/ bright / positron（淡い） を選べます
  VECTOR_STYLE_URL: 'https://tiles.openfreemap.org/styles/liberty',

  // 地図の初期表示（嬉野温泉街）
  MAP_CENTER: [33.098, 129.988],
  MAP_ZOOM: 15,

  // サイト名・運営者表示
  SITE_TITLE: '嬉野温泉 湯どうふマップ',
  OPERATOR: '',
};
