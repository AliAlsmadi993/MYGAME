// جمل تمسخر السعلوة: كل جملة إلها موقف (trigger) وشرط مبني على ذاكرتها عنك.
// ctx = { mem, run, favHide, hideLabel, room }
export const TAUNTS = [
  // بداية الليلة
  { id: 'back_many', on: 'start', when: (c) => c.mem.attempts >= 10, ar: (c) => `هاي المرة رقم ${c.mem.attempts}… ما بتتعلّم؟`, en: (c) => `Attempt ${c.mem.attempts}… you never learn?` },
  { id: 'died_hide', on: 'start', when: (c) => c.mem.lastDeath?.cause === 'hide', ar: (c) => `آخر مرة تخبّيت ب${c.lastDeathLabel}… لسا ريحتك فيها`, en: 'Last time you hid… your smell is still there' },
  { id: 'died_fast', on: 'start', when: (c) => c.mem.lastDeath && c.mem.lastDeath.time < 120, ar: 'المرة الماضية ما طوّلت… خلينا نلعب أكثر هالمرة', en: "Last time didn't last long… let's play longer" },
  { id: 'back', on: 'start', when: (c) => c.mem.attempts > 1, ar: 'رجعت؟ اشتقتلك…', en: 'You came back? I missed you…' },
  { id: 'first', on: 'start', when: (c) => c.mem.attempts <= 1, ar: 'مين هون؟… ضيف؟', en: "Who's there?… a guest?" },

  // أثناء التجوّل (عشوائي حسب العادات)
  { id: 'runner', on: 'idle', when: (c) => c.mem.runRatio > 0.35, ar: 'اركض… اركض… رجليك بيتعبوا، أنا لا', en: 'Run… run… your legs tire, mine never do' },
  { id: 'screamer', on: 'idle', when: (c) => c.mem.loudness > 0.6 || c.run.screams > 2, ar: 'صوتك حلو لما تصرّخ… صرّخ كمان', en: 'Your voice is lovely when you scream… again' },
  { id: 'quiet', on: 'idle', when: (c) => c.run.time > 90 && c.run.screams === 0 && c.run.heard < 3, ar: 'ساكت؟ بعرف إنك هون… بسمع قلبك', en: "Silent? I know you're here… I hear your heart" },
  { id: 'light', on: 'idle', when: (c) => c.mem.flashlightRatio > 0.7, ar: 'ضوّك بيبيّن من آخر الدنيا', en: 'Your light shows from the end of the world' },
  { id: 'route', on: 'idle', when: (c) => c.hasRoute, ar: 'بعرف من وين بتهرب… أنا مستنيتك هناك', en: 'I know where you run… I will be waiting' },
  { id: 'dawn', on: 'idle', when: (c) => c.run.hour >= 3, ar: 'الفجر بعيد… بعيد كثير', en: 'Dawn is far… so far' },
  { id: 'house', on: 'idle', when: () => true, ar: 'أهلين… بيتي بيتك', en: 'Welcome… my house is your house' },
  { id: 'granny', on: 'idle', when: () => true, ar: 'ستّك ما كانت تخاف… إنت ليش خايف؟', en: "Your grandma wasn't afraid… why are you?" },

  // لما تتخبّى بمخبأك المفضّل
  { id: 'fav_hide', on: 'hide', when: (c) => c.favHide && c.favHide === c.hideId, ar: 'نفس المكان؟… صرت أعرفه أكثر منك', en: 'Same place again?… I know it better than you' },

  // لما تاخذ غرض
  { id: 'item', on: 'item', when: () => true, ar: 'رجّع غراض ستّك مكانهم!', en: "Put your grandma's things back!" },
  { id: 'anklet', on: 'anklet', when: () => true, ar: 'خلخالي!… هاته!', en: 'My anklet!… give it back!' },

  // الموت
  { id: 'caught_hide', on: 'death', when: (c) => c.run.deathCause === 'hide', ar: 'لقيتك… زي كل مرة', en: 'Found you… like every time' },
  { id: 'caught', on: 'death', when: () => true, ar: 'نام… نام… الليلة لسا طويلة', en: 'Sleep… sleep… the night is still long' },
];

const textOf = (v, c) => (typeof v === 'function' ? v(c) : v);

// أول جملة مناسبة ما انقالت بهالجولة؛ بالتجوّل بنختار عشوائياً بين المناسب
export function pickTaunt(trigger, ctx, used, rand = Math.random) {
  const ok = TAUNTS.filter((t) => t.on === trigger && !used.has(t.id) && t.when(ctx));
  if (!ok.length) return null;
  const t = trigger === 'idle' ? ok[Math.floor(rand() * ok.length)] : ok[0];
  used.add(t.id);
  return { id: t.id, ar: textOf(t.ar, ctx), en: textOf(t.en, ctx) };
}
