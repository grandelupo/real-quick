import type { FoodItem } from './types';

// The free, instant, offline fast path for typed entries. A large share of
// what people type is "banana", "2 eggs", "coffee with milk" — those never
// need a model call. Anything the table cannot fully explain goes to the AI.
//
// Values are for one typical unit (USDA FoodData Central, rounded).

interface FoodRow {
  /** Lower-case names: English singular first, then aliases (incl. Japanese). */
  names: string[];
  emoji: string;
  /** Display name, English. The UI localises nothing here — the user's own words are shown when they typed them. */
  label: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const T: FoodRow[] = [
  { names: ['banana', 'バナナ'], emoji: '🍌', label: 'Banana', grams: 118, kcal: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { names: ['apple', 'りんご', 'リンゴ'], emoji: '🍎', label: 'Apple', grams: 182, kcal: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { names: ['orange', 'みかん', 'オレンジ'], emoji: '🍊', label: 'Orange', grams: 131, kcal: 62, protein: 1.2, carbs: 15, fat: 0.2 },
  { names: ['pear', '梨'], emoji: '🍐', label: 'Pear', grams: 178, kcal: 101, protein: 0.6, carbs: 27, fat: 0.2 },
  { names: ['peach', '桃'], emoji: '🍑', label: 'Peach', grams: 150, kcal: 59, protein: 1.4, carbs: 14, fat: 0.4 },
  { names: ['kiwi'], emoji: '🥝', label: 'Kiwi', grams: 69, kcal: 42, protein: 0.8, carbs: 10, fat: 0.4 },
  { names: ['avocado', 'アボカド'], emoji: '🥑', label: 'Avocado', grams: 150, kcal: 240, protein: 3, carbs: 13, fat: 22 },
  { names: ['strawberry', 'いちご'], emoji: '🍓', label: 'Strawberry', grams: 12, kcal: 4, protein: 0.1, carbs: 0.9, fat: 0 },
  { names: ['grape', 'ぶどう'], emoji: '🍇', label: 'Grape', grams: 5, kcal: 3, protein: 0, carbs: 0.9, fat: 0 },
  { names: ['egg', '卵', 'たまご', 'ゆで卵'], emoji: '🥚', label: 'Egg', grams: 50, kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { names: ['toast', 'slice of bread', 'bread', 'トースト', '食パン'], emoji: '🍞', label: 'Toast', grams: 30, kcal: 80, protein: 2.7, carbs: 15, fat: 1 },
  { names: ['croissant', 'クロワッサン'], emoji: '🥐', label: 'Croissant', grams: 57, kcal: 231, protein: 4.7, carbs: 26, fat: 12 },
  { names: ['bagel', 'ベーグル'], emoji: '🥯', label: 'Bagel', grams: 105, kcal: 270, protein: 11, carbs: 53, fat: 1.7 },
  { names: ['rice', 'bowl of rice', 'ご飯', 'ごはん', 'ライス'], emoji: '🍚', label: 'Rice', grams: 160, kcal: 250, protein: 4.3, carbs: 56, fat: 0.5 },
  { names: ['onigiri', 'おにぎり'], emoji: '🍙', label: 'Onigiri', grams: 110, kcal: 180, protein: 3.5, carbs: 39, fat: 0.6 },
  { names: ['natto', '納豆'], emoji: '🫘', label: 'Natto', grams: 45, kcal: 90, protein: 7.4, carbs: 5.4, fat: 4.5 },
  { names: ['miso soup', '味噌汁', 'みそ汁'], emoji: '🥣', label: 'Miso soup', grams: 200, kcal: 40, protein: 3, carbs: 4, fat: 1.3 },
  { names: ['oatmeal', 'porridge', 'oats', 'オートミール'], emoji: '🥣', label: 'Oatmeal', grams: 234, kcal: 166, protein: 6, carbs: 28, fat: 3.6 },
  { names: ['yogurt', 'yoghurt', 'greek yogurt', 'ヨーグルト'], emoji: '🥛', label: 'Yogurt', grams: 170, kcal: 100, protein: 17, carbs: 6, fat: 0.7 },
  { names: ['glass of milk', 'milk', '牛乳'], emoji: '🥛', label: 'Milk', grams: 244, kcal: 122, protein: 8, carbs: 12, fat: 4.8 },
  { names: ['coffee', 'black coffee', 'espresso', 'americano', 'コーヒー'], emoji: '☕', label: 'Coffee', grams: 240, kcal: 2, protein: 0.3, carbs: 0, fat: 0 },
  { names: ['coffee with milk', 'latte', 'cafe latte', 'カフェラテ', 'ラテ'], emoji: '☕', label: 'Latte', grams: 350, kcal: 190, protein: 12, carbs: 18, fat: 7 },
  { names: ['cappuccino', 'flat white', 'カプチーノ'], emoji: '☕', label: 'Cappuccino', grams: 240, kcal: 110, protein: 6, carbs: 9, fat: 5 },
  { names: ['tea', 'green tea', 'お茶', '緑茶'], emoji: '🍵', label: 'Tea', grams: 240, kcal: 2, protein: 0, carbs: 0.5, fat: 0 },
  { names: ['beer', 'ビール'], emoji: '🍺', label: 'Beer', grams: 355, kcal: 153, protein: 1.6, carbs: 13, fat: 0 },
  { names: ['glass of wine', 'wine', 'ワイン'], emoji: '🍷', label: 'Wine', grams: 150, kcal: 125, protein: 0.1, carbs: 4, fat: 0 },
  { names: ['cola', 'coke', 'soda', 'コーラ'], emoji: '🥤', label: 'Cola', grams: 355, kcal: 140, protein: 0, carbs: 39, fat: 0 },
  { names: ['orange juice', 'juice', 'オレンジジュース'], emoji: '🧃', label: 'Orange juice', grams: 248, kcal: 112, protein: 1.7, carbs: 26, fat: 0.5 },
  { names: ['protein shake', 'protein', 'プロテイン'], emoji: '🥤', label: 'Protein shake', grams: 330, kcal: 160, protein: 30, carbs: 5, fat: 2 },
  { names: ['chicken breast', 'chicken', '鶏むね肉', 'サラダチキン'], emoji: '🍗', label: 'Chicken breast', grams: 150, kcal: 248, protein: 46, carbs: 0, fat: 5.4 },
  { names: ['salmon', '鮭', 'サーモン'], emoji: '🐟', label: 'Salmon', grams: 150, kcal: 312, protein: 33, carbs: 0, fat: 19 },
  { names: ['steak', 'ステーキ'], emoji: '🥩', label: 'Steak', grams: 200, kcal: 500, protein: 50, carbs: 0, fat: 33 },
  { names: ['salad', 'green salad', 'サラダ'], emoji: '🥗', label: 'Green salad', grams: 150, kcal: 60, protein: 2, carbs: 7, fat: 3 },
  { names: ['pizza slice', 'slice of pizza', 'pizza', 'ピザ'], emoji: '🍕', label: 'Pizza slice', grams: 107, kcal: 285, protein: 12, carbs: 36, fat: 10 },
  { names: ['burger', 'hamburger', 'cheeseburger', 'ハンバーガー'], emoji: '🍔', label: 'Burger', grams: 220, kcal: 540, protein: 30, carbs: 40, fat: 28 },
  { names: ['fries', 'french fries', 'chips', 'ポテト', 'フライドポテト'], emoji: '🍟', label: 'Fries', grams: 117, kcal: 365, protein: 4, carbs: 48, fat: 17 },
  { names: ['sandwich', 'サンドイッチ'], emoji: '🥪', label: 'Sandwich', grams: 200, kcal: 400, protein: 20, carbs: 40, fat: 17 },
  { names: ['burrito', 'ブリトー'], emoji: '🌯', label: 'Burrito', grams: 300, kcal: 650, protein: 28, carbs: 80, fat: 22 },
  { names: ['taco', 'タコス'], emoji: '🌮', label: 'Taco', grams: 100, kcal: 210, protein: 9, carbs: 20, fat: 10 },
  { names: ['ramen', 'ラーメン'], emoji: '🍜', label: 'Ramen', grams: 600, kcal: 550, protein: 22, carbs: 70, fat: 20 },
  { names: ['sushi', 'piece of sushi', '寿司', 'すし'], emoji: '🍣', label: 'Sushi piece', grams: 40, kcal: 50, protein: 2.5, carbs: 8, fat: 0.6 },
  { names: ['pasta', 'spaghetti', 'パスタ', 'スパゲッティ'], emoji: '🍝', label: 'Pasta', grams: 350, kcal: 560, protein: 20, carbs: 85, fat: 15 },
  { names: ['soup', 'スープ'], emoji: '🍲', label: 'Soup', grams: 300, kcal: 180, protein: 8, carbs: 20, fat: 7 },
  { names: ['cookie', 'クッキー'], emoji: '🍪', label: 'Cookie', grams: 30, kcal: 150, protein: 1.7, carbs: 20, fat: 7 },
  { names: ['donut', 'doughnut', 'ドーナツ'], emoji: '🍩', label: 'Donut', grams: 60, kcal: 250, protein: 3, carbs: 30, fat: 14 },
  { names: ['chocolate bar', 'chocolate', 'チョコ', 'チョコレート'], emoji: '🍫', label: 'Chocolate', grams: 45, kcal: 235, protein: 3, carbs: 26, fat: 13 },
  { names: ['ice cream', 'アイス', 'アイスクリーム'], emoji: '🍦', label: 'Ice cream', grams: 100, kcal: 210, protein: 3.5, carbs: 24, fat: 11 },
  { names: ['cake', 'slice of cake', 'ケーキ'], emoji: '🍰', label: 'Cake slice', grams: 100, kcal: 350, protein: 4, carbs: 50, fat: 15 },
  { names: ['muffin', 'マフィン'], emoji: '🧁', label: 'Muffin', grams: 113, kcal: 420, protein: 6, carbs: 55, fat: 20 },
  { names: ['handful of nuts', 'nuts', 'almonds', 'ナッツ', 'アーモンド'], emoji: '🥜', label: 'Nuts', grams: 28, kcal: 165, protein: 6, carbs: 6, fat: 14 },
  { names: ['peanut butter', 'ピーナッツバター'], emoji: '🥜', label: 'Peanut butter (tbsp)', grams: 16, kcal: 95, protein: 3.6, carbs: 3.6, fat: 8 },
  { names: ['cheese', 'slice of cheese', 'チーズ'], emoji: '🧀', label: 'Cheese slice', grams: 28, kcal: 113, protein: 7, carbs: 0.4, fat: 9.3 },
  { names: ['granola bar', 'protein bar', 'bar', 'プロテインバー'], emoji: '🍫', label: 'Bar', grams: 50, kcal: 200, protein: 10, carbs: 22, fat: 8 },
  { names: ['popcorn', 'ポップコーン'], emoji: '🍿', label: 'Popcorn', grams: 30, kcal: 160, protein: 2.5, carbs: 17, fat: 9 },
  { names: ['carrot', '人参', 'にんじん'], emoji: '🥕', label: 'Carrot', grams: 61, kcal: 25, protein: 0.6, carbs: 6, fat: 0.1 },
  { names: ['cucumber', 'きゅうり'], emoji: '🥒', label: 'Cucumber', grams: 200, kcal: 30, protein: 1.3, carbs: 7, fat: 0.2 },
  { names: ['tomato', 'トマト'], emoji: '🍅', label: 'Tomato', grams: 123, kcal: 22, protein: 1.1, carbs: 4.8, fat: 0.2 },
  { names: ['potato', 'じゃがいも'], emoji: '🥔', label: 'Potato', grams: 173, kcal: 160, protein: 4.3, carbs: 37, fat: 0.2 },
  { names: ['tofu', '豆腐'], emoji: '🧈', label: 'Tofu', grams: 150, kcal: 115, protein: 12, carbs: 3, fat: 7 },
  { names: ['pancake', 'パンケーキ'], emoji: '🥞', label: 'Pancake', grams: 77, kcal: 175, protein: 5, carbs: 22, fat: 7 },
];

const INDEX = new Map<string, FoodRow>();
for (const row of T) for (const n of row.names) INDEX.set(n, row);

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  half: 0.5, 'a half': 0.5, couple: 2, 'a couple of': 2, few: 3, 'a few': 3,
};

/** "2 eggs, toast and a coffee" → ["2 eggs", "toast", "a coffee"]. */
export function splitParts(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .split(/\s*(?:,|;|\+|&|\band\b|\bplus\b|、|と|\n)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function singular(word: string): string[] {
  const out = [word];
  if (word.endsWith('ies')) out.push(word.slice(0, -3) + 'y');
  if (word.endsWith('es')) out.push(word.slice(0, -2));
  if (word.endsWith('s')) out.push(word.slice(0, -1));
  return out;
}

interface Parsed {
  qty: number;
  /** Explicit grams ("150g chicken"), which override the unit portion. */
  grams?: number;
  name: string;
}

export function parsePart(part: string): Parsed {
  let rest = part.trim();
  let qty = 1;
  let grams: number | undefined;

  const g = rest.match(/^(\d+(?:[.,]\d+)?)\s*(?:g|gr|grams?|グラム)\s*(?:of\s+)?(.*)$/);
  if (g) {
    grams = parseFloat(g[1].replace(',', '.'));
    rest = g[2];
  } else {
    const n = rest.match(/^(\d+(?:[.,]\d+)?|½|¼)\s*(?:x\s*)?(.*)$/);
    if (n) {
      qty = n[1] === '½' ? 0.5 : n[1] === '¼' ? 0.25 : parseFloat(n[1].replace(',', '.'));
      rest = n[2];
    } else {
      for (const w of Object.keys(WORD_NUMBERS).sort((a, b) => b.length - a.length)) {
        if (rest.startsWith(w + ' ')) {
          qty = WORD_NUMBERS[w];
          rest = rest.slice(w.length + 1);
          break;
        }
      }
    }
    // Japanese counters: "卵2個", "バナナ1本"
    const jp = rest.match(/^(.+?)(\d+(?:\.\d+)?)\s*(?:個|本|枚|杯|切れ|つ)?$/);
    if (jp && /[^\x00-\x7F]/.test(jp[1])) {
      rest = jp[1];
      qty = parseFloat(jp[2]);
    }
  }
  rest = rest.replace(/^(?:of|the)\s+/, '').trim();
  return { qty, grams, name: rest };
}

export function lookup(name: string): FoodRow | undefined {
  for (const candidate of singular(name)) {
    const hit = INDEX.get(candidate);
    if (hit) return hit;
  }
  return undefined;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Resolve typed text entirely from the local table, or return null when any
 * part is unknown (the caller then asks the AI for the whole sentence, so
 * the user never gets a half-counted meal).
 */
export function parseLocally(text: string): FoodItem[] | null {
  const parts = splitParts(text);
  if (parts.length === 0 || parts.length > 8) return null;
  const items: FoodItem[] = [];
  for (const part of parts) {
    const p = parsePart(part);
    if (!p.name || p.qty <= 0 || p.qty > 20) return null;
    const row = lookup(p.name);
    if (!row) return null;
    const k = p.grams !== undefined ? p.grams / row.grams : p.qty;
    if (!(k > 0) || k > 20) return null;
    items.push({
      name: p.qty !== 1 && p.grams === undefined ? `${p.qty} × ${row.label}` : row.label,
      emoji: row.emoji,
      grams: Math.round(row.grams * k),
      kcal: Math.round(row.kcal * k),
      protein: round1(row.protein * k),
      carbs: round1(row.carbs * k),
      fat: round1(row.fat * k),
    });
  }
  return items;
}

export const LOCAL_FOOD_COUNT = T.length;
