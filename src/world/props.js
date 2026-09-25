// مجسّمات البيت المفصّلة: خزانة منقوشة، سرير نحاس، بير بسقف وبكرة، ساعة حيط برقّاص، راديو قديم،
// فرشات بنقشة السدو، شمعدانات نحاس، وأقواس فوق الأبواب. كلها مولّدة برمجياً.
// كل دالة بترجع THREE.Group أصلها على الأرض ووجهها باتجاه +z.
import * as THREE from 'three';
import { materials } from './textures.js';

const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

function part(parent, geo, mat, x, y, z, { rx = 0, ry = 0, rz = 0, cast = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// صندوق بسقف مقوّس (للساعة والراديو): عرض w، ارتفاع الجوانب h، ارتفاع القوس ah، عمق d. الوجه باتجاه +z وخلفه عند z=-d
function archBox(w, h, ah, d) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.absellipse(0, h, w / 2, ah, 0, Math.PI, false);
  s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 16 });
  g.translate(0, 0, -d);
  return g;
}

function canvasMat(w, h, draw, opts = {}) {
  if (typeof document === 'undefined') return new THREE.MeshStandardMaterial(opts);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 1, ...opts });
}

// مواد خاصة بالمجسّمات (مرة وحدة)
let PM = null;
function pm() {
  if (PM) return PM;
  // السدو: خطوط حمرا وسودا وبيضا بمثلثات ومعيّنات
  const sadu = canvasMat(256, 256, (g, w, h) => {
    const bands = [['#6e1414', 40], ['#1a1010', 14], ['#c9b48a', 8], ['#1a1010', 10], ['#8e1b1b', 28], ['#d8c9a0', 18], ['#8e1b1b', 28], ['#1a1010', 10], ['#c9b48a', 8], ['#1a1010', 14], ['#6e1414', 40]];
    let y = 0;
    const total = bands.reduce((a, b) => a + b[1], 0);
    for (const [c, bh] of bands) {
      const hh = (bh / total) * h;
      g.fillStyle = c;
      g.fillRect(0, y, w, hh);
      y += hh;
    }
    // مثلثات بالشريط الفاتح بالنص
    const mid = h / 2;
    g.fillStyle = '#1a1010';
    for (let x = 0; x < w; x += 16) {
      g.beginPath();
      g.moveTo(x, mid + 7);
      g.lineTo(x + 8, mid - 7);
      g.lineTo(x + 16, mid + 7);
      g.fill();
    }
    // معيّنات بالشرايط الحمرا
    g.fillStyle = '#d8c9a0';
    for (const yy of [h * 0.3, h * 0.7]) {
      for (let x = 8; x < w; x += 24) {
        g.beginPath();
        g.moveTo(x, yy - 6);
        g.lineTo(x + 6, yy);
        g.lineTo(x, yy + 6);
        g.lineTo(x - 6, yy);
        g.fill();
      }
    }
    // غبرة وبقع
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(20,15,10,${Math.random() * 0.15})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  // وجه الساعة بأرقام عربية مشرقية
  const clockFace = canvasMat(256, 256, (g, w) => {
    g.fillStyle = '#d9cfb4';
    g.beginPath();
    g.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#3a2a1a';
    g.lineWidth = 6;
    g.stroke();
    g.fillStyle = '#2a1a0a';
    g.font = 'bold 30px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const digits = ['١٢', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '١٠', '١١'];
    digits.forEach((d, i) => {
      const a = (i / 12) * Math.PI * 2;
      g.fillText(d, w / 2 + Math.sin(a) * 96, w / 2 - Math.cos(a) * 96);
    });
    // اصفرار وشقوق
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(120,90,40,${Math.random() * 0.15})`;
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * w, Math.random() * 14, 0, Math.PI * 2);
      g.fill();
    }
  });
  // قماش سمّاعة الراديو
  const grille = canvasMat(128, 128, (g, w, h) => {
    g.fillStyle = '#3a2a18';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    for (let i = 0; i < w; i += 3) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, h);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(w, i);
      g.stroke();
    }
  });
  PM = {
    sadu,
    clockFace,
    grille,
    brass: new THREE.MeshStandardMaterial({ color: 0xa8823e, roughness: 0.32, metalness: 0.9 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.6, metalness: 0.7 }),
    wax: new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.5, emissive: 0x3a2a10, emissiveIntensity: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fb0b0, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.25 }),
    rope: new THREE.MeshStandardMaterial({ color: 0x7a6440, roughness: 1 }),
    quilt: canvasMat(128, 128, (g, w, h) => {
      g.fillStyle = '#5a2e2a';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#c9a45a';
      g.lineWidth = 2;
      for (let i = -h; i < w; i += 16) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + h, h);
        g.moveTo(i + h, 0);
        g.lineTo(i, h);
        g.stroke();
      }
    }),
  };
  return PM;
}

// ---------- الخزانة: جسم بإطار، بابين بحشوات مقوّسة، تاج منحوت، وأرجل ----------
export function wardrobe() {
  const M = materials();
  const P = pm();
  const g = new THREE.Group();
  const W = 1.7;
  const H = 2.3;
  const D = 1.05;
  part(g, new THREE.BoxGeometry(W, H - 0.2, D), M.wood, 0, 0.15 + (H - 0.2) / 2, 0);
  // تاج بطبقتين وقوس بالنص
  part(g, new THREE.BoxGeometry(W + 0.12, 0.08, D + 0.1), M.woodDark, 0, H + 0.04, 0);
  part(g, new THREE.BoxGeometry(W + 0.2, 0.06, D + 0.16), M.woodDark, 0, H + 0.11, 0);
  const crest = part(g, new THREE.CylinderGeometry(0.35, 0.35, 0.05, 20, 1, false, -Math.PI / 2, Math.PI), M.woodDark, 0, H + 0.14, D / 2 + 0.03, { rx: Math.PI / 2 });
  crest.scale.set(1, 1, 0.5);
  // قاعدة وأرجل مخروطية
  part(g, new THREE.BoxGeometry(W + 0.08, 0.08, D + 0.06), M.woodDark, 0, 0.19, 0);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, lathe([[0.05, 0], [0.07, 0.08], [0.06, 0.15]], 8), M.woodDark, x * (W / 2 - 0.08), 0, z * (D / 2 - 0.08));
  // الأبواب: إطار + حشوتين (وحدة فوقها قوس)
  for (const s of [-1, 1]) {
    const x = s * (W / 4);
    const dz = D / 2 + 0.015;
    part(g, new THREE.BoxGeometry(W / 2 - 0.04, H - 0.4, 0.03), M.woodDark, x, 1.2, dz);
    for (const [yy, hh] of [[0.62, 0.55], [1.55, 1.0]]) {
      part(g, new THREE.BoxGeometry(W / 2 - 0.26, hh, 0.025), M.wood, x, yy, dz + 0.02);
      // إطار الحشوة البارز
      part(g, new THREE.BoxGeometry(W / 2 - 0.2, 0.03, 0.03), M.woodDark, x, yy + hh / 2 + 0.015, dz + 0.03);
      part(g, new THREE.BoxGeometry(W / 2 - 0.2, 0.03, 0.03), M.woodDark, x, yy - hh / 2 - 0.015, dz + 0.03);
    }
    // قوس منحوت فوق الحشوة الكبيرة
    part(g, new THREE.TorusGeometry(0.2, 0.014, 6, 16, Math.PI), M.woodDark, x, 1.95, dz + 0.035);
    // مقبض نحاس بحلقة
    part(g, new THREE.SphereGeometry(0.022, 8, 6), P.brass, s * 0.07, 1.2, dz + 0.04, { cast: false });
    part(g, new THREE.TorusGeometry(0.03, 0.006, 6, 12), P.brass, s * 0.07, 1.16, dz + 0.05, { cast: false });
  }
  // قفل نحاس بالنص
  part(g, new THREE.BoxGeometry(0.06, 0.09, 0.02), P.brass, 0, 1.3, D / 2 + 0.05, { cast: false });
  return g;
}

// ---------- سرير نحاس: أعمدة بكرات، قضبان، فرشة ولحاف مقلّم، ومخدة ----------
export function bed() {
  const M = materials();
  const P = pm();
  const g = new THREE.Group();
  for (const [x, z, h] of [[-0.72, -1.1, 1.25], [0.72, -1.1, 1.25], [-0.72, 1.1, 0.85], [0.72, 1.1, 0.85]]) {
    part(g, new THREE.CylinderGeometry(0.028, 0.03, h, 8), P.brass, x, h / 2, z);
    part(g, new THREE.SphereGeometry(0.055, 10, 8), P.brass, x, h + 0.03, z);
  }
  // قضبان الراس والرجلين
  for (const [z, top, n] of [[-1.1, 1.15, 7], [1.1, 0.78, 5]]) {
    part(g, new THREE.CylinderGeometry(0.02, 0.02, 1.44, 8), P.brass, 0, top, z, { rz: Math.PI / 2 });
    part(g, new THREE.CylinderGeometry(0.018, 0.018, 1.44, 8), P.brass, 0, 0.62, z, { rz: Math.PI / 2 });
    for (let i = 0; i < n; i++) {
      const x = -0.6 + (i / (n - 1)) * 1.2;
      part(g, new THREE.CylinderGeometry(0.01, 0.01, top - 0.62, 6), P.brass, x, (top + 0.62) / 2, z);
    }
    part(g, new THREE.TorusGeometry(0.12, 0.012, 6, 16), P.brass, 0, (top + 0.62) / 2 + 0.05, z);
  }
  // الفرشة واللحاف النازل للأرض (بيخبّي اللي تحت)
  part(g, new THREE.BoxGeometry(1.4, 0.2, 2.1), M.sheet, 0, 0.62, 0);
  const quilt = part(g, new THREE.BoxGeometry(1.52, 0.06, 1.7), P.quilt, 0, 0.74, 0.22);
  void quilt;
  for (const s of [-1, 1]) part(g, new THREE.BoxGeometry(0.04, 0.62, 1.7), P.quilt, s * 0.76, 0.43, 0.22);
  part(g, new THREE.BoxGeometry(1.52, 0.62, 0.04), P.quilt, 0, 0.43, 1.07);
  // مخدة منفوخة
  const pillow = part(g, new THREE.SphereGeometry(0.3, 14, 10), M.sheet, 0, 0.8, -0.8);
  pillow.scale.set(1.8, 0.35, 0.8);
  return g;
}

// ---------- البير: حجر، سقف خشب صغير، بكرة وحبل ودلو ----------
export function well() {
  const M = materials();
  const P = pm();
  const g = new THREE.Group();
  part(g, lathe([[0.75, 0], [0.98, 0], [1.02, 0.1], [1.02, 0.82], [1.06, 0.88], [1.06, 0.96], [0.72, 0.96], [0.72, 0]], 24), M.stone, 0, 0, 0);
  part(g, new THREE.CircleGeometry(0.72, 24).rotateX(-Math.PI / 2), M.dark, 0, 0.55, 0, { cast: false });
  // عمودين وسقف مائل
  for (const s of [-1, 1]) part(g, new THREE.BoxGeometry(0.12, 2.1, 0.12), M.woodDark, s * 0.88, 1.5, 0);
  for (const s of [-1, 1]) part(g, new THREE.BoxGeometry(2.1, 0.04, 0.75), M.woodDark, 0, 2.62 + 0.14, s * 0.32, { rx: s * 0.45 });
  part(g, new THREE.BoxGeometry(2.1, 0.08, 0.08), M.woodDark, 0, 2.9, 0);
  // المحور والمقبض
  part(g, new THREE.CylinderGeometry(0.07, 0.07, 1.76, 10), M.woodDark, 0, 2.15, 0, { rz: Math.PI / 2 });
  part(g, new THREE.CylinderGeometry(0.075, 0.075, 0.4, 10), P.rope, 0, 2.15, 0, { rz: Math.PI / 2 });
  part(g, new THREE.BoxGeometry(0.04, 0.3, 0.04), P.iron, 1.0, 2.02, 0);
  part(g, new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6), P.iron, 1.08, 1.88, 0, { rz: Math.PI / 2 });
  // الحبل نازل للدلو المعلّق
  part(g, new THREE.CylinderGeometry(0.008, 0.008, 1.0, 5), P.rope, 0.05, 1.63, 0.06, { cast: false });
  const bucket = part(g, lathe([[0, 0], [0.12, 0], [0.15, 0.24], [0.155, 0.25], [0.145, 0.25], [0.14, 0.24], [0.11, 0.02]], 14), M.woodDark, 0.05, 0.9, 0.06);
  void bucket;
  for (const yy of [0.95, 1.08]) part(g, new THREE.TorusGeometry(0.135 + (yy - 0.9) * 0.06, 0.006, 4, 16), P.iron, 0.05, yy, 0.06, { rx: Math.PI / 2 });
  part(g, new THREE.TorusGeometry(0.15, 0.005, 4, 12, Math.PI), P.iron, 0.05, 1.15, 0.06);
  return g;
}

// ---------- ساعة حيط برقّاص (الرقّاص بيتحرّك من world.update) ----------
export function wallClock() {
  const M = materials();
  const P = pm();
  const g = new THREE.Group();
  part(g, archBox(0.46, 1.0, 0.2, 0.17), M.woodDark, 0, -0.55, 0);
  const face = part(g, new THREE.CircleGeometry(0.18, 24), P.clockFace, 0, 0.35, 0.02, { cast: false });
  void face;
  part(g, new THREE.TorusGeometry(0.185, 0.015, 6, 24), P.brass, 0, 0.35, 0.025, { cast: false });
  const hands = new THREE.Group();
  hands.position.set(0, 0.35, 0.03);
  g.add(hands);
  const hour = part(hands, new THREE.BoxGeometry(0.012, 0.09, 0.004).translate(0, 0.045, 0), P.iron, 0, 0, 0, { cast: false });
  const minute = part(hands, new THREE.BoxGeometry(0.008, 0.14, 0.004).translate(0, 0.07, 0), P.iron, 0, 0, 0.003, { cast: false });
  // صندوق الرقّاص بزجاج
  part(g, new THREE.PlaneGeometry(0.34, 0.6), P.glass, 0, -0.18, 0.02, { cast: false });
  const pend = new THREE.Group();
  pend.position.set(0, 0.12, -0.03);
  g.add(pend);
  part(pend, new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4), P.brass, 0, -0.25, 0, { cast: false });
  part(pend, new THREE.CylinderGeometry(0.06, 0.06, 0.012, 16), P.brass, 0, -0.52, 0, { rx: Math.PI / 2, cast: false });
  g.userData = { pend, hour, minute };
  return g;
}

// ---------- راديو قديم خشب: سمّاعة قماش، شاشة موجات، وزرّين ----------
export function radio() {
  const M = materials();
  const P = pm();
  const g = new THREE.Group();
  // جسم خشب بسقف مقوّس
  part(g, archBox(0.52, 0.24, 0.1, 0.26), M.wood, 0, 0.02, 0.13);
  part(g, new THREE.PlaneGeometry(0.3, 0.16), P.grille, -0.06, 0.2, 0.145, { cast: false });
  part(g, new THREE.PlaneGeometry(0.12, 0.05), new THREE.MeshStandardMaterial({ color: 0xc8a860, emissive: 0x3a2a08, roughness: 0.3 }), 0.14, 0.24, 0.145, { cast: false });
  for (const x of [0.1, 0.18]) part(g, new THREE.CylinderGeometry(0.025, 0.025, 0.03, 12), P.brass, x, 0.1, 0.155, { rx: Math.PI / 2 });
  part(g, new THREE.BoxGeometry(0.54, 0.02, 0.28), M.woodDark, 0, 0.01, 0);
  return g;
}

// ---------- فرشة أرضية بنقشة السدو + مسند ----------
export function floorCushion(len = 2.4) {
  const P = pm();
  const g = new THREE.Group();
  const seat = part(g, new THREE.BoxGeometry(0.78, 0.18, len), P.sadu, 0, 0.09, 0);
  seat.geometry.attributes.uv.array.forEach((v, i, a) => (a[i] = v * (i % 2 ? 1 : len)));
  // مسند منفوخ على الحيط
  const back = part(g, new THREE.CylinderGeometry(0.16, 0.16, len * 0.92, 14), P.sadu, -0.3, 0.33, 0, { rx: Math.PI / 2 });
  back.scale.set(1, 1, 1.25);
  return g;
}

// ---------- شمعدان نحاس بشمعة ذايبة ----------
export function candleHolder() {
  const P = pm();
  const g = new THREE.Group();
  part(g, lathe([[0, 0], [0.07, 0], [0.075, 0.01], [0.03, 0.03], [0.018, 0.08], [0.03, 0.1], [0.045, 0.11], [0.04, 0.12]], 14), P.brass, 0, 0, 0);
  part(g, new THREE.CylinderGeometry(0.026, 0.03, 0.16, 10), P.wax, 0, 0.2, 0);
  // شمع ذايب نازل
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7;
    const drip = part(g, new THREE.CapsuleGeometry(0.007, 0.04 + (i % 2) * 0.03, 3, 5), P.wax, Math.cos(a) * 0.027, 0.24 - (i % 2) * 0.02, Math.sin(a) * 0.027, { cast: false });
    void drip;
  }
  part(g, new THREE.CylinderGeometry(0.002, 0.002, 0.02, 3), P.iron, 0, 0.29, 0, { cast: false });
  return g;
}

// ---------- قوس حجر فوق باب (بيتحط على الوجهين) ----------
export function doorArch(width) {
  const M = materials();
  const g = new THREE.Group();
  const r = width / 2;
  part(g, new THREE.TorusGeometry(r, 0.07, 8, 20, Math.PI), M.stone, 0, 0, 0);
  // حجر العقد (المفتاح) بالنص
  part(g, new THREE.BoxGeometry(0.14, 0.2, 0.12), M.stone, 0, r + 0.02, 0);
  return g;
}

// للعارض: كل المجسّمات بالاسم
export const props = { wardrobe, bed, well, wallClock, radio, floorCushion: () => floorCushion(2.4), candleHolder, doorArch: () => doorArch(1.8) };
