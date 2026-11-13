'use strict';
/* =========================================================
   たんぱく質ノート
   - 必要量: 厚生労働省「日本人の食事摂取基準（2025年版）」策定検討会報告書
             各論 1-2 たんぱく質（p.90, 92, 95, 96, 103）
   - 食品の値: 日本食品標準成分表（八訂）増補2023年から引用（foods.json）
   - データは端末のブラウザ（localStorage）にのみ保存
   ========================================================= */

/* ---------- 食事摂取基準（2025年版）p.103 の表 ---------- */
const DRI = {
  // [下限年齢, 上限年齢, 表示]
  brackets: [
    [1, 2, '1〜2歳'], [3, 5, '3〜5歳'], [6, 7, '6〜7歳'], [8, 9, '8〜9歳'],
    [10, 11, '10〜11歳'], [12, 14, '12〜14歳'], [15, 17, '15〜17歳'],
    [18, 29, '18〜29歳'], [30, 49, '30〜49歳'], [50, 64, '50〜64歳'],
    [65, 74, '65〜74歳'], [75, 200, '75歳以上'],
  ],
  m: { ear: [15, 20, 25, 30, 40, 50, 50, 50, 50, 50, 50, 50], rda: [20, 25, 30, 40, 45, 60, 65, 65, 65, 65, 60, 60] },
  f: { ear: [15, 20, 25, 30, 40, 45, 45, 40, 40, 40, 40, 40], rda: [20, 25, 30, 40, 50, 55, 55, 50, 50, 50, 50, 50] },
  goal: ['13〜20', '13〜20', '13〜20', '13〜20', '13〜20', '13〜20', '13〜20', '13〜20', '13〜20', '14〜20', '15〜20', '15〜20'],
};
// 妊婦・授乳婦の付加量（推定平均必要量 / 推奨量）p.103
const ADD = {
  none: { ear: 0, rda: 0, label: '' },
  preg1: { ear: 0, rda: 0, label: '妊娠初期' },
  preg2: { ear: 5, rda: 5, label: '妊娠中期' },
  preg3: { ear: 20, rda: 25, label: '妊娠後期' },
  lact: { ear: 15, rda: 20, label: '授乳中' },
};
// 成人の維持必要量 0.73 g/kg体重/日（p.90）× 推奨量算定係数 1.25（p.92）
const ADULT_EAR_PER_KG = 0.73;
const RDA_FACTOR = 1.25;
// 高齢者：1.2 g/kg体重/日以上がフレイル・サルコペニア予防の可能性（p.95）
const FRAIL_PER_KG = 1.2;

/* ---------- 目安量（個数で入れるための重さ） ----------
   種類（kind）
   egg : 卵の規格（農林水産省「鶏卵の規格」の重量区分の中央値）× 成分表の廃棄率・重量変化率で計算
   ml  : 成分表の備考（100mLあたりの重さ）から計算
   raw : 調理前の重さ（目安）× 成分表の重量変化率 で計算
   est : このツール独自の一般的な目安
*/
const EGG_SIZES = [['M', 61], ['L', 67], ['MS', 55], ['S', 49], ['LL', 73], ['SS', 43]]; // 殻付き g（区分の中央値）
const EGG_REFUSE_RAW = 0.14;    // 12004 鶏卵 全卵 生 の廃棄率（卵殻）
const EGG_REFUSE_BOILED = 0.11; // 12005 鶏卵 全卵 ゆで の廃棄率（卵殻）
const EGG_COOKED = ['12006', '12021', '12022', '12023']; // 割卵して調理するもの（重量変化率あり）

// [表示, 重さg, 数え方] または { l: 表示, raw: 調理前のg, c: 数え方 }
const FOOD_UNITS = {
  '01088': [['茶碗1杯', 150, '杯'], ['小盛り', 100], ['大盛り', 200], ['どんぶり1杯', 250, '杯']],
  '01085': [['茶碗1杯', 150, '杯']],
  '01026': [['6枚切1枚', 60, '枚'], ['8枚切1枚', 45, '枚'], ['5枚切1枚', 72, '枚'], ['4枚切1枚', 90, '枚']],
  '01034': [['1個', 30, '個']],
  '01039': [['1玉', 200, '玉']],
  '01064': [{ l: '乾めん100g分', raw: 100, c: '人前' }, { l: '乾めん80g分', raw: 80 }],
  '01130': [{ l: '乾めん1束100g分', raw: 100, c: '束' }],
  '01042': [{ l: '乾めん100g分', raw: 100 }],
  '01048': [{ l: '生めん1玉分', raw: 120, c: '玉' }],
  '04046': [['1パック', 45, 'パック'], ['小パック', 40, 'パック']],
  '04032': [['1/2丁', 150], ['1/3丁', 100], ['1丁', 300, '丁']],
  '04033': [['1/2丁', 150], ['1/3丁', 100], ['1丁', 300, '丁']],
  '04040': [['1枚', 30, '枚']],
  '04039': [['1枚', 140, '枚']],
  '13025': [['1食分', 100]],
  '13040': [['スライス1枚', 18, '枚']],
  '11227': [['1本', 50, '本']],
  '11228': [{ l: '1本分', raw: 50, c: '本' }],
  '11229': [{ l: '1本分', raw: 50, c: '本' }],
  '11176': [['1枚', 10, '枚']],
  '11186': [['1本', 20, '本']],
  '11306': [{ l: '1本分', raw: 20, c: '本' }],
  '11307': [{ l: '1本分', raw: 20, c: '本' }],
  '11183': [['1枚', 17, '枚']],
  '10134': [['1切れ', 80, '切れ']],
  '10136': [{ l: '1切れ分', raw: 80, c: '切れ' }],
  '10139': [['1切れ', 80, '切れ']],
  '10154': [['1切れ', 80, '切れ']],
  '10263': [['1缶', 70, '缶']],
  '10164': [['1缶（固形量）', 150, '缶']],
  '10381': [['1本', 30, '本']],
  '10376': [['1本', 10, '本']],
  '10055': [['大さじ1', 5]],
};

/* よく使う食材（一覧の表示名） */
const STAPLES = [
  { code: '12004', label: '卵（生）' },
  { code: '12005', label: 'ゆで卵' },
  { code: '12021', label: '目玉焼き' },
  { code: '12022', label: 'スクランブルエッグ（いり卵）' },
  { code: '04046', label: '納豆' },
  { code: '04032', label: '木綿豆腐' },
  { code: '04033', label: '絹ごし豆腐' },
  { code: '13003', label: '牛乳' },
  { code: '13025', label: 'ヨーグルト（無糖）' },
  { code: '13040', label: 'プロセスチーズ' },
  { code: '11220', label: '鶏むね（皮なし・生）' },
  { code: '11288', label: '鶏むね（皮なし・焼き）' },
  { code: '11221', label: '鶏もも（皮つき・生）' },
  { code: '11227', label: 'ささみ（生）' },
  { code: '11229', label: 'ささみ（ゆで）' },
  { code: '11130', label: '豚もも（生）' },
  { code: '11123', label: '豚ロース（生）' },
  { code: '11163', label: '豚ひき肉（生）' },
  { code: '11075', label: '牛もも 輸入（生）' },
  { code: '11176', label: 'ロースハム' },
  { code: '11186', label: 'ウインナー' },
  { code: '10134', label: '鮭（生）' },
  { code: '10136', label: '焼き鮭' },
  { code: '10139', label: '塩鮭' },
  { code: '10263', label: 'ツナ缶（油漬）' },
  { code: '10164', label: 'さば水煮缶' },
  { code: '01088', label: 'ごはん（白米）' },
  { code: '01026', label: '食パン' },
  { code: '01039', label: 'うどん（ゆで）' },
  { code: '01064', label: 'スパゲッティ（ゆで）' },
];
const SUGGEST_CODES = ['12004', '04046', '11220', '04032', '10134', '10263', '13003', '13040'];

/* 食品の目安量一覧 → [{ l: 表示, g: その食品としての重さ, c: 数え方, kind, note }] */
function unitsFor(f) {
  if (!f) return [];
  const out = [];
  if (f.code === '12004') {
    for (const [sz, w] of EGG_SIZES) out.push({ l: `${sz}サイズ1個`, g: r1(w * (1 - EGG_REFUSE_RAW)), c: '個', kind: 'egg' });
  } else if (f.code === '12005' && f.rate) {
    for (const [sz, w] of EGG_SIZES) out.push({ l: `${sz}サイズ1個`, g: r1(w * f.rate / 100 * (1 - EGG_REFUSE_BOILED)), c: '個', kind: 'egg' });
  } else if (EGG_COOKED.includes(f.code) && f.rate) {
    for (const [sz, w] of EGG_SIZES) out.push({ l: `卵${sz}サイズ1個分`, g: r1(w * (1 - EGG_REFUSE_RAW) * f.rate / 100), c: '個', kind: 'egg' });
  }
  if (f.code === '13003' && f.ml) out.push({ l: 'コップ1杯 200mL', g: r1(200 * f.ml / 100), c: '杯', kind: 'ml' });
  for (const u of FOOD_UNITS[f.code] || []) {
    if (Array.isArray(u)) out.push({ l: u[0], g: u[1], c: u[2] || null, kind: 'est' });
    else if (f.rate) out.push({ l: u.l, g: r1(u.raw * f.rate / 100), c: u.c || null, kind: 'raw', raw: u.raw });
  }
  return out;
}
function unitNote(u, f) {
  if (u.kind === 'egg') return '卵の重さは農林水産省「鶏卵の規格」の重量区分の中央値から、殻の分（成分表の廃棄率）' + (f.rate ? `と調理による重さの変化（重量変化率${f.rate}%）` : '') + 'を除いて計算しています。';
  if (u.kind === 'ml') return `成分表の備考（100mL＝${f.ml}g）から計算しています。`;
  if (u.kind === 'raw') return `調理前${u.raw}g（一般的な目安）に、成分表の重量変化率${f.rate}%をかけた重さです。`;
  return '1個・1枚などの重さは一般的な目安です。実際の重さがわかるときは「g」で入れてください。';
}

/* 検索の言い換え（漢字・通称 → 成分表の表記） */
const ALIASES = {
  'たまご': ['鶏卵'], '玉子': ['鶏卵'], '卵': ['卵'],
  '鶏肉': ['にわとり'], '鶏': ['にわとり', '鶏'], 'とりにく': ['にわとり'], 'チキン': ['にわとり', 'チキン'],
  '豚肉': ['ぶた'], '豚': ['ぶた', '豚'], 'ぶたにく': ['ぶた'], 'ポーク': ['ぶた', 'ポーク'],
  '牛肉': ['うし'], 'ぎゅうにく': ['うし'], 'ビーフ': ['うし', 'ビーフ'],
  'ごはん': ['めし'], 'ご飯': ['めし'], '白米': ['精白米'], 'お米': ['こめ'],
  '鮭': ['さけ'], 'しゃけ': ['さけ'], 'サーモン': ['さけ', 'サーモン'],
  '鯖': ['さば'], '鮪': ['まぐろ'], 'ツナ': ['まぐろ類)缶詰', 'かつお類)缶詰'],
  '鰯': ['いわし'], '鯵': ['あじ'], '鱈': ['たら'], '鰤': ['ぶり'], '海老': ['えび'], '烏賊': ['いか'], '蛸': ['たこ'],
  '胸': ['むね'], 'むね肉': ['むね'], 'もも肉': ['もも'],
  'とうふ': ['豆腐'], 'なっとう': ['納豆'], 'ぎゅうにゅう': ['牛乳'], 'ミルク': ['牛乳', 'ミルク'],
  'しょくぱん': ['食パン'], 'ちーず': ['チーズ'],
};

const MEALS = [['b', '朝食'], ['l', '昼食'], ['d', '夕食'], ['s', '間食']];
const STORE_KEY = 'protein-note-v1';

/* ---------- 状態 ---------- */
let foods = [];            // [{code, g, name, p, f, ml, key, main, sub}]
let foodByCode = new Map();
let foodsReady = false;
let state = loadState();
let viewDate = todayStr();
let currentTab = 'today';

function defaultState() {
  return { profile: null, days: {}, myList: [], recent: {}, photoKeepDays: 30 };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const s = Object.assign(defaultState(), JSON.parse(raw));
    // v1.1 までの「マイ食品」をマイリスト（市販品）へ移す
    if (Array.isArray(s.myFoods)) {
      for (const m of s.myFoods) {
        if (!s.myList.some(x => x.id === m.id)) {
          s.myList.push({ id: m.id, kind: 'prod', name: m.name, unit: m.unit || '1食', basis: m.basis === '100g' ? '100g' : 'unit', protein: Number(m.protein) || 0, defGrams: 100 });
        }
      }
      delete s.myFoods;
    }
    return s;
  } catch (e) {
    return defaultState();
  }
}
function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('保存できませんでした（ブラウザの保存領域を確認してください）');
  }
}

/* ---------- 便利関数 ---------- */
function $(s, r = document) { return r.querySelector(s); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function r1(n) { return Math.round(n * 10) / 10; }
function fmt(n) { return r1(n).toFixed(1).replace(/\.0$/, ''); }
function pad(n) { return String(n).padStart(2, '0'); }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return dateStr(new Date()); }
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); }
function dateLabel(s) {
  const d = parseDate(s);
  const wd = '日月火水木金土'[d.getDay()];
  const t = todayStr();
  const prefix = s === t ? 'きょう ' : s === addDays(t, -1) ? 'きのう ' : '';
  return `${prefix}${d.getMonth() + 1}/${d.getDate()}(${wd})`;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, Math.max(2200, String(msg).length * 90));
}

/* カタカナ→ひらがな、全角半角統一、記号・空白除去 */
function norm(s) {
  return String(s).normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s\[\]<>・、,，。]/g, '');
}
// 括弧（ ）は残す（"まぐろ類)缶詰" のような言い換えに使うため）
const NORM_ALIASES = Object.fromEntries(
  Object.entries(ALIASES).map(([k, v]) => [norm(k), v.map(norm)])
);
const ALIAS_KEYS = Object.keys(NORM_ALIASES).sort((a, b) => b.length - a.length);

function splitName(name) {
  // 先頭の ＜…＞ や （…） を分類として分ける
  let rest = name.trim();
  const sub = [];
  let m;
  while ((m = rest.match(/^[＜（]([^＞）]+)[＞）]\s*/))) {
    sub.push(m[1]);
    rest = rest.slice(m[0].length);
  }
  return { main: rest, sub: sub.join('・') };
}

/* ---------- 必要量の計算 ---------- */
function bracketIndex(age) {
  return DRI.brackets.findIndex(([lo, hi]) => age >= lo && age <= hi);
}
function computeTargets(p) {
  if (!p || !p.age) return null;
  const age = Number(p.age);
  if (!(age >= 1)) return { unsupported: true };
  const i = bracketIndex(Math.floor(age));
  if (i < 0) return { unsupported: true };
  const sex = p.sex === 'f' ? 'f' : 'm';
  const add = sex === 'f' && ADD[p.status] ? ADD[p.status] : ADD.none;
  const rdaBase = DRI[sex].rda[i];
  const earBase = DRI[sex].ear[i];
  const w = Number(p.weight) || 0;
  const t = {
    bracket: DRI.brackets[i][2],
    sexLabel: sex === 'f' ? '女性' : '男性',
    rda: rdaBase + add.rda,
    ear: earBase + add.ear,
    addLabel: add.label,
    addRda: add.rda,
    goalPct: DRI.goal[i],
    weight: w || null,
    weightRef: null,
    frail: null,
    age,
  };
  if (age >= 18 && w > 0) {
    // 切上げ（食事摂取基準の丸め方に合わせる）
    t.weightRef = Math.ceil(w * ADULT_EAR_PER_KG * RDA_FACTOR) + add.rda;
  }
  if (age >= 65 && w > 0) {
    t.frail = Math.ceil(w * FRAIL_PER_KG);
  }
  return t;
}

/* ---------- 記録 ---------- */
function dayEntries(d) { return state.days[d] || []; }
function dayTotal(d) { return r1(dayEntries(d).reduce((a, e) => a + (Number(e.protein) || 0), 0)); }
function mealTotal(d, meal) { return r1(dayEntries(d).filter(e => e.meal === meal).reduce((a, e) => a + e.protein, 0)); }

function addEntry(d, entry) {
  if (!state.days[d]) state.days[d] = [];
  state.days[d].push(Object.assign({ id: uid() }, entry));
  if (entry.code) {
    const r = state.recent[entry.code] || { n: 0 };
    state.recent[entry.code] = Object.assign({}, r, { n: r.n + 1, g: entry.grams, t: Date.now() });
  }
  if (entry.mlId) {
    const k = 'ml:' + entry.mlId;
    const r = state.recent[k] || { n: 0 };
    state.recent[k] = { n: r.n + 1, t: Date.now() };
  }
  if (entry.refId) {
    const k = `${entry.kind}:${entry.refId}`;
    const r = state.recent[k] || { n: 0 };
    state.recent[k] = { n: r.n + 1, v: entry.basis === '100g' ? entry.grams : entry.qty, t: Date.now() };
  }
  saveState();
}
function updateEntry(d, id, patch) {
  const arr = dayEntries(d);
  const e = arr.find(x => x.id === id);
  if (e) Object.assign(e, patch);
  saveState();
}
function removeEntry(d, id) {
  state.days[d] = dayEntries(d).filter(x => x.id !== id);
  if (!state.days[d].length) delete state.days[d];
  saveState();
}
function proteinFor(food, grams) { return r1(food.p * grams / 100); }

/* ---------- 食品データの読込 ---------- */
async function loadFoods() {
  try {
    const res = await fetch('foods.json');
    const data = await res.json();
    foods = data.foods.map(([code, g, name, p, f, ml, rate]) => {
      const { main, sub } = splitName(name);
      return { code, g, name, p, f, ml, rate: rate || null, main, sub, group: data.groups[g], key: norm(name) };
    });
    foodByCode = new Map(foods.map(x => [x.code, x]));
    foodsReady = true;
    render();
  } catch (e) {
    toast('食品データを読み込めませんでした');
  }
}

/* ---------- 検索 ---------- */
function tokenize(q) {
  const raw = norm(q.replace(/[　]/g, ' ')).length ? q.normalize('NFKC').split(/\s+/).map(norm).filter(Boolean) : [];
  const out = [];
  for (const t of raw) {
    // 「鶏むね」のように言い換え語＋残りがくっついている場合は分割
    const k = ALIAS_KEYS.find(k => t.includes(k) && t !== k);
    if (k) {
      out.push(k);
      t.split(k).filter(Boolean).forEach(x => out.push(x));
    } else out.push(t);
  }
  return out;
}
const STAPLE_CODES = new Set(STAPLES.map(s => s.code));
function searchFoods(q) {
  const toks = tokenize(q);
  if (!toks.length) return [];
  const alts = toks.map(t => NORM_ALIASES[t] || [t]); // 言い換えがある語は言い換え先で探す（自分自身を含めたい語は ALIASES 側に書く）
  const res = [];
  for (const f of foods) {
    let ok = true;
    for (const a of alts) {
      if (!a.some(x => f.key.includes(x))) { ok = false; break; }
    }
    if (ok) res.push(f);
  }
  const rec = state.recent;
  res.sort((a, b) => {
    const sa = (STAPLE_CODES.has(a.code) ? 0 : 2) - (rec[a.code] ? 1 : 0);
    const sb = (STAPLE_CODES.has(b.code) ? 0 : 2) - (rec[b.code] ? 1 : 0);
    if (sa !== sb) return sa - sb;
    return a.name.length - b.name.length;
  });
  return res.slice(0, 60);
}

/* =========================================================
   描画
   ========================================================= */
function render() {
  $('#datenav').hidden = currentTab !== 'today';
  $('#dateLabel').textContent = dateLabel(viewDate);
  $('#todayBtn').hidden = viewDate === todayStr();
  document.body.classList.toggle('not-today', viewDate !== todayStr());
  if (currentTab === 'today') renderToday();
  if (currentTab === 'history') renderHistory();
  if (currentTab === 'settings') renderSettings();
}

function ringSvg(ratio) {
  // 水位で見せる：丸い水槽にたんぱく質の量だけ水がたまる。届くと満水（金の縁）
  const v = Math.max(0, Math.min(1, ratio));
  const y = v >= 1 ? -8 : 124 - 116 * v;
  const wave = (c) => `<path d="M0 6 Q16.5 0 33 6 T66 6 T99 6 T132 6 T165 6 T198 6 T231 6 T264 6 V140 H0Z" fill="${c}"/>`;
  // たんぱく質がたまるほど、水の中のめだかが増える（届くと4匹）
  const spots = [[0.3, 74, 93, 30], [0.45, 22, 99, 26], [0.6, 48, 106, 22], [1, 86, 104, 20]];
  const fish = spots.filter(s => v >= s[0]).map((s, i) =>
    `<image class="fishy" style="animation-delay:-${i * 0.9}s" href="characters/medaka-kihon.png" x="${s[1]}" y="${s[2]}" width="${s[3]}" height="${(s[3] * 0.664).toFixed(1)}"/>`).join('');
  return `<svg viewBox="0 0 132 132" aria-hidden="true">
    <defs><clipPath id="pnClip"><circle cx="66" cy="66" r="59"/></clipPath></defs>
    <circle cx="66" cy="66" r="59" fill="var(--track)" opacity=".45"/>
    <g clip-path="url(#pnClip)">
      <g transform="translate(0,${(y - 3).toFixed(1)})"><g class="wv2">${wave('var(--w2)')}</g></g>
      <g transform="translate(0,${y.toFixed(1)})"><g class="wv">${wave('var(--w1)')}</g></g>
      ${fish}
    </g>
    <circle cx="66" cy="66" r="62" fill="none" stroke="${ratio >= 1 ? 'var(--gold)' : 'var(--primary)'}" stroke-width="5"/>
  </svg>`;
}

// めだかのひとこと（1画面に1つ）
function hitokoto(ratio) {
  const m = ratio <= 0 ? ['まずは ひと口から。', 'kihon']
    : ratio < 0.5 ? ['いい調子。ゆっくりいこうね。', 'kihon']
    : ratio < 1 ? ['もうすこし。ぷくぷく。', 'smile']
    : ['届いたよ。おつかれさま。', 'jump'];
  return `<div class="hito"><img src="characters/medaka-${m[1]}.png" alt=""><span>${m[0]}</span></div>`;
}

function renderToday() {
  const el = $('#tab-today');
  const t = computeTargets(state.profile);
  const total = dayTotal(viewDate);
  let html = '';

  if (!t) {
    html += `<div class="card welcome">
      <h2>はじめに</h2>
      <p>年齢と性別を入れると、1日に必要なたんぱく質の量（推奨量）を表示します。</p>
      <p><button class="btn ghost small" style="background:#fff" data-go="settings">年齢・性別を入れる</button></p>
    </div>`;
  } else if (t.unsupported) {
    html += `<div class="card"><p>このツールは1歳以上が対象です。乳児の目安量は「設定・出典」を参照してください。</p></div>`;
  }

  // サマリー
  if (t && !t.unsupported) {
    const target = t.rda;
    const remain = r1(target - total);
    let rows = `<div class="target-row main"><span>推奨量<span class="tiny muted">（${t.bracket}${t.sexLabel}${t.addLabel ? '・' + t.addLabel : ''}）</span></span><b>${target}g</b></div>`;
    if (t.weightRef) rows += `<div class="target-row"><span>体重からの参考値<span class="tiny muted">（${fmt(t.weight)}kg）</span></span><b>${t.weightRef}g</b></div>`;
    if (t.frail) rows += `<div class="target-row frail"><span>フレイル予防の参考<span class="tiny muted">（1.2g/kg）</span></span><b>${t.frail}g</b></div>`;
    if (t.age >= 65 && !t.weight) rows += `<div class="target-row"><span class="small muted">体重を入れると、フレイル予防の参考量（1.2g/kg）も表示します</span></div>`;

    const maxV = Math.max(target, t.frail || 0, total) * 1.08 || 1;
    let marks = '';
    if (t.frail && t.frail !== target) marks += `<div class="mark" style="left:${(t.frail / maxV) * 100}%"><span>${t.frail}g</span></div>`;
    marks += `<div class="mark" style="left:${(target / maxV) * 100}%;background:var(--primary)"><span style="color:var(--primary)">${target}g</span></div>`;

    html += `<div class="card">
      <div class="summary">
        <div class="ring">${ringSvg(total / target)}
          <div class="center"><div class="big">${fmt(total)}</div><div class="unit">g / ${target}g</div></div>
        </div>
        <div class="targets">${rows}</div>
      </div>
      <div class="bar"><div class="fill" style="width:${(total / maxV) * 100}%"></div>${marks}</div>
      <div style="height:14px"></div>
      ${hitokoto(total / target)}
      ${remain > 0
        ? `<div class="remain">推奨量まで あと <span style="color:var(--accent)">${fmt(remain)}g</span></div>`
        : `<div class="remain done">推奨量に届きました（+${fmt(-remain)}g）</div>`}
      ${t.frail && total >= target && total < t.frail ? `<div class="small muted">フレイル予防の参考量（${t.frail}g）まで あと ${fmt(t.frail - total)}g</div>` : ''}
    </div>`;

    if (remain > 0 && foodsReady) html += renderSuggestions(remain);
  }

  // 写真
  html += `<div class="photo-bar">
    <button class="btn ghost small" id="photoAddBtn">📷 食べたものの写真を入れる</button>
    <span class="tiny muted">撮った時間で朝・昼・夕・間食に振り分けます</span>
  </div>`;

  // 食事
  for (const [m, label] of MEALS) {
    const list = dayEntries(viewDate).filter(e => e.meal === m);
    html += `<div class="card">
      <div class="meal-head"><h2>${label}</h2><span class="meal-total">${fmt(mealTotal(viewDate, m))}g</span></div>
      <div class="pstrip" data-pmeal="${m}"></div>
      ${list.map(e => `<button class="entry" data-edit="${e.id}">
          <span class="nm"><div>${esc(e.name)}</div><div class="tiny muted">${esc(entryAmountLabel(e))}</div></span>
          <span class="pg">${fmt(e.protein)}g</span>
        </button>`).join('')}
      <div class="meal-actions">
        <button class="btn small" data-add="${m}">＋ 追加</button>
        <button class="btn ghost small" data-copy="${m}">前日と同じ</button>
      </div>
    </div>`;
  }
  html += `<p class="tiny muted" style="text-align:center">食品の値：日本食品標準成分表（八訂）増補2023年から引用</p>`;
  el.innerHTML = html;
  fillPhotoStrips();
}

function renderSuggestions(remain) {
  const items = SUGGEST_CODES.map(c => {
    const f = foodByCode.get(c);
    const st = STAPLES.find(x => x.code === c);
    const u = unitsFor(f)[0];
    if (!f || !st || !u) {
      if (!f || !st) return null;
      // 目安量がない食品は100gで
      const per = proteinFor(f, 100);
      return { f, label: st.label, uLabel: '100g', g: 100, per, need: `約${Math.ceil((remain / f.p) * 100 / 10) * 10}g` };
    }
    const per = proteinFor(f, u.g);
    const need = u.c ? `約${fmt(Math.ceil((remain / per) * 2) / 2)}${u.c}` : `約${Math.ceil((remain / f.p) * 100 / 10) * 10}g`;
    return { f, label: st.label, uLabel: u.l, g: u.g, per, need };
  }).filter(Boolean);
  return `<div class="card">
    <h2>あと${fmt(remain)}gをとるなら</h2>
    <div class="sugg">
      ${items.map(x => `<button data-quick="${x.f.code}">
        <b>${esc(x.label)}</b>
        ${esc(x.uLabel)}で${fmt(x.per)}g<br><span class="muted">→ ${x.need}分</span>
      </button>`).join('')}
    </div>
    <div class="tiny muted" style="margin-top:6px">どれか1つでとる場合の量です。タップで記録できます。</div>
  </div>`;
}

function renderHistory() {
  const el = $('#tab-history');
  const t = computeTargets(state.profile);
  const target = t && !t.unsupported ? t.rda : null;
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(addDays(todayStr(), -i));
  const vals = days.map(d => ({ d, v: dayTotal(d), has: dayEntries(d).length > 0 }));
  const maxV = Math.max(target || 0, ...vals.map(x => x.v), 10) * 1.1;
  const recorded = vals.filter(x => x.has);
  const avg = recorded.length ? recorded.reduce((a, x) => a + x.v, 0) / recorded.length : 0;
  const ok = target ? recorded.filter(x => x.v >= target).length : 0;

  let html = `<div class="card">
    <h2>直近14日</h2>
    <div class="chart">
      ${target ? `<div class="tline" style="bottom:${(target / maxV) * 100}%"><span>推奨量 ${target}g</span></div>` : ''}
      ${vals.map(x => `<button class="col" data-day="${x.d}" aria-label="${x.d} ${fmt(x.v)}g">
          <div class="b ${target && x.v >= target ? 'ok' : ''} ${x.d === todayStr() ? 'today' : ''}" style="height:${(x.v / maxV) * 100}%"></div>
        </button>`).join('')}
    </div>
    <div class="chart-days">${vals.map(x => `<span>${parseDate(x.d).getDate()}</span>`).join('')}</div>
    <div class="tiny muted">棒をタップするとその日の記録を開きます</div>
  </div>
  <div class="card">
    <div class="stats">
      <div><b>${recorded.length}</b><span class="tiny muted">記録した日</span></div>
      <div><b>${fmt(avg)}g</b><span class="tiny muted">平均（記録日）</span></div>
      <div><b>${target ? ok : '-'}</b><span class="tiny muted">推奨量に届いた日</span></div>
    </div>
  </div>`;

  const allDays = Object.keys(state.days).sort().reverse().slice(0, 60);
  html += `<div class="card daylist"><h2>記録一覧</h2>
    ${allDays.length ? allDays.map(d => `<button class="row" data-day="${d}"><span>${dateLabel(d)}</span><b>${fmt(dayTotal(d))}g</b></button>`).join('') : '<div class="empty">まだ記録がありません</div>'}
  </div>`;
  el.innerHTML = html;
}

function renderSettings() {
  const el = $('#tab-settings');
  photoCount().then(n => { const x = $('#photoCountLabel'); if (x) x.textContent = `保存中の写真：${n}枚`; });
  const p = state.profile || {};
  const t = computeTargets(state.profile);
  el.innerHTML = `
  <div class="card">
    <h2>あなたの情報</h2>
    <form id="profileForm">
      <div class="field"><label for="age">年齢</label>
        <input id="age" name="age" type="number" inputmode="numeric" min="1" max="120" value="${esc(p.age || '')}" placeholder="例：45" required></div>
      <div class="field"><label>性別</label>
        <div class="radio-row">
          <label><input type="radio" name="sex" value="m" ${p.sex === 'm' ? 'checked' : ''} required>男性</label>
          <label><input type="radio" name="sex" value="f" ${p.sex === 'f' ? 'checked' : ''}>女性</label>
        </div></div>
      <div class="field"><label for="weight">体重（任意）</label>
        <input id="weight" name="weight" type="number" inputmode="decimal" step="0.1" min="10" max="250" value="${esc(p.weight || '')}" placeholder="例：55">
        <div class="hint">18歳以上は体重からの参考値、65歳以上はフレイル予防の参考量（1.2g/kg）も表示します</div></div>
      <div class="field" id="statusField" ${p.sex === 'f' ? '' : 'hidden'}><label for="status">妊娠・授乳</label>
        <select id="status" name="status">
          ${Object.entries(ADD).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${k === 'none' ? '該当しない' : v.label}</option>`).join('')}
        </select></div>
      <button class="btn block" type="submit">保存</button>
    </form>
  </div>

  ${t && !t.unsupported ? `<div class="card">
    <h2>あなたの目安</h2>
    <div class="target-row main"><span>推奨量</span><b>${t.rda}g/日</b></div>
    <div class="target-row"><span>推定平均必要量</span><b>${t.ear}g/日</b></div>
    ${t.weightRef ? `<div class="target-row"><span>体重からの参考値</span><b>${t.weightRef}g/日</b></div>` : ''}
    ${t.frail ? `<div class="target-row frail"><span>フレイル予防の参考（1.2g/kg）</span><b>${t.frail}g/日</b></div>` : ''}
    <div class="target-row"><span>目標量（参考）</span><b>${t.goalPct}%エネルギー</b></div>
    <p class="small muted" style="margin-bottom:0">
      <b>推奨量</b>：ほとんどの人（97〜98%）が不足しない量。${t.bracket}・${t.sexLabel}の表の値${t.addRda ? `に${t.addLabel}の付加量 +${t.addRda}g を加えた値` : ''}です。<br>
      <b>推定平均必要量</b>：半数の人が必要量を満たす量。<br>
      ${t.weightRef ? `<b>体重からの参考値</b>：成人の推奨量の計算式（0.73g/kg × 1.25）をあなたの体重に当てはめた値です。表の値は「参照体重」で計算されています。<br>` : ''}
      ${t.frail ? `<b>フレイル予防の参考</b>：食事摂取基準では、高齢者は推奨量より多め（1.2g/kg体重/日以上）にとるとフレイル・サルコペニアを予防できる可能性がある、とされています（確定した基準値ではありません）。<br>` : ''}
      <b>目標量</b>：生活習慣病などの予防のため、1日のエネルギーのうちたんぱく質でとる割合です。
    </p>
  </div>` : ''}

  <div class="card">
    <h2>マイリスト</h2>
    <p class="small muted" style="margin-top:0">よく食べるものを入れておくと、追加画面からタップ1回で記録できます。食材は記録するときの「☆ この量でマイリストへ」、市販品・メニューは下のボタンから登録します。</p>
    ${state.myList.length ? mlSorted().map(it => `<button class="entry" data-mledit="${it.id}">
      <span class="nm"><div>${esc(it.name)}</div><div class="tiny muted">${esc(mlAmountLabel(it))}・${ML_KIND_LABEL[it.kind]}</div></span><span class="pg">${foodsReady || it.kind !== 'food' ? fmt(mlProteinShown(it)) + 'g' : ''}</span></button>`).join('') : '<div class="empty small">まだありません</div>'}
    <div class="meal-actions"><button class="btn small" data-mlnew="1">＋ 市販品・メニューを登録</button></div>
  </div>

  <div class="card">
    <h2>写真</h2>
    <p class="small muted" style="margin-top:0">食べたものを思い出すための写真です。縮小してこの端末の中だけに保存し、外部には送りません。バックアップには含まれません。</p>
    <div class="field"><label for="keepDays">写真を残す期間</label>
      <select id="keepDays">
        ${[[7, '7日'], [30, '30日'], [90, '90日'], [0, '無期限（自分で削除）']].map(([v, l]) => `<option value="${v}" ${Number(state.photoKeepDays == null ? 30 : state.photoKeepDays) === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <div class="hint">期間を過ぎた写真は、次に開いたときに自動で消えます（記録は消えません）</div></div>
    <div class="small muted" id="photoCountLabel"></div>
  </div>

  <div class="card">
    <h2>データの保存</h2>
    <p class="small muted" style="margin-top:0">記録はこの端末のブラウザの中だけに保存され、外部には送信されません。機種変更やブラウザのデータ削除で消えるため、ときどきバックアップしてください。</p>
    <div class="meal-actions" style="flex-wrap:wrap">
      <button class="btn small" id="exportBtn">バックアップを保存</button>
      <button class="btn ghost small" id="importBtn">バックアップから復元</button>
      <input type="file" id="importFile" accept="application/json,.json" hidden>
    </div>
    <div class="meal-actions"><button class="btn danger small" id="wipeBtn">すべてのデータを削除</button></div>
  </div>

  <div class="card src">
    <h2>ご注意</h2>
    <p>このツールは健康な人が食事のたんぱく質量の目安を知るためのものです。医療や栄養指導の代わりにはなりません。</p>
    <p><b>腎臓病などでたんぱく質の制限や管理を受けている人は、このツールの値ではなく主治医・管理栄養士の指示を優先してください。</b>（食事摂取基準でも、疾患の管理を目的とした制限や多量摂取が必要な場合はそちらを優先すべきとされています）</p>
    <p>食品の値は可食部（食べる部分）100gあたりの平均的な値です。実際の食品とは品種・調理法などで差があります。「推定」と表示された値は、成分表で推計値とされているものです。</p>

    <h2 style="margin-top:16px">出典</h2>
    <h3>必要量</h3>
    <p>厚生労働省「日本人の食事摂取基準（2025年版）」策定検討会報告書（令和6年10月）各論 1-2 たんぱく質</p>
    <p class="tiny muted">推奨量・推定平均必要量（p.103の表）／成人の維持必要量 0.73g/kg体重/日（p.90）／推奨量算定係数 1.25（p.92）／高齢者の1.2g/kg体重/日（p.95）／疾患管理の優先（p.96）／目標量（p.95〜96, p.103）</p>
    <p class="tiny muted">乳児（1歳未満）の目安量：0〜5か月 10g、6〜8か月 15g、9〜11か月 25g（p.103）</p>
    <h3>食品のたんぱく質量</h3>
    <p>日本食品標準成分表（八訂）増補2023年から引用（文部科学省 科学技術・学術審議会 資源調査分科会、2026年3月27日掲載のデータ）。「たんぱく質」の列の値を使用。</p>
    <h3>個数で入れるときの重さ</h3>
    <p>卵：農林水産省「鶏卵の規格」（畜産物の価格安定に関する法律施行規則の規定に基づく鶏卵の規格）の重量区分（例：M 58g以上64g未満）の中央値から、成分表の廃棄率（殻）を除いて計算。目玉焼きなどは、さらに成分表の重量変化率をかけています。</p>
    <p>牛乳200mL：成分表の備考（100mL＝103.2g）から計算。</p>
    <p>調理前の重さで入れる場合と「1本分」「乾めん100g分」など：日本食品標準成分表（八訂）増補2023年 第1章「調理方法の概要及び重量変化率表」の重量変化率を使って換算。</p>
    <p>ごはん茶碗1杯、食パン1枚、納豆1パック、豆腐1/2丁、調理前の量（ささみ1本50gなど）は、このツール独自の一般的な目安で、公的な値ではありません。</p>
    <p class="tiny muted">たんぱく質ノート v1.3.1</p>
  </div>`;
}

/* =========================================================
   シート（追加・編集）
   ========================================================= */
let sheetCtx = null;
function openSheet(title, bodyHtml, onMount) {
  const sh = $('#sheet');
  sh.innerHTML = `<div class="sheet-head"><h3>${title}</h3><button class="close-x" data-close="1" aria-label="閉じる">✕</button></div>
    <div class="sheet-body">${bodyHtml}</div>`;
  sh.hidden = false;
  $('#sheetBackdrop').hidden = false;
  document.body.style.overflow = 'hidden';
  if (onMount) onMount(sh);
}
function closeSheet() {
  $('#sheet').hidden = true;
  $('#sheetBackdrop').hidden = true;
  document.body.style.overflow = '';
  sheetCtx = null;
}

/* --- 食品を探す --- */
function openAdd(meal) {
  const mode = state.myList.length ? 'ml' : historyItems().length ? 'hist' : 'search';
  sheetCtx = { meal, mode, q: '' };
  const segs = [['ml', 'マイリスト'], ['hist', '履歴'], ['search', '食材']];
  openSheet(`${mealLabel(meal)}に追加`, `
    <input class="search" id="q" type="search" placeholder="食材名で検索（例：鶏むね、納豆、さけ）" autocomplete="off">
    ${photoStripForSheet()}
    <div class="seg" id="seg">${segs.map(([k, l]) => `<button data-mode="${k}" class="${k === mode ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="results"></div>`, sh => {
    const q = $('#q', sh);
    q.addEventListener('input', () => {
      sheetCtx.q = q.value;
      if (sheetCtx.mode !== 'search' && q.value.trim()) { sheetCtx.mode = 'search'; setSeg('search'); }
      renderResults();
    });
    setSeg(mode);
    renderResults();
  });
}
function mealLabel(m) { return (MEALS.find(x => x[0] === m) || [, ''])[1]; }
function setSeg(mode) {
  document.querySelectorAll('#seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
}

function foodRow(f, extra = '') {
  return `<button class="food" data-pick="${f.code}" ${extra}>
    <span class="nm"><div>${esc(f.main)}</div><div class="sub">${esc([f.group, f.sub].filter(Boolean).join('・'))}${f.f === 1 ? '・推定値' : ''}</div></span>
    <span class="p">${fmt(f.p)}g<small>/100g</small></span>
  </button>`;
}

/* ---------- マイリスト ---------- */
const ML_KIND_LABEL = { food: '食材', prod: '市販品', menu: 'メニュー' };
function mlSorted() {
  return state.myList.slice().sort((a, b) => ((state.recent['ml:' + b.id] || {}).n || 0) - ((state.recent['ml:' + a.id] || {}).n || 0));
}
function mlAmountLabel(it) {
  if (it.kind === 'food') return it.desc || `${fmt(it.grams)}g`;
  if (it.kind === 'menu') return '1食';
  if (it.basis === '100g') return `${fmt(it.defGrams || 100)}g`;
  return it.unit || '1個';
}
/* マイリストの1件を、登録した量のまま記録データにする */
function mlEntry(it, meal) {
  if (it.kind === 'food') {
    const f = foodByCode.get(it.code);
    if (!f) return null;
    return { meal, mlId: it.id, code: it.code, name: it.name, grams: it.grams, protein: proteinFor(f, it.grams), amode: it.amode, ulabel: it.ulabel, count: it.count, raw: it.raw, desc: it.desc };
  }
  const item = mlItem(it);
  const is100 = item.basis === '100g';
  const v = is100 ? (it.defGrams || 100) : 1;
  return {
    meal, mlId: it.id, kind: it.kind, refId: it.id, name: it.name, unit: item.unit, basis: item.basis,
    perUnit: item.protein, qty: is100 ? null : v, grams: is100 ? v : null, protein: itemProtein(item, v),
  };
}
function mlItem(it) {
  if (it.kind === 'menu') return { kind: 'menu', id: it.id, name: it.name, unit: '1食', protein: it.protein, basis: 'unit' };
  return { kind: 'prod', id: it.id, name: it.name, unit: it.basis === '100g' ? '100g' : (it.unit || '1個'), protein: it.protein, basis: it.basis === '100g' ? '100g' : 'unit' };
}
function mlProteinShown(it) {
  const e = mlEntry(it, 'b');
  return e ? e.protein : 0;
}
function mlRow(it) {
  const p = foodsReady || it.kind !== 'food' ? `${fmt(mlProteinShown(it))}g` : '…';
  return `<div class="mlrow">
    <button class="food" data-mlrec="${it.id}">
      <span class="nm"><div>${esc(it.name)}</div><div class="sub">${esc(mlAmountLabel(it))}・${ML_KIND_LABEL[it.kind]}</div></span>
      <span class="p">${p} <span class="plus">＋</span></span>
    </button>
    <button class="adj" data-mladj="${it.id}" aria-label="量を変えて記録">量</button>
  </div>`;
}

/* 過去の記録から、同じ内容（同じ量）のものを1件ずつ新しい順に */
function entryKey(e) {
  if (e.code) return `c:${e.code}:${e.grams}:${e.desc || ''}`;
  return `${e.kind || 'my'}:${e.refId || e.myId || e.name}:${e.basis === '100g' ? e.grams : e.qty}`;
}
function historyItems(limit = 40) {
  const seen = new Set();
  const out = [];
  for (const d of Object.keys(state.days).sort().reverse()) {
    const arr = state.days[d];
    for (let k = arr.length - 1; k >= 0; k--) {
      const e = arr[k];
      const key = entryKey(e);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
function entryAmountLabel(e) {
  if (e.desc) return e.desc;
  if (e.code || e.basis === '100g') return `${fmt(e.grams)}g`;
  return `${fmt(e.qty)} × ${e.unit || '1食'}`;
}

function renderResults() {
  const box = $('#results');
  if (!box) return;
  const mode = sheetCtx.mode;
  if (mode === 'ml') {
    const list = mlSorted();
    box.innerHTML = (list.length
      ? `<div class="list-label">タップで${mealLabel(sheetCtx.meal)}に記録（登録した量）。「量」で量を変えて記録</div>` + list.map(mlRow).join('')
      : `<div class="empty">マイリストはまだ空です。<br>よく食べるものを入れておくと、ここからタップ1回で記録できます。<br><span class="small">食材は、記録するときの「☆ この量でマイリストへ」で入ります。</span></div>`) +
      `<div class="meal-actions"><button class="btn ghost small block" data-mlnew="1">＋ 市販品・メニューを登録</button></div>`;
    return;
  }
  if (mode === 'hist') {
    const list = historyItems();
    sheetCtx.hist = list;
    box.innerHTML = list.length
      ? `<div class="list-label">タップするとすぐ${mealLabel(sheetCtx.meal)}に記録します（同じ量）</div>` +
        list.map((e, i) => `<button class="food" data-hist="${i}">
          <span class="nm"><div>${esc(e.name)}</div><div class="sub">${esc(entryAmountLabel(e))}</div></span>
          <span class="p">${fmt(e.protein)}g <span class="plus">＋</span></span></button>`).join('')
      : '<div class="empty">まだ記録がありません。「食材」から探してください。</div>';
    return;
  }
  if (!foodsReady) { box.innerHTML = '<div class="empty">食品データを読み込み中…</div>'; return; }
  const q = sheetCtx.q.trim();
  if (!q) {
    const recent = Object.entries(state.recent)
      .filter(([k]) => foodByCode.has(k))
      .sort((a, b) => b[1].t - a[1].t).slice(0, 8).map(([k]) => foodByCode.get(k));
    let html = '';
    if (recent.length) html += `<div class="list-label">最近使った食材</div>` + recent.map(f => foodRow(f)).join('');
    html += `<div class="list-label">よく使う食材</div>` + STAPLES.map(s => {
      const f = foodByCode.get(s.code);
      return f ? `<button class="food" data-pick="${f.code}">
        <span class="nm"><div>${esc(s.label)}</div><div class="sub">${esc(f.main)}</div></span>
        <span class="p">${fmt(f.p)}g<small>/100g</small></span></button>` : '';
    }).join('');
    box.innerHTML = html;
    return;
  }
  const res = searchFoods(q);
  const nq = norm(q);
  const mine = state.myList.filter(it => norm(it.name).includes(nq));
  const regBtn = `<div class="meal-actions"><button class="btn ghost small block" data-mlnew="${esc(q)}">「${esc(q)}」を市販品・メニューとしてマイリストに登録</button></div>`;
  box.innerHTML =
    (mine.length ? `<div class="list-label">マイリスト</div>${mine.map(mlRow).join('')}<div class="list-label">食品成分表</div>` : '') +
    (res.length
      ? res.map(f => foodRow(f)).join('') + (res.length >= 60 ? '<div class="empty small">候補が多いので、言葉を足して絞り込んでください（例：「鶏 むね 皮なし」）</div>' : '') +
        `<div class="list-label">市販品・外食などで見つからないとき</div>${regBtn}`
      : `<div class="empty">成分表では見つかりませんでした。<br>ひらがなや別の言い方でも試してください（例：「とり」→「にわとり」、「ごはん」→「めし」）。</div>${regBtn}`);
}

/* --- 量を入れる（個数／g／調理前のg） --- */
function openAmount(code, opts = {}) {
  const f = foodByCode.get(code);
  if (!f) return;
  const staple = STAPLES.find(s => s.code === code);
  const units = unitsFor(f);
  const last = state.recent[code] || {};
  const editing = opts.entry || null;
  const src = editing || opts.preset || null; // 以前の入れ方を再現する
  let mode = units.length ? 'unit' : 'g';
  let unitIdx = 0, count = 1, value = 100, raw = 100, unit = 'g';
  if (src && src.amode) {
    mode = src.amode;
    if (mode === 'unit') { const k = units.findIndex(u => u.l === src.ulabel); unitIdx = k >= 0 ? k : 0; count = src.count || 1; if (k < 0) { mode = 'g'; value = src.grams; } }
    if (mode === 'raw') raw = src.raw || 100;
    if (mode === 'g') value = src.grams;
  } else if (src && src.grams) {
    mode = 'g'; value = src.grams;
  } else if (last.amode) {
    mode = last.amode === 'raw' && !f.rate ? 'g' : last.amode;
    if (mode === 'unit') { const k = units.findIndex(u => u.l === last.ulabel); unitIdx = k >= 0 ? k : 0; if (!units.length) mode = 'g'; }
    if (mode === 'raw') raw = last.raw || 100;
    if (mode === 'g') value = last.g || 100;
  }
  sheetCtx = Object.assign(sheetCtx || {}, {
    meal: editing ? editing.meal : (opts.meal || (sheetCtx && sheetCtx.meal) || guessMeal()),
    code, amode: mode, unitIdx, count, value, raw, unit, editing, units,
    mlId: editing ? editing.mlId : (opts.mlId || null),
    label: editing ? editing.name : (opts.label || null),
  });
  const title = editing ? '記録を修正' : esc(opts.label || (staple ? staple.label : f.main));
  openSheet(title, `
    ${photoStripForSheet()}
    <div class="small">${esc(f.name)}</div>
    <div class="tiny muted">100gあたり たんぱく質 ${fmt(f.p)}g${f.f === 1 ? '（推定値）' : f.f === 2 ? '（微量）' : ''}</div>
    <div class="meal-pick">${MEALS.map(([m, l]) => `<button class="chip ${m === sheetCtx.meal ? 'on' : ''}" data-meal="${m}">${l}</button>`).join('')}</div>
    <div class="seg" id="amodeSeg">
      ${units.length ? `<button data-amode="unit">個数で</button>` : ''}
      <button data-amode="g">重さ（g）で</button>
      ${f.rate ? `<button data-amode="raw">調理前の重さで</button>` : ''}
    </div>
    <div id="amodeBody"></div>
    <div class="result"><span>たんぱく質 <span class="tiny muted" id="gramsLabel"></span></span><b id="calc">0g</b></div>
    <button class="btn block" id="saveAmt">${editing ? '修正する' : '記録する'}</button>
    <div class="meal-actions"><button class="btn ghost small block" id="starBtn">☆ この量でマイリストへ</button></div>
    ${editing ? '<div class="meal-actions"><button class="btn danger small block" id="delEntry">この記録を削除</button></div>' : ''}
  `, () => renderAmountBody());
}
function renderAmountBody() {
  const c = sheetCtx;
  const f = foodByCode.get(c.code);
  document.querySelectorAll('#amodeSeg button').forEach(b => b.classList.toggle('on', b.dataset.amode === c.amode));
  const box = $('#amodeBody');
  if (c.amode === 'unit') {
    const u = c.units[c.unitIdx];
    box.innerHTML = `
      <div class="chips unit-chips">${c.units.map((x, i) => `<button class="chip ${i === c.unitIdx ? 'on' : ''}" data-uidx="${i}">${esc(x.l)}</button>`).join('')}</div>
      <div class="stepper">
        <button class="step" data-cnt="-0.5" aria-label="減らす">−</button>
        <div class="cnt"><b id="cntVal">${fmt(c.count)}</b><span>${esc(u.c ? u.c : '× ' + u.l)}</span></div>
        <button class="step" data-cnt="0.5" aria-label="増やす">＋</button>
      </div>
      <div class="note">${esc(unitNote(u, f))}</div>`;
  } else if (c.amode === 'raw') {
    box.innerHTML = `
      <div class="amount-box"><input id="rawAmt" type="number" inputmode="decimal" min="0" step="any" value="${fmt(c.raw)}"><span class="u">g</span></div>
      <div class="chips">${[50, 80, 100, 150, 200].map(g => `<button class="chip" data-rawg="${g}">${g}g</button>`).join('')}</div>
      <div class="note">肉のパックの表示など、調理する前（生・乾めんなど）の重さを入れてください。成分表の重量変化率（${f.rate}%）で、この料理の重さに換算します。</div>`;
    $('#rawAmt').addEventListener('input', ev => { c.raw = Number(ev.target.value) || 0; updAmount(); });
  } else {
    box.innerHTML = `
      <div class="amount-box">
        <input id="amt" type="number" inputmode="decimal" min="0" step="any" value="${fmt(c.value)}">
        ${f.ml ? `<div class="seg" style="margin:0;flex:none"><button data-unit="g" class="${c.unit === 'g' ? 'on' : ''}">g</button><button data-unit="mL" class="${c.unit === 'mL' ? 'on' : ''}">mL</button></div>` : '<span class="u">g</span>'}
      </div>
      <div class="chips">${[50, 100, 150, 200].map(g => `<button class="chip" data-g="${g}">${g}${f.ml && c.unit === 'mL' ? 'mL' : 'g'}</button>`).join('')}</div>
      <div class="tiny muted" style="margin-top:6px">食べる部分の重さを入れてください</div>`;
    $('#amt').addEventListener('input', ev => { c.value = Number(ev.target.value) || 0; updAmount(); });
  }
  updAmount();
}
function updAmount() {
  const f = foodByCode.get(sheetCtx.code);
  const g = currentGrams();
  $('#calc').textContent = `${fmt(proteinFor(f, g))}g`;
  $('#gramsLabel').textContent = g > 0 && sheetCtx.amode !== 'g' ? `（${fmt(g)}g）` : '';
  $('#saveAmt').disabled = !(g > 0);
  $('#starBtn').disabled = !(g > 0);
}
function currentGrams() {
  const c = sheetCtx;
  const f = foodByCode.get(c.code);
  if (c.amode === 'unit') { const u = c.units[c.unitIdx]; return u ? r1(u.g * c.count) : 0; }
  if (c.amode === 'raw') return f.rate ? r1(c.raw * f.rate / 100) : 0;
  const v = Number(c.value) || 0;
  return c.unit === 'mL' && f.ml ? r1(v * f.ml / 100) : v;
}
/* 記録に残す「どう入れたか」 */
function amountMeta() {
  const c = sheetCtx;
  const g = currentGrams();
  if (c.amode === 'unit') {
    const u = c.units[c.unitIdx];
    return { amode: 'unit', ulabel: u.l, count: c.count, desc: `${u.l}${c.count !== 1 ? ' ×' + fmt(c.count) : ''}（${fmt(g)}g）` };
  }
  if (c.amode === 'raw') return { amode: 'raw', raw: c.raw, desc: `調理前${fmt(c.raw)}g（${fmt(g)}g）` };
  return { amode: 'g', desc: c.unit === 'mL' ? `${fmt(c.value)}mL（${fmt(g)}g）` : `${fmt(g)}g` };
}
function guessMeal() {
  const h = new Date().getHours();
  if (h < 10) return 'b';
  if (h < 15) return 'l';
  if (h < 17) return 's';
  return 'd';
}

/* --- マイリストの登録・編集 --- */
function starCurrentFood() {
  const f = foodByCode.get(sheetCtx.code);
  const grams = currentGrams();
  if (!f || !(grams > 0)) return;
  const meta = amountMeta();
  if (state.myList.some(x => x.kind === 'food' && x.code === f.code && Math.abs(x.grams - grams) < 0.05)) {
    toast('同じ量ですでにマイリストに入っています'); return;
  }
  const st = STAPLES.find(x => x.code === f.code);
  const it = Object.assign({ id: uid(), kind: 'food', code: f.code, grams, name: sheetCtx.label || (st ? st.label : f.main) }, meta);
  state.myList.push(it);
  saveState();
  toast(`マイリストに入れました（${it.name} ${mlAmountLabel(it)}）`);
}

/* opts: { name: 初期の名前, meal: 追加画面から開いたときの食事 } */
function openMlForm(id, opts = {}) {
  const it = id ? state.myList.find(x => x.id === id) : null;
  const meal = opts.meal || null;
  if (it && it.kind === 'food') return openMlFoodForm(it);
  const kind = it ? it.kind : 'prod';
  const basis = it && it.basis === '100g' ? '100g' : 'unit';
  openSheet(it ? 'マイリストを編集' : 'マイリストに登録', `
    <form id="mlForm" novalidate>
      <div class="field"><label>種類</label>
        <div class="radio-row">
          <label><input type="radio" name="kind" value="prod" ${kind === 'prod' ? 'checked' : ''}>市販品</label>
          <label><input type="radio" name="kind" value="menu" ${kind === 'menu' ? 'checked' : ''}>メニュー</label>
        </div></div>
      <div class="field"><label for="mlName">名前</label><input id="mlName" maxlength="40" value="${esc(it ? it.name : (opts.name || ''))}" placeholder="例：サラダチキン プレーン／家の豚汁"></div>

      <div id="prodFields">
        <div class="field"><label>パッケージの表示</label>
          <div class="radio-row">
            <label><input type="radio" name="basis" value="unit" ${basis === 'unit' ? 'checked' : ''}>1個・1本などあたり</label>
            <label><input type="radio" name="basis" value="100g" ${basis === '100g' ? 'checked' : ''}>100gあたり</label>
          </div></div>
        <div class="field" id="unitField"><label for="mlUnit">単位</label><input id="mlUnit" maxlength="20" value="${esc(it && it.kind === 'prod' && basis === 'unit' ? it.unit : '1個')}" placeholder="例：1個、1本、1袋"></div>
        <div class="field" id="defField"><label for="mlDef">いつも食べる量（g）</label><input id="mlDef" type="number" inputmode="decimal" step="any" min="0" value="${esc(it && it.defGrams ? it.defGrams : 100)}">
          <div class="hint">タップ1回で記録するときの量です</div></div>
        <div class="label-sample">
          <div class="ls-title">見本：パッケージの栄養成分表示</div>
          <div class="ls-box"><div class="ls-head">栄養成分表示 <mark>1本（60g）あたり</mark></div>
            <div>エネルギー　　 98kcal</div><div><mark>たんぱく質　　 12.0g</mark></div><div>脂質　　　　　 3.1g</div></div>
          <div class="tiny">この例なら「1個・1本などあたり」を選び、単位「1本」、たんぱく質「12」と入れます。表示の見出しが「100gあたり」なら「100gあたり」を選んでください。</div>
        </div>
      </div>

      <div class="field"><label for="mlP" id="pLabel">たんぱく質（g）</label><input id="mlP" type="number" inputmode="decimal" step="any" min="0" value="${it ? esc(it.protein) : ''}" placeholder="例：12">
        <div class="hint" id="pHint"></div></div>
      <div class="form-err" id="mlErr" hidden></div>

      ${meal ? `<button class="btn block" type="submit" data-and="rec">登録して${mealLabel(meal)}に記録</button>
        <div class="meal-actions"><button class="btn ghost small block" type="submit" data-and="none">登録だけ</button></div>`
        : `<button class="btn block" type="submit" data-and="none">${it ? '保存' : '登録'}</button>`}
      ${it ? '<div class="meal-actions"><button type="button" class="btn danger small block" id="mlDel">マイリストから削除</button></div>' : ''}
    </form>`, sh => {
    const sync = () => {
      const k = sh.querySelector('input[name=kind]:checked').value;
      const b = sh.querySelector('input[name=basis]:checked').value;
      $('#prodFields', sh).hidden = k !== 'prod';
      $('#unitField', sh).hidden = b === '100g';
      $('#defField', sh).hidden = b !== '100g';
      const unit = $('#mlUnit', sh).value.trim() || '1個';
      $('#pLabel', sh).textContent = k === 'menu' ? '1食あたりのたんぱく質（g）' : b === '100g' ? '100gあたりのたんぱく質（g）' : `${unit}あたりのたんぱく質（g）`;
      $('#pHint', sh).textContent = k === 'menu' ? '外食の栄養表示や、レシピに書いてある1人分の値を入れてください' : '';
    };
    sh.querySelectorAll('input[name=kind],input[name=basis]').forEach(r => r.addEventListener('change', sync));
    $('#mlUnit', sh).addEventListener('input', sync);
    sync();
    let submitter = 'none';
    sh.querySelectorAll('button[type=submit]').forEach(b => b.addEventListener('click', () => { submitter = b.dataset.and; }));
    $('#mlForm', sh).addEventListener('submit', ev => {
      ev.preventDefault();
      const err = $('#mlErr', sh);
      const showErr = m => { err.textContent = m; err.hidden = false; };
      err.hidden = true;
      const k = sh.querySelector('input[name=kind]:checked').value;
      const b = k === 'prod' ? sh.querySelector('input[name=basis]:checked').value : 'unit';
      const name = $('#mlName', sh).value.trim();
      const pRaw = $('#mlP', sh).value.trim();
      const protein = Number(pRaw);
      const unit = k === 'menu' ? '1食' : b === '100g' ? '100g' : ($('#mlUnit', sh).value.trim() || '1個');
      const defGrams = Number($('#mlDef', sh).value) || 100;
      if (!name) return showErr('名前を入れてください');
      if (pRaw === '' || !(protein >= 0)) return showErr('たんぱく質の数字を入れてください');
      // 入力ミスのチェック
      if (b === '100g' && protein > 100) return showErr('100gあたりのたんぱく質が100gを超えることはありません。数字を確認してください');
      if (k === 'prod' && b === '100g' && !(defGrams > 0)) return showErr('いつも食べる量を入れてください');
      if (k === 'prod' && b === 'unit' && protein > 80 && !confirm(`${unit}あたり ${protein}g はかなり多い値です。「100gあたり」の表示ではありませんか？\nこのまま登録する場合は OK を押してください。`)) return;
      if (k === 'menu' && protein > 100 && !confirm(`1食あたり ${protein}g はかなり多い値です。このまま登録しますか？`)) return;
      const data = { kind: k, name, protein, basis: b, unit, defGrams: b === '100g' ? defGrams : undefined };
      let target;
      if (it) { Object.assign(it, data); target = it; }
      else { target = Object.assign({ id: uid() }, data); state.myList.push(target); }
      saveState();
      if (meal && submitter === 'rec') {
        const e = mlEntry(target, meal);
        addEntry(viewDate, e);
        toast(`${name} ${fmt(e.protein)}g を${mealLabel(meal)}に記録しました`);
        closeSheet(); render();
      } else if (meal) {
        toast('マイリストに登録しました');
        openAdd(meal); sheetCtx.mode = 'ml'; setSeg('ml'); renderResults();
      } else {
        toast(it ? '保存しました' : '登録しました');
        closeSheet(); render();
      }
    });
    const del = $('#mlDel', sh);
    if (del) del.addEventListener('click', () => deleteMl(it));
  });
}
function openMlFoodForm(it) {
  const f = foodByCode.get(it.code);
  openSheet('マイリストを編集', `
    <form id="mlFoodForm">
      <div class="small muted">${esc(f ? f.name : '')}</div>
      <div class="field" style="margin-top:8px"><label for="mfName">名前</label><input id="mfName" maxlength="40" required value="${esc(it.name)}"></div>
      <div class="field"><label for="mfG">量（g）</label><input id="mfG" type="number" inputmode="decimal" step="any" min="0" required value="${esc(it.grams)}"></div>
      <button class="btn block" type="submit">保存</button>
      <div class="meal-actions"><button type="button" class="btn danger small block" id="mlDel">マイリストから削除</button></div>
    </form>`, sh => {
    $('#mlFoodForm', sh).addEventListener('submit', ev => {
      ev.preventDefault();
      const g = Number($('#mfG', sh).value);
      const name = $('#mfName', sh).value.trim();
      if (!name || !(g > 0)) return;
      if (Math.abs(g - it.grams) > 0.05) Object.assign(it, { amode: 'g', desc: `${fmt(g)}g`, ulabel: null, count: null, raw: null });
      Object.assign(it, { name, grams: g });
      saveState(); toast('保存しました'); closeSheet(); render();
    });
    $('#mlDel', sh).addEventListener('click', () => deleteMl(it));
  });
}
function deleteMl(it) {
  if (!confirm(`「${it.name}」をマイリストから削除しますか？（これまでの記録は残ります）`)) return;
  state.myList = state.myList.filter(x => x.id !== it.id);
  saveState(); closeSheet(); render();
}

/* マイリストの市販品・メニューや、その記録の量を入れる。item = {kind, id, name, unit, protein, basis} */
function itemFromEntry(e) {
  return { kind: e.kind || 'my', id: e.refId || e.myId, name: e.name, unit: e.unit || '1食', protein: e.perUnit, basis: e.basis || 'unit' };
}
function openItemAmount(item, entry, defVal, mlId) {
  const is100 = item.basis === '100g';
  const meal = entry ? entry.meal : sheetCtx.meal;
  const val = entry ? (is100 ? entry.grams : entry.qty) : (defVal || (is100 ? 100 : 1));
  sheetCtx = { meal, item, val, editing: entry || null, mlId: entry ? entry.mlId : mlId };
  const chips = is100 ? [50, 100, 150, 200] : [0.5, 1, 1.5, 2, 3];
  openSheet(entry ? '記録を修正' : esc(item.name), `
    <div class="tiny muted">${is100 ? '100g' : esc(item.unit)}あたり たんぱく質 ${fmt(item.protein)}g</div>
    <div class="meal-pick">${MEALS.map(([mm, l]) => `<button class="chip ${mm === meal ? 'on' : ''}" data-meal="${mm}">${l}</button>`).join('')}</div>
    <div class="amount-box"><input id="qty" type="number" inputmode="decimal" min="0" step="any" value="${fmt(val)}"><span class="u">${is100 ? 'g' : '× ' + esc(item.unit)}</span></div>
    <div class="chips">${chips.map(q => `<button class="chip" data-q="${q}">${q}${is100 ? 'g' : ''}</button>`).join('')}</div>
    <div class="result"><span>たんぱく質</span><b id="calc">0g</b></div>
    <button class="btn block" id="saveMy">${entry ? '修正する' : '記録する'}</button>
    ${entry ? '<div class="meal-actions"><button class="btn danger small block" id="delEntry">この記録を削除</button></div>' : ''}
  `, sh => {
    const qty = $('#qty', sh);
    const upd = () => {
      $('#calc', sh).textContent = `${fmt(itemProtein(item, sheetCtx.val))}g`;
      $('#saveMy', sh).disabled = !(Number(sheetCtx.val) > 0);
    };
    qty.addEventListener('input', () => { sheetCtx.val = Number(qty.value) || 0; upd(); });
    upd();
  });
}
function itemProtein(item, val) {
  const v = Number(val) || 0;
  return r1(item.basis === '100g' ? item.protein * v / 100 : item.protein * v);
}

/* --- 記録の編集 --- */
function openEdit(id) {
  const e = dayEntries(viewDate).find(x => x.id === id);
  if (!e) return;
  if (e.code && foodByCode.has(e.code)) {
    sheetCtx = null;
    openAmount(e.code, { entry: e });
  } else if (e.perUnit != null) {
    openItemAmount(itemFromEntry(e), e);
  }
}

/* --- 履歴・マイリストから1タップで記録 --- */
function addFromHistory(i) {
  const src = sheetCtx.hist && sheetCtx.hist[i];
  if (!src) return;
  const c = Object.assign({}, src, { meal: sheetCtx.meal });
  delete c.id;
  addEntry(viewDate, c);
  toast(`${c.name} ${fmt(c.protein)}g を${mealLabel(c.meal)}に記録しました`);
  render();
}
function addFromMl(id) {
  const it = state.myList.find(x => x.id === id);
  if (!it) return;
  if (it.kind === 'food' && !foodsReady) { toast('食品データを読み込み中です'); return; }
  const e = mlEntry(it, sheetCtx.meal);
  if (!e) return;
  addEntry(viewDate, e);
  toast(`${e.name} ${fmt(e.protein)}g を${mealLabel(e.meal)}に記録しました`);
  render();
  renderResults();
}
function adjustMl(id) {
  const it = state.myList.find(x => x.id === id);
  if (!it) return;
  if (it.kind === 'food') {
    openAmount(it.code, { preset: it, mlId: it.id, label: it.name });
  } else {
    openItemAmount(mlItem(it), null, it.basis === '100g' ? (it.defGrams || 100) : 1, it.id);
  }
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* --- 前日コピー --- */
function copyPrevMeal(meal) {
  const prev = addDays(viewDate, -1);
  const src = dayEntries(prev).filter(e => e.meal === meal);
  if (!src.length) { toast(`前日の${mealLabel(meal)}の記録がありません`); return; }
  src.forEach(e => {
    const c = Object.assign({}, e);
    delete c.id;
    addEntry(viewDate, c);
  });
  toast(`前日の${mealLabel(meal)}（${src.length}件）をコピーしました`);
  render();
}

/* --- バックアップ --- */
function exportData() {
  downloadJson({ app: 'protein-note', version: 1, exportedAt: new Date().toISOString(), data: state }, `protein-note-backup-${todayStr()}.json`);
}
function importData(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const obj = JSON.parse(rd.result);
      const d = obj && obj.app === 'protein-note' ? obj.data : null;
      if (!d || typeof d.days !== 'object') throw new Error('bad');
      if (!confirm('今のデータをバックアップの内容で置き換えます。よろしいですか？')) return;
      state = Object.assign(defaultState(), d);
      saveState();
      toast('復元しました');
      render();
    } catch (e) {
      toast('このファイルは読み込めませんでした');
    }
  };
  rd.readAsText(file);
}

/* =========================================================
   イベント
   ========================================================= */
document.addEventListener('click', ev => {
  const b = ev.target.closest('button, [data-close]');
  if (!b) {
    if (ev.target.id === 'sheetBackdrop') closeSheet();
    if (ev.target.id === 'photoViewer') closePhotoViewer();
    return;
  }
  const ds = b.dataset;

  if (ds.tab) { switchTab(ds.tab); return; }
  if (ds.go) { switchTab(ds.go); return; }
  if (ds.close) { closeSheet(); return; }
  if (ds.add) { openAdd(ds.add); return; }
  if (ds.copy) { copyPrevMeal(ds.copy); return; }
  if (ds.edit) { openEdit(ds.edit); return; }
  if (ds.quick) { sheetCtx = { meal: guessMeal() }; openAmount(ds.quick); return; }
  if (ds.photo) { openPhotoViewer(ds.photo); return; }
  if (ds.pmove) { movePhoto(ds.pmove); return; }
  if (ds.day) { viewDate = ds.day; switchTab('today'); return; }
  if (ds.pick) { openAmount(ds.pick); return; }
  if (ds.hist) { addFromHistory(Number(ds.hist)); return; }
  if (ds.mlrec) { addFromMl(ds.mlrec); return; }
  if (ds.mladj) { adjustMl(ds.mladj); return; }
  if (ds.mlnew) {
    const fromAdd = sheetCtx && sheetCtx.meal && !sheetCtx.code && !sheetCtx.item ? sheetCtx.meal : null;
    openMlForm(null, { name: ds.mlnew !== '1' ? ds.mlnew : '', meal: fromAdd });
    return;
  }
  if (ds.mledit) { sheetCtx = null; openMlForm(ds.mledit); return; }
  if (ds.mode) { sheetCtx.mode = ds.mode; setSeg(ds.mode); renderResults(); return; }
  if (ds.meal && sheetCtx) {
    sheetCtx.meal = ds.meal;
    document.querySelectorAll('.meal-pick .chip').forEach(c => c.classList.toggle('on', c.dataset.meal === ds.meal));
    return;
  }
  if (ds.amode && sheetCtx && sheetCtx.code) {
    // 切り替えても重さを引き継ぐ
    const g = currentGrams();
    const f = foodByCode.get(sheetCtx.code);
    sheetCtx.amode = ds.amode;
    if (ds.amode === 'g') { sheetCtx.unit = 'g'; sheetCtx.value = g || 100; }
    if (ds.amode === 'raw' && f.rate && g) sheetCtx.raw = r1(g * 100 / f.rate);
    renderAmountBody();
    return;
  }
  if (ds.uidx && sheetCtx && sheetCtx.code) { sheetCtx.unitIdx = Number(ds.uidx); renderAmountBody(); return; }
  if (ds.cnt && sheetCtx && sheetCtx.code) {
    sheetCtx.count = Math.max(0.5, r1(sheetCtx.count + Number(ds.cnt)));
    $('#cntVal').textContent = fmt(sheetCtx.count);
    updAmount();
    return;
  }
  if (ds.rawg && sheetCtx && sheetCtx.code) { sheetCtx.raw = Number(ds.rawg); $('#rawAmt').value = ds.rawg; updAmount(); return; }
  if (ds.unit && sheetCtx && sheetCtx.code) {
    const f = foodByCode.get(sheetCtx.code);
    if (ds.unit === sheetCtx.unit) return;
    const grams = currentGrams();
    sheetCtx.unit = ds.unit;
    sheetCtx.value = ds.unit === 'mL' ? r1(grams * 100 / f.ml) : grams;
    renderAmountBody();
    return;
  }
  if (ds.g && sheetCtx && sheetCtx.code) {
    sheetCtx.value = Number(ds.g);
    $('#amt').value = ds.g;
    updAmount();
    return;
  }
  if (ds.q && sheetCtx && sheetCtx.item) {
    sheetCtx.val = Number(ds.q);
    $('#qty').value = ds.q;
    $('#qty').dispatchEvent(new Event('input'));
    return;
  }

  switch (b.id) {
    case 'prevDay': viewDate = addDays(viewDate, -1); render(); break;
    case 'nextDay': viewDate = addDays(viewDate, 1); render(); break;
    case 'dateLabel': viewDate = todayStr(); render(); break;
    case 'todayBtn': viewDate = todayStr(); render(); window.scrollTo(0, 0); break;
    case 'saveAmt': {
      const f = foodByCode.get(sheetCtx.code);
      const grams = currentGrams();
      if (!(grams > 0)) return;
      const staple = STAPLES.find(s => s.code === f.code);
      const meta = amountMeta();
      const data = Object.assign({ meal: sheetCtx.meal, code: f.code, name: sheetCtx.label || (staple ? staple.label : f.main), grams, protein: proteinFor(f, grams) }, meta);
      if (sheetCtx.mlId) data.mlId = sheetCtx.mlId;
      state.recent[f.code] = Object.assign(state.recent[f.code] || { n: 0 }, { amode: meta.amode, ulabel: meta.ulabel, raw: meta.raw, g: grams });
      if (sheetCtx.editing) { updateEntry(viewDate, sheetCtx.editing.id, data); toast('修正しました'); }
      else { addEntry(viewDate, data); toast(`${data.name} ${fmt(data.protein)}g を記録しました`); }
      closeSheet(); render();
      break;
    }
    case 'saveMy': {
      const it = sheetCtx.item;
      const v = Number(sheetCtx.val);
      if (!(v > 0)) return;
      const is100 = it.basis === '100g';
      const data = {
        meal: sheetCtx.meal, mlId: sheetCtx.mlId || undefined, kind: it.kind, refId: it.id, name: it.name, unit: it.unit, basis: is100 ? '100g' : 'unit',
        perUnit: it.protein, qty: is100 ? null : v, grams: is100 ? v : null, protein: itemProtein(it, v),
      };
      if (sheetCtx.editing) { updateEntry(viewDate, sheetCtx.editing.id, data); toast('修正しました'); }
      else { addEntry(viewDate, data); toast(`${it.name} ${fmt(data.protein)}g を記録しました`); }
      closeSheet(); render();
      break;
    }
    case 'delEntry':
      if (sheetCtx && sheetCtx.editing && confirm('この記録を削除しますか？')) {
        removeEntry(viewDate, sheetCtx.editing.id); closeSheet(); render();
      }
      break;
    case 'exportBtn': exportData(); break;
    case 'importBtn': $('#importFile').click(); break;
    case 'starBtn': starCurrentFood(); break;
    case 'photoAddBtn': $('#photoInput').click(); break;
    case 'pvDelete': deleteViewedPhoto(); break;
    case 'pvClose': closePhotoViewer(); break;
    case 'wipeBtn':
      if (confirm('すべての記録・設定・マイ食品を削除します。元に戻せません。よろしいですか？')) {
        state = defaultState(); saveState(); deleteAllPhotos().then(render); toast('削除しました');
      }
      break;
  }
});

document.addEventListener('change', ev => {
  if (ev.target.id === 'photoInput' && ev.target.files.length) { addPhotos(Array.from(ev.target.files)); ev.target.value = ''; }
  if (ev.target.id === 'keepDays') { state.photoKeepDays = Number(ev.target.value); saveState(); cleanupPhotos(); toast('保存しました'); }
  if (ev.target.id === 'importFile' && ev.target.files[0]) importData(ev.target.files[0]);
  if (ev.target.name === 'sex') $('#statusField').hidden = ev.target.value !== 'f';
});
document.addEventListener('submit', ev => {
  if (ev.target.id !== 'profileForm') return;
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const sex = fd.get('sex');
  state.profile = {
    age: Number(fd.get('age')),
    sex,
    weight: fd.get('weight') ? Number(fd.get('weight')) : null,
    status: sex === 'f' ? (fd.get('status') || 'none') : 'none',
  };
  saveState();
  toast('保存しました');
  switchTab('today');
});
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (!$('#photoViewer').hidden) closePhotoViewer(); else closeSheet();
});

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + tab; });
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  window.scrollTo(0, 0);
  render();
}

/* ---------- 起動 ---------- */
if (!state.profile) currentTab = 'today';
render();
loadFoods();
cleanupPhotos();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
