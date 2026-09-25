// أزرار التحكم (قسم 21): كل فعل إله زر رئيسي بيتغيّر من الإعدادات، وبعض الأفعال إلها زر ثاني ثابت.
export const KEY_ACTIONS = {
  forward: { ar: 'قدّام', key: 'KeyW', alt: 'ArrowUp' },
  back: { ar: 'ورا', key: 'KeyS', alt: 'ArrowDown' },
  left: { ar: 'شمال', key: 'KeyA', alt: 'ArrowLeft' },
  right: { ar: 'يمين', key: 'KeyD', alt: 'ArrowRight' },
  sprint: { ar: 'ركض', key: 'ShiftLeft', alt: 'ShiftRight' },
  crouch: { ar: 'انحناء', key: 'KeyC', alt: 'ControlLeft' },
  flashlight: { ar: 'الكشاف', key: 'KeyF' },
  interact: { ar: 'تفاعل', key: 'KeyE' },
  use: { ar: 'استعمال أداة', key: 'KeyG' },
  drop: { ar: 'رمي أداة', key: 'KeyX' },
  breath: { ar: 'حبس النفَس', key: 'Space' },
  leanLeft: { ar: 'ميلان شمال', key: 'KeyQ' },
  leanRight: { ar: 'ميلان يمين', key: 'KeyR' },
  items: { ar: 'الأغراض', key: 'Tab' },
};

// custom = { action: code } من الإعدادات ← خريطة code ← action
export function buildKeymap(custom = {}) {
  const map = new Map();
  for (const [action, a] of Object.entries(KEY_ACTIONS)) {
    if (a.alt) map.set(a.alt, action);
  }
  for (const [action, a] of Object.entries(KEY_ACTIONS)) map.set(custom[action] || a.key, action);
  return map;
}

// اسم الزر للعرض
export function keyLabel(code) {
  return (code || '').replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R').replace('Space', 'Space');
}
