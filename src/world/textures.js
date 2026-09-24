// مواد واقعية مولّدة برمجياً (بدون ملفات وبدون حقوق): لون + خريطة نتوءات (normal) + خشونة.
import * as THREE from 'three';

const SIZE = 512;

// ضجيج قيمي قابل للتكرار (tileable)
function makeNoise(seed) {
  const perm = new Uint8Array(512);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const p = [...Array(256).keys()].sort(() => rnd() - 0.5);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grid = (x, y, per) => perm[(perm[((x % per) + per) % per] + (((y % per) + per) % per)) & 511] / 255;
  const smooth = (t) => t * t * (3 - 2 * t);
  const value = (x, y, per) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const a = grid(xi, yi, per);
    const b = grid(xi + 1, yi, per);
    const c = grid(xi, yi + 1, per);
    const d = grid(xi + 1, yi + 1, per);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  // fbm: u,v من 0 إلى 1
  return (u, v, freq = 4, oct = 5) => {
    let sum = 0;
    let amp = 0.5;
    let f = freq;
    for (let o = 0; o < oct; o++) {
      sum += amp * value(u * f, v * f, f);
      f *= 2;
      amp *= 0.5;
    }
    return sum;
  };
}

// بتبني الخرائط من دالة بترجع { h (ارتفاع 0..1), r, g, b (0..1), rough (0..1) } لكل بكسل
function bake(fn, { size = SIZE, bump = 3 } = {}) {
  const n = size * size;
  const height = new Float32Array(n);
  const col = document.createElement('canvas');
  col.width = col.height = size;
  const nrm = col.cloneNode();
  const rgh = col.cloneNode();
  const cImg = col.getContext('2d').createImageData(size, size);
  const nImg = nrm.getContext('2d').createImageData(size, size);
  const rImg = rgh.getContext('2d').createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const s = fn(x / size, y / size);
      height[i] = s.h;
      cImg.data[i * 4] = Math.min(255, s.r * 255);
      cImg.data[i * 4 + 1] = Math.min(255, s.g * 255);
      cImg.data[i * 4 + 2] = Math.min(255, s.b * 255);
      cImg.data[i * 4 + 3] = 255;
      const r = Math.min(255, s.rough * 255);
      rImg.data[i * 4] = rImg.data[i * 4 + 1] = rImg.data[i * 4 + 2] = r;
      rImg.data[i * 4 + 3] = 255;
    }
  // normal map من فرق الارتفاعات
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const h = (xx, yy) => height[((yy + size) % size) * size + ((xx + size) % size)];
      const dx = (h(x + 1, y) - h(x - 1, y)) * bump;
      const dy = (h(x, y + 1) - h(x, y - 1)) * bump;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      nImg.data[i] = (-dx / len) * 127 + 128;
      nImg.data[i + 1] = (dy / len) * 127 + 128;
      nImg.data[i + 2] = (1 / len) * 127 + 128;
      nImg.data[i + 3] = 255;
    }
  col.getContext('2d').putImageData(cImg, 0, 0);
  nrm.getContext('2d').putImageData(nImg, 0, 0);
  rgh.getContext('2d').putImageData(rImg, 0, 0);
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: tex(col, true), normalMap: tex(nrm), roughnessMap: tex(rgh) };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => a + (b - a) * t;

// حجر قديم بفواصل (حيطان)
function stone() {
  const n = makeNoise(1);
  const n2 = makeNoise(2);
  const rows = 6;
  return bake((u, v) => {
    const row = Math.floor(v * rows);
    const off = row % 2 ? 0.5 / 3 : 0;
    const cols = 3;
    const cu = (u + off) * cols;
    const fu = cu - Math.floor(cu);
    const fv = v * rows - row;
    const edge = Math.min(fu, 1 - fu, (fv * cols) / rows * 2, ((1 - fv) * cols) / rows * 2);
    const block = Math.floor(cu) * 7 + row * 13;
    const mortar = clamp01(edge * 30 - 0.4);
    const g = n(u, v, 8, 5);
    const detail = n2(u, v, 32, 3);
    const tone = 0.85 + ((block * 37) % 17) / 100;
    const h = mortar * (0.6 + g * 0.4) + detail * 0.15;
    const dirt = clamp01(n2(u, v, 3, 3) * 1.4 - 0.45);
    const base = (0.55 + g * 0.25) * tone * (1 - dirt * 0.35);
    return {
      h,
      r: mortar ? base * 0.93 : 0.33,
      g: mortar ? base * 0.84 : 0.3,
      b: mortar ? base * 0.68 : 0.26,
      rough: 0.85 + detail * 0.15,
    };
  }, { bump: 6 });
}

// جص مقشّر فوق حجر، مع بقع رطوبة وسيلان
function plaster() {
  const n = makeNoise(3);
  const n2 = makeNoise(4);
  const n3 = makeNoise(5);
  return bake((u, v) => {
    const peel = n(u, v, 3, 5);
    const bare = peel < 0.36; // الجص واقع
    const g = n2(u, v, 24, 3);
    const damp = clamp01(n3(u * 0.5, v, 2, 4) * 1.6 - 0.55 + v * 0.35); // الرطوبة أكثر تحت
    const streak = clamp01(n3(u * 6, v * 0.3, 8, 2) * 1.8 - 1.0) * v;
    const stain = clamp01(damp + streak);
    let r = mix(0.72, 0.45, stain) + g * 0.05;
    let gg = mix(0.66, 0.4, stain) + g * 0.05;
    let b = mix(0.55, 0.3, stain) + g * 0.04;
    if (bare) {
      r = 0.42 + g * 0.1;
      gg = 0.36 + g * 0.08;
      b = 0.28 + g * 0.06;
    }
    return { h: (bare ? 0.2 : 0.6) + g * 0.1 + peel * 0.1, r, g: gg, b, rough: bare ? 0.95 : 0.8 + stain * 0.1 };
  }, { bump: 5 });
}

// بلاط أرضيات قديم مزخرف (بلاط شامي) مع تشقق وغبرة
function tiles() {
  const n = makeNoise(6);
  const n2 = makeNoise(7);
  const N = 4;
  return bake((u, v) => {
    const tu = u * N;
    const tv = v * N;
    const fu = tu - Math.floor(tu) - 0.5;
    const fv = tv - Math.floor(tv) - 0.5;
    const grout = Math.max(Math.abs(fu), Math.abs(fv)) > 0.47;
    const d = Math.hypot(fu, fv);
    const star = Math.abs(Math.cos(Math.atan2(fv, fu) * 4)) * 0.18 + 0.12;
    const motif = d < star ? 1 : d < star + 0.04 ? 2 : Math.abs(Math.abs(fu) - Math.abs(fv)) < 0.03 ? 2 : 0;
    const wear = clamp01(n(u, v, 6, 5) * 1.5 - 0.3);
    const dust = clamp01(n2(u, v, 3, 4) * 1.4 - 0.4);
    const g = n2(u, v, 40, 2);
    let c = motif === 1 ? [0.45, 0.16, 0.12] : motif === 2 ? [0.12, 0.18, 0.22] : [0.72, 0.66, 0.55];
    c = c.map((x) => mix(x, 0.5, wear * 0.35) * (1 - dust * 0.3) + g * 0.04);
    if (grout) c = [0.22, 0.2, 0.17];
    return { h: grout ? 0 : 0.7 + g * 0.1 - wear * 0.1, r: c[0], g: c[1], b: c[2], rough: grout ? 1 : 0.45 + wear * 0.4 + dust * 0.2 };
  }, { bump: 4 });
}

// خشب قديم (أبواب، خزاين، سقف)
function wood() {
  const n = makeNoise(8);
  const n2 = makeNoise(9);
  return bake((u, v) => {
    const plank = Math.floor(u * 4);
    const pu = u * 4 - plank;
    const gap = pu < 0.02 || pu > 0.98;
    const grain = Math.sin((v * 40 + n(u * 4, v, 4, 4) * 12 + plank * 3) * Math.PI) * 0.5 + 0.5;
    const g = n2(u, v, 30, 2);
    const tone = 0.8 + (plank % 3) * 0.08;
    const r = (0.3 + grain * 0.12 + g * 0.05) * tone;
    return { h: gap ? 0 : 0.6 + grain * 0.15, r, g: r * 0.68, b: r * 0.45, rough: 0.7 + grain * 0.2 };
  }, { bump: 4 });
}

// أرض الحوش: حجارة مرصوفة وتراب
function cobbles() {
  const n = makeNoise(10);
  const n2 = makeNoise(11);
  const pts = [];
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) pts.push([rnd(), rnd()]);
  return bake((u, v) => {
    let d1 = 9;
    let d2 = 9;
    for (const [px, py] of pts) {
      for (const ox of [-1, 0, 1])
        for (const oy of [-1, 0, 1]) {
          const d = Math.hypot(u - px - ox, v - py - oy);
          if (d < d1) [d2, d1] = [d1, d];
          else if (d < d2) d2 = d;
        }
    }
    const edge = clamp01((d2 - d1) * 25);
    const g = n(u, v, 16, 4);
    const mud = clamp01(n2(u, v, 3, 4) * 1.6 - 0.5);
    const c = 0.38 + g * 0.2;
    return {
      h: edge * (0.7 + g * 0.3),
      r: mix(0.2, c * 0.95, edge) * (1 - mud * 0.4),
      g: mix(0.17, c * 0.9, edge) * (1 - mud * 0.45),
      b: mix(0.13, c * 0.8, edge) * (1 - mud * 0.5),
      rough: mix(1, 0.75, edge) - mud * 0.35, // الوحل بيلمع
    };
  }, { bump: 7 });
}

// سجاد قديم
function rug() {
  const n = makeNoise(12);
  return bake((u, v) => {
    const b = Math.min(u, 1 - u, v, 1 - v);
    const border = b < 0.08;
    const pattern = Math.abs(Math.sin(u * 30) * Math.sin(v * 30)) > 0.5;
    const diamond = Math.abs(u - 0.5) + Math.abs(v - 0.5) < 0.25;
    const wear = n(u, v, 10, 4);
    let c = border ? [0.18, 0.12, 0.1] : diamond ? [0.55, 0.4, 0.2] : pattern ? [0.4, 0.08, 0.07] : [0.3, 0.06, 0.05];
    c = c.map((x) => x * (0.7 + wear * 0.5));
    return { h: wear * 0.3, r: c[0], g: c[1], b: c[2], rough: 1 };
  }, { size: 256, bump: 2 });
}

let cache;
export function materials() {
  if (cache) return cache;
  const std = (tex, repeat = 1, extra = {}) => {
    for (const t of Object.values(tex)) t.repeat.set(repeat, repeat);
    return new THREE.MeshStandardMaterial({ ...tex, ...extra });
  };
  const s = stone();
  const p = plaster();
  const w = wood();
  cache = {
    stone: std(s),
    plaster: std(p),
    tiles: std(tiles()),
    wood: std(w),
    woodDark: std(w, 1, { color: 0x6a5a4a }),
    cobbles: std(cobbles()),
    rug: std(rug()),
    ceiling: std(w, 1, { color: 0x8a7a68 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x7a1e1c, roughness: 1 }),
    sheet: new THREE.MeshStandardMaterial({ color: 0x9a927e, roughness: 1 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8a6d3b, roughness: 0.4, metalness: 0.8 }),
    clay: new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }),
  };
  return cache;
}
