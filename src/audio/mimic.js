// تقليد صوت اللاعب: المقاطع محفوظة على جهاز اللاعب فقط (IndexedDB) وما بتنرفع لأي مكان.
const DB = 'salwa';
const STORE = 'clips';
const MAX_CLIPS = 12;
const MAX_AGE = 7 * 24 * 3600 * 1000; // بتنحذف تلقائياً بعد أسبوع

function openDb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error);
  });
}

export class Mimic {
  constructor(engine) {
    this.engine = engine;
    this.clips = [];
    this.persist = true;
  }

  async load() {
    try {
      const all = (await tx('readonly', (s) => s.getAll())) || [];
      const fresh = all.filter((c) => Date.now() - c.at < MAX_AGE);
      if (fresh.length !== all.length) await this.#rewrite(fresh);
      this.clips = fresh;
    } catch {
      this.clips = [];
    }
  }

  async add(clip) {
    const c = { ...clip, at: Date.now() };
    this.clips.push(c);
    // نحتفظ بالأوضح: الصرخات أولاً ثم الأعلى
    this.clips.sort((a, b) => b.peak - a.peak);
    this.clips.length = Math.min(this.clips.length, MAX_CLIPS);
    if (this.persist) await this.#rewrite(this.clips).catch(() => {});
  }

  async #rewrite(list) {
    await tx('readwrite', (s) => {
      s.clear();
      for (const c of list) s.add({ samples: c.samples, sampleRate: c.sampleRate, peak: c.peak, kind: c.kind, at: c.at });
    });
  }

  async clear() {
    this.clips = [];
    await tx('readwrite', (s) => s.clear()).catch(() => {});
  }

  pick(kind) {
    const pool = kind ? this.clips.filter((c) => c.kind === kind) : this.clips;
    const list = pool.length ? pool : this.clips;
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  // تشغيل المقطع من مكان معيّن بعد تشويهه. distortion من 0 (شبه طبيعي) إلى 1 (مرعب)
  play(clip, pos, distortion = 0) {
    const e = this.engine;
    const ctx = e.ctx;
    const buf = ctx.createBuffer(1, clip.samples.length, clip.sampleRate);
    buf.copyToChannel(clip.samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.94 - distortion * 0.18; // أخفض وأبطأ مع الوقت
    const shaper = ctx.createWaveShaper();
    const k = distortion * 40;
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    shaper.curve = curve;
    const gain = ctx.createGain();
    gain.gain.value = 2.2 * (e.voiceLevel ?? 1);
    const wet = ctx.createGain();
    wet.gain.value = 0.3 + distortion * 0.5;
    const pan = e.panner(pos);
    src.connect(shaper).connect(gain).connect(pan);
    gain.connect(wet).connect(e.reverb);
    // أحياناً بالذروة: نسخة ثانية معكوسة ومتأخرة
    if (distortion > 0.7 && Math.random() < 0.5) {
      const rev = ctx.createBuffer(1, buf.length, buf.sampleRate);
      rev.copyToChannel(clip.samples.slice().reverse(), 0);
      const r = ctx.createBufferSource();
      r.buffer = rev;
      r.playbackRate.value = 0.7;
      const rg = ctx.createGain();
      rg.gain.value = 0.6;
      r.connect(rg).connect(pan);
      r.start(e.now + buf.duration * 0.6);
    }
    const dur = buf.duration / src.playbackRate.value;
    e.speaking = true;
    src.onended = () => (e.speaking = false);
    src.start();
    return dur;
  }
}
