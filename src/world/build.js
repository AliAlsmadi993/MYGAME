// بناء البيت بـ Three.js بشكل واقعي: مواد PBR، ظلال، شموع بترجف، ضوء قمر، وأثاث عربي قديم.
import * as THREE from 'three';
import { W, H, TILE, WALL_H, HIDE_SPOTS, WELL, GATE, PHONE, NEST, STAIRS, UPSTAIRS, GLASS, ROOMS, charAt, isWall, tileCenter, roomAt, roomTiles } from './map.js';
import { materials } from './textures.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const DOOR_H = 2.3;

// أداة صغيرة: مجسّم بمكان معيّن، بيرمي ظل ويستقبله
function mesh(geo, mat, x, y, z, { ry = 0, rx = 0, rz = 0, cast = true, parent } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

function instanced(geo, mat, cells, place, { cast = true } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, cells.length);
  const m4 = new THREE.Matrix4();
  cells.forEach((c, i) => im.setMatrixAt(i, place(c, m4)));
  im.castShadow = cast;
  im.receiveShadow = true;
  return im;
}

// شكل دوراني (جرار، دلال، براميل) من نقاط المقطع
const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

// نسيج خيوط العنكبوت
function webTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(220,220,210,0.55)';
  g.lineWidth = 1;
  const spokes = 9;
  for (let i = 0; i < spokes; i++) {
    const a = (i / (spokes - 1)) * (Math.PI / 2);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.cos(a) * 256, Math.sin(a) * 256);
    g.stroke();
  }
  for (let r = 20; r < 250; r += 18 + Math.random() * 10) {
    g.beginPath();
    for (let i = 0; i < spokes; i++) {
      const a = (i / (spokes - 1)) * (Math.PI / 2);
      const rr = r * (0.9 + Math.random() * 0.15);
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      i ? g.quadraticCurveTo(x * 0.93, y * 0.93, x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// مشربية: شبكة خشب بفتحات دائرية ومعيّنات (الشفاف بيتقص بـ alphaTest)
function mashrabiyaTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'destination-out';
  const n = 8;
  const s = 256 / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      g.beginPath();
      g.arc(i * s + s / 2, j * s + s / 2, s * 0.32, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(i * s, j * s - s * 0.12);
      g.lineTo(i * s + s * 0.12, j * s);
      g.lineTo(i * s, j * s + s * 0.12);
      g.lineTo(i * s - s * 0.12, j * s);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// صورة عائلية قديمة بالأبيض والأسود (بني باهت)
function familyPhoto(seed, withHer) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = withHer ? 196 : 320;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(c.width / 2, c.height / 2, 10, c.width / 2, c.height / 2, c.width);
  grd.addColorStop(0, '#b8a888');
  grd.addColorStop(1, '#4a4034');
  g.fillStyle = grd;
  g.fillRect(0, 0, c.width, c.height);
  const person = (x, base, h, dark) => {
    g.fillStyle = dark;
    g.beginPath();
    g.arc(x, base - h, h * 0.13, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(x - h * 0.16, base);
    g.lineTo(x - h * 0.12, base - h * 0.82);
    g.lineTo(x + h * 0.12, base - h * 0.82);
    g.lineTo(x + h * 0.16, base);
    g.fill();
  };
  const n = withHer ? 3 : 1 + (seed % 3);
  for (let i = 0; i < n; i++) person(c.width * ((i + 1) / (n + 1)) - (withHer ? 30 : 0), c.height - 10, withHer ? 110 : 160 - i * 20, '#2a241d');
  if (withHer) {
    // المرأة الطويلة: أعلى من الكل، شعرها نازل ووجهها مش باين
    const x = c.width - 38;
    person(x, c.height - 6, 178, '#0e0c0a');
    g.fillStyle = '#0a0806';
    g.fillRect(x - 16, c.height - 190, 32, 70);
  }
  // خدوش وبقع
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,250,230' : '20,15,10'},${Math.random() * 0.25})`;
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 1 + Math.random() * 2, Math.random() * 30);
  }
  return c;
}

// لوحة خط عربي (أمثال وشعر، بدون نصوص دينية)
function calligraphy(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 240;
  const g = c.getContext('2d');
  g.fillStyle = '#d9c9a3';
  g.fillRect(0, 0, 512, 240);
  g.strokeStyle = '#6a4a22';
  g.lineWidth = 6;
  g.strokeRect(14, 14, 484, 212);
  g.lineWidth = 2;
  g.strokeRect(26, 26, 460, 188);
  g.fillStyle = '#2a1a0a';
  g.direction = 'rtl';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${text.length > 16 ? 44 : 60}px Amiri, 'Noto Naskh Arabic', serif`;
  g.fillText(text, 256, 122);
  for (let i = 0; i < 80; i++) {
    g.fillStyle = `rgba(90,60,20,${Math.random() * 0.15})`;
    g.beginPath();
    g.arc(Math.random() * 512, Math.random() * 240, Math.random() * 8, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export function buildWorld(scene) {
  const M = materials();
  scene.background = new THREE.Color(0x010102);
  scene.fog = new THREE.FogExp2(0x020203, 0.07);
  const colliders = [];
  const blockedTiles = new Set();
  const addCollider = (x, z, hw, hd, tile = true) => {
    colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });
    if (tile) {
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(z / TILE);
      blockedTiles.add(`${tx},${ty}`);
    }
  };
  const C = (x, y) => tileCenter(x, y);

  // ---------- الأرضيات ----------
  const floorMat = { c: M.cobbles, u: M.stone, b: M.wood, a: M.tiles, k: M.tiles, l: M.tiles, h: M.wood, d: M.tiles, e: M.stone, r: M.stone, w: M.wood, m: M.wood, n: M.wood, '.': M.tiles };
  const byMat = new Map();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (isWall(x, y)) continue;
      const mat = floorMat[charAt(x, y)] ?? M.tiles;
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push({ x, y });
    }
  const floorGeo = new THREE.PlaneGeometry(TILE, TILE).rotateX(-Math.PI / 2);
  for (const [mat, cells] of byMat) {
    scene.add(instanced(floorGeo, mat, cells, ({ x, y }, m4) => {
      const p = C(x, y);
      return m4.makeTranslation(p.x, 0, p.z);
    }, { cast: false }));
  }

  // ---------- الحيطان ----------
  const plasterWalls = [];
  const stoneWalls = [];
  const parapets = []; // حيطان السطح: قصيرة
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!isWall(x, y) || charAt(x, y) === 'G') continue;
      const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (isWall(x + dx, y + dy) ? null : charAt(x + dx, y + dy)));
      if (around.every((r) => r === null)) continue;
      if (around.includes('r')) parapets.push({ x, y });
      else (around.some((r) => r === 'u' || r === 'c' || r === 'e') ? stoneWalls : plasterWalls).push({ x, y });
    }
  const wallGeo = new THREE.BoxGeometry(TILE, WALL_H, TILE);
  for (const [cells, mat] of [[plasterWalls, M.plaster], [stoneWalls, M.stone]]) {
    scene.add(instanced(wallGeo, mat, cells, ({ x, y }, m4) => {
      const p = C(x, y);
      return m4.makeTranslation(p.x, WALL_H / 2, p.z);
    }));
  }
  const PARAPET_H = 1.05;
  scene.add(instanced(new THREE.BoxGeometry(TILE, PARAPET_H, TILE), M.plaster, parapets, ({ x, y }, m4) => {
    const p = C(x, y);
    return m4.makeTranslation(p.x, PARAPET_H / 2, p.z);
  }));
  // وزرة حجر تحت الجص
  const skirting = [];
  for (const { x, y } of plasterWalls)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!isWall(x + dx, y + dy)) skirting.push({ x, y, dx, dy });
  scene.add(instanced(new THREE.BoxGeometry(TILE, 0.35, 0.06), M.stone, skirting, ({ x, y, dx, dy }, m4) => {
    const p = C(x, y);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx ? Math.PI / 2 : 0);
    return m4.compose(new THREE.Vector3(p.x + dx * (TILE / 2 + 0.03), 0.175, p.z + dy * (TILE / 2 + 0.03)), q, new THREE.Vector3(1, 1, 1));
  }, { cast: false }));

  // ---------- السقف والجسور الخشبية ----------
  const ceilCells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!isWall(x, y) && !ROOMS[charAt(x, y)]?.openSky) ceilCells.push({ x, y });
  const ceilMat = M.ceiling.clone();
  ceilMat.side = THREE.DoubleSide;
  scene.add(instanced(new THREE.PlaneGeometry(TILE, TILE).rotateX(Math.PI / 2), ceilMat, ceilCells, ({ x, y }, m4) => {
    const p = C(x, y);
    return m4.makeTranslation(p.x, WALL_H, p.z);
  }));
  scene.add(instanced(new THREE.BoxGeometry(TILE, 0.22, 0.18), M.woodDark, ceilCells, ({ x, y }, m4) => {
    const p = C(x, y);
    return m4.makeTranslation(p.x, WALL_H - 0.11, p.z);
  }));

  // ---------- عتبات الأبواب ----------
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (charAt(x, y) !== '.') continue;
      const p = C(x, y);
      const alongX = isWall(x - 1, y) && isWall(x + 1, y); // الباب بفتحة بحيط أفقي
      const lintel = mesh(new THREE.BoxGeometry(TILE, WALL_H - DOOR_H, TILE), M.plaster, p.x, (WALL_H + DOOR_H) / 2, p.z);
      scene.add(lintel);
      const beam = new THREE.BoxGeometry(alongX ? TILE * 0.72 : 0.2, 0.14, alongX ? 0.2 : TILE * 0.72);
      for (const s of [-1, 1]) {
        scene.add(mesh(beam, M.woodDark, p.x + (alongX ? 0 : s * TILE * 0.4), DOOR_H - 0.07, p.z + (alongX ? s * TILE * 0.4 : 0)));
        const jamb = new THREE.BoxGeometry(0.12, DOOR_H, 0.12);
        scene.add(mesh(jamb, M.woodDark, p.x + (alongX ? s * TILE * 0.36 : 0), DOOR_H / 2, p.z + (alongX ? 0 : s * TILE * 0.36)));
      }
    }

  // ---------- الأبواب الخشبية (بتنفتح وبتتسكّر) ----------
  const doors = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (charAt(x, y) !== '.') continue;
      const p = C(x, y);
      const alongX = isWall(x - 1, y) && isWall(x + 1, y);
      const w = TILE * 0.72 - 0.14;
      const hinge = new THREE.Group();
      const leaf = mesh(new THREE.BoxGeometry(w, DOOR_H - 0.12, 0.07), M.wood, w / 2, (DOOR_H - 0.12) / 2, 0, { parent: hinge });
      for (const yy of [0.5, 1.2, 1.9]) mesh(new THREE.BoxGeometry(w * 0.9, 0.1, 0.1), M.woodDark, w / 2, yy, 0, { parent: hinge });
      mesh(new THREE.SphereGeometry(0.04, 6, 4), M.metal, w - 0.12, 1.05, 0.06, { parent: hinge, cast: false });
      void leaf;
      // المفصّلة عند طرف الإطار
      const base = alongX ? 0 : -Math.PI / 2;
      hinge.position.set(p.x - (alongX ? w / 2 : 0), 0, p.z - (alongX ? 0 : w / 2));
      hinge.rotation.y = base;
      scene.add(hinge);
      doors.push({ x, y, hinge, base, angle: 0 });
    }

  // ---------- السطح: الدرج، الحبال، والقرية تحت ----------
  const sd = C(STAIRS.down.x, STAIRS.down.y);
  for (let i = 0; i < 7; i++) {
    // درج حجر طالع عالحيط الشرقي
    const h = 0.25 * (i + 1);
    scene.add(mesh(new THREE.BoxGeometry(0.32, h, 1.1), M.stone, sd.x - 0.9 + i * 0.32, h / 2, sd.z + 0.55));
  }
  addCollider(sd.x + 0.1, sd.z + 0.55, 1.1, 0.55);
  // فتحة الدرج من فوق: عتمة وسياج
  const hatch = (t) => {
    const c = C(t.x, t.y);
    scene.add(mesh(new THREE.PlaneGeometry(1.2, 1.2).rotateX(-Math.PI / 2), M.dark, c.x, 0.01, c.z + 0.5, { cast: false }));
    for (const [ox, oz, rw, rd] of [[-0.62, 0.5, 0.05, 1.2], [0.62, 0.5, 0.05, 1.2], [0, -0.1, 1.2, 0.05]]) {
      scene.add(mesh(new THREE.BoxGeometry(rw, 0.9, rd), M.metal, c.x + ox, 0.45, c.z + oz));
    }
  };
  hatch(STAIRS.up);
  hatch(UPSTAIRS.up);
  // درج خشب بالليوان طالع عالحيط الشمالي
  const ud = C(UPSTAIRS.down.x, UPSTAIRS.down.y);
  for (let i = 0; i < 7; i++) {
    const h = 0.25 * (i + 1);
    scene.add(mesh(new THREE.BoxGeometry(1.1, h, 0.32), M.woodDark, ud.x + 0.55, h / 2, ud.z + 0.9 - i * 0.32));
  }
  addCollider(ud.x + 0.55, ud.z - 0.1, 0.55, 1.1);

  // ---------- الطابق الفوقاني ----------
  const U = (tx, ty) => C(tx, ty);
  // غرفة الخياطة: طاولة ومكنة خياطة، ومانيكان (بتلف لحالها)
  const tb = U(74, 1);
  scene.add(mesh(new THREE.BoxGeometry(1.4, 0.75, 0.7), M.wood, tb.x, 0.375, tb.z - 0.6));
  addCollider(tb.x, tb.z - 0.6, 0.7, 0.35);
  const sewing = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.45, 0.12, 0.2), M.dark, 0, 0.06, 0, { parent: sewing });
  mesh(new THREE.BoxGeometry(0.1, 0.25, 0.18), M.dark, 0.18, 0.2, 0, { parent: sewing });
  mesh(new THREE.BoxGeometry(0.4, 0.08, 0.14), M.dark, 0.0, 0.32, 0, { parent: sewing });
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12), M.metal, 0.24, 0.2, 0.1, { parent: sewing, rx: Math.PI / 2 });
  sewing.position.set(tb.x, 0.75, tb.z - 0.6);
  scene.add(sewing);
  const mannequin = new THREE.Group();
  const dress = new THREE.MeshStandardMaterial({ color: 0x3a1a1a, roughness: 1 });
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), M.metal, 0, 0.45, 0, { parent: mannequin });
  mesh(new THREE.CylinderGeometry(0.22, 0.35, 0.9, 12), dress, 0, 1.1, 0, { parent: mannequin });
  mesh(new THREE.SphereGeometry(0.2, 12, 8).scale(1, 0.8, 0.7), dress, 0, 1.6, 0, { parent: mannequin });
  mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.15, 8), M.sheet, 0, 1.8, 0, { parent: mannequin });
  mesh(new THREE.SphereGeometry(0.11, 10, 8), M.sheet, 0, 1.95, 0, { parent: mannequin });
  mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.04, 12), M.woodDark, 0, 0.02, 0, { parent: mannequin });
  const mq = U(74, 3);
  mannequin.position.set(mq.x + 0.4, 0, mq.z);
  scene.add(mannequin);
  addCollider(mq.x + 0.4, mq.z, 0.3, 0.3, false);
  // خيطان وقماش عالأرض
  scene.add(mesh(new THREE.PlaneGeometry(1.6, 1.1).rotateX(-Math.PI / 2), M.cloth, U(72, 3).x, 0.012, U(72, 3).z, { cast: false }));
  // السدّة: كراتين وشنط قديمة ومهد بيهتز
  for (const [tx, ty, ox, oz, w, h, d] of [[78, 1, -0.6, -0.6, 0.8, 0.6, 0.6], [78, 1, -0.6, -0.6, 0.6, 0.4, 0.5], [82, 4, 0.5, 0.4, 0.9, 0.7, 0.7], [81, 4, 0.2, 0.6, 0.7, 0.5, 0.5], [83, 3, 0.6, 0, 0.5, 0.9, 0.9]]) {
    const c = U(tx, ty);
    const stack = scene.children.filter((o) => o.userData.box === `${tx},${ty}`).length;
    const box = mesh(new THREE.BoxGeometry(w, h, d), M.wood, c.x + ox, h / 2 + stack * 0.6, c.z + oz, { ry: Math.random() * 0.4 });
    box.userData.box = `${tx},${ty}`;
    scene.add(box);
    if (!stack) addCollider(c.x + ox, c.z + oz, w / 2, d / 2);
  }
  const cradle = new THREE.Group();
  const rockerGeo = new THREE.TorusGeometry(0.5, 0.025, 4, 16, Math.PI * 0.5);
  for (const z of [-0.3, 0.3]) {
    const r = mesh(rockerGeo, M.woodDark, 0, 0.5, z, { parent: cradle, rz: Math.PI * 1.25 });
    void r;
  }
  mesh(new THREE.BoxGeometry(0.9, 0.35, 0.55), M.wood, 0, 0.3, 0, { parent: cradle });
  mesh(new THREE.BoxGeometry(0.8, 0.05, 0.45), M.sheet, 0, 0.46, 0, { parent: cradle });
  const cp = U(78, 3);
  cradle.position.set(cp.x, 0, cp.z + 0.3);
  scene.add(cradle);
  addCollider(cp.x, cp.z + 0.3, 0.45, 0.3, false);
  // لمبة ميتة معلّقة بالممر
  const bulb = U(76, 6);
  scene.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.6, 4), M.dark, bulb.x, WALL_H - 0.3, bulb.z, { cast: false }));
  scene.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0x222218, roughness: 0.2 }), bulb.x, WALL_H - 0.64, bulb.z, { cast: false }));

  // ---------- زجاج مكسور ----------
  const shardGeo = new THREE.CircleGeometry(0.06, 3).rotateX(-Math.PI / 2);
  const shardMat = new THREE.MeshStandardMaterial({ color: 0x9fb4bc, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.7 });
  const shards = [];
  for (const g of GLASS) for (let i = 0; i < 14; i++) shards.push({ ...C(g.x, g.y), a: Math.random() * 6, r: Math.random() * 0.9, s: 0.5 + Math.random() });
  scene.add(instanced(shardGeo, shardMat, shards, (sh, m4) => {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sh.a * 3);
    return m4.compose(new THREE.Vector3(sh.x + Math.cos(sh.a) * sh.r, 0.006, sh.z + Math.sin(sh.a) * sh.r), q, new THREE.Vector3(sh.s, 1, sh.s));
  }, { cast: false }));
  const roofTiles = roomTiles('r');
  const rc = roofTiles.reduce((a, t) => ({ x: a.x + C(t.x, t.y).x / roofTiles.length, z: a.z + C(t.x, t.y).z / roofTiles.length }), { x: 0, z: 0 });
  // حبل غسيل عليه شراشف بتتحرّك مع الريح
  const sheets = [];
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 1, side: THREE.DoubleSide });
  scene.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, TILE * 4, 4), M.sheet, rc.x, 2.0, rc.z, { rz: Math.PI / 2, cast: false }));
  for (const s of [-1, 1]) scene.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.1, 6), M.woodDark, rc.x + s * TILE * 2, 1.05, rc.z));
  for (let i = 0; i < 3; i++) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5, 6, 6), clothMat);
    sh.geometry.translate(0, -0.75, 0);
    sh.position.set(rc.x - 2.6 + i * 2.2, 2.0, rc.z);
    sh.castShadow = true;
    scene.add(sh);
    sheets.push(sh);
  }
  // القرية النايمة تحت: بيوت معتمة وكم شباك مضوّي، ومأذنة بعيدة
  const houseMat = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 1 });
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffb060 });
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + Math.random() * 0.2;
    const r = 16 + Math.random() * 22;
    const w = 4 + Math.random() * 6;
    const h = 3 + Math.random() * 4;
    const x = rc.x + Math.cos(a) * r;
    const z = rc.z + Math.sin(a) * r;
    const b = mesh(new THREE.BoxGeometry(w, h, w * (0.6 + Math.random() * 0.6)), houseMat, x, -WALL_H - 1 + h / 2, z, { ry: Math.random(), cast: false });
    scene.add(b);
    if (Math.random() < 0.3) scene.add(mesh(new THREE.PlaneGeometry(0.5, 0.7), winMat, x - Math.cos(a) * (w / 2 + 0.05), -WALL_H - 1 + h * 0.6, z - Math.sin(a) * (w / 2 + 0.05), { ry: -a - Math.PI / 2, cast: false }));
  }
  const mp = { x: rc.x + 30, z: rc.z - 25 };
  scene.add(mesh(new THREE.CylinderGeometry(0.9, 1.1, 16, 8), houseMat, mp.x, -WALL_H + 4, mp.z, { cast: false }));
  scene.add(mesh(new THREE.ConeGeometry(1.1, 3, 8), houseMat, mp.x, -WALL_H + 13.5, mp.z, { cast: false }));
  scene.add(mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0x6fd08a }), mp.x, -WALL_H + 11.6, mp.z, { cast: false }));
  // نجوم
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 500; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.15 + Math.random() * 1.2;
    sp.push(rc.x + Math.cos(a) * Math.cos(e) * 90, Math.sin(e) * 90, rc.z + Math.sin(a) * Math.cos(e) * 90);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xaab4c8, size: 0.35, fog: false })));

  // ---------- رسومات الأطفال عالحيطان ----------
  const drawing = (seed) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = '#d8cfb8';
    g.fillRect(0, 0, 256, 200);
    g.lineWidth = 4;
    g.lineCap = 'round';
    const stick = (x, y, s, col) => {
      g.strokeStyle = col;
      g.beginPath();
      g.arc(x, y, 9 * s, 0, Math.PI * 2);
      g.moveTo(x, y + 9 * s);
      g.lineTo(x, y + 40 * s);
      g.moveTo(x - 14 * s, y + 22 * s);
      g.lineTo(x + 14 * s, y + 22 * s);
      g.moveTo(x, y + 40 * s);
      g.lineTo(x - 10 * s, y + 60 * s);
      g.moveTo(x, y + 40 * s);
      g.lineTo(x + 10 * s, y + 60 * s);
      g.stroke();
    };
    const kids = 2 + (seed % 3);
    for (let i = 0; i < kids; i++) stick(40 + i * 38, 110, 1, ['#2a4fa0', '#b02a2a', '#2a8a3a'][i % 3]);
    // المرأة الطويلة: شعر أسود طويل وإيدين طوال
    g.strokeStyle = '#111';
    g.lineWidth = 5;
    const x = 200;
    g.beginPath();
    g.arc(x, 30, 12, 0, Math.PI * 2);
    g.moveTo(x, 42);
    g.lineTo(x, 140);
    g.moveTo(x, 70);
    g.lineTo(x - 70, 110);
    g.moveTo(x, 70);
    g.lineTo(x + 30, 120);
    g.moveTo(x, 140);
    g.lineTo(x - 18, 190);
    g.moveTo(x, 140);
    g.lineTo(x + 18, 190);
    g.stroke();
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(x + i * 4, 22);
      g.quadraticCurveTo(x + i * 9, 60, x + i * 7, 100);
      g.stroke();
    }
    g.fillStyle = '#b02a2a';
    g.font = 'bold 22px sans-serif';
    g.fillText(seed % 2 ? 'ستّي' : 'هي', 20, 30);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
  };
  // على الحيط الشمالي لغرفة الأطفال والقبو (z = بداية صف 12)
  for (const [tx, seed, rz] of [[2, 1, 0.05], [4, 2, -0.08], [5, 3, 0.03], [18, 4, 0.1], [20, 5, -0.05]]) {
    const p = C(tx, 12);
    scene.add(mesh(new THREE.PlaneGeometry(0.62, 0.48), drawing(seed), p.x, 1.1 + (seed % 2) * 0.25, 12 * TILE + 0.02, { rz, cast: false }));
  }

  // ---------- الشبابيك (عالحيطان الخارجية) ----------
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b1522, emissive: 0x28405e, emissiveIntensity: 0.55, roughness: 0.2 });
  const windows = [
    { x: 3, y: 0, dir: [0, 1] }, { x: 11, y: 0, dir: [0, 1] }, { x: 20, y: 0, dir: [0, 1] },
    { x: 0, y: 8, dir: [1, 0] }, { x: 0, y: 14, dir: [1, 0] }, { x: 24, y: 8, dir: [-1, 0] },
  ];
  const lattice = new THREE.MeshStandardMaterial({ map: mashrabiyaTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, color: 0x8a6a4a });
  for (const [i, w] of windows.entries()) {
    const p = C(w.x, w.y);
    const ry = w.dir[0] ? Math.PI / 2 : 0;
    const fx = p.x + w.dir[0] * (TILE / 2 + 0.01);
    const fz = p.z + w.dir[1] * (TILE / 2 + 0.01);
    const face = ry + (w.dir[0] < 0 || w.dir[1] < 0 ? Math.PI : 0);
    scene.add(mesh(new THREE.PlaneGeometry(0.9, 1.2), glass, fx, 1.8, fz, { ry: face, cast: false }));
    // مشربية خشب مزخرفة بنص الشبابيك، والباقي شبك حديد
    if (i % 2 === 0) {
      const lm = mesh(new THREE.PlaneGeometry(1.0, 1.3), lattice, fx + w.dir[0] * 0.06, 1.8, fz + w.dir[1] * 0.06, { ry: face });
      lm.castShadow = true;
      scene.add(lm);
      const frame = new THREE.BoxGeometry(w.dir[1] ? 1.1 : 0.12, 0.1, w.dir[0] ? 1.1 : 0.12);
      for (const h of [1.12, 2.48]) scene.add(mesh(frame, M.woodDark, fx + w.dir[0] * 0.06, h, fz + w.dir[1] * 0.06));
      continue;
    }
    // شبك حديد وخشب
    for (const o of [-0.3, 0, 0.3]) {
      const bar = new THREE.BoxGeometry(0.04, 1.25, 0.04);
      scene.add(mesh(bar, M.metal, fx + (w.dir[1] ? o : 0) + w.dir[0] * 0.03, 1.8, fz + (w.dir[0] ? o : 0) + w.dir[1] * 0.03));
    }
    const frame = new THREE.BoxGeometry(w.dir[1] ? 1.1 : 0.12, 0.1, w.dir[0] ? 1.1 : 0.12);
    for (const h of [1.15, 2.45]) scene.add(mesh(frame, M.woodDark, fx + w.dir[0] * 0.04, h, fz + w.dir[1] * 0.04));
  }

  // ---------- على الحيطان: صور عائلية وخط عربي ----------
  // (tx,ty) خانة حيط، dir باتجاه الغرفة
  const onWall = (tx, ty, dir, w, h, mat, y = 1.7) => {
    const p = C(tx, ty);
    const ry = Math.atan2(dir[0], dir[1]);
    const x = p.x + dir[0] * (TILE / 2 + 0.03);
    const z = p.z + dir[1] * (TILE / 2 + 0.03);
    scene.add(mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.03), M.woodDark, x - dir[0] * 0.015, y, z - dir[1] * 0.015, { ry, cast: false }));
    scene.add(mesh(new THREE.PlaneGeometry(w, h), mat, x + dir[0] * 0.002, y, z + dir[1] * 0.002, { ry, cast: false }));
  };
  const texMat = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  };
  onWall(0, 7, [1, 0], 0.4, 0.5, texMat(familyPhoto(1, false)));
  onWall(0, 9, [1, 0], 0.55, 0.42, texMat(familyPhoto(2, true)), 1.8); // الجدة شابة… ومعها امرأة طويلة
  onWall(18, 0, [0, 1], 0.36, 0.46, texMat(familyPhoto(3, false)));
  onWall(9, 0, [0, 1], 0.9, 0.42, texMat(calligraphy('الصبر مفتاح الفرج')), 2.0);
  onWall(13, 0, [0, 1], 0.9, 0.42, texMat(calligraphy('أهلاً وسهلاً')), 2.0);
  onWall(9, 17, [0, -1], 1.0, 0.45, texMat(calligraphy('يا دارُ ما فعلتْ بكِ الأيامُ')), 2.1);

  // ---------- البوابة ----------
  const gp = C(GATE.x, GATE.y);
  const gate = new THREE.Group();
  for (const s of [-1, 1]) {
    const leaf = mesh(new THREE.BoxGeometry(TILE / 2 - 0.02, WALL_H - 0.1, 0.18), M.woodDark, s * (TILE / 4), (WALL_H - 0.1) / 2, 0, { parent: gate });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      mesh(new THREE.SphereGeometry(0.035, 6, 4), M.metal, s * (TILE / 4) + (j - 1) * 0.3, 0.5 + i * 0.7, 0.1, { parent: gate, cast: false });
    }
    void leaf;
  }
  mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12), M.metal, 0.15, 1.3, 0.12, { parent: gate });
  gate.position.set(gp.x, 0, gp.z - TILE / 2 + 0.1);
  scene.add(gate);

  // ---------- البير بالحوش ----------
  const wp = C(WELL.x, WELL.y);
  const well = new THREE.Group();
  const ringGeo = lathe([[0.75, 0], [0.95, 0], [1.0, 0.1], [1.0, 0.85], [0.95, 0.95], [0.75, 0.95], [0.72, 0.9], [0.72, 0]], 20);
  mesh(ringGeo, M.stone, 0, 0, 0, { parent: well });
  mesh(new THREE.CircleGeometry(0.72, 20).rotateX(-Math.PI / 2), M.dark, 0, 0.5, 0, { parent: well, cast: false });
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.12, 1.9, 0.12), M.woodDark, s * 0.85, 1.4, 0, { parent: well });
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 8), M.woodDark, 0, 2.2, 0, { parent: well, rz: Math.PI / 2 });
  mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.4, 4), M.sheet, 0.2, 1.5, 0, { parent: well, cast: false });
  mesh(lathe([[0.12, 0], [0.16, 0.25], [0.15, 0.27]], 10), M.metal, 0.2, 0.75, 0, { parent: well });
  well.position.set(wp.x, 0, wp.z);
  scene.add(well);

  // شجرة الليمون اليابسة
  const tree = new THREE.Group();
  const branch = (len, rad, depth, parent) => {
    const g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(rad * 0.6, rad, len, 5).translate(0, len / 2, 0), M.woodDark, 0, 0, 0, { parent: g });
    parent.add(g);
    if (depth > 0)
      for (let i = 0; i < 3; i++) {
        const c = branch(len * 0.7, rad * 0.6, depth - 1, g);
        c.position.y = len * (0.7 + Math.random() * 0.3);
        c.rotation.set((Math.random() - 0.5) * 1.4, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 1.4);
      }
    return g;
  };
  branch(1.6, 0.14, 3, tree);
  const tp = C(16, 7);
  tree.position.set(tp.x, 0, tp.z - 0.5);
  scene.add(tree);
  addCollider(tp.x, tp.z - 0.5, 0.25, 0.25);

  // ---------- المخابئ ----------
  const hideMeshes = {};
  for (const s of HIDE_SPOTS) {
    const p = C(s.x, s.y);
    const g = new THREE.Group();
    const facing = () => {
      const open = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dy]) => !isWall(s.x + dx, s.y + dy)) || [0, 1];
      g.rotation.y = Math.atan2(open[0], open[1]);
    };
    if (s.kind === 'chest') {
      // سحّارة العرس: صندوق خشب بأحزمة نحاس (والشمعة فوقها)
      mesh(new THREE.BoxGeometry(1.3, 0.62, 0.62), M.wood, 0, 0.31, -0.6, { parent: g });
      mesh(new THREE.BoxGeometry(1.34, 0.08, 0.66), M.woodDark, 0, 0.66, -0.6, { parent: g });
      for (const x of [-0.45, 0, 0.45]) mesh(new THREE.BoxGeometry(0.06, 0.72, 0.66), M.metal, x, 0.36, -0.6, { parent: g });
      mesh(new THREE.BoxGeometry(0.12, 0.14, 0.04), M.metal, 0, 0.5, -0.27, { parent: g, cast: false });
    } else if (s.kind === 'curtain') {
      // ستارة ثقيلة بطيّات، نازلة لقرب الأرض (رجليك ممكن تبيّن)
      const geo = new THREE.PlaneGeometry(TILE * 0.95, 2.75, 24, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 9) * 0.07);
      geo.computeVertexNormals();
      const cloth = new THREE.MeshStandardMaterial({ color: 0x4a1414, roughness: 1, side: THREE.DoubleSide });
      mesh(geo, cloth, 0, 1.55, 0.2, { parent: g });
      mesh(new THREE.CylinderGeometry(0.025, 0.025, TILE, 6), M.metal, 0, 2.95, 0.2, { parent: g, rz: Math.PI / 2 });
      facing();
    } else if (s.kind === 'tank') {
      // خزان مي معدني على قاعدة، بدرج صغير
      mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 16), M.metal, 0, 1.25, 0, { parent: g });
      mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.06, 16), M.woodDark, 0, 2.02, 0, { parent: g });
      for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), M.metal, x, 0.25, z, { parent: g });
      for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(0.4, 0.03, 0.03), M.metal, -0.1, 0.3 + i * 0.35, -0.85, { parent: g });
    } else if (s.kind === 'stall') {
      // بيت خلاء خشبي صغير بباب بيتسكّر من جوّا
      for (const [x, z, w, d] of [[-0.9, 0, 0.08, 1.9], [0.9, 0, 0.08, 1.9], [0, -0.95, 1.9, 0.08]]) mesh(new THREE.BoxGeometry(w, 2.3, d), M.woodDark, x, 1.15, z, { parent: g });
      mesh(new THREE.BoxGeometry(1.7, 2.1, 0.06), M.wood, 0, 1.08, 0.95, { parent: g });
      mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), M.metal, 0.6, 1.1, 1.0, { parent: g, cast: false });
      mesh(new THREE.BoxGeometry(1.9, 0.08, 2), M.woodDark, 0, 2.34, 0, { parent: g });
      facing();
    } else if (s.kind === 'wardrobe') {
      mesh(new THREE.BoxGeometry(1.7, 2.3, 1.1), M.wood, 0, 1.2, 0, { parent: g });
      mesh(new THREE.BoxGeometry(1.8, 0.12, 1.2), M.woodDark, 0, 2.4, 0, { parent: g });
      mesh(new THREE.BoxGeometry(1.8, 0.1, 1.2), M.woodDark, 0, 0.05, 0, { parent: g });
      for (const x of [-0.42, 0.42]) {
        mesh(new THREE.BoxGeometry(0.8, 2.1, 0.05), M.woodDark, x, 1.2, 0.56, { parent: g });
        mesh(new THREE.BoxGeometry(0.6, 1.6, 0.03), M.wood, x, 1.2, 0.59, { parent: g });
        mesh(new THREE.SphereGeometry(0.035, 6, 4), M.metal, x > 0 ? 0.08 : -0.08, 1.2, 0.62, { parent: g, cast: false });
      }
      const open = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dy]) => !isWall(s.x + dx, s.y + dy)) || [0, 1];
      g.rotation.y = Math.atan2(open[0], open[1]);
    } else {
      // سرير نحاس مع شرشف نازل للأرض
      const brass = M.metal;
      for (const [x, z, h] of [[-0.7, -1.1, 1.2], [0.7, -1.1, 1.2], [-0.7, 1.1, 0.8], [0.7, 1.1, 0.8]]) {
        mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 6), brass, x, h / 2, z, { parent: g });
        mesh(new THREE.SphereGeometry(0.05, 6, 4), brass, x, h, z, { parent: g });
      }
      for (const [z, h] of [[-1.1, 1.1], [1.1, 0.72]]) mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), brass, 0, h, z, { parent: g, rz: Math.PI / 2 });
      mesh(new THREE.BoxGeometry(1.4, 0.2, 2.2), M.sheet, 0, 0.6, 0, { parent: g });
      mesh(new THREE.BoxGeometry(1.5, 0.45, 2.3), M.sheet, 0, 0.5, 0, { parent: g, cast: false });
      mesh(new THREE.BoxGeometry(0.6, 0.12, 0.4), M.sheet, 0, 0.76, -0.8, { parent: g });
    }
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    hideMeshes[s.id] = g;
  }

  // ---------- الأثاث حسب الغرف ----------
  const put = (geo, mat, tx, ty, ox, y, oz, opts = {}) => {
    const p = C(tx, ty);
    const m = mesh(geo, mat, p.x + ox, y, p.z + oz, opts);
    scene.add(m);
    if (opts.solid) {
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const swap = Math.abs(Math.sin(opts.ry ?? 0)) > 0.5;
      const hw = ((swap ? bb.max.z - bb.min.z : bb.max.x - bb.min.x) / 2) * 0.9;
      const hd = ((swap ? bb.max.x - bb.min.x : bb.max.z - bb.min.z) / 2) * 0.9;
      addCollider(m.position.x, m.position.z, hw, hd);
    }
    return m;
  };
  const jar = lathe([[0, 0], [0.16, 0.02], [0.24, 0.2], [0.22, 0.42], [0.1, 0.55], [0.09, 0.62], [0.12, 0.66]]);
  const dallah = lathe([[0, 0], [0.1, 0], [0.11, 0.05], [0.07, 0.18], [0.05, 0.22], [0.08, 0.3], [0, 0.36]], 12);
  const barrel = lathe([[0, 0], [0.35, 0], [0.42, 0.45], [0.35, 0.9], [0, 0.9]], 14);

  // الليوان: فرشات عربية ومساند وطبلية وسجادة
  const rugGeo = new THREE.PlaneGeometry(3, 4).rotateX(-Math.PI / 2);
  put(rugGeo, M.rug, 3, 8, 0.8, 0.012, 0, { cast: false });
  for (let y = 6; y <= 10; y++) {
    put(new THREE.BoxGeometry(0.8, 0.2, TILE - 0.05), M.cloth, 1, y, -0.75, 0.1, 0, { solid: true });
    put(new THREE.BoxGeometry(0.25, 0.5, 0.6), M.cloth, 1, y, -1.05, 0.45, 0, { rz: -0.2 });
  }
  put(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 20), M.wood, 3, 8, 0.8, 0.35, 0);
  put(new THREE.CylinderGeometry(0.4, 0.45, 0.3, 12, 1, true), M.woodDark, 3, 8, 0.8, 0.16, 0);
  put(dallah, M.metal, 3, 8, 0.7, 0.38, 0.1);
  put(new THREE.BoxGeometry(0.5, 1, 0.22), M.woodDark, 3, 6, 0, 2.0, -1.12); // ساعة الحيط
  put(new THREE.CircleGeometry(0.17, 16), M.sheet, 3, 6, 0, 2.15, -1.0, { cast: false });

  // المضافة
  put(new THREE.PlaneGeometry(3.5, 2.5).rotateX(-Math.PI / 2), M.rug, 11, 2, 0, 0.012, 0, { cast: false });
  for (let x = 9; x <= 13; x++) put(new THREE.BoxGeometry(TILE - 0.05, 0.25, 0.8), M.cloth, x, 1, 0, 0.12, -0.75, { solid: true });
  put(new THREE.BoxGeometry(0.5, 0.35, 0.3), M.woodDark, 8, 4, -0.7, 0.9, 0.7); // راديو قديم
  put(new THREE.BoxGeometry(0.6, 0.8, 0.5), M.wood, 8, 4, -0.7, 0.4, 0.7, { solid: true });
  put(dallah, M.metal, 12, 2, 0.3, 0.02, 0.4);

  // المطبخ: مصطبة، رفوف، جرار، طناجر
  put(new THREE.BoxGeometry(TILE * 2, 0.9, 0.7), M.stone, 4, 1, 0, 0.45, -0.85, { solid: true });
  put(new THREE.BoxGeometry(TILE * 2, 0.06, 0.35), M.woodDark, 4, 1, 0, 1.8, -1.05);
  for (let i = 0; i < 5; i++) put(jar.clone().scale(0.5, 0.5, 0.5), M.clay, 4, 1, -1.8 + i * 0.8, 1.83, -1.05);
  for (let i = 0; i < 3; i++) put(jar, M.clay, 6, 4, -0.8 + i * 0.1, 0, 0.8 - i * 0.55, { solid: i === 1 });
  put(new THREE.CylinderGeometry(0.25, 0.2, 0.25, 12, 1, true), M.metal, 3, 1, 0, 1.0, -0.85);

  // غرفة الجدة: سجادة، مرآة (السحّارة صارت مخبأ)
  put(new THREE.PlaneGeometry(3, 3.5).rotateX(-Math.PI / 2), M.rug, 20, 3, 0, 0.012, 0, { cast: false });
  // مراية حقيقية بتعكس (وأحياناً بيبيّن فيها شي وراك)
  const mirror = new Reflector(new THREE.PlaneGeometry(0.7, 1.2), { textureWidth: 256, textureHeight: 440, color: 0x8a9090 });
  const mpos = C(23, 3);
  mirror.position.set(mpos.x + 1.2, 1.6, mpos.z);
  mirror.rotation.y = -Math.PI / 2;
  scene.add(mirror);
  put(new THREE.BoxGeometry(0.06, 1.35, 0.85), M.woodDark, 23, 3, 1.23, 1.6, 0);

  // غرفة الأطفال: ألعاب ومهد
  put(new THREE.SphereGeometry(0.15, 12, 8), M.cloth, 3, 14, 0.4, 0.15, 0.3);
  for (let i = 0; i < 4; i++) put(new THREE.BoxGeometry(0.16, 0.16, 0.16), M.wood, 2, 15, i * 0.2, 0.08 + (i === 3 ? 0.16 : 0), i === 3 ? 0.2 : 0, { ry: i });
  // دمية
  const doll = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.3, 8), M.cloth, 0, 0.15, 0, { parent: doll });
  mesh(new THREE.SphereGeometry(0.07, 10, 8), M.sheet, 0, 0.36, 0, { parent: doll });
  const dp = C(2, 12);
  doll.position.set(dp.x - 0.8, 0.0, dp.z - 0.8);
  doll.rotation.set(0, 0.6, 0.25);
  scene.add(doll);

  // الحمّام
  put(lathe([[0, 0], [0.3, 0.05], [0.35, 0.3], [0.33, 0.32], [0.28, 0.1], [0, 0.08]]), M.stone, 22, 7, 0.8, 0.6, -0.8);
  put(new THREE.BoxGeometry(0.3, 0.6, 0.3), M.stone, 22, 7, 0.8, 0.3, -0.8, { solid: true });
  put(lathe([[0, 0], [0.18, 0], [0.22, 0.35], [0.21, 0.36]], 12), M.metal, 21, 9, 0.4, 0, 0.6);

  // القبو: براميل وأكياس وجرار
  for (const [tx, ty, ox, oz] of [[17, 12, -0.5, -0.5], [17, 13, -0.6, 0], [23, 16, 0.5, 0.5], [18, 16, -0.4, 0.6]]) {
    put(barrel, M.wood, tx, ty, ox, 0, oz, { solid: true });
    put(new THREE.TorusGeometry(0.4, 0.02, 4, 16), M.metal, tx, ty, ox, 0.25, oz, { rx: Math.PI / 2, cast: false });
  }
  for (let i = 0; i < 4; i++) put(new THREE.SphereGeometry(0.3, 8, 6).scale(1, 0.7, 0.8), M.sheet, 23, 13, 0.6, 0.2 + (i > 2 ? 0.35 : 0), -0.8 + i * 0.5);

  // التلفون الأرضي القديم على طاولة صغيرة
  const php = C(PHONE.x, PHONE.y);
  const phone = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.6, 0.8, 0.45), M.wood, 0, 0.4, 0, { parent: phone });
  mesh(new THREE.BoxGeometry(0.26, 0.1, 0.22), M.dark, 0, 0.85, 0, { parent: phone });
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12), M.sheet, 0, 0.91, 0.02, { parent: phone, cast: false });
  mesh(new THREE.CapsuleGeometry(0.03, 0.18, 4, 8), M.dark, 0, 0.94, -0.06, { parent: phone, rz: Math.PI / 2 });
  phone.position.set(php.x, 0, php.z - 0.7);
  scene.add(phone);
  addCollider(php.x, php.z - 0.7, 0.3, 0.25);

  // عشّ السعلوة بالقبو: خِرَق وقش وعظام
  const np = C(NEST.x, NEST.y);
  const nest = new THREE.Group();
  mesh(new THREE.TorusGeometry(0.7, 0.22, 6, 16).scale(1, 1, 0.35).rotateX(Math.PI / 2), M.sheet, 0, 0.08, 0, { parent: nest });
  mesh(new THREE.CircleGeometry(0.6, 12).rotateX(-Math.PI / 2), M.cloth, 0, 0.03, 0, { parent: nest, cast: false });
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.35, 5), M.sheet, Math.cos(a) * 0.9, 0.03, Math.sin(a) * 0.9, { parent: nest, rz: Math.PI / 2, ry: a * 2 });
  }
  nest.position.set(np.x, 0, np.z);
  scene.add(nest);

  // المدخل: مسطبة حجر
  put(new THREE.BoxGeometry(TILE * 1.5, 0.45, 0.5), M.stone, 9, 16, 0.5, 0.22, 0.85, { solid: true });

  // ---------- خيوط العنكبوت بالزوايا ----------
  const webMat = new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.6 });
  for (const [tx, ty, sx, sy] of [[1, 1, -1, -1], [23, 12, 1, -1], [17, 16, -1, 1], [6, 16, 1, 1], [8, 12, -1, -1], [23, 6, 1, -1], [1, 10, -1, 1], [23, 4, 1, 1]]) {
    const p = C(tx, ty);
    const web = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), webMat);
    web.position.set(p.x + sx * (TILE / 2 - 0.4), WALL_H - 0.4, p.z + sy * (TILE / 2 - 0.4));
    web.rotation.y = Math.atan2(sx, sy) + Math.PI * 0.75;
    web.rotation.x = 0.4;
    scene.add(web);
  }

  // ---------- الإضاءة ----------
  const hemi = new THREE.HemisphereLight(0x1c2536, 0x0a0806, 0.4);
  scene.add(hemi);
  // القمر: ضوء اتجاهي أزرق بظلال، بيدخل بس من الحوش لأن السقف بيحجبه
  const moon = new THREE.DirectionalLight(0x8ea6d8, 1.1);
  moon.position.set(wp.x - 12, 30, wp.z + 8);
  moon.target.position.set(wp.x, 0, wp.z);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 70 });
  moon.shadow.bias = -0.0015;
  moon.shadow.normalBias = 0.04;
  scene.add(moon, moon.target);

  // شموع بترجف
  const candles = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  const candleSpots = [[3, 8, 1.1, 0.38, 0.3], [21, 1, 0.4, 0.7, -0.8], [4, 1, -1.2, 0.9, -0.8], [5, 16, 0.6, 0.02, 0.6], [14, 16, 0.4, 0.02, 0.5], [22, 7, 0.8, 0.9, -0.8], [74, 1, 0.5, 0.75, -0.6]];
  for (const [tx, ty, ox, y, oz] of candleSpots) {
    const p = C(tx, ty);
    const x = p.x + ox;
    const z = p.z + oz;
    scene.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.18, 8), M.sheet, x, y + 0.09, z));
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 6), flameMat);
    flame.position.set(x, y + 0.21, z);
    scene.add(flame);
    const light = new THREE.PointLight(0xff9a45, 3, 8, 1.8);
    light.position.set(x, y + 0.35, z);
    scene.add(light);
    candles.push({ light, flame, base: 3, seed: Math.random() * 100, lit: true, room: roomAt(tx, ty), pos: { x, y: y + 0.3, z } });
  }

  let lightningT = 0;
  let sky = 1; // بالطابق الفوقاني ما في قمر (السقف مسكّر وما في شبابيك)
  const skyBase = hemi.intensity;
  return {
    hideMeshes,
    colliders,
    blockedTiles,
    wellPos: wp,
    gatePos: gp,
    doors,
    mannequin,
    mirror,
    setSky(on) {
      sky = on ? 1 : 0;
    },
    update(dt, t) {
      cradle.rotation.x = Math.sin(t * 1.6) * (0.06 + this.rock * 0.25);
      for (const [i, sh] of sheets.entries()) sh.rotation.x = Math.sin(t * 1.3 + i) * 0.25 + Math.sin(t * 3.1 + i * 2) * 0.05;
      for (const c of candles) {
        if (!c.lit) continue;
        const f = 0.75 + Math.sin(t * 11 + c.seed) * 0.1 + Math.sin(t * 23.7 + c.seed) * 0.08 + (Math.random() - 0.5) * 0.12;
        c.light.intensity = c.base * f;
        c.flame.scale.set(1, 0.8 + f * 0.4, 1);
      }
      if (lightningT > 0) {
        lightningT -= dt;
        const k = lightningT > 0.35 ? 1 : lightningT > 0.25 ? 0.2 : lightningT > 0.15 ? 0.8 : Math.max(0, lightningT / 0.15) * 0.4;
        moon.intensity = (1.1 + k * 6) * sky;
        hemi.intensity = (skyBase + k * 1.2) * sky;
      } else {
        moon.intensity = 1.1 * sky;
        hemi.intensity = skyBase * (0.25 + 0.75 * sky);
      }
    },
    rock: 0, // المهد: بيهتز أقوى وقت الحدث
    lightning() {
      lightningT = 0.5;
    },
    // السعلوة بتطفي الشموع، واللاعب بيولّعها بالكبريت
    setCandle(c, lit) {
      c.lit = lit;
      c.flame.visible = lit;
      c.light.intensity = lit ? c.base : 0;
    },
    candles,
  };
}

// أغراض قابلة للالتقاط
export function pickupMesh(kind) {
  const M = materials();
  const shine = (color, metal = 0.2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12, roughness: 0.35, metalness: metal });
  let m;
  switch (kind) {
    case 'rosary': {
      m = new THREE.Group();
      const bead = new THREE.SphereGeometry(0.018, 6, 4);
      const mat = shine(0x2f6b45);
      for (let i = 0; i < 33; i++) {
        const a = (i / 33) * Math.PI * 2;
        const b = new THREE.Mesh(bead, mat);
        b.position.set(Math.cos(a) * 0.15, 0.02, Math.sin(a) * 0.1);
        m.add(b);
      }
      const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 6), shine(0x6b4a2a));
      tassel.position.set(0, 0.02, 0.16);
      tassel.rotation.x = Math.PI / 2;
      m.add(tassel);
      return m;
    }
    case 'anklet':
      m = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 24), shine(0xd8dce6, 1));
      m.rotation.x = Math.PI / 2;
      m.position.y = 0.02;
      return m;
    case 'photo': {
      m = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.38), M.woodDark);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32).rotateX(-Math.PI / 2), shine(0x8f8570, 0));
      pic.position.y = 0.012;
      m.add(frame, pic);
      m.rotation.y = 0.4;
      return m;
    }
    case 'battery':
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), shine(0xb08b2a, 0.6));
      m.rotation.z = Math.PI / 2;
      m.position.y = 0.03;
      return m;
    case 'bell':
      m = new THREE.Mesh(lathe([[0, 0.12], [0.02, 0.11], [0.04, 0.06], [0.07, 0], [0.065, 0]], 12), shine(0xd4a93a, 1));
      return m;
    case 'key': {
      m = new THREE.Group();
      const brass = shine(0xb8862e, 1);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), brass);
      shaft.rotation.z = Math.PI / 2;
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 6, 12), brass);
      bow.position.x = -0.12;
      bow.rotation.x = Math.PI / 2;
      const bit = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.05), brass);
      bit.position.set(0.08, 0, 0.03);
      m.add(shaft, bow, bit);
      m.position.y = 0.015;
      return m;
    }
    case 'doorkey': {
      // مفتاح حديد كبير قديم
      m = new THREE.Group();
      const iron = shine(0x5a5550, 0.9);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.26, 6), iron);
      shaft.rotation.z = Math.PI / 2;
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), iron);
      bow.position.x = -0.16;
      bow.rotation.x = Math.PI / 2;
      const bit = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.07), iron);
      bit.position.set(0.1, 0, 0.04);
      m.add(shaft, bow, bit);
      m.position.y = 0.02;
      return m;
    }
    case 'water': {
      m = new THREE.Group();
      const glass = new THREE.MeshStandardMaterial({ color: 0x6f8f9a, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55, emissive: 0x1a2a30 });
      m.add(new THREE.Mesh(lathe([[0, 0], [0.07, 0], [0.08, 0.1], [0.05, 0.17], [0.025, 0.2], [0.025, 0.24]], 12), glass));
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.03, 8), M.woodDark);
      cork.position.y = 0.25;
      m.add(cork);
      return m;
    }
    case 'matches':
      m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.06), shine(0x8a2a1a, 0));
      m.position.y = 0.015;
      return m;
    case 'salt':
      m = new THREE.Mesh(lathe([[0, 0], [0.07, 0], [0.08, 0.12], [0.05, 0.16], [0, 0.17]], 10), shine(0xe8e4dc, 0));
      return m;
    case 'bead': {
      m = new THREE.Group();
      m.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), shine(0x1f4fd8, 0.3)));
      const eye = new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), shine(0xffffff, 0));
      eye.position.y = 0.041;
      eye.rotation.x = -Math.PI / 2;
      m.add(eye);
      m.position.y = 0.04;
      return m;
    }
    case 'recorder':
    case 'tape': {
      const big = kind === 'recorder';
      m = new THREE.Group();
      m.add(new THREE.Mesh(new THREE.BoxGeometry(big ? 0.3 : 0.1, big ? 0.08 : 0.012, big ? 0.18 : 0.065), shine(big ? 0x2a2a2a : 0x3a2a1a, 0.2)));
      for (const x of [-1, 1]) {
        const reel = new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.035 : 0.014, big ? 0.035 : 0.014, big ? 0.085 : 0.014, 10), shine(0xd8d0c0, 0));
        reel.position.x = x * (big ? 0.07 : 0.025);
        m.add(reel);
      }
      m.position.y = big ? 0.04 : 0.008;
      return m;
    }
  }
  return m;
}
