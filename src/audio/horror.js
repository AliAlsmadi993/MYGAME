// أصوات رعب مولّدة برمجياً: صوت أنثوي مشوّه (formants)، همس، تنفّس، صرير، رعد، عواء، ونغمات فزع.
// كل دالة بتاخذ المحرّك (e) ومكان الصوت (pos أو null) وبتشغّل فوراً.

// وجهة الصوت: مكاني + إرسال للصدى
function out(e, pos, vol = 1, wet = 0.35) {
  const g = e.ctx.createGain();
  g.gain.value = vol;
  const dest = pos ? e.panner(pos) : e.master;
  g.connect(dest);
  const send = e.ctx.createGain();
  send.gain.value = wet;
  g.connect(send).connect(e.reverb);
  return g;
}

function shaper(ctx, amount) {
  const ws = ctx.createWaveShaper();
  const c = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    c[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  ws.curve = c;
  return ws;
}

function noiseSrc(e, dur, t) {
  const s = e.ctx.createBufferSource();
  s.buffer = e.noise;
  s.start(t, Math.random() * 2, dur);
  return s;
}

// أحرف علّة (formants) لصوت أنثوي
const VOWELS = {
  a: [850, 1220, 2810],
  o: [590, 880, 2540],
  u: [370, 950, 2670],
  i: [310, 2790, 3310],
  e: [560, 2320, 2950],
};

// صوت حنجرة: pitch = [[وقت, تردد], ...]، vowel حرف أو قائمة حروف بتتبدّل
function voice(e, dest, t, dur, { pitch, vowel = 'a', breath = 0.3, drive = 3, vib = 6, vibDepth = 12, jitter = 0 }) {
  const ctx = e.ctx;
  const src = ctx.createOscillator();
  src.type = 'sawtooth';
  src.frequency.setValueAtTime(pitch[0][1], t);
  for (const [dt, f] of pitch.slice(1)) src.frequency.linearRampToValueAtTime(f, t + dt);
  const v = ctx.createOscillator();
  const vg = ctx.createGain();
  v.frequency.value = vib;
  vg.gain.value = vibDepth;
  v.connect(vg).connect(src.frequency);
  if (jitter) {
    // خشونة: تقطيع عشوائي للنبرة
    const j = ctx.createBufferSource();
    j.buffer = e.noise;
    const jl = ctx.createBiquadFilter();
    jl.type = 'lowpass';
    jl.frequency.value = 40;
    const jg = ctx.createGain();
    jg.gain.value = jitter;
    j.connect(jl).connect(jg).connect(src.frequency);
    j.start(t, Math.random(), dur);
  }
  const pre = ctx.createGain();
  pre.gain.value = 0.5;
  src.connect(pre);
  // نفَس مخلوط
  const n = noiseSrc(e, dur, t);
  const ng = ctx.createGain();
  ng.gain.value = breath;
  n.connect(ng).connect(pre);
  const sum = ctx.createGain();
  sum.gain.value = 0.8;
  const vowels = Array.isArray(vowel) ? vowel : [vowel];
  VOWELS[vowels[0]].forEach((f, k) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 9 + k * 3;
    bp.frequency.setValueAtTime(f, t);
    vowels.slice(1).forEach((vw, idx) => bp.frequency.linearRampToValueAtTime(VOWELS[vw][k], t + ((idx + 1) / vowels.length) * dur));
    const fg = ctx.createGain();
    fg.gain.value = [1, 0.6, 0.25][k];
    pre.connect(bp).connect(fg).connect(sum);
  });
  const ws = shaper(ctx, drive);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(1, t + Math.min(0.15, dur * 0.2));
  env.gain.setValueAtTime(1, t + dur * 0.7);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  sum.connect(ws).connect(env).connect(dest);
  src.start(t);
  v.start(t);
  src.stop(t + dur + 0.05);
  v.stop(t + dur + 0.05);
  return env;
}

export const horror = {
  // همهمة التهويدة بصوت أنثوي مكتوم
  hum(e, dest, freq, dur) {
    voice(e, dest, e.now, dur, { pitch: [[0, freq], [dur, freq * 0.98]], vowel: ['u', 'o'], breath: 0.25, drive: 1.5, vib: 5.5, vibDepth: 5 });
  },

  // صرخة السعلوة: صوت أنثوي عالي بيتكسّر
  scream(e, pos, vol = 1) {
    if (e.sample?.('scream', pos, vol, { wet: 0.4 })) return;
    const t = e.now;
    const d = out(e, pos, vol * 0.9, 0.5);
    voice(e, d, t, 1.8, { pitch: [[0, 620], [0.15, 1150], [0.9, 980], [1.8, 420]], vowel: ['a', 'e', 'a'], breath: 0.5, drive: 12, vib: 9, vibDepth: 45, jitter: 60 });
    voice(e, d, t + 0.03, 1.7, { pitch: [[0, 900], [0.2, 1500], [1.7, 600]], vowel: 'i', breath: 0.3, drive: 18, vib: 11, vibDepth: 70, jitter: 90 });
  },

  // ضحكة بطيئة "ها… ها… ها"
  laugh(e, pos, vol = 1) {
    if (e.sample?.('laugh', pos, vol, { wet: 0.4 })) return;
    const t = e.now;
    const d = out(e, pos, vol * 0.7, 0.6);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const f = 330 - i * 30;
      voice(e, d, t + i * 0.32, 0.26, { pitch: [[0, f * 1.1], [0.26, f * 0.85]], vowel: 'a', breath: 0.8, drive: 4, vib: 5, vibDepth: 8 });
    }
  },

  // همس بكلام غير مفهوم
  whisper(e, pos, vol = 1, dur = 2) {
    if (e.sample?.('whisper', pos, vol, { wet: 0.3 })) return;
    const ctx = e.ctx;
    const t = e.now;
    const d = out(e, pos, vol * 1.3, 0.3);
    const n = noiseSrc(e, dur, t);
    const bp1 = ctx.createBiquadFilter();
    const bp2 = ctx.createBiquadFilter();
    bp1.type = bp2.type = 'bandpass';
    bp1.Q.value = 6;
    bp2.Q.value = 8;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    let tt = t;
    const keys = Object.keys(VOWELS);
    while (tt < t + dur) {
      const vw = VOWELS[keys[Math.floor(Math.random() * keys.length)]];
      const syl = 0.08 + Math.random() * 0.14;
      bp1.frequency.setValueAtTime(vw[0] * 1.3, tt);
      bp2.frequency.setValueAtTime(vw[1] * 1.2, tt);
      env.gain.exponentialRampToValueAtTime(0.5 + Math.random() * 0.5, tt + syl * 0.3);
      env.gain.exponentialRampToValueAtTime(0.02, tt + syl);
      tt += syl + (Math.random() < 0.25 ? 0.15 : 0.02);
    }
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400; // "سسس" الهمس
    const hg = ctx.createGain();
    hg.gain.value = 0.35;
    n.connect(bp1).connect(env);
    n.connect(bp2).connect(env);
    n.connect(hp).connect(hg).connect(env);
    env.connect(d);
  },

  // خرخرة منخفضة لما تطارد
  growl(e, pos, vol = 1) {
    if (e.sample?.('growl', pos, vol)) return;
    const t = e.now;
    const d = out(e, pos, vol, 0.3);
    voice(e, d, t, 1.3, { pitch: [[0, 85], [0.6, 70], [1.3, 95]], vowel: ['o', 'u'], breath: 0.9, drive: 20, vib: 23, vibDepth: 25, jitter: 30 });
  },

  // نفس خشن مكاني (شهيق وزفير)
  breath(e, pos, vol = 1, inhale = true) {
    if (e.sample?.(inhale ? 'breath_in' : 'breath_out', pos, vol, { wet: 0.1 })) return;
    const ctx = e.ctx;
    const t = e.now;
    const dur = inhale ? 1.1 : 1.4;
    const d = out(e, pos, vol, 0.2);
    const n = noiseSrc(e, dur, t);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(inhale ? 900 : 1300, t);
    bp.frequency.linearRampToValueAtTime(inhale ? 1500 : 700, t + dur);
    // حشرجة
    const rasp = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = inhale ? 38 : 27;
    const lg = ctx.createGain();
    lg.gain.value = 0.5;
    lfo.connect(lg).connect(rasp.gain);
    rasp.gain.value = 0.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.6, t + dur * 0.4);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(rasp).connect(env).connect(d);
    lfo.start(t);
    lfo.stop(t + dur);
  },

  // صرير خشب
  creak(e, pos, vol = 1) {
    if (e.sample?.('creak', pos, vol)) return;
    const ctx = e.ctx;
    const t = e.now;
    const dur = 0.6 + Math.random() * 0.9;
    const d = out(e, pos, vol * 0.5, 0.4);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = 90 + Math.random() * 120;
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * (0.7 + Math.random() * 0.8), t + dur);
    // احتكاك: تقطيع سريع
    const am = ctx.createGain();
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(18 + Math.random() * 20, t);
    lfo.frequency.linearRampToValueAtTime(8 + Math.random() * 30, t + dur);
    const lg = ctx.createGain();
    lg.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain);
    am.gain.value = 0.5;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.7, t + 0.08);
    env.gain.setValueAtTime(0.7, t + dur - 0.1);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(am).connect(bp).connect(env).connect(d);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur);
    lfo.stop(t + dur);
  },

  // نقطة مي بالقبو
  drip(e, pos, vol = 1) {
    if (e.sample?.('drip', pos, vol, { wet: 0.5 })) return;
    const ctx = e.ctx;
    const t = e.now;
    const d = out(e, pos, vol * 0.4, 0.8);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(1600 + Math.random() * 600, t);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(d);
    o.start(t);
    o.stop(t + 0.15);
  },

  // رعد
  thunder(e, delay = 0.8, vol = 1) {
    if (e.variants?.('thunder').length) {
      setTimeout(() => e.sample('thunder', null, vol, { wet: 0.3 }), delay * 1000);
      return;
    }
    const ctx = e.ctx;
    const t = e.now + delay;
    const d = out(e, null, vol * 0.9, 0.5);
    const dur = 3.5 + Math.random() * 2;
    const n = noiseSrc(e, dur, t);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.05);
    env.gain.exponentialRampToValueAtTime(0.35, t + 0.6);
    env.gain.linearRampToValueAtTime(0.5, t + 1.2);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(lp).connect(env).connect(d);
  },

  // عواء كلب بعيد
  howl(e, vol = 1) {
    if (e.sample?.('howl', { x: (e.lastListener?.x ?? 0) + 40, y: 2, z: -30 }, vol, { wet: 0.6 })) return;
    const t = e.now;
    const d = out(e, { x: e.lastListener?.x + 40 || 80, y: 2, z: -30 }, vol * 0.5, 0.8);
    voice(e, d, t, 2.8, { pitch: [[0, 420], [0.4, 620], [2.2, 560], [2.8, 380]], vowel: ['o', 'u'], breath: 0.2, drive: 2, vib: 5, vibDepth: 10 });
  },

  // نغمة فزع لما تشوفك: عنقود متنافر بيعلى
  sting(e, vol = 1) {
    if (e.sample?.('sting', null, vol, { wet: 0.3 })) return;
    const ctx = e.ctx;
    const t = e.now;
    const d = out(e, null, vol * 0.35, 0.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(4000, t + 0.4);
    lp.frequency.exponentialRampToValueAtTime(600, t + 2.2);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.06);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    lp.connect(env).connect(d);
    for (const semi of [0, 1, 6, 11, 13, 18]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 110 * Math.pow(2, semi / 12) * (1 + (Math.random() - 0.5) * 0.01);
      o.connect(lp);
      o.start(t);
      o.stop(t + 2.5);
    }
    const n = noiseSrc(e, 2.4, t);
    n.connect(lp);
  },

  // نغمة عود منخفضة ومشوّهة وقت الخطر (مقام حجاز)
  oud(e, vol = 1) {
    if (e.sample?.('oud', null, vol * 0.6, { wet: 0.5 })) return;
    const ctx = e.ctx;
    const t = e.now;
    const semis = [0, 1, 4, 5, 7, 8, 10];
    const f = 98 * Math.pow(2, semis[Math.floor(Math.random() * semis.length)] / 12);
    const d = out(e, null, vol * 0.3, 0.7);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 1.2);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    lp.connect(shaper(ctx, 4)).connect(env).connect(d);
    // وتر مزدوج بفرق بسيط + انزلاق نازل (ريشة ثقيلة)
    for (const det of [0.997, 1.004]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * det * 1.02, t);
      o.frequency.exponentialRampToValueAtTime(f * det * 0.985, t + 1.5);
      o.connect(lp);
      o.start(t);
      o.stop(t + 2.3);
    }
  },

  // خطوات اللاعب حسب الأرضية
  step(e, surface, vol = 1) {
    if (e.sample?.(`step_${surface}`, null, vol * 0.7, { wet: 0.05 })) return;
    // خشب بدون تسجيل خاص: نفس خطوات الحجر بس أوطى
    if (surface === 'wood' && e.sample?.('step_stone', null, vol * 0.6, { wet: 0.05, rate: 0.82 })) return;
    const ctx = e.ctx;
    const t = e.now;
    const d = out(e, null, vol, 0.15);
    const n = noiseSrc(e, 0.2, t);
    const f = ctx.createBiquadFilter();
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    if (surface === 'wood') {
      f.type = 'lowpass';
      f.frequency.value = 500;
      env.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      if (Math.random() < 0.15) horror.creak(e, null, 0.25);
    } else if (surface === 'dirt') {
      f.type = 'bandpass';
      f.frequency.value = 2200;
      f.Q.value = 0.7;
      env.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    } else {
      f.type = 'bandpass';
      f.frequency.value = 1100;
      f.Q.value = 1.2;
      env.gain.exponentialRampToValueAtTime(0.25, t + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    }
    n.connect(f).connect(env).connect(d);
  },
};

// طبقة خلفية: همهمة منخفضة مقلقة بتعلى مع الخوف
export function drone(e) {
  const ctx = e.ctx;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 180;
  g.connect(e.amb ?? e.master);
  lp.connect(g);
  for (const f of [41, 43.3, 61.7, 82.4]) {
    const o = ctx.createOscillator();
    o.type = f > 60 ? 'triangle' : 'sine';
    o.frequency.value = f;
    const og = ctx.createGain();
    og.gain.value = f > 60 ? 0.25 : 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.1;
    const lg = ctx.createGain();
    lg.gain.value = 0.2;
    lfo.connect(lg).connect(og.gain);
    o.connect(og).connect(lp);
    o.start();
    lfo.start();
  }
  // تنفّس اللاعب لما يخاف كثير
  return {
    setFear(f) {
      g.gain.setTargetAtTime(0.05 + f * 0.25, e.now, 0.8);
      lp.frequency.setTargetAtTime(180 + f * 500, e.now, 0.8);
    },
  };
}
