// أذن السعلوة: قراءة المايك، المعايرة، بوابة الضجيج، والتقاط مقاطع من صوت اللاعب.
const BLOCK = 2048;

export class Mic {
  constructor(engine) {
    this.engine = engine;
    this.enabled = false;
    this.db = -100;
    this.level = 0; // 0 = صمت الغرفة، 1 = كلام عادي، 2+ = صراخ
    this.floor = -60;
    this.speech = -30;
    this.recordEnabled = true;
    this.gain = 1; // حساسية إضافية من الإعدادات
    this.onClip = null;
    this.onLevel = null;
    this.#pre = [];
    this.#cap = null;
    this.#manual = null;
  }

  #pre;
  #cap;
  #manual;

  // مسجّل الكاسيت: بيسجّل الثواني الجاية كما هي (اللاعب بيحكي فيه قصداً)
  recordNext(seconds = 3) {
    if (!this.enabled) return Promise.resolve(null);
    return new Promise((resolve) => (this.#manual = { chunks: [], need: seconds, resolve }));
  }

  async enable(deviceId = '') {
    const ctx = this.engine.ctx;
    const audio = { echoCancellation: true, noiseSuppression: false, autoGainControl: false };
    if (deviceId) audio.deviceId = { exact: deviceId };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    const src = ctx.createMediaStreamSource(this.stream);
    const proc = ctx.createScriptProcessor(BLOCK, 1, 1);
    const sink = ctx.createGain();
    sink.gain.value = 0;
    src.connect(proc).connect(sink).connect(ctx.destination);
    proc.onaudioprocess = (e) => this.#process(e.inputBuffer.getChannelData(0), ctx.sampleRate);
    this.proc = proc;
    this.enabled = true;
  }

  disable() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.proc?.disconnect();
    this.enabled = false;
    this.level = 0;
  }

  #process(data, rate) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const db = 10 * Math.log10(sum / data.length + 1e-10);
    // تنعيم سريع للصعود وبطيء للنزول
    this.db = db > this.db ? db : this.db * 0.7 + db * 0.3;
    const muted = this.engine.speaking;
    this.level = muted ? 0 : Math.max(0, ((this.db - this.floor) / Math.max(6, this.speech - this.floor)) * this.gain);
    this.onLevel?.(this.level, this.db);
    this.#capture(Float32Array.from(data), rate, muted);
    const man = this.#manual;
    if (man) {
      man.chunks.push(Float32Array.from(data));
      if ((man.chunks.length * BLOCK) / rate >= man.need) {
        this.#manual = null;
        const samples = new Float32Array(man.chunks.length * BLOCK);
        man.chunks.forEach((c, i) => samples.set(c, i * BLOCK));
        man.resolve({ samples, sampleRate: rate, peak: 1, kind: 'talk' });
      }
    }
  }

  // تسجيل مقطع لما اللاعب يحكي أو يصرّخ (مع ربع ثانية قبلها)
  #capture(chunk, rate, muted) {
    const lvl = this.level;
    this.#pre.push(chunk);
    const preMax = Math.ceil((0.3 * rate) / BLOCK);
    while (this.#pre.length > preMax) this.#pre.shift();
    if (!this.recordEnabled || muted) {
      this.#cap = null;
      return;
    }
    if (!this.#cap && lvl > 0.7) this.#cap = { chunks: [...this.#pre], quiet: 0, peak: lvl };
    if (!this.#cap) return;
    const cap = this.#cap;
    cap.chunks.push(chunk);
    cap.peak = Math.max(cap.peak, lvl);
    cap.quiet = lvl < 0.4 ? cap.quiet + BLOCK / rate : 0;
    const dur = (cap.chunks.length * BLOCK) / rate;
    if (cap.quiet > 0.45 || dur > 3) {
      this.#cap = null;
      if (dur < 0.6) return;
      const samples = new Float32Array(cap.chunks.length * BLOCK);
      cap.chunks.forEach((c, i) => samples.set(c, i * BLOCK));
      this.onClip?.({ samples, sampleRate: rate, peak: cap.peak, kind: classifyClip(samples, rate, cap.peak) });
    }
  }

  // معايرة: صمت ثم "مين هون؟"
  async calibrate(onPhase) {
    const sample = async (ms) => {
      const vals = [];
      const prev = this.onLevel;
      this.onLevel = (l, db) => vals.push(db);
      await new Promise((r) => setTimeout(r, ms));
      this.onLevel = prev;
      return vals.sort((a, b) => a - b);
    };
    const rec = this.recordEnabled;
    this.recordEnabled = false;
    onPhase?.('silence');
    const quiet = await sample(3500);
    this.floor = quiet[Math.floor(quiet.length * 0.8)] ?? -60;
    onPhase?.('speak');
    const talk = await sample(3000);
    const loud = talk[Math.floor(talk.length * 0.9)] ?? this.floor + 20;
    this.speech = Math.max(loud, this.floor + 12);
    this.recordEnabled = rec;
    onPhase?.('done');
    return { floor: this.floor, speech: this.speech };
  }
}

// تصنيف بسيط للمقطع (قسم 11): صرخة، ضحكة (نبضات متكررة)، نفَس (واطي وطويل)، أو كلام.
// peak بنفس مقياس level (1 = كلام عادي)
export function classifyClip(samples, rate, peak) {
  if (peak > 2.2) return 'scream';
  const win = Math.floor(rate * 0.05);
  const env = [];
  for (let i = 0; i + win <= samples.length; i += win) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += samples[j] * samples[j];
    env.push(Math.sqrt(s / win));
  }
  const max = Math.max(...env, 1e-9);
  // نعدّ النبضات: صعود فوق 60% من الأعلى بعد نزول تحت 30%
  let bursts = 0;
  let low = true;
  for (const v of env) {
    if (low && v > max * 0.6) {
      bursts++;
      low = false;
    } else if (v < max * 0.3) low = true;
  }
  const secs = samples.length / rate;
  if (bursts >= 4 && bursts / secs >= 2.5) return 'laugh';
  if (peak < 1 && bursts <= 2 && secs > 1) return 'breath';
  return 'talk';
}

// تصنيف المستوى حسب جدول وثيقة التصميم (مدى السماع بالمتر ودقة التحديد)
export function levelToNoise(level) {
  if (level < 0.3) return null;
  if (level < 0.7) return { radius: 3, precision: 1, label: 'whisper' };
  if (level < 1.4) return { radius: 11, precision: 3, label: 'talk' };
  if (level < 2.2) return { radius: 22, precision: 2, label: 'loud' };
  return { radius: 60, precision: 0, label: 'scream' };
}
