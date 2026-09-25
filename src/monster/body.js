// شكل السعلوة: طويلة ونحيلة ومحنية لقدّام، ثوب أسود مهترئ بخِرَق متدلّية، جلد باهت عظمي،
// إيدين طوال بأصابع مفصّلة ومخالب، فك مرخي بأسنان، شعر أسود طويل بخصل بتغطي الوجه، وأقدام معكوسة.
// كل شي مولّد برمجياً. وجهها باتجاه -z، وأصل المجسّم عند رجليها.
import * as THREE from 'three';

// ---------- أدوات هندسية ----------

// أنبوب عضوي على منحنى بنصف قطر متغيّر: radii = [[t, r], ...]
function organicTube(points, radii, { radial = 10, segs = 24, closed = true, flipV = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(segs, false);
  const radiusAt = (t) => {
    for (let i = 1; i < radii.length; i++) {
      if (t <= radii[i][0]) {
        const [t0, r0] = radii[i - 1];
        const [t1, r1] = radii[i];
        const k = (t - t0) / (t1 - t0 || 1);
        return r0 + (r1 - r0) * (k * k * (3 - 2 * k));
      }
    }
    return radii[radii.length - 1][1];
  };
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    const r = radiusAt(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      pos.push(c.x + (Math.cos(a) * n.x + Math.sin(a) * b.x) * r, c.y + (Math.cos(a) * n.y + Math.sin(a) * b.y) * r, c.z + (Math.cos(a) * n.z + Math.sin(a) * b.z) * r);
      uv.push(j / radial, flipV ? 1 - t : t);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b2 = a + radial + 1;
      idx.push(a, b2, a + 1, b2, b2 + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // سكّر الطرفين
  if (closed) {
    const cap = (i, flip) => {
      const c = curve.getPointAt(i / segs);
      const ci = pos.length / 3;
      pos.push(c.x, c.y, c.z);
      uv.push(0.5, i / segs);
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        flip ? idx.push(ci, a + 1, a) : idx.push(ci, a, a + 1);
      }
    };
    cap(0, false);
    cap(segs, true);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
  }
  g.computeVertexNormals();
  return g;
}

// شريط مسطّح على منحنى (للشعر والخِرَق): عرض بيقلّ لتحت
function ribbon(points, width0, width1, segs = 10, twist = 0) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const pos = [];
  const uv = [];
  const idx = [];
  const up = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    // العرض أفقي تقريباً ومتعامد مع اتجاه الشريط
    up.set(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(tan, up);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize().applyAxisAngle(tan, twist * t);
    const w = (width0 + (width1 - width0) * t) / 2;
    pos.push(c.x - side.x * w, c.y - side.y * w, c.z - side.z * w, c.x + side.x * w, c.y + side.y * w, c.z + side.z * w);
    uv.push(0, 1 - t, 1, 1 - t);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function canvasTex(w, h, draw, srgb = true) {
  if (typeof document === 'undefined') return null; // الاختبارات بدون متصفح
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

let rnd = Math.random;

// ---------- المواد (مرة وحدة لكل المجسّمات: الوحش والطيف والشبح بالمراية) ----------
let MAT = null;
function materials() {
  if (MAT) return MAT;
  // جلد باهت مرقّط بعروق
  const skinMap = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8f8b7c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const v = Math.random();
      g.fillStyle = v < 0.5 ? `rgba(70,72,60,${Math.random() * 0.25})` : `rgba(170,165,150,${Math.random() * 0.15})`;
      g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 9, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(60,70,85,0.35)';
    for (let i = 0; i < 18; i++) {
      g.lineWidth = 0.6 + Math.random();
      g.beginPath();
      let x = Math.random() * w;
      let y = Math.random() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 8; k++) g.lineTo((x += (Math.random() - 0.5) * 30), (y += 10 + Math.random() * 20));
      g.stroke();
    }
  });
  const skin = new THREE.MeshStandardMaterial({ map: skinMap, bumpMap: skinMap, bumpScale: 0.6, roughness: 0.72, color: 0xd8d4c4 });
  const nail = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.35 });
  // قماش أسود مهترئ: خيوط، بقع، وثقوب بتنقص (alpha)
  const clothMap = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#16120f';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      g.fillStyle = `rgba(${40 + Math.random() * 20},${34 + Math.random() * 14},${28},${0.25})`;
      g.fillRect(0, y, w, 1);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${60 + Math.random() * 30},${40},${25},${Math.random() * 0.25})`;
      g.beginPath();
      g.ellipse(Math.random() * w, Math.random() * h, 5 + Math.random() * 25, 3 + Math.random() * 12, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  const clothAlpha = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#000';
    // الحافة التحتانية ممزّقة (v=0 تحت)
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) g.lineTo(x, h - (Math.abs(Math.sin(x * 0.11)) * 30 + Math.random() * 28 + (Math.random() < 0.12 ? 40 : 0)));
    g.lineTo(w, h);
    g.fill();
    // ثقوب
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.ellipse(Math.random() * w, h * 0.35 + Math.random() * h * 0.55, 2 + Math.random() * 8, 3 + Math.random() * 12, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }, false);
  // القماش والشعر بدون لمعة (Lambert): الأسود بيضل أسود حتى تحت الكشاف من قريب
  const cloth = new THREE.MeshLambertMaterial({ map: clothMap, alphaMap: clothAlpha, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x5a554e });
  // الخِرَق: نفس القماش بحافة ممزّقة على الجنبين كمان
  const ragAlpha = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(w * 0.2, 0);
    for (let y = 0; y <= h; y += 8) g.lineTo(w * (0.1 + Math.random() * 0.25) * (1 + y / h), y);
    for (let y = h; y >= 0; y -= 8) g.lineTo(w * (0.9 - Math.random() * 0.25 * (1 + y / h)), y);
    g.fill();
  }, false);
  const rag = new THREE.MeshLambertMaterial({ map: clothMap, alphaMap: ragAlpha, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x524d46 });
  // الشعر: خصل رفيعة (alpha بخطوط) أسود بلمعة خفيفة
  const hairAlpha = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w;
      const end = h * (0.55 + Math.random() * 0.45);
      g.strokeStyle = `rgba(255,255,255,${0.6 + Math.random() * 0.4})`;
      g.lineWidth = 1 + Math.random() * 2.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + (Math.random() - 0.5) * 20, end * 0.4, x + (Math.random() - 0.5) * 30, end * 0.7, x + (Math.random() - 0.5) * 24, end);
      g.stroke();
    }
  }, false);
  const hair = new THREE.MeshLambertMaterial({ color: 0x0b0907, alphaMap: hairAlpha, alphaTest: 0.35, side: THREE.DoubleSide });
  const skinHead = skin.clone();
  skinHead.vertexColors = true;
  MAT = {
    skin,
    skinHead,
    nail,
    cloth,
    rag,
    hair,
    inner: new THREE.MeshBasicMaterial({ color: 0x050303 }),
    teeth: new THREE.MeshStandardMaterial({ color: 0x9c9277, roughness: 0.5 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
    iris: new THREE.MeshBasicMaterial({ color: 0x1a0d05 }),
  };
  return MAT;
}

// ---------- الجسم ----------
export function buildBody() {
  const M = materials();
  const g = new THREE.Group();
  const add = (mesh, parent = g) => {
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // الثوب: من الكتاف للأرض، واسع تحت، والجزء الفوقاني محني لقدّام (حدبة)
  const prof = [[0.52, 0], [0.5, 0.25], [0.42, 0.7], [0.3, 1.15], [0.24, 1.4], [0.27, 1.7], [0.3, 1.9], [0.2, 2.02], [0.08, 2.08]];
  const robeGeo = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 36);
  const rp = robeGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    let x = rp.getX(i);
    const y = rp.getY(i);
    let z = rp.getZ(i);
    const a = Math.atan2(z, x);
    // طيّات القماش
    const fold = 1 + Math.sin(a * 11 + y * 2) * 0.05 * (1 - y / 2.1) + Math.sin(a * 5 - y * 3) * 0.03;
    x *= fold * 1.2;
    z *= fold * 0.72;
    // الحدبة: كل ما طلعنا بيميل لقدّام (-z)
    const bend = Math.max(0, y - 1.2);
    z -= bend * bend * 0.42;
    rp.setXYZ(i, x, y, z);
  }
  robeGeo.computeVertexNormals();
  const robe = add(new THREE.Mesh(robeGeo, M.cloth));

  // خِرَق متدلّية من الحافة والخصر
  const rags = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rnd() * 0.3;
    const high = i % 3 === 0;
    const y0 = high ? 0.9 + rnd() * 0.4 : 0.12 + rnd() * 0.1;
    const r0 = high ? 0.36 : 0.56;
    const len = high ? 0.6 + rnd() * 0.4 : 0.15 + rnd() * 0.2;
    const x = Math.cos(a) * r0 * 1.2;
    const z = Math.sin(a) * r0 * 0.72;
    const pivot = new THREE.Group();
    pivot.position.set(x, y0, z);
    pivot.rotation.y = -a + Math.PI / 2;
    const geo = ribbon([[0, 0, 0], [0, -len * 0.5, 0.02], [0, -len, 0.05]], 0.12 + rnd() * 0.08, 0.05, 5);
    add(new THREE.Mesh(geo, M.rag), pivot);
    pivot.userData = { phase: rnd() * 6 };
    g.add(pivot);
    rags.push(pivot);
  }

  // الرقبة الطويلة (بارزة لقدّام من الحدبة) والراس
  const neckBase = new THREE.Vector3(0, 2.0, -0.27);
  add(new THREE.Mesh(organicTube([[0, 1.98, -0.2], [0, 2.1, -0.3], [0, 2.2, -0.38]], [[0, 0.07], [0.5, 0.05], [1, 0.055]], { radial: 10, segs: 8 }), M.skin));
  const head = new THREE.Group();
  head.position.set(0, 2.3, -0.42);
  g.add(head);
  void neckBase;
  // الوجه: جمجمة وحدة منحوتة: تجاويف عيون عميقة معتمة، حاجب بارز، خدود غايرة، وتم طويل مفتوح.
  // العتمة بالتجاويف والتم معمولة بألوان الرؤوس (vertex colors) متل الظل.
  const R = 0.14;
  const skullGeo = new THREE.SphereGeometry(R, 56, 42);
  const sp = skullGeo.attributes.position;
  const colors = [];
  const dir = new THREE.Vector3();
  const bump = (d, c, sx, sy) => {
    // تأثير ناعم حوالين اتجاه c، بيضاوي (sx عرض، sy طول)
    const dx = d.x - c.x;
    const dy = d.y - c.y;
    const dz = d.z - c.z;
    return Math.exp(-((dx * dx + dz * dz) / (sx * sx) + (dy * dy) / (sy * sy)));
  };
  const EYES = [-1, 1].map((s) => new THREE.Vector3(s * 0.4, 0.2, -0.89).normalize());
  const MOUTH = new THREE.Vector3(0, -0.45, -0.89).normalize();
  const eyePos = [];
  for (let i = 0; i < sp.count; i++) {
    dir.set(sp.getX(i), sp.getY(i), sp.getZ(i)).normalize();
    let r = R;
    let dark = 0;
    for (const e of EYES) {
      const w = bump(dir, e, 0.2, 0.17);
      r -= 0.038 * w;
      dark = Math.max(dark, w * 1.1);
      // الحاجب البارز فوق كل عين
      r += 0.012 * bump(dir, new THREE.Vector3(e.x, e.y + 0.2, e.z), 0.22, 0.07);
    }
    // خدود غايرة
    for (const s of [-1, 1]) {
      const w = bump(dir, new THREE.Vector3(s * 0.62, -0.18, -0.72), 0.22, 0.2);
      r -= 0.022 * w;
      dark = Math.max(dark, w * 0.35);
    }
    // الأنف: عضمة رفيعة وفتحة معتمة
    r += 0.01 * bump(dir, new THREE.Vector3(0, 0.02, -1), 0.06, 0.18);
    const nose = bump(dir, new THREE.Vector3(0, -0.14, -0.99), 0.07, 0.05);
    r -= 0.015 * nose;
    dark = Math.max(dark, nose);
    // التم: شق طويل عمودي
    const mouth = bump(dir, MOUTH, 0.16, 0.3);
    r -= 0.05 * mouth;
    dark = Math.max(dark, mouth * 1.2);
    let x = dir.x * r * 0.84;
    let y = dir.y * r * 1.32;
    let z = dir.z * r;
    // ذقن طويل ضيّق
    if (dir.y < -0.35) {
      const k = (-0.35 - dir.y) / 0.65;
      x *= 1 - k * 0.35;
      y -= k * 0.05;
    }
    sp.setXYZ(i, x, y, z);
    const c = 1 - Math.min(1, dark) * 0.93;
    colors.push(c, c, c * 0.97);
  }
  skullGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  skullGeo.computeVertexNormals();
  add(new THREE.Mesh(skullGeo, M.skinHead), head);
  // عيون: نقطتين صغار بيلمعوا بقعر التجاويف
  const eyes = [];
  for (const e of EYES) {
    const eye = add(new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 8), M.eye), head);
    eye.position.set(e.x * (R - 0.03) * 0.84, e.y * (R - 0.03) * 1.32, e.z * (R - 0.03));
    eyes.push(eye);
    eyePos.push(eye.position);
  }
  // أسنان رفيعة على حواف التم
  const jaw = new THREE.Group();
  head.add(jaw);
  const toothGeo = new THREE.ConeGeometry(0.0038, 0.026, 4);
  // نقطة على سطح الجمجمة باتجاه معيّن (نفس تشويه الوجه تقريباً)
  const onFace = (dx, dy, inset) => {
    const d = new THREE.Vector3(MOUTH.x + dx, MOUTH.y + dy, MOUTH.z).normalize();
    const r = R - inset;
    return new THREE.Vector3(d.x * r * 0.84, d.y * r * 1.32, d.z * r);
  };
  for (let i = 0; i < 16; i++) {
    const top = i < 8;
    const dx = ((i % 8) / 7 - 0.5) * 0.36;
    const t = add(new THREE.Mesh(toothGeo, M.teeth), top ? head : jaw);
    t.position.copy(onFace(dx, top ? 0.2 : -0.24, 0.022));
    t.rotation.x = top ? Math.PI - 0.3 : 0.3;
    t.rotation.z = dx * 0.8;
    t.scale.y = 0.7 + ((i * 7) % 5) * 0.15;
  }
  jaw.rotation.x = 0.1;

  // الشعر: خصل طويلة من الراس، بتنزل على الظهر والكتاف، وقدّام الوجه (مع فتحة بتبيّن عين وحدة والتم)
  const strands = [];
  const scalp = add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), M.hair), head);
  scalp.scale.set(0.95, 1.38, 1.05);
  scalp.position.y = 0.012;
  const hairCount = 96;
  for (let i = 0; i < hairCount; i++) {
    const a = (i / hairCount) * Math.PI * 2 + rnd() * 0.05;
    // a = 0 قدّام (-z)
    const fx = Math.sin(a);
    const fz = -Math.cos(a);
    const front = fz < -0.55;
    // فتحة قدّام العين اليمين والتم
    if (front && fx > -0.08 && fx < 0.32 && rnd() < 0.92) continue;
    const root = [fx * 0.12, 0.17 - Math.abs(fz) * 0.03, fz * 0.12];
    const len = front ? 0.55 + rnd() * 0.3 : 0.8 + rnd() * 0.45;
    const out = front ? 0.04 : 0.06 + rnd() * 0.05;
    const pts = [root, [fx * (0.15 + out * 0.5), 0.05, fz * (0.16 + out * 0.5)]];
    for (let k = 1; k <= 4; k++) {
      const y = 0.05 - (len * k) / 4;
      const w = Math.sin(k * 1.7 + i) * 0.025;
      pts.push([fx * (0.16 + out) + w, y, fz * (0.16 + out) + (front ? 0 : 0.04 * k) + w]);
    }
    const pivot = new THREE.Group();
    const geo = ribbon(pts, 0.045 + rnd() * 0.03, 0.01, 12, (rnd() - 0.5) * 0.8);
    add(new THREE.Mesh(geo, M.hair), pivot);
    pivot.userData = { base: new THREE.Euler(), phase: rnd() * 6 };
    head.add(pivot);
    strands.push(pivot);
  }

  // الإيدين: كتف عظمي، ذراع طويل رفيع بكوع بارز، كف كبير، خمس أصابع بثلاث مفاصل ومخالب
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.33, 1.9, -0.18);
    g.add(shoulder);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), M.cloth), shoulder).scale.set(1.2, 1, 1);
    add(new THREE.Mesh(organicTube([[0, 0, 0], [s * 0.02, -0.33, 0.01], [0, -0.66, 0]], [[0, 0.05], [0.4, 0.04], [0.85, 0.034], [1, 0.045]], { radial: 10, segs: 12 }), M.skin), shoulder);
    // كم ممزّق واسع
    const sleeve = new THREE.Mesh(organicTube([[0, 0.04, 0], [0, -0.3, 0], [0, -0.62, 0.02]], [[0, 0.06], [0.5, 0.08], [1, 0.12]], { radial: 12, segs: 8, closed: false, flipV: true }), M.cloth);
    add(sleeve, shoulder);
    const elbow = new THREE.Group();
    elbow.position.y = -0.66;
    shoulder.add(elbow);
    // عقدة الكوع والرسغ (عظم بارز)
    add(new THREE.Mesh(new THREE.SphereGeometry(0.047, 10, 8), M.skin), elbow).scale.set(1, 0.9, 1.1);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), M.skin), elbow).position.y = -0.64;
    add(new THREE.Mesh(organicTube([[0, 0, 0], [0, -0.32, 0.01], [0, -0.64, 0]], [[0, 0.042], [0.15, 0.03], [0.8, 0.024], [1, 0.03]], { radial: 10, segs: 12 }), M.skin), elbow);
    const hand = new THREE.Group();
    hand.position.y = -0.66;
    hand.scale.setScalar(1.45); // إيدين كبار بشكل مش طبيعي
    elbow.add(hand);
    // الكف: عظام مشطية بارزة بدل كتلة وحدة
    const palm = add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), M.skin), hand);
    palm.scale.set(0.95, 1.45, 0.38);
    palm.position.y = -0.055;
    for (let k = 0; k < 4; k++) {
      const x = (-0.036 + k * 0.024) * s;
      add(new THREE.Mesh(organicTube([[x * 0.4, -0.01, 0], [x, -0.11, -0.004]], [[0, 0.008], [0.8, 0.007], [1, 0.011]], { radial: 6, segs: 4 }), M.skin), hand);
    }
    const fingers = [];
    for (let f = 0; f < 5; f++) {
      const thumb = f === 4;
      const base = new THREE.Group();
      base.position.set(thumb ? s * -0.045 : (-0.036 + f * 0.024) * s, thumb ? -0.04 : -0.11, thumb ? -0.02 : 0);
      base.rotation.z = thumb ? s * 0.6 : 0;
      hand.add(base);
      let parent = base;
      const lens = thumb ? [0.05, 0.045, 0.04] : [0.1 + (f === 1 || f === 2 ? 0.025 : 0), 0.08, 0.065];
      const segs = [];
      lens.forEach((len, k) => {
        const seg = new THREE.Group();
        const r = 0.009 - k * 0.0018;
        add(new THREE.Mesh(organicTube([[0, 0, 0], [0, -len, 0]], [[0, r * 1.25], [0.5, r], [1, r * 1.15]], { radial: 6, segs: 3 }), M.skin), seg);
        seg.position.y = k === 0 ? 0 : -lens[k - 1];
        parent.add(seg);
        parent = seg;
        segs.push(seg);
      });
      // مخلب
      const claw = add(new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.04, 5), M.nail), parent);
      claw.position.y = -lens[2] - 0.015;
      claw.rotation.x = Math.PI + 0.3;
      fingers.push(segs);
    }
    arms.push({ shoulder, elbow, hand, fingers, side: s });
  }

  // أقدام معكوسة (الكعب لقدّام والأصابع لورا) بتبيّن من تحت الثوب
  for (const s of [-1, 1]) {
    const foot = new THREE.Group();
    foot.position.set(s * 0.13, 0, 0.02);
    g.add(foot);
    add(new THREE.Mesh(organicTube([[0, 0.14, 0], [0, 0.05, -0.04], [0, 0.03, 0.08], [0, 0.02, 0.16]], [[0, 0.035], [0.3, 0.04], [1, 0.03]], { radial: 8, segs: 10 }), M.skin), foot);
    for (let k = 0; k < 4; k++) {
      const toe = add(new THREE.Mesh(organicTube([[0, 0.02, 0.15], [(k - 1.5) * 0.02, 0.012, 0.22], [(k - 1.5) * 0.028, 0.006, 0.27]], [[0, 0.01], [1, 0.006]], { radial: 5, segs: 4 }), M.skin), foot);
      void toe;
    }
  }

  g.userData = { head, jaw, arms, strands, eyes, robe, rags };
  return g;
}

// الحركة: مشي متقطّع، راس بيميل بزوايا غريبة، فك بيرجف، أصابع بتتحرّك، شعر وخِرَق بتتمرجح،
// وبالمطاردة بتميل لقدّام وإيديها ممدودة. covering = الضو بوجهها: إيديها على وجهها.
export function animateBody(body, t, { moving, chase, searching, covering = false }) {
  const { head, jaw, arms, strands, robe, rags } = body.userData;
  const twitch = Math.sin(t * 13) > 0.96 ? 0.5 : 0;
  head.rotation.z = Math.sin(t * 0.7) * 0.3 + twitch;
  head.rotation.x = chase ? 0.3 : searching ? Math.sin(t * 1.5) * 0.35 : 0.12;
  head.rotation.y = searching ? Math.sin(t * 0.9) * 0.7 : Math.sin(t * 0.23) * 0.15;
  // الأسنان التحتانية بترجف (كأن الفك بيطقطق)
  if (jaw) jaw.position.y = -(chase ? 0.012 : 0.004) - (Math.sin(t * 3.1) > 0.9 ? 0.008 : 0) + Math.sin(t * 23) * 0.001;
  const speed = chase ? 9 : 4;
  const swing = moving ? Math.sin(t * speed) : 0;
  for (const a of arms) {
    // موجب = لقدّام (-z)
    const reach = chase ? 1.35 : 0.08;
    a.shoulder.rotation.x = reach + swing * 0.25 * a.side;
    a.shoulder.rotation.z = a.side * (chase ? 0.12 : 0.1);
    a.elbow.rotation.x = chase ? 0.15 + Math.sin(t * 17 + a.side) * 0.08 : 0.18;
    // الأصابع: بتتقوّس وبترجف
    a.fingers?.forEach((segs, f) => {
      const curl = (chase ? 0.25 : 0.45) + Math.sin(t * (2 + f * 0.7) + a.side) * 0.12;
      segs.forEach((seg, k) => (seg.rotation.x = -curl * (k + 1) * 0.5));
    });
  }
  // الضو بوجهها: إيديها الطوال عوجهها
  if (covering) {
    for (const a of arms) {
      a.shoulder.rotation.x = 0.8;
      a.shoulder.rotation.z = -a.side * 0.35;
      a.elbow.rotation.x = 2.45;
    }
    head.rotation.x = 0.55;
  }
  body.rotation.x = chase ? -0.12 : 0; // بتميل لقدّام
  robe.scale.set(1, 1 + Math.sin(t * 1.3) * 0.01, 1);
  for (const s of strands) {
    const sway = Math.sin(t * (moving ? 5 : 1.2) + s.userData.phase) * (moving ? 0.07 : 0.025);
    s.rotation.x = (chase ? 0.12 : 0) + sway;
    s.rotation.z = sway * 0.6;
  }
  for (const r of rags ?? []) {
    const sway = Math.sin(t * (moving ? 6 : 1.5) + r.userData.phase) * (moving ? 0.35 : 0.1);
    r.rotation.x = sway;
  }
  body.position.y = moving ? Math.abs(Math.sin(t * speed * 0.5)) * 0.04 : 0;
}
