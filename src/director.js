// مدير التوتر (قسم 16): بيراقب شو عم يصير مع اللاعب. مطاردة طويلة ← استراحة، هدوء طويل ← حدث مخيف أو بيقرّبها.
export class Director {
  constructor(rand = Math.random) {
    this.rand = rand;
    this.chase = 0; // ثواني المطاردة المتواصلة
    this.calm = 0; // ثواني بدون خوف
    this.reliefCd = 0;
    this.nextScare = 40 + rand() * 30;
  }

  // ctx = { chasing, fear, hour } ← 'relief' | 'nudge' | 'scare' | null
  update(dt, { chasing, fear, hour }) {
    this.reliefCd -= dt;
    this.chase = chasing ? this.chase + dt : 0;
    this.calm = fear < 0.2 && !chasing ? this.calm + dt : 0;
    this.nextScare -= dt;
    // آخر ساعة قبل الفجر: يأس السعلوة، ما في استراحة
    const maxChase = Math.max(22, 40 - hour * 4);
    if (this.chase > maxChase && this.reliefCd <= 0 && hour < 4) {
      this.chase = 0;
      this.reliefCd = 60;
      return 'relief';
    }
    const calmLimit = Math.max(30, 75 - hour * 10);
    if (this.calm > calmLimit) {
      this.calm = 0;
      return this.rand() < 0.5 ? 'nudge' : 'scare';
    }
    if (this.nextScare <= 0) {
      this.nextScare = Math.max(30, 70 - hour * 8) + this.rand() * 40;
      if (!chasing) return 'scare';
    }
    return null;
  }
}

// أحداث مخيفة بدون خطر حقيقي. ctx = { phoneRinging, radioOn, hour, hasClips }
export const SCARES = [
  { id: 'door', weight: 3 }, // باب بينصفق
  { id: 'toys', weight: 2 }, // ألعاب الأطفال بتتحرّك
  { id: 'ceiling', weight: 2 }, // خطوات فوق السقف
  { id: 'radio', weight: 1.5, ok: (c) => !c.radioOn }, // الراديو بيشتغل لحاله
  { id: 'phone', weight: 1.5, ok: (c) => !c.phoneRinging && c.hour >= 1 }, // التلفون الأرضي بيرن
  { id: 'cradle', weight: 1 }, // المهد بالسدّة بيهتز لحاله
  { id: 'laugh', weight: 1 },
  { id: 'whisper', weight: 1 },
];

export function pickScare(ctx, rand = Math.random) {
  const ok = SCARES.filter((s) => !s.ok || s.ok(ctx));
  let r = rand() * ok.reduce((a, s) => a + s.weight, 0);
  for (const s of ok) if ((r -= s.weight) < 0) return s.id;
  return ok[ok.length - 1].id;
}
