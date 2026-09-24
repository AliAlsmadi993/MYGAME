// بناء البيت بـ Three.js بأسلوب ألعاب PS1: أشكال بسيطة، نسيج بدقة منخفضة، ضباب أسود.
import * as THREE from 'three';
import { W, H, TILE, WALL_H, HIDE_SPOTS, WELL, GATE, charAt, isWall, tileCenter } from './map.js';

function canvasTex(size, paint, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  paint(g, size);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const speckle = (g, s, base, spread, n = 900) => {
  g.fillStyle = base;
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    const v = Math.floor(Math.random() * spread);
    g.fillStyle = `rgba(${v},${v * 0.9},${v * 0.75},0.25)`;
    g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
  }
};

const stoneTex = () =>
  canvasTex(64, (g, s) => {
    speckle(g, s, '#8d7b62', 255);
    g.strokeStyle = 'rgba(40,30,20,0.6)';
    for (let r = 0; r < 4; r++) {
      const y = r * 16;
      g.strokeRect(-1, y, s + 2, 16);
      for (let x = (r % 2) * 16; x < s; x += 32) g.strokeRect(x, y, 32, 16);
    }
  });

const floorTex = () =>
  canvasTex(
    64,
    (g, s) => {
      speckle(g, s, '#6b5a4a', 200);
      g.fillStyle = 'rgba(120,40,30,0.25)';
      for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) if ((x + y) % 2) g.fillRect(x * 32, y * 32, 32, 32);
      g.strokeStyle = 'rgba(20,15,10,0.7)';
      g.strokeRect(0, 0, 32, 32);
      g.strokeRect(32, 32, 32, 32);
    },
  );

const dirtTex = () => canvasTex(32, (g, s) => speckle(g, s, '#4c4330', 180, 400));
const woodTex = () =>
  canvasTex(32, (g, s) => {
    g.fillStyle = '#4a2e1a';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 3) {
      g.fillStyle = `rgba(0,0,0,${0.1 + Math.random() * 0.25})`;
      g.fillRect(0, y, s, 1);
    }
  });

export function buildWorld(scene) {
  scene.background = new THREE.Color(0x020203);
  scene.fog = new THREE.FogExp2(0x020203, 0.085);

  const stone = new THREE.MeshLambertMaterial({ map: stoneTex() });
  const wood = new THREE.MeshLambertMaterial({ map: woodTex() });

  // الأرضية
  const fTex = floorTex();
  fTex.repeat.set(W, H);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * TILE, H * TILE), new THREE.MeshLambertMaterial({ map: fTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((W * TILE) / 2, 0, (H * TILE) / 2);
  scene.add(floor);

  // الحيطان: بس اللي بيبيّن (جنب خانة مفتوحة)
  const wallCells = [];
  const ceilCells = [];
  const dirtCells = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = charAt(x, y);
      if (isWall(x, y)) {
        if (c === 'G') continue;
        const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !isWall(x + dx, y + dy));
        if (open) wallCells.push({ x, y });
      } else if (c === 'c') dirtCells.push({ x, y });
      else ceilCells.push({ x, y });
    }
  const m4 = new THREE.Matrix4();
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, WALL_H, TILE), stone, wallCells.length);
  wallCells.forEach(({ x, y }, i) => {
    const p = tileCenter(x, y);
    walls.setMatrixAt(i, m4.makeTranslation(p.x, WALL_H / 2, p.z));
  });
  scene.add(walls);

  const ceil = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(TILE, TILE).rotateX(Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x3a2c20 }),
    ceilCells.length,
  );
  ceilCells.forEach(({ x, y }, i) => {
    const p = tileCenter(x, y);
    ceil.setMatrixAt(i, m4.makeTranslation(p.x, WALL_H, p.z));
  });
  scene.add(ceil);

  const dirt = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(TILE, TILE).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ map: dirtTex() }),
    dirtCells.length,
  );
  dirtCells.forEach(({ x, y }, i) => {
    const p = tileCenter(x, y);
    dirt.setMatrixAt(i, m4.makeTranslation(p.x, 0.01, p.z));
  });
  scene.add(dirt);

  // البوابة الخشبية
  const gp = tileCenter(GATE.x, GATE.y);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(TILE, WALL_H, TILE * 0.5), wood);
  gate.position.set(gp.x, WALL_H / 2, gp.z - TILE * 0.25);
  scene.add(gate);

  // البير بالحوش
  const wp = tileCenter(WELL.x, WELL.y);
  const well = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1, 0.9, 10, 1, true),
    new THREE.MeshLambertMaterial({ map: stone.map, side: THREE.DoubleSide }),
  );
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.85, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  hole.position.y = 0.3;
  ring.position.y = 0.45;
  well.add(ring, hole);
  well.position.set(wp.x, 0, wp.z);
  scene.add(well);

  // المخابئ
  const hideMeshes = {};
  const sheet = new THREE.MeshLambertMaterial({ color: 0x8a8272 });
  for (const s of HIDE_SPOTS) {
    const p = tileCenter(s.x, s.y);
    const g = new THREE.Group();
    if (s.kind === 'wardrobe') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 1.1), wood);
      body.position.y = 1.2;
      const knob = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0x8a6d3b }));
      knob.position.set(0.1, 1.2, 0.56);
      g.add(body, knob);
      // نوجّه الخزانة نحو الغرفة
      const open = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dy]) => !isWall(s.x + dx, s.y + dy)) || [0, 1];
      g.rotation.y = Math.atan2(open[0], open[1]);
    } else {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.2), wood);
      frame.position.y = 0.45;
      const mat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.15, 2.1), sheet);
      mat.position.y = 0.75;
      g.add(frame, mat);
    }
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    hideMeshes[s.id] = g;
  }

  // ديكور بسيط: فرشات بالليوان، ساعة حيط، ألعاب أطفال
  const deco = (geo, mat, x, y, oy = 0, ox = 0, oz = 0) => {
    const p = tileCenter(x, y);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(p.x + ox, oy, p.z + oz);
    scene.add(m);
    return m;
  };
  const cushion = new THREE.MeshLambertMaterial({ color: 0x6b1f1f });
  for (let y = 6; y <= 10; y++) deco(new THREE.BoxGeometry(0.9, 0.25, 2.2), cushion, 1, y, 0.12, -0.6);
  deco(new THREE.BoxGeometry(0.6, 1, 0.2), wood, 3, 6, 2.1, 0, -1.1); // ساعة
  const toy = new THREE.MeshLambertMaterial({ color: 0x7a6a2a });
  deco(new THREE.BoxGeometry(0.3, 0.3, 0.3), toy, 3, 14, 0.15);
  deco(new THREE.SphereGeometry(0.2, 6, 4), toy, 4, 15, 0.2);
  deco(new THREE.BoxGeometry(1.2, 0.8, 0.6), wood, 5, 1, 0.4); // خزانة مطبخ

  // الإضاءة: شبه معدومة. ضوء قمر أزرق فوق الحوش فقط
  scene.add(new THREE.HemisphereLight(0x223044, 0x0a0806, 0.35));
  const moon = new THREE.PointLight(0x6f86b8, 25, 22, 1.6);
  moon.position.set(wp.x, WALL_H + 3, wp.z);
  scene.add(moon);

  return { hideMeshes, wellPos: wp, gatePos: gp };
}

// أغراض قابلة للالتقاط
export function pickupMesh(kind) {
  const glint = (color) => new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 });
  let m;
  switch (kind) {
    case 'rosary':
      m = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 4, 10), glint(0x3f7a52));
      break;
    case 'anklet':
      m = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 4, 12), glint(0xc8ccd4));
      break;
    case 'photo':
      m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 0.45), glint(0x9c8f76));
      break;
    case 'battery':
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 6), glint(0xb08b2a));
      break;
    case 'bell':
      m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), glint(0xd4a93a));
      break;
  }
  if (kind !== 'photo') m.rotation.x = Math.PI / 2;
  return m;
}
