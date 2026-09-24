// مستويات الصعوبة (قسم 16 بوثيقة التصميم)
// hints: تلميحات الشاشة (الأغراض ظاهرة دايماً، أشرطة التحمّل…)، bead: فرصة ظهور الخرزة الزرقاء
// permadeath: الموت بيمسح ذاكرتها ودفترك بيضل
export const DIFFICULTIES = {
  story: { ar: 'حكاية', en: 'Story', monsterSpeed: 0.8, hearing: 0.7, sight: 0.8, adapt: 0.5, hourSeconds: 240, batterySeconds: 420, bells: 4, batteries: 3, salt: 2, bead: 0.6, hints: 'full' },
  normal: { ar: 'ليلة عادية', en: 'Normal night', monsterSpeed: 1, hearing: 1, sight: 1, adapt: 1, hourSeconds: 180, batterySeconds: 300, bells: 3, batteries: 2, salt: 2, bead: 0.3, hints: 'some' },
  friday: { ar: 'ليلة الجمعة', en: 'Friday night', monsterSpeed: 1.15, hearing: 1.25, sight: 1.1, adapt: 1.5, hourSeconds: 150, batterySeconds: 220, bells: 2, batteries: 1, salt: 1, bead: 0.15, hints: 'some' },
  merciless: { ar: 'بلا رحمة', en: 'Merciless', monsterSpeed: 1.2, hearing: 1.3, sight: 1.15, adapt: 1.6, hourSeconds: 150, batterySeconds: 200, bells: 2, batteries: 1, salt: 1, bead: 0, hints: 'none', permadeath: true },
};

// الليالي (قسم 17): الثانية بتنفتح بعد أول نجاة، بخريطة معدّلة وسعلوة أذكى
export const NIGHTS = {
  1: { ar: 'الليلة الأولى', mods: {} },
  2: {
    ar: 'الليلة الثانية',
    // أسرع شوي، بتتكيّف أسرع، بتطفي الشموع أكثر، وبتختفي وبتظهر بمكان ثاني
    mods: { monsterSpeed: 1.08, adapt: 1.3, hearing: 1.1 },
    lightsOut: 0.5,
    teleport: true,
    sealed: 1, // مخبأ مسكّر بمسامير
  },
};

export function nightConfig(diff, night) {
  const n = NIGHTS[night] ?? NIGHTS[1];
  const cfg = { ...diff, night, lightsOut: n.lightsOut ?? 0.2, teleport: !!n.teleport, sealed: n.sealed ?? 0 };
  for (const [k, m] of Object.entries(n.mods)) cfg[k] *= m;
  return cfg;
}

export const START_HOUR = 0; // 12:00 منتصف الليل
export const DAWN_HOUR = 5; // 5:00 الفجر
