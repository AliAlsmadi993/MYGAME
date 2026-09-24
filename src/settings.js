// الإعدادات (قسم 21 و22): الحساسية، إمكانية الوصول، ووضع الستريمر. محفوظة على الجهاز.
const KEY = 'salwa.settings.v1';

export const DEFAULT_SETTINGS = {
  sensitivity: 1,
  invertY: false,
  reduceFlashes: false, // بدون برق وارتجاف ألوان قوي
  reduceScreams: false, // الصرخات المفاجئة أوطى
  streamer: false, // تنبيه قبل أي تسجيل من صوتك
  showMic: true,
  micGain: 1, // حساسية المايك
  micDevice: '', // جهاز المايك (فاضي = الافتراضي)
  voiceLang: 'ar', // لغة صوت السعلوة: ar | en (الترجمة دايماً بالثنتين)
};

export function loadSettings(storage = globalThis.localStorage) {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(storage?.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
