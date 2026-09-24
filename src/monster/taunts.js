// جمل تمسخر السعلوة: كل جملة إلها موقف (trigger) وشرط مبني على ذاكرتها عنك.
// ctx = { mem, run, favHide, hideLabel, room, night, hideKind, lit, carryingAnklet }
import { DIALECT_TAUNTS } from './dialects.js';

export const TAUNTS = [
  // بداية الليلة
  { id: 'night2', on: 'start', when: (c) => c.night === 2, ar: 'رجعت لليلة ثانية؟… هالمرة بعرف البيت أحسن منك', en: 'Back for a second night?… I know the house better than you now' },
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
  { id: 'anklet_hear', on: 'idle', when: (c) => c.carryingAnklet, ar: 'بسمع خلخالي معك… رنّ… رنّ', en: 'I hear my anklet on you… jingle… jingle' },
  { id: 'roof', on: 'idle', when: (c) => c.room === 'r', ar: 'طلعت عالسطح؟… القرية نايمة، ما حدا رح يسمعك', en: 'Up on the roof?… the village sleeps, no one will hear you' },
  { id: 'locked', on: 'locked', when: () => true, ar: 'بتسكّر الأبواب بوجهي؟… أنا ما بدي باب', en: 'Locking doors on me?… I need no door' },
  { id: 'house', on: 'idle', when: () => true, ar: 'أهلين… بيتي بيتك', en: 'Welcome… my house is your house' },
  { id: 'granny', on: 'idle', when: () => true, ar: 'ستّك ما كانت تخاف… إنت ليش خايف؟', en: "Your grandma wasn't afraid… why are you?" },

  // لما تتخبّى بمخبأك المفضّل
  { id: 'fav_hide', on: 'hide', when: (c) => c.favHide && c.favHide === c.hideId, ar: 'نفس المكان؟… صرت أعرفه أكثر منك', en: 'Same place again?… I know it better than you' },

  { id: 'curtain_feet', on: 'hide', when: (c) => c.hideKind === 'curtain' && c.lit, ar: 'شايفة ضوّك من ورا الستارة…', en: 'I can see your light behind the curtain…' },

  // الأدوات والحيل
  { id: 'salt', on: 'salt', when: () => true, ar: 'ملح؟… ستّك علّمتك؟ الملح بيذوب يا حلو', en: 'Salt?… grandma taught you? Salt melts, sweetie' },
  { id: 'bead', on: 'bead', when: () => true, ar: 'خرزة؟!… المرة الجاية ما في خرزة', en: 'A bead?!… next time there is no bead' },
  { id: 'lure', on: 'lure', when: () => true, ar: 'نفس الحيلة؟… ما عاد تزبط معي', en: 'The same trick?… it no longer works on me' },
  { id: 'miss', on: 'miss', when: () => true, ar: 'كنت متأكدة إنك هون… ريحتك لسا هون', en: 'I was sure you were here… your smell is still here' },
  { id: 'tape', on: 'tape', when: () => true, ar: 'ستّك كذّابة… لا تسمع كلامها', en: "Your grandma was a liar… don't listen to her" },
  { id: 'teleport', on: 'teleport', when: () => true, ar: 'أنا هون… لا… هون', en: "I'm here… no… here" },
  { id: 'anklet_back', on: 'anklet_back', when: () => true, ar: 'خلخالي… رجعلي… (بتغني)', en: 'My anklet… it came back… (she sings)' },

  // لما تاخذ غرض
  { id: 'item', on: 'item', when: () => true, ar: 'رجّع غراض ستّك مكانهم!', en: "Put your grandma's things back!" },
  { id: 'anklet', on: 'anklet', when: () => true, ar: 'خلخالي!… هاته!', en: 'My anklet!… give it back!' },

  // الموت
  { id: 'caught_hide', on: 'death', when: (c) => c.run.deathCause === 'hide', ar: 'لقيتك… زي كل مرة', en: 'Found you… like every time' },
  { id: 'caught', on: 'death', when: () => true, ar: 'نام… نام… الليلة لسا طويلة', en: 'Sleep… sleep… the night is still long' },
];

const textOf = (v, c) => (typeof v === 'function' ? v(c) : v);

// أول جملة مناسبة ما انقالت بهالجولة؛ بالتجوّل بنختار عشوائياً بين المناسب.
// ctx.dialect: levant (الأصل) | gulf | iraq | egypt
export function pickTaunt(trigger, ctx, used, rand = Math.random) {
  const ok = TAUNTS.filter((t) => t.on === trigger && !used.has(t.id) && t.when(ctx));
  if (!ok.length) return null;
  const t = trigger === 'idle' ? ok[Math.floor(rand() * ok.length)] : ok[0];
  used.add(t.id);
  const ar = DIALECT_TAUNTS[ctx.dialect]?.[t.id] ?? t.ar;
  return { id: t.id, ar: textOf(ar, ctx), en: textOf(t.en, ctx) };
}
