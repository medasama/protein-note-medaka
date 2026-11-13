'use strict';
/* =========================================================
   写真メモ（食べたものを思い出すための写真）
   - 画像解析はしない。撮った時間で日付と朝・昼・夕・間食に振り分けて、小さく並べるだけ
   - 端末のブラウザ（IndexedDB）にだけ保存。外部には送らない。バックアップの対象外
   - app.js の関数（state, viewDate, toast など）を呼び出し時に使う
   ========================================================= */
const PHOTO_DB = 'protein-note-photos';
const PHOTO_FULL_MAX = 1280; // 拡大表示用の長辺(px)
const PHOTO_THUMB_MAX = 240; // 縮小表示用の長辺(px)
let photoDbPromise = null;
const photoCache = new Map(); // 'YYYY-MM-DD' -> [{id, date, meal, takenAt, timeKnown, thumb}]

function photoDb() {
  if (!photoDbPromise) {
    photoDbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(PHOTO_DB, 1);
      r.onupgradeneeded = () => {
        const st = r.result.createObjectStore('photos', { keyPath: 'id' });
        st.createIndex('date', 'date');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return photoDbPromise;
}
function idbDone(req) {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
async function photoStore(mode = 'readonly') {
  const db = await photoDb();
  return db.transaction('photos', mode).objectStore('photos');
}
async function photosOn(date) { return idbDone((await photoStore()).index('date').getAll(date)); }
async function getPhoto(id) { return idbDone((await photoStore()).get(id)); }
async function putPhoto(rec) { return idbDone((await photoStore('readwrite')).put(rec)); }
async function deletePhotoRec(id) { return idbDone((await photoStore('readwrite')).delete(id)); }

/* ---------- 撮影時刻 ---------- */
// JPEG の EXIF から DateTimeOriginal（なければ DateTime）を読む
async function readExifDate(file) {
  const buf = await file.slice(0, 256 * 1024).arrayBuffer();
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
  let off = 2;
  while (off + 4 < v.byteLength) {
    const marker = v.getUint16(off);
    const len = v.getUint16(off + 2);
    if (marker === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) { // "Exif"
      return parseTiffDate(v, off + 10);
    }
    if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) break;
    off += 2 + len;
  }
  return null;
}
function parseTiffDate(v, tiff) {
  const le = v.getUint16(tiff) === 0x4949;
  const u16 = o => v.getUint16(tiff + o, le);
  const u32 = o => v.getUint32(tiff + o, le);
  const readAscii = (o, n) => { let s = ''; for (let i = 0; i < n - 1; i++) s += String.fromCharCode(v.getUint8(tiff + o + i)); return s; };
  const scan = (ifd, wanted) => {
    const found = {};
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      const tag = u16(e);
      if (wanted.includes(tag)) found[tag] = { type: u16(e + 2), count: u32(e + 4), val: u32(e + 8) };
    }
    return found;
  };
  try {
    const ifd0 = scan(u32(4), [0x0132, 0x8769]);
    let s = null;
    if (ifd0[0x8769]) {
      const ex = scan(ifd0[0x8769].val, [0x9003]);
      if (ex[0x9003]) s = readAscii(ex[0x9003].val, ex[0x9003].count);
    }
    if (!s && ifd0[0x0132]) s = readAscii(ifd0[0x0132].val, ifd0[0x0132].count);
    const m = s && s.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    return isNaN(d.getTime()) ? null : d;
  } catch (e) { return null; }
}
async function photoTime(file) {
  const ex = await readExifDate(file).catch(() => null);
  if (ex) return { date: ex, known: true };
  const lm = file.lastModified;
  // 端末によっては「選んだ時刻」が入るので、今と2分以内なら撮影時刻とはみなさない
  if (lm && Math.abs(Date.now() - lm) > 2 * 60 * 1000) return { date: new Date(lm), known: true };
  return { date: new Date(), known: false };
}
// 時刻 → 日付と食事（0〜4時は前の日の間食）
function slotForTime(d) {
  const h = d.getHours();
  if (h < 4) return { date: addDays(dateStr(d), -1), meal: 's' };
  const meal = h < 10 ? 'b' : h < 15 ? 'l' : h < 17 ? 's' : 'd';
  return { date: dateStr(d), meal };
}

/* ---------- 縮小 ---------- */
async function loadImage(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* 下で再挑戦 */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}
function drawScaled(img, max) {
  const w = img.width, h = img.height;
  const sc = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * sc);
  c.height = Math.round(h * sc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}
async function shrinkImage(file) {
  const img = await loadImage(file);
  const full = await new Promise(res => drawScaled(img, PHOTO_FULL_MAX).toBlob(res, 'image/jpeg', 0.75));
  const thumb = drawScaled(img, PHOTO_THUMB_MAX).toDataURL('image/jpeg', 0.6);
  if (img.close) img.close();
  if (!full) throw new Error('encode');
  return { full, thumb };
}

/* ---------- 取り込み ---------- */
async function addPhotos(files) {
  if (!files.length) return;
  toast(`写真を取り込み中…（${files.length}枚）`);
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* 任意 */ }
  let ok = 0, fail = 0, unknown = 0;
  const placed = new Map(); // date -> 枚数
  for (const file of files) {
    try {
      const t = await photoTime(file);
      const { full, thumb } = await shrinkImage(file);
      let date, meal;
      if (t.known) ({ date, meal } = slotForTime(t.date));
      else { date = viewDate; meal = guessMeal(); unknown++; }
      await putPhoto({ id: uid(), date, meal, takenAt: t.known ? t.date.toISOString() : null, timeKnown: t.known, blob: full, thumb, added: Date.now() });
      placed.set(date, (placed.get(date) || 0) + 1);
      photoCache.delete(date);
      ok++;
    } catch (e) {
      fail++;
    }
  }
  const msgs = [];
  if (ok) {
    const other = [...placed.keys()].filter(d => d !== viewDate);
    msgs.push(`${ok}枚入れました`);
    if (other.length) msgs.push(`${other.map(d => dateLabel(d).replace(/^(きょう|きのう) /, '')).join('・')}の分はその日に入っています`);
  }
  if (unknown) msgs.push(`${unknown}枚は撮った時間がわからないため今の時間帯に入れました（タップで移せます）`);
  if (fail) msgs.push(`${fail}枚は読み込めませんでした`);
  toast(msgs.join('。'));
  render(); // 表示中の日付は変えない
}

/* ---------- 表示 ---------- */
async function refreshPhotos(date) {
  try {
    const list = await photosOn(date);
    list.sort((a, b) => (a.takenAt || '').localeCompare(b.takenAt || '') || a.added - b.added);
    photoCache.set(date, list.map(({ id, date, meal, takenAt, timeKnown, thumb }) => ({ id, date, meal, takenAt, timeKnown, thumb })));
  } catch (e) {
    photoCache.set(date, []);
  }
}
function hhmm(iso) { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
function thumbsHtml(date, meal, size) {
  const list = (photoCache.get(date) || []).filter(p => p.meal === meal);
  return list.map(p => `<button class="pthumb ${size}" data-photo="${p.id}" aria-label="写真を拡大">
      <img src="${p.thumb}" alt=""><span>${p.timeKnown ? hhmm(p.takenAt) : '時刻?'}</span></button>`).join('');
}
function fillPhotoStrips() {
  const d = viewDate;
  const fill = () => {
    if (viewDate !== d) return;
    document.querySelectorAll('.pstrip[data-pmeal]').forEach(el => { el.innerHTML = thumbsHtml(d, el.dataset.pmeal, 'sm'); });
    document.querySelectorAll('.sheet-pstrip[data-smeal]').forEach(el => {
      const h = thumbsHtml(d, el.dataset.smeal, 'md');
      el.innerHTML = h ? `<div class="tiny muted">この食事の写真（タップで拡大）</div><div class="pst-row">${h}</div>` : '';
    });
  };
  if (photoCache.has(d)) fill();
  refreshPhotos(d).then(fill);
}
function photoStripForSheet() {
  const m = sheetCtx && sheetCtx.meal;
  if (!m) return '';
  const h = thumbsHtml(viewDate, m, 'md');
  // 中身はキャッシュから。まだなら fillPhotoStrips が後で埋める
  setTimeout(fillPhotoStrips, 0);
  return `<div class="sheet-pstrip" data-smeal="${m}">${h ? `<div class="tiny muted">この食事の写真（タップで拡大）</div><div class="pst-row">${h}</div>` : ''}</div>`;
}

/* ---------- 拡大表示 ---------- */
let viewingPhoto = null;
let viewingUrl = null;
async function openPhotoViewer(id) {
  const rec = await getPhoto(id).catch(() => null);
  if (!rec) return;
  viewingPhoto = rec;
  if (viewingUrl) URL.revokeObjectURL(viewingUrl);
  viewingUrl = URL.createObjectURL(rec.blob);
  renderPhotoViewer();
  $('#photoViewer').hidden = false;
}
function renderPhotoViewer() {
  const rec = viewingPhoto;
  const when = rec.timeKnown ? `${dateLabel(dateStr(new Date(rec.takenAt))).replace(/^(きょう|きのう) /, '')} ${hhmm(rec.takenAt)}に撮影` : '撮った時間はわかりませんでした';
  $('#photoViewer').innerHTML = `
    <img src="${viewingUrl}" alt="食事の写真">
    <div class="pv-bar">
      <div class="pv-when">${esc(when)}・${esc(dateLabel(rec.date))}の${esc(mealLabel(rec.meal))}</div>
      <div class="pv-meals">${MEALS.map(([m, l]) => `<button class="chip ${m === rec.meal ? 'on' : ''}" data-pmove="${m}">${l}</button>`).join('')}</div>
      <div class="pv-actions">
        <button class="btn danger small" id="pvDelete">この写真を削除</button>
        <button class="btn small" id="pvClose">閉じる</button>
      </div>
    </div>`;
}
function closePhotoViewer() {
  $('#photoViewer').hidden = true;
  $('#photoViewer').innerHTML = '';
  if (viewingUrl) URL.revokeObjectURL(viewingUrl);
  viewingUrl = null;
  viewingPhoto = null;
}
async function movePhoto(meal) {
  if (!viewingPhoto || viewingPhoto.meal === meal) return;
  viewingPhoto.meal = meal;
  await putPhoto(viewingPhoto);
  photoCache.delete(viewingPhoto.date);
  renderPhotoViewer();
  fillPhotoStrips();
  toast(`${mealLabel(meal)}に移しました`);
}
async function deleteViewedPhoto() {
  if (!viewingPhoto || !confirm('この写真を削除しますか？（記録は消えません）')) return;
  const d = viewingPhoto.date;
  await deletePhotoRec(viewingPhoto.id);
  photoCache.delete(d);
  closePhotoViewer();
  fillPhotoStrips();
}

/* ---------- 保存期間 ---------- */
async function cleanupPhotos() {
  const keep = state.photoKeepDays == null ? 30 : Number(state.photoKeepDays);
  if (!keep) return; // 0 = 無期限
  const limit = addDays(todayStr(), -keep);
  try {
    const st = await photoStore('readwrite');
    const range = IDBKeyRange.upperBound(limit, true);
    const req = st.index('date').openCursor(range);
    await new Promise((resolve, reject) => {
      req.onsuccess = () => { const c = req.result; if (c) { c.delete(); c.continue(); } else resolve(); };
      req.onerror = () => reject(req.error);
    });
    photoCache.clear();
  } catch (e) { /* 何もしない */ }
}
async function deleteAllPhotos() {
  try {
    const st = await photoStore('readwrite');
    await idbDone(st.clear());
    photoCache.clear();
  } catch (e) { /* 何もしない */ }
}
async function photoCount() {
  try { return await idbDone((await photoStore()).count()); } catch (e) { return 0; }
}
