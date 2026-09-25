// الأصوات الحقيقية: خانات المؤثرات اللي بتقدر تستبدلها بتسجيلات، وجمل صوتك إنت اللي بتناديك فيها.
// اسم الملف بيحدد الخانة: scream.mp3 أو scream_2.ogg (أكثر من نسخة = بتختار عشوائي).

export const SFX_SLOTS = {
  scream: 'صرختها',
  laugh: 'ضحكتها',
  whisper: 'همس',
  growl: 'خرخرة',
  breath_in: 'نفَسها (شهيق)',
  breath_out: 'نفَسها (زفير)',
  lullaby: 'غنّيتها (تهويدة، بتتكرر)',
  monster_step: 'خطواتها الحافية',
  step_stone: 'خطواتك على حجر',
  step_wood: 'خطواتك على خشب',
  step_dirt: 'خطواتك على تراب',
  creak: 'صرير خشب/باب',
  slam: 'باب بينصفق',
  knock: 'دق على خشب',
  unlock: 'قفل حديد',
  thunder: 'رعد',
  rain_loop: 'مطر (بيتكرر)',
  wind_loop: 'ريح (بيتكرر)',
  drip: 'نقطة مي',
  howl: 'عواء كلب بعيد',
  chime: 'دقة ساعة الحيط',
  bell: 'جرس',
  jingle: 'رنّة خلخال',
  glass: 'دعسة على زجاج',
  ring: 'رنّة تلفون قديم',
  toys: 'علبة موسيقى',
  radio_loop: 'راديو قديم (بيتكرر)',
  oud: 'نغمة عود',
  sting: 'نغمة فزع',
  heartbeat: 'دقة قلب',
  gasp: 'شهقة',
  pant: 'لهاث',
  splash: 'مي',
  match: 'حكّة كبريت',
  teleport: 'سحبة غريبة (إنذار)',
  grab: 'لحظة الإمساك',
};

// جمل بصوتك إنت (السعلوة بتستعملها لتستدرجك وتناديك)
export const MY_PROMPTS = {
  name: { ar: 'اسمك (مثلاً: «علي»)', say: 'قول اسمك بصوتك العادي' },
  come: { ar: '«تعال لهون»', say: 'تعال لهون' },
  where: { ar: '«وينك؟»', say: 'وينك؟' },
  help: { ar: '«ساعدني!»', say: 'ساعدني!' },
  who: { ar: '«مين هون؟»', say: 'مين هون؟' },
  scream: { ar: 'صرخة', say: 'صرّخ' },
  laugh: { ar: 'ضحكة', say: 'اضحك' },
};

// اسم ملف ← خانة (أو null)
export function slotForFile(filename) {
  const base = filename.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[-\s]+/g, '_');
  const m = /^([a-z_]+?)(?:_\d+)?$/.exec(base);
  if (!m) return null;
  if (SFX_SLOTS[m[1]]) return m[1];
  return SFX_SLOTS[base] ? base : null;
}

// مفاتيح التخزين
export const keys = {
  sfx: (slot, n = 0) => `sfx:${slot}:${n}`,
  me: (label) => `me:${label}`,
  taunt: (dialect, id) => `taunt:${dialect}:${id}`,
  grandma: (tapeId, i) => `grandma:${tapeId}:${i}`,
};
