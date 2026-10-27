import { getLocales } from 'expo-localization';

// Two shipped locales: English and Japanese (Japan scored highest in the
// market pass — see marketing/appstore/listing.md). Keys are short ids; a
// missing Japanese key falls back to English, and a test asserts none are missing.

const en = {
  // header / day
  today: 'Today',
  yesterday: 'Yesterday',
  of: 'of',
  left: '{n} left',
  over: '{n} over',
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
  pending: 'Counting {n}…',
  scrollHint: 'Swipe up or down for other days',
  notesHint: 'Swipe left for the food list',

  // capture
  ctaPrefix: 'Click to',
  ctaSuffix: 'and track calories instantly',
  snapA11y: 'Snap your food',
  previewA11y: 'Camera preview. Tap to enlarge.',
  closePreview: 'Close',
  gotIt: 'Got it!',
  countingNow: 'Counting it now — eat in peace.',
  savedForLater: 'Saved. It gets counted next time you are online.',
  cameraOff: 'Camera off',
  allowCamera: 'Allow camera',
  cameraDenied: 'Camera access is off. Turn it on in Settings to snap food.',
  openSettings: 'Open Settings',

  // side notes
  foodToday: 'Food today',
  foodOn: 'Food on {d}',
  nothingYet: 'Nothing yet. Snap a plate or type what you ate.',
  typeHere: 'Type it… e.g. 2 eggs and toast',
  add: 'Add',
  counting: 'Counting…',
  failed: "Couldn't read that one.",
  noFood: "We couldn't spot food in that photo.",
  retry: 'Retry',
  limitReached: 'Today’s free counts are used up.',
  unlock: 'Unlock unlimited',
  remove: 'Remove',
  edit: 'Edit',
  save: 'Save',
  cancel: 'Cancel',
  portion: 'Portion',
  name: 'Name',
  calories: 'Calories',
  items: 'What we saw',
  addedBy: { photo: 'Snapped', text: 'Typed', widget: 'Snapped from widget' },

  // settings
  settings: 'Settings',
  dailyGoal: 'Daily goal',
  recalc: 'Work it out for me',
  estimates: 'Estimates',
  biasUnder: 'Go easy',
  biasUnderSub: '10% lighter',
  biasHonest: 'Straight up',
  biasHonestSub: 'As estimated',
  biasOver: 'Keep me honest',
  biasOverSub: '15% heavier',
  biasExplain: 'Photos hide butter and oil. Leaning heavier keeps you on the safe side. Only changes new entries.',
  units: 'Energy unit',
  partner: 'Partner',
  partnerPlaceholder: 'Their name (for sharing)',
  nightLook: 'Night look after 8pm',
  nightOfferTitle: 'Snacking after dark?',
  nightOfferBody: 'Real Quick can switch to a calm night look after 8 pm — a quieter screen that makes the late plate easier to notice. You can change it any time in Settings.',
  nightOfferYes: 'Turn on the night look',
  nightOfferNo: 'Not now',
  haptics: 'Haptics',
  widgets: 'Widgets',
  widgetsHowIOS: 'Lock Screen: press and hold the Lock Screen ▸ Customize ▸ Lock Screen ▸ tap the widget row ▸ Real Quick. Or add the “Snap” control in place of the flashlight. Home Screen: press and hold ▸ Edit ▸ Add Widget ▸ Real Quick.',
  widgetsHowAndroid: 'Press and hold your home screen ▸ Widgets ▸ Real Quick. The 1×1 “Snap” widget takes a photo with one tap and closes again.',
  pro: 'Real Quick Pro',
  proActive: 'Pro is active — unlimited counts.',
  proFree: 'Free for your first 3 days, then Pro counts everything.',
  upgrade: 'Go unlimited',
  restore: 'Restore purchases',
  manage: 'Manage subscription',
  privacy: 'Privacy',
  terms: 'Terms of Use',
  support: 'Support',
  eraseAll: 'Erase all my data',
  eraseConfirm: 'Erase every entry and setting on this phone? This cannot be undone.',
  erase: 'Erase',
  done: 'Done',

  // share
  share: 'Share',
  shareTitle: 'My day on Real Quick',
  shareMood: {
    empty: 'Fresh start today.',
    started: 'Off to a light start.',
    onTrack: 'Right on track.',
    nailed: 'Nailed it today!',
    over: 'A little over — tomorrow is new.',
  },
  shareText: '{hi}{kcal} of {goal} {unit} today. {mood}',
  shareHi: '{name}, ',

  // onboarding
  obHelloTitle: 'Snap your food.\nThat’s it.',
  obHelloBody: 'Real Quick counts calories and macros from one photo. No searching, no weighing, no typing.',
  continue: 'Continue',
  obGoalTitle: 'Your daily goal',
  obGoalBody: 'Pick a number, or let us work it out. You can change it any time.',
  iKnow: 'I know my number',
  workItOut: 'Work it out',
  sexF: 'Female',
  sexM: 'Male',
  age: 'Age',
  height: 'Height',
  weight: 'Weight',
  activity: 'Activity',
  actLow: 'Mostly sitting',
  actLight: 'On my feet a bit',
  actModerate: 'Active',
  actHigh: 'Very active',
  goalKind: 'Goal',
  goalLose: 'Lose',
  goalMaintain: 'Maintain',
  goalGain: 'Gain',
  metric: 'Metric',
  imperial: 'Imperial',
  perDay: '{unit} a day',
  obBiasTitle: 'How should we estimate?',
  obBiasBody: 'Photos can’t see the butter in the pan. Choose how we lean when a portion is unclear.',
  obCameraTitle: 'One camera, always ready',
  obCameraBody: 'A tiny live preview sits next to the snap button, so a photo takes one tap. Photos are only sent to count the food, then deleted.',
  obCameraCta: 'Allow camera',
  notNow: 'Not now',
  obTourTitle: 'Three things to know',
  obTour1: 'Tap the big button. We count it while you eat.',
  obTour2: 'Swipe left to see, fix or type food.',
  obTour3: 'Swipe up and down to visit other days.',
  obWidget: 'Even faster: add the Snap widget to your Lock Screen.',
  obWidgetAndroid: 'Even faster: add the Snap widget to your home screen.',
  letsGo: "Let's eat",

  // paywall
  calendar: 'Open the month',
  monthPrev: 'Previous month',
  monthNext: 'Next month',
  pwTitle: 'Real Quick Pro',
  pwBody: 'The first 3 days are free. After that, Pro counts every photo and every typed meal. Two plans, nothing else to choose.',
  pwFeature1: 'Unlimited photo counts',
  pwFeature2: 'Unlimited typed meals, read by AI',
  pwFeature3: 'Every widget snap, no daily cap',
  pwFeature4: 'Live sharing with your partner',
  // free days and sharing
  trialDaysLeft: '{n} free days left',
  trialLastDay: 'Last free day',
  trialOver: 'Your 3 free days are over — Pro counts everything.',
  pwTitleLocked: 'Your 3 free days are over.',
  shareSheetTitle: 'Share your days',
  shareSheetBody: 'Your partner gets a link that shows today and your history, live, for as long as you keep sharing. No photos, no account.',
  shareNameLabel: 'Your name, as they’ll see it',
  shareStart: 'Start sharing',
  shareSend: 'Send the link',
  shareStop: 'Stop sharing',
  shareOn: 'Sharing is on',
  shareLinkHint: 'Anyone with the link can open it. You can stop any time.',
  shareFailed: 'Couldn’t reach the server. Try again in a moment.',
  shareStopped: 'Sharing stopped',
  shareMessage: 'Follow my days on Real Quick: {url}',
  sharing: 'Sharing',
  shareManage: 'Manage sharing →',
  shareOff: 'Off — share a live link with your partner.',
  pwYearly: 'Yearly',
  pwMonthly: 'Monthly',
  pwPer: '{price} / {period}',
  pwRenews: 'Billed {monthly} a month or {yearly} a year. Renews automatically until you cancel, at least 24 hours before the period ends, in Settings ▸ Apple Account ▸ Subscriptions.',
  pwRenewsAndroid: 'Billed {monthly} a month or {yearly} a year. Renews automatically until you cancel in Google Play ▸ Payments & subscriptions.',
  pwChoose: 'Tap a plan to subscribe',
  pwCoupon: 'Have a coupon code?',
  pwCouponTitle: 'Coupon code',
  pwCouponApply: 'Apply',
  pwCouponBad: "That code isn't valid.",
  pwCouponNet: "Couldn't reach the server. Try again in a moment.",
  pwCouponOk: 'Pro is on until {d}.',
  pwLater: 'Maybe later',
  pwUnavailable: 'The store is not reachable right now. Your free counts keep working — try again later.',
  pwThanks: 'Welcome to Pro!',
  week: 'week',
  month: 'month',
  year: 'year',
  oneWeek: '1 week',

  // errors
  offline: 'Offline — snaps are saved and counted later.',
};

type Dict = typeof en;
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const ja: DeepPartial<Dict> = {
  today: '今日',
  yesterday: '昨日',
  of: '/',
  left: 'あと {n}',
  over: '{n} オーバー',
  protein: 'たんぱく質',
  carbs: '炭水化物',
  fat: '脂質',
  pending: '{n}件 計算中…',
  scrollHint: '上下にスワイプで他の日へ',
  notesHint: '左にスワイプで食事リスト',

  ctaPrefix: 'タップで',
  ctaSuffix: 'すぐにカロリー記録',
  snapA11y: '食事を撮影',
  previewA11y: 'カメラのプレビュー。タップで拡大。',
  closePreview: '閉じる',
  gotIt: 'OK！',
  countingNow: 'いま計算中。ゆっくり食べてね。',
  savedForLater: '保存しました。次にオンラインになったら計算します。',
  cameraOff: 'カメラ オフ',
  allowCamera: 'カメラを許可',
  cameraDenied: 'カメラへのアクセスがオフです。設定でオンにすると撮影できます。',
  openSettings: '設定を開く',

  foodToday: '今日の食事',
  foodOn: '{d} の食事',
  nothingYet: 'まだ何もありません。撮影するか、食べたものを入力してね。',
  typeHere: '入力… 例：卵2個とトースト',
  add: '追加',
  counting: '計算中…',
  failed: '読み取れませんでした。',
  noFood: '写真から食べ物が見つかりませんでした。',
  retry: '再試行',
  limitReached: '今日の無料分を使い切りました。',
  unlock: '無制限にする',
  remove: '削除',
  edit: '編集',
  save: '保存',
  cancel: 'キャンセル',
  portion: '量',
  name: '名前',
  calories: 'カロリー',
  items: '写っていたもの',
  addedBy: { photo: '撮影', text: '入力', widget: 'ウィジェットから撮影' },

  settings: '設定',
  dailyGoal: '1日の目標',
  recalc: '自動で計算する',
  estimates: '見積もり',
  biasUnder: 'ゆるめ',
  biasUnderSub: '10% 少なめ',
  biasHonest: 'そのまま',
  biasHonestSub: '推定どおり',
  biasOver: 'きびしめ',
  biasOverSub: '15% 多め',
  biasExplain: '写真には油やバターが写りません。多めに見積もると安心です。新しい記録だけに反映されます。',
  units: 'エネルギー単位',
  partner: 'パートナー',
  partnerPlaceholder: '名前（シェア用）',
  nightLook: '20時以降はナイトモード',
  nightOfferTitle: '夜食が多めですか？',
  nightOfferBody: '20時以降、Real Quick を落ち着いたナイトモードにできます。静かな画面で、夜遅くの一皿に気づきやすくなります。設定からいつでも変えられます。',
  nightOfferYes: 'ナイトモードをオンにする',
  nightOfferNo: '今はしない',
  haptics: '触覚フィードバック',
  widgets: 'ウィジェット',
  widgetsHowIOS: 'ロック画面：ロック画面を長押し ▸ カスタマイズ ▸ ロック画面 ▸ ウィジェット欄をタップ ▸ Real Quick。懐中電灯の代わりに「撮影」コントロールも置けます。ホーム画面：長押し ▸ 編集 ▸ ウィジェットを追加 ▸ Real Quick。',
  widgetsHowAndroid: 'ホーム画面を長押し ▸ ウィジェット ▸ Real Quick。1×1の「撮影」ウィジェットはワンタップで撮影して閉じます。',
  pro: 'Real Quick Pro',
  proActive: 'Pro 有効 — 無制限に計算できます。',
  proFree: '最初の3日間は無料。その後はProですべて計算。',
  upgrade: '無制限にする',
  restore: '購入を復元',
  manage: 'サブスクリプションを管理',
  privacy: 'プライバシー',
  terms: '利用規約',
  support: 'サポート',
  eraseAll: 'すべてのデータを消去',
  eraseConfirm: 'この端末の記録と設定をすべて消去しますか？元に戻せません。',
  erase: '消去',
  done: '完了',

  share: 'シェア',
  shareTitle: 'Real Quick の今日の記録',
  shareMood: {
    empty: '今日はこれから。',
    started: '軽めのスタート。',
    onTrack: '順調です。',
    nailed: '今日はばっちり！',
    over: '少しオーバー。明日また。',
  },
  shareText: '{hi}今日は {kcal} / {goal} {unit}。{mood}',
  shareHi: '{name}へ：',

  obHelloTitle: '食事を撮るだけ。\nそれだけ。',
  obHelloBody: '写真1枚でカロリーとPFCを計算。検索も計量も入力もいりません。',
  continue: '次へ',
  obGoalTitle: '1日の目標',
  obGoalBody: '数値を選ぶか、自動で計算します。あとからいつでも変更できます。',
  iKnow: '数値を知っている',
  workItOut: '計算する',
  sexF: '女性',
  sexM: '男性',
  age: '年齢',
  height: '身長',
  weight: '体重',
  activity: '活動量',
  actLow: 'ほぼ座っている',
  actLight: '少し動く',
  actModerate: 'よく動く',
  actHigh: 'とてもよく動く',
  goalKind: '目標',
  goalLose: '減量',
  goalMaintain: '維持',
  goalGain: '増量',
  metric: 'メートル法',
  imperial: 'ヤード・ポンド法',
  perDay: '{unit}/日',
  obBiasTitle: 'どう見積もる？',
  obBiasBody: '写真ではフライパンのバターまでは見えません。量があいまいなときの傾け方を選んでください。',
  obCameraTitle: 'カメラはいつでも準備OK',
  obCameraBody: '撮影ボタンの横に小さなプレビューがあるので、ワンタップで撮れます。写真は計算のためだけに送信され、その後削除されます。',
  obCameraCta: 'カメラを許可',
  notNow: 'あとで',
  obTourTitle: '覚えることは3つだけ',
  obTour1: '大きなボタンをタップ。食べている間に計算します。',
  obTour2: '左にスワイプで確認・修正・入力。',
  obTour3: '上下にスワイプで他の日へ。',
  obWidget: 'もっと速く：ロック画面に「撮影」ウィジェットを追加。',
  obWidgetAndroid: 'もっと速く：ホーム画面に「撮影」ウィジェットを追加。',
  letsGo: 'はじめる',

  calendar: '月を開く',
  monthPrev: '前の月',
  monthNext: '次の月',
  pwTitle: 'Real Quick Pro',
  pwBody: '最初の3日間は無料。その後はProが写真も入力した食事もすべて計算します。プランは2つだけ、ほかに選ぶものはありません。',
  pwFeature1: '写真の計算が無制限',
  pwFeature2: '入力した食事もAIで無制限に計算',
  pwFeature3: 'ウィジェットからの撮影も回数制限なし',
  pwFeature4: 'パートナーとのライブシェア',
  // free days and sharing
  trialDaysLeft: '無料期間 残り{n}日',
  trialLastDay: '無料期間 最終日',
  trialOver: '無料の3日間が終わりました — Proですべて計算できます。',
  pwTitleLocked: '無料の3日間が終わりました。',
  shareSheetTitle: '毎日の記録をシェア',
  shareSheetBody: 'パートナーに送ったリンクで、今日の記録と履歴をリアルタイムで見てもらえます。シェアをやめるまで続きます。写真は送られず、アカウントも不要です。',
  shareNameLabel: '相手に表示する名前',
  shareStart: 'シェアを始める',
  shareSend: 'リンクを送る',
  shareStop: 'シェアをやめる',
  shareOn: 'シェア中',
  shareLinkHint: 'リンクを知っている人は誰でも開けます。いつでもやめられます。',
  shareFailed: 'サーバーに接続できませんでした。少し待ってからもう一度。',
  shareStopped: 'シェアをやめました',
  shareMessage: 'Real Quick で私の毎日をフォロー: {url}',
  sharing: 'シェア',
  shareManage: 'シェアの設定 →',
  shareOff: 'オフ — パートナーにライブのリンクを送れます。',
  pwYearly: '年額',
  pwMonthly: '月額',
  pwPer: '{price} / {period}',
  pwRenews: '月額 {monthly} または年額 {yearly}。解約するまで自動更新されます。解約は期間終了の24時間前までに「設定」▸「Apple Account」▸「サブスクリプション」から。',
  pwRenewsAndroid: '月額 {monthly} または年額 {yearly}。Google Play ▸「お支払いと定期購入」で解約するまで自動更新されます。',
  pwChoose: 'プランをタップして登録',
  pwCoupon: 'クーポンコードをお持ちですか？',
  pwCouponTitle: 'クーポンコード',
  pwCouponApply: '適用',
  pwCouponBad: 'このコードは無効です。',
  pwCouponNet: 'サーバーに接続できません。しばらくしてからお試しください。',
  pwCouponOk: '{d} まで Pro が有効です。',
  pwLater: 'あとで',
  pwUnavailable: 'ストアに接続できません。無料の計算はそのまま使えます。後でもう一度お試しください。',
  pwThanks: 'Pro へようこそ！',
  week: '週',
  month: '月',
  year: '年',
  oneWeek: '1週間',

  offline: 'オフライン — 撮影は保存され、あとで計算されます。',
};

export type Lang = 'en' | 'ja';

export function detectLang(): Lang {
  try {
    const code = getLocales()[0]?.languageCode ?? 'en';
    return code === 'ja' ? 'ja' : 'en';
  } catch {
    return 'en';
  }
}

export let lang: Lang = detectLang();
export const locale = lang === 'ja' ? 'ja-JP' : undefined;

type Leaf = string;
type Path<T> = { [K in keyof T & string]: T[K] extends Leaf ? K : `${K}.${Path<T[K]>}` }[keyof T & string];
export type Key = Path<Dict>;

function get(dict: unknown, key: string): string | undefined {
  let cur = dict as Record<string, unknown> | undefined;
  for (const part of key.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[part] as Record<string, unknown> | undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function t(key: Key, vars?: Record<string, string | number>): string {
  const raw = (lang === 'ja' ? get(ja, key) : undefined) ?? get(en, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

/** Locale-aware number with thousands separators. */
export function n(v: number): string {
  return Math.round(v).toLocaleString(locale);
}

export function dayLabel(dayKeyStr: string, todayKey: string, yesterdayKey: string): string {
  if (dayKeyStr === todayKey) return t('today');
  if (dayKeyStr === yesterdayKey) return t('yesterday');
  const [y, m, d] = dayKeyStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return date.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
}

export const __dicts = { en, ja };
