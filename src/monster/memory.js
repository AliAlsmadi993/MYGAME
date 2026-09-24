// ذاكرة السعلوة: شو بتعرف عن اللاعب، محفوظة بين المحاولات على جهاز اللاعب فقط.
import { W, H } from '../world/map.js';

const KEY = 'salwa.memory.v1';
const DECAY = 0.7; // العادات القديمة بتضعف كل محاولة

export function emptyMemory() {
  return {
    attempts: 0,
    wins: 0,
    hideCounts: {}, // مخبأ ← وزن
    routeHeat: new Array(W * H).fill(0), // الخانات اللي بيهرب منها
    roomVisits: {}, // الغرفة ← وزن (وين بيروح أول شي)
    runRatio: 0, // نسبة الركض
    flashlightRatio: 0.5,
    loudness: 0, // صراخ بالدقيقة
    lastDeath: null, // { cause: 'hide'|'chase', spot, room }
    lureTricks: 0, // كم مرة خدعتها بالراديو أو المسجّل (بتتعلّم تتجاهلهم)
    bestSurvival: 0,
  };
}

export function loadMemory(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return emptyMemory();
    const m = { ...emptyMemory(), ...JSON.parse(raw) };
    if (m.routeHeat.length !== W * H) m.routeHeat = new Array(W * H).fill(0);
    return m;
  } catch {
    return emptyMemory();
  }
}

export function saveMemory(mem, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(mem));
  } catch {
    /* التخزين مش متاح: الذاكرة بتضل للجولة بس */
  }
}

export function clearMemory(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// بداية جولة جديدة: نضعّف الأوزان القديمة ونعدّ المحاولة
export function beginRun(mem) {
  mem.attempts += 1;
  for (const k of Object.keys(mem.hideCounts)) mem.hideCounts[k] *= DECAY;
  for (const k of Object.keys(mem.roomVisits)) mem.roomVisits[k] *= DECAY;
  mem.routeHeat = mem.routeHeat.map((v) => v * DECAY);
  return mem;
}

export function noteHide(mem, spotId) {
  mem.hideCounts[spotId] = (mem.hideCounts[spotId] || 0) + 1;
}

export function noteRoute(mem, x, y, amount = 1) {
  mem.routeHeat[y * W + x] += amount;
}

export function noteLure(mem) {
  mem.lureTricks += 1;
}

// فرصة إنها تتجاهل صوت تشتيت (جرس/راديو/مسجّل)
export function lureIgnoreChance(mem, runUses, adapt = 1) {
  return Math.min(0.8, (Math.max(0, runUses - 1) * 0.2 + mem.lureTricks * 0.06) * adapt);
}

export function noteRoom(mem, room, amount = 1) {
  mem.roomVisits[room] = (mem.roomVisits[room] || 0) + amount;
}

// معدّل متحرّك (EMA) لسلوك الجولة
export function blendHabits(mem, run) {
  const a = 0.4;
  if (run.moveTime > 5) mem.runRatio = mem.runRatio * (1 - a) + (run.sprintTime / run.moveTime) * a;
  if (run.time > 5) {
    mem.flashlightRatio = mem.flashlightRatio * (1 - a) + (run.flashlightTime / run.time) * a;
    mem.loudness = mem.loudness * (1 - a) + (run.screams / Math.max(1, run.time / 60)) * a;
  }
}

// المخابئ مرتّبة حسب شو بتتوقّع السعلوة
export function hideSearchOrder(mem, spots) {
  return [...spots].sort((s1, s2) => (mem.hideCounts[s2.id] || 0) - (mem.hideCounts[s1.id] || 0));
}

export function favoriteHide(mem) {
  let best = null;
  let bestW = 0.8;
  for (const [id, w] of Object.entries(mem.hideCounts)) if (w > bestW) [best, bestW] = [id, w];
  return best;
}

// أسخن خانة (طريق الهروب المفضّل) لنصب كمين
export function hottestRoute(mem, minHeat = 2) {
  let best = -1;
  let bestV = minHeat;
  mem.routeHeat.forEach((v, i) => {
    if (v > bestV) [best, bestV] = [i, v];
  });
  return best < 0 ? null : { x: best % W, y: Math.floor(best / W) };
}

export function favoriteRoom(mem) {
  let best = null;
  let bestW = 1;
  for (const [r, w] of Object.entries(mem.roomVisits)) if (w > bestW) [best, bestW] = [r, w];
  return best;
}

// ملخّص "شو تعلّمت عنك" لشاشة النهاية
export function learnedSummary(mem, spotsById, rooms) {
  const out = [];
  const fav = favoriteHide(mem);
  if (fav) out.push(`بتتخبّى كثير في: ${spotsById[fav]?.label ?? fav}`);
  if (hottestRoute(mem)) out.push('بتعرف طريق هروبك المفضّل');
  if (mem.runRatio > 0.35) out.push('بتركض كثير… وبتسمع خطواتك من بعيد');
  if (mem.flashlightRatio > 0.7) out.push('الكشاف دايماً شغّال… ضوّك بيفضحك');
  if (mem.loudness > 0.6) out.push('بتصرّخ كثير… وصوتك صار عندها');
  if (mem.lureTricks >= 3) out.push('صارت تعرف حيلة الراديو والمسجّل');
  const room = favoriteRoom(mem);
  if (room) out.push(`أول ما تدخل بتروح على ${rooms[room]?.ar ?? room}`);
  return out;
}
