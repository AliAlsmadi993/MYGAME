// الحقيبة (قسم 14): 4 خانات بس، وكل خانة بتحمل نوع واحد من الأدوات (بتتكدّس لحد معيّن).
export const BAG_SLOTS = 4;

export const TOOLS = {
  bell: { ar: 'جرس', en: 'Bell', icon: '🔔', max: 5 },
  battery: { ar: 'بطارية', en: 'Battery', icon: '🔋', max: 3 },
  matches: { ar: 'كبريت', en: 'Matches', icon: '🔥', max: 5, per: 3 }, // العلبة فيها 3 أعواد
  salt: { ar: 'ملح', en: 'Salt', icon: '🧂', max: 2 },
  bead: { ar: 'خرزة زرقاء', en: 'Blue bead', icon: '🧿', max: 1, passive: true },
  recorder: { ar: 'مسجّل كاسيت', en: 'Tape recorder', icon: '📼', max: 1 },
};

export class Bag {
  constructor(slots = BAG_SLOTS) {
    this.slots = new Array(slots).fill(null); // { tool, count }
    this.sel = 0;
  }

  count(tool) {
    return this.slots.reduce((n, s) => n + (s?.tool === tool ? s.count : 0), 0);
  }

  // بترجع كم فات فعلاً (0 = الحقيبة مليانة)
  add(tool, n = 1) {
    const max = TOOLS[tool].max;
    let left = n;
    for (const s of this.slots) {
      if (s?.tool === tool && s.count < max) {
        const k = Math.min(left, max - s.count);
        s.count += k;
        left -= k;
      }
    }
    while (left > 0) {
      const i = this.slots.indexOf(null);
      if (i < 0) break;
      const k = Math.min(left, max);
      this.slots[i] = { tool, count: k };
      left -= k;
    }
    return n - left;
  }

  canAdd(tool) {
    return this.slots.some((s) => s === null || (s.tool === tool && s.count < TOOLS[tool].max));
  }

  take(tool, n = 1) {
    if (this.count(tool) < n) return false;
    let left = n;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s?.tool !== tool) continue;
      const k = Math.min(left, s.count);
      s.count -= k;
      left -= k;
      if (!s.count) this.slots[i] = null;
    }
    return true;
  }

  get selected() {
    return this.slots[this.sel]?.tool ?? null;
  }

  select(i) {
    this.sel = ((i % this.slots.length) + this.slots.length) % this.slots.length;
  }

  // الخانة الجاية اللي فيها شي
  cycle(dir = 1) {
    for (let k = 1; k <= this.slots.length; k++) {
      const i = (this.sel + dir * k + this.slots.length * k) % this.slots.length;
      if (this.slots[i]) return this.select(i);
    }
  }

  // بتفضّي الخانة المختارة وبترجع شو كان فيها
  drop() {
    const s = this.slots[this.sel];
    this.slots[this.sel] = null;
    return s;
  }
}
