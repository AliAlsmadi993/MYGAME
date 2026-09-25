// التقدّم بين الجولات (قسم 17): أشرطة الجدة، النهايات، الإنجازات، والليالي والأدوات المفتوحة.
// منفصل عن ذاكرة السعلوة: "خلّيها تنساني" ما بيمسح دفترك.
import { TAPES } from './story/tapes.js';

const KEY = 'salwa.progress.v1';

export const ACHIEVEMENTS = {
  first_escape: { ar: 'أول نجاة', en: 'First survival', desc: 'انجُ من ليلة كاملة' },
  silent: { ar: 'ولا كلمة', en: 'Not a word', desc: 'انجُ والمايك شغّال بدون ما يلتقط أي كلام' },
  not_yours: { ar: 'صوتك مش إلك', en: 'Not your voice', desc: 'اسمعها تقلّد صوتك 5 مرات' },
  changed_habit: { ar: 'غيّرت عادتك', en: 'Changed your habit', desc: 'انجُ بعد ما تعلّمت مخبأك المفضّل، بدون ما تستخدمه' },
  grandma_right: { ar: 'ستّي كانت محقّة', en: 'Grandma was right', desc: 'اجمع كل أشرطة الجدة' },
  rooster: { ar: 'صاح الديك', en: 'The rooster crowed', desc: 'اصمد للفجر' },
  evil_eye: { ar: 'عين وصابتها', en: 'Evil eye', desc: 'الخرزة الزرقاء نجّتك من إيدها' },
  salt_line: { ar: 'خط الملح', en: 'Salt line', desc: 'وقّفها بخط ملح' },
  keeper: { ar: 'الحارس الجديد', en: 'The new keeper', desc: 'النهاية الحقيقية' },
  anklet_home: { ar: 'رجع لصاحبه', en: 'Back to its owner', desc: 'النهاية السرّية' },
  night_two: { ar: 'الليلة الثانية', en: 'The second night', desc: 'انجُ من الليلة الثانية' },
  merciless: { ar: 'بلا رحمة', en: 'Merciless', desc: 'انجُ على صعوبة بلا رحمة' },
};

export function emptyProgress() {
  return {
    tapes: [], // الأشرطة اللي انسمعت
    endings: [],
    achievements: [],
    wins: 0,
    mimicsHeard: 0, // كم مرة سمعت صوتك (مجموع كل الليالي)
  };
}

export function loadProgress(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? { ...emptyProgress(), ...JSON.parse(raw) } : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(p));
  } catch {
    /* التخزين مش متاح */
  }
}

export function clearProgress(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

const addOnce = (list, id) => (list.includes(id) ? false : (list.push(id), true));

export function unlock(p, id) {
  return ACHIEVEMENTS[id] ? addOnce(p.achievements, id) : false;
}

export function noteTape(p, id) {
  return addOnce(p.tapes, id);
}

// الليلة الثانية بتنفتح بعد أول نجاة، والمسجّل كمان
export const nightTwoUnlocked = (p) => p.wins > 0;
export const recorderUnlocked = (p) => p.wins > 0;

// نهاية الليلة: بنسجّل النتيجة وبنرجّع الإنجازات الجديدة
// run = { ending, night, difficulty, micOn, spoke, mimics, favHideAtStart, usedFav, beadSaved, saltBlocked }
export function finishRun(p, run) {
  const won = run.ending !== 'death' && run.ending !== 'demo';
  addOnce(p.endings, run.ending);
  p.mimicsHeard += run.mimics || 0;
  const fresh = [];
  const give = (id, cond) => cond && unlock(p, id) && fresh.push(id);
  if (won) p.wins++;
  give('first_escape', won);
  give('silent', won && run.micOn && !run.spoke);
  give('changed_habit', won && run.favHideAtStart && !run.usedFav);
  give('rooster', run.ending === 'dawn');
  give('keeper', run.ending === 'true');
  give('anklet_home', run.ending === 'secret');
  give('night_two', won && run.night === 2);
  give('merciless', won && run.difficulty === 'merciless');
  give('not_yours', p.mimicsHeard >= 5);
  give('grandma_right', TAPES.every((t) => p.tapes.includes(t.id)));
  give('evil_eye', !!run.beadSaved);
  give('salt_line', !!run.saltBlocked);
  return fresh;
}
