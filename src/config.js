// مستويات الصعوبة (قسم 16 بوثيقة التصميم)
export const DIFFICULTIES = {
  story: { ar: 'حكاية', en: 'Story', monsterSpeed: 0.8, hearing: 0.7, sight: 0.8, adapt: 0.5, hourSeconds: 240, batterySeconds: 420, bells: 4, batteries: 3 },
  normal: { ar: 'ليلة عادية', en: 'Normal night', monsterSpeed: 1, hearing: 1, sight: 1, adapt: 1, hourSeconds: 180, batterySeconds: 300, bells: 3, batteries: 2 },
  friday: { ar: 'ليلة الجمعة', en: 'Friday night', monsterSpeed: 1.15, hearing: 1.25, sight: 1.1, adapt: 1.5, hourSeconds: 150, batterySeconds: 220, bells: 2, batteries: 1 },
};

export const START_HOUR = 0; // 12:00 منتصف الليل
export const DAWN_HOUR = 5; // 5:00 الفجر
