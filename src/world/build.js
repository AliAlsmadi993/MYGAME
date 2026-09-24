// بناء البيت بـ Three.js بشكل واقعي: مواد PBR، ظلال، شموع بترجف، ضوء قمر، وأثاث عربي قديم.
import * as THREE from 'three';
import { W, H, TILE, WALL_H, HIDE_SPOTS, WELL, GATE, charAt, isWall, tileCenter, roomAt } from './map.js';
import { materials } from './textures.js';

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
  const floorMat = { c: M.cobbles, u: M.stone, b: M.wood, a: M.tiles, k: M.tiles, l: M.tiles, h: M.wood, d: M.tiles, e: M.stone, '.': M.tiles };
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
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!isWall(x, y) || charAt(x, y) === 'G') continue;
      const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (isWall(x + dx, y + dy) ? null : charAt(x + dx, y + dy)));
      if (around.every((r) => r === null)) continue;
      (around.some((r) => r === 'u' || r === 'c' || r === 'e') ? stoneWalls : plasterWalls).push({ x, y });
    }
  const wallGeo = new THREE.BoxGeometry(TILE, WALL_H, TILE);
  for (const [cells, mat] of [[plasterWalls, M.plaster], [stoneWalls, M.stone]]) {
    scene.add(instanced(wallGeo, mat, cells, ({ x, y }, m4) => {
      const p = C(x, y);
      return m4.makeTranslation(p.x, WALL_H / 2, p.z);
    }));
  }
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
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!isWall(x, y) && charAt(x, y) !== 'c') ceilCells.push({ x, y });
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

  // ---------- الشبابيك (عالحيطان الخارجية) ----------
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b1522, emissive: 0x28405e, emissiveIntensity: 0.55, roughness: 0.2 });
  const windows = [
    { x: 3, y: 0, dir: [0, 1] }, { x: 11, y: 0, dir: [0, 1] }, { x: 20, y: 0, dir: [0, 1] },
    { x: 0, y: 8, dir: [1, 0] }, { x: 0, y: 14, dir: [1, 0] }, { x: 24, y: 8, dir: [-1, 0] },
  ];
  for (const w of windows) {
    const p = C(w.x, w.y);
    const ry = w.dir[0] ? Math.PI / 2 : 0;
    const fx = p.x + w.dir[0] * (TILE / 2 + 0.01);
    const fz = p.z + w.dir[1] * (TILE / 2 + 0.01);
    scene.add(mesh(new THREE.PlaneGeometry(0.9, 1.2), glass, fx, 1.8, fz, { ry: ry + (w.dir[0] < 0 || w.dir[1] < 0 ? Math.PI : 0), cast: false }));
    // شبك حديد وخشب
    for (const o of [-0.3, 0, 0.3]) {
      const bar = new THREE.BoxGeometry(0.04, 1.25, 0.04);
      scene.add(mesh(bar, M.metal, fx + (w.dir[1] ? o : 0) + w.dir[0] * 0.03, 1.8, fz + (w.dir[0] ? o : 0) + w.dir[1] * 0.03));
    }
    const frame = new THREE.BoxGeometry(w.dir[1] ? 1.1 : 0.12, 0.1, w.dir[0] ? 1.1 : 0.12);
    for (const h of [1.15, 2.45]) scene.add(mesh(frame, M.woodDark, fx + w.dir[0] * 0.04, h, fz + w.dir[1] * 0.04));
  }

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
    if (s.kind === 'wardrobe') {
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

  // غرفة الجدة: سحّارة، سجادة، مرآة
  put(new THREE.PlaneGeometry(3, 3.5).rotateX(-Math.PI / 2), M.rug, 20, 3, 0, 0.012, 0, { cast: false });
  put(new THREE.BoxGeometry(1.2, 0.7, 0.6), M.wood, 21, 1, 0, 0.35, -0.8, { solid: true });
  for (const x of [-0.45, 0.45]) put(new THREE.BoxGeometry(0.06, 0.72, 0.62), M.metal, 21, 1, x, 0.36, -0.8);
  const mirror = new THREE.MeshStandardMaterial({ color: 0x223, metalness: 1, roughness: 0.08 });
  put(new THREE.PlaneGeometry(0.7, 1.2), mirror, 23, 3, 1.2, 1.6, 0, { ry: -Math.PI / 2, cast: false });
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
  for (const [tx, ty, ox, y, oz] of [[3, 8, 1.1, 0.38, 0.3], [21, 1, 0.4, 0.7, -0.8], [4, 1, -1.2, 0.9, -0.8]]) {
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
    candles.push({ light, flame, base: 3, seed: Math.random() * 100 });
  }

  let lightningT = 0;
  const skyBase = hemi.intensity;
  return {
    hideMeshes,
    colliders,
    blockedTiles,
    wellPos: wp,
    gatePos: gp,
    update(dt, t) {
      for (const c of candles) {
        const f = 0.75 + Math.sin(t * 11 + c.seed) * 0.1 + Math.sin(t * 23.7 + c.seed) * 0.08 + (Math.random() - 0.5) * 0.12;
        c.light.intensity = c.base * f;
        c.flame.scale.set(1, 0.8 + f * 0.4, 1);
      }
      if (lightningT > 0) {
        lightningT -= dt;
        const k = lightningT > 0.35 ? 1 : lightningT > 0.25 ? 0.2 : lightningT > 0.15 ? 0.8 : Math.max(0, lightningT / 0.15) * 0.4;
        moon.intensity = 1.1 + k * 6;
        hemi.intensity = skyBase + k * 1.2;
      } else {
        moon.intensity = 1.1;
        hemi.intensity = skyBase;
      }
    },
    lightning() {
      lightningT = 0.5;
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
  }
  return m;
}
