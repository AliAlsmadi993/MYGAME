// محرّك الصوت: كل الأصوات مولّدة برمجياً (بدون ملفات) ومكانية ثلاثية الأبعاد.
import { horror, drone } from './horror.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.speaking = false; // لما السعلوة بتحكي أو بتقلّد: نسكّر أذن المايك حتى ما تسمع حالها
    this.screamScale = 1; // إعداد "تقليل الصراخ المفاجئ"
    this.masterLevel = 0.9;
    this.voiceLevel = 1; // صوت السعلوة وتسجيلات اللاعب
    this.onSound = null; // (kind, pos) لترجمة الأصوات
  }

  // مستويات الصوت من الإعدادات
  setVolumes({ volMaster = 1, volVoice = 1, volAmb = 1 } = {}) {
    this.masterLevel = 0.9 * volMaster;
    this.voiceLevel = volVoice;
    this.ambLevel = volAmb;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.masterLevel, this.now, 0.05);
    this.amb.gain.setTargetAtTime(volAmb, this.now, 0.05);
  }

  start() {
    if (this.ctx) return this.ctx.resume();
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    // ضاغط حتى ما يطلع صوت مؤذي للأذن
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 8;
    this.master.connect(comp).connect(ctx.destination);
    this.out = comp;
    this.master.gain.value = this.masterLevel;
    // الأجواء (ريح، مطر، همهمة) إلها مستوى لحالها
    this.amb = ctx.createGain();
    this.amb.gain.value = this.ambLevel ?? 1;
    this.amb.connect(this.master);
    this.noise = this.#noiseBuffer(3);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.#impulse(2.6, 2.5);
    this.reverb.connect(this.master);
    this.#ambience();
    this.#heart();
    this.drone = drone(this);
    return ctx.resume();
  }

  // صمت متعمّد قبل الأحداث الكبيرة: بنوطّي كل شي شوي وبنرجّعه
  duck(seconds = 2, depth = 0.12) {
    if (!this.ctx) return;
    const g = this.master.gain;
    const t = this.now;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(this.masterLevel * depth, t + 0.4);
    g.setValueAtTime(this.masterLevel * depth, t + seconds);
    g.linearRampToValueAtTime(this.masterLevel, t + seconds + 0.15);
  }

  // نسخة من صوت اللعبة كـ MediaStream (لتسجيل الفيديو)
  tap() {
    if (!this.tapNode) {
      this.tapNode = this.ctx.createMediaStreamDestination();
      this.out.connect(this.tapNode);
    }
    return this.tapNode.stream;
  }

  get now() {
    return this.ctx.currentTime;
  }

  #noiseBuffer(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  #impulse(sec, decay) {
    const len = this.ctx.sampleRate * sec;
    const b = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  #noiseSrc(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  // ريح ومطر بالخلفية
  #ambience() {
    const ctx = this.ctx;
    const wind = this.#noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 400;
    bp.Q.value = 0.8;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(bp.frequency);
    const wg = ctx.createGain();
    wg.gain.value = 0.12;
    wind.connect(bp).connect(wg).connect(this.amb);
    const rain = this.#noiseSrc();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000;
    const rg = ctx.createGain();
    rg.gain.value = 0.025;
    rain.connect(hp).connect(rg).connect(this.amb);
    wind.start();
    rain.start();
    lfo.start();
  }

  // نبض القلب: بيعلى ويسرع مع الخوف
  #heart() {
    this.fear = 0;
    const beat = () => {
      if (!this.ctx) return;
      const f = this.fear;
      if (f > 0.15) {
        this.#thump(this.now, 0.25 * f, 55);
        this.#thump(this.now + 0.18, 0.16 * f, 48);
      }
      setTimeout(beat, 60000 / (60 + f * 90));
    };
    beat();
  }

  #thump(t, vol, freq) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(freq * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.25);
  }

  setListener(pos, forward) {
    if (!this.ctx) return;
    this.lastListener = pos;
    const l = this.ctx.listener;
    const t = this.now;
    if (l.positionX) {
      l.positionX.setValueAtTime(pos.x, t);
      l.positionY.setValueAtTime(pos.y, t);
      l.positionZ.setValueAtTime(pos.z, t);
      l.forwardX.setValueAtTime(forward.x, t);
      l.forwardY.setValueAtTime(forward.y, t);
      l.forwardZ.setValueAtTime(forward.z, t);
      l.upX.setValueAtTime(0, t);
      l.upY.setValueAtTime(1, t);
      l.upZ.setValueAtTime(0, t);
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
  }

  panner(pos) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 2;
    p.rolloffFactor = 1.4;
    p.maxDistance = 60;
    this.movePanner(p, pos);
    p.connect(this.master);
    return p;
  }

  movePanner(p, pos) {
    const t = this.now;
    if (p.positionX) {
      p.positionX.setValueAtTime(pos.x, t);
      p.positionY.setValueAtTime(pos.y ?? 1.6, t);
      p.positionZ.setValueAtTime(pos.z, t);
    } else p.setPosition(pos.x, pos.y ?? 1.6, pos.z);
  }

  // أصوات لحظية بمكان معيّن
  playAt(kind, pos, vol = 1) {
    if (!this.ctx) return;
    this.onSound?.(kind, pos);
    const h = { shriek: 'scream', laugh: 'laugh', whisper: 'whisper', growl: 'growl', creak: 'creak', drip: 'drip' }[kind];
    if (kind === 'shriek') vol *= this.screamScale;
    if (h) return horror[h](this, pos, vol);
    if (kind === 'grab') {
      vol *= this.screamScale;
      horror.scream(this, null, 1.2 * this.screamScale);
      horror.sting(this, 1.3 * this.screamScale);
    }
    const ctx = this.ctx;
    const out = pos ? this.panner(pos) : this.master;
    const g = ctx.createGain();
    g.connect(out);
    const t = this.now;
    const env = (a, d, peak) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak * vol, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    };
    const osc = (type, f0, f1, dur) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.05);
      return o;
    };
    const noise = (dur, type, freq) => {
      const s = this.#noiseSrc(false);
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      s.connect(f).connect(g);
      s.start(t, Math.random() * 2, dur);
    };
    switch (kind) {
      case 'mstep': // خطوة حافية للسعلوة
        env(0.005, 0.18, 0.5);
        noise(0.2, 'lowpass', 300);
        break;
      case 'pstep': // خطوة اللاعب
        env(0.005, 0.1, 0.12);
        noise(0.12, 'lowpass', 600);
        break;
      case 'bell':
        env(0.005, 1.6, 0.35);
        osc('sine', 1760, null, 1.6);
        osc('sine', 2637, null, 1.2);
        break;
      case 'chime': // ساعة الحيط
        env(0.01, 2.5, 0.4);
        osc('triangle', 392, null, 2.5);
        osc('sine', 784, null, 2);
        break;
      case 'shriek': // صرخة السعلوة
        env(0.05, 1.4, 0.7);
        osc('sawtooth', 900, 300, 1.4);
        osc('sawtooth', 1300, 420, 1.4);
        noise(1.4, 'bandpass', 1800);
        break;
      case 'laugh': {
        env(0.02, 1.8, 0.35);
        const o = osc('triangle', 330, 180, 1.8);
        const trem = ctx.createOscillator();
        const tg = ctx.createGain();
        trem.frequency.value = 7;
        tg.gain.value = 60;
        trem.connect(tg).connect(o.frequency);
        trem.start(t);
        trem.stop(t + 1.9);
        break;
      }
      case 'knock':
        for (let i = 0; i < 3; i++) this.#thumpAt(g, t + i * 0.28);
        g.gain.value = vol;
        break;
      case 'pickup':
        env(0.01, 0.4, 0.2);
        osc('sine', 660, 990, 0.3);
        break;
      case 'jingle': // الخلخال
        env(0.003, 0.35, 0.18);
        osc('sine', 3200, null, 0.35);
        osc('sine', 4100, null, 0.25);
        break;
      case 'pant': // لهاث
        env(0.15, 0.5, 0.25);
        noise(0.65, 'bandpass', 900);
        break;
      case 'grab': // لحظة الإمساك
        env(0.01, 2.2, 0.6);
        osc('sawtooth', 120, 60, 2.2);
        noise(2.2, 'lowpass', 1500);
        osc('square', 700, 200, 1.2);
        break;
      case 'ritual':
        env(0.1, 3, 0.4);
        osc('sine', 220, 110, 3);
        osc('sine', 330, 165, 3);
        break;
      case 'whisper':
        env(0.2, 1.5, 0.3);
        noise(1.7, 'bandpass', 2500);
        break;
      case 'slam': // باب بينصفق
        g.gain.value = vol * 1.4;
        this.#thumpAt(g, t);
        this.#thumpAt(g, t + 0.06);
        horror.creak(this, pos, 0.5 * vol);
        break;
      case 'toys': { // علبة موسيقى بتدق لحالها
        g.gain.value = vol * 0.25;
        [0, 4, 7, 12, 7, 4, 11].forEach((semi, i) => {
          const o = ctx.createOscillator();
          const og = ctx.createGain();
          const tt = t + i * 0.32 * (1 + i * 0.08); // بتبطّى متل اللي خلص زمبركها
          o.frequency.value = 1046 * Math.pow(2, semi / 12);
          og.gain.setValueAtTime(0.0001, tt);
          og.gain.exponentialRampToValueAtTime(1, tt + 0.005);
          og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.6);
          o.connect(og).connect(g);
          o.start(tt);
          o.stop(tt + 0.65);
        });
        break;
      }
      case 'ring': // رنّة تلفون قديم (جرسين بسرعة)
        g.gain.value = vol * 0.3;
        for (const off of [0, 0.4]) {
          for (let k = 0; k < 14; k++) {
            const o = ctx.createOscillator();
            const og = ctx.createGain();
            const tt = t + off + k * 0.025;
            o.type = 'square';
            o.frequency.value = k % 2 ? 1150 : 1300;
            og.gain.setValueAtTime(0.5, tt);
            og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.024);
            o.connect(og).connect(g);
            o.start(tt);
            o.stop(tt + 0.03);
          }
        }
        break;
      case 'teleport': // سحبة معكوسة: إنذار إنها اختفت أو ظهرت
        env(1.2, 0.25, 0.5);
        noise(1.5, 'bandpass', 700);
        osc('sawtooth', 60, 400, 1.4);
        break;
      case 'match': // حكّة عود كبريت
        env(0.005, 0.5, 0.3);
        noise(0.55, 'highpass', 2500);
        break;
      case 'salt': // رشّة ملح
        env(0.05, 0.9, 0.12);
        noise(1, 'highpass', 5000);
        break;
      case 'gasp': // شهقة بعد حبس النفَس
        env(0.03, 0.5, 0.45);
        noise(0.55, 'bandpass', 1400);
        break;
      case 'glass': // دعسة على زجاج مكسور
        g.gain.value = vol * 0.5;
        for (let i = 0; i < 5; i++) {
          const tt = t + i * 0.025 + Math.random() * 0.02;
          const s = this.#noiseSrc(false);
          const f = ctx.createBiquadFilter();
          f.type = 'highpass';
          f.frequency.value = 3500 + Math.random() * 3000;
          const og = ctx.createGain();
          og.gain.setValueAtTime(0.8, tt);
          og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05);
          s.connect(f).connect(og).connect(g);
          s.start(tt, Math.random() * 2, 0.06);
        }
        break;
      case 'splash': // مي الخزان
        env(0.02, 0.9, 0.35);
        noise(1, 'lowpass', 900);
        noise(0.5, 'bandpass', 2500);
        break;
      case 'unlock': // قفل حديد قديم
        env(0.002, 0.25, 0.4);
        osc('square', 180, 90, 0.2);
        noise(0.25, 'bandpass', 2000);
        break;
      case 'click': // زر المسجّل
        env(0.001, 0.05, 0.4);
        noise(0.06, 'bandpass', 3000);
        break;
    }
  }

  #thumpAt(dest, t) {
    const s = this.#noiseSrc(false);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 250;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    s.connect(f).connect(g).connect(dest);
    s.start(t, 0, 0.16);
  }

  // تهويدة السعلوة: بتغنيها وهي تتجوّل، إنذار للاعب
  lullaby(panner) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(panner);
    const notes = [0, 3, 5, 3, 0, -2, 0, 3, 7, 5, 3, 2, 0];
    let i = 0;
    let alive = true;
    g.stop = () => {
      alive = false;
      g.disconnect();
    };
    const sing = () => {
      if (!alive) return;
      horror.hum(this, g, 220 * Math.pow(2, notes[i % notes.length] / 12), 0.9);
      i++;
      setTimeout(sing, i % notes.length === 0 ? 3500 : 700);
    };
    sing();
    return g;
  }

  // راديو قديم: تشويش ولحن مشوّه، بيرجع دالة لإطفائه
  radio(pos, seconds = 20) {
    const ctx = this.ctx;
    const p = this.panner(pos);
    const g = ctx.createGain();
    g.gain.value = 0.35;
    g.connect(p);
    const st = this.#noiseSrc();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.6;
    const sg = ctx.createGain();
    sg.gain.value = 0.35;
    st.connect(bp).connect(sg).connect(g);
    st.start();
    // لحن عود بعيد (مقام حجاز) بيطلع وبيغيب بالتشويش
    const notes = [0, 1, 4, 5, 7, 5, 4, 1, 0, -1, 0];
    let i = 0;
    let alive = true;
    const pluck = () => {
      if (!alive) return;
      const t = this.now;
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 196 * Math.pow(2, notes[i++ % notes.length] / 12) * (1 + (Math.random() - 0.5) * 0.02);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.5 * (0.3 + Math.random() * 0.7), t + 0.01);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 0.75);
      setTimeout(pluck, 380 + Math.random() * 250);
    };
    pluck();
    const stop = () => {
      if (!alive) return;
      alive = false;
      g.gain.setTargetAtTime(0, this.now, 0.05);
      setTimeout(() => {
        st.stop();
        p.disconnect();
      }, 300);
    };
    setTimeout(stop, seconds * 1000);
    return stop;
  }

  // صوت الجدة بالأشرطة والتلفون: قراءة آلية أهدى، مع خشخشة شريط
  grandma(text, pos) {
    if (pos) this.playAt('whisper', pos, 0.3);
    this.speak(text, null, 'ar', { pitch: 0.7, rate: 0.85, volume: 0.8 });
  }

  // صوت السعلوة وهي تحكي: قراءة آلية بصوت ثقيل كمرحلة أولى + همس مكاني
  speak(text, pos, lang = 'ar', { pitch = 0.1, rate = 0.75, volume = 0.9 } = {}) {
    if (pos) horror.whisper(this, pos, 0.9, 2.5);
    const synth = window.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    // lang ممكن تكون 'ar' أو لهجة محددة زي 'ar-EG': منفضّل صوت اللهجة إذا موجود
    const base = lang.slice(0, 2);
    u.lang = lang.includes('-') ? lang : base === 'ar' ? 'ar-SA' : 'en-US';
    const voices = synth.getVoices();
    const v = voices.find((x) => x.lang === u.lang) || voices.find((x) => x.lang?.startsWith(base));
    if (v) u.voice = v;
    u.pitch = pitch;
    u.rate = rate;
    u.volume = Math.min(1, volume * this.voiceLevel);
    this.speaking = true;
    u.onend = u.onerror = () => (this.speaking = false);
    synth.cancel();
    synth.speak(u);
    setTimeout(() => (this.speaking = false), 8000);
  }
}
