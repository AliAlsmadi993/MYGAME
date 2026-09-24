// خريطة البيت: كل خانة = TILE متر. '#' حائط، '.' باب/ممر، 'G' البوابة، والحروف الصغيرة غرف.
export const TILE = 2.5;
export const WALL_H = 3.2;

export const LAYOUT = [
  '#########################',
  '#kkkkkk#aaaaaaaa#bbbbbbb#',
  '#kkkkkk#aaaaaaaa#bbbbbbb#',
  '#kkkkkk.aaaaaaaa.bbbbbbb#',
  '#kkkkkk#aaaaaaaa#bbbbbbb#',
  '####.#####.#######.######',
  '#llllll#ccccccccccc#dddd#',
  '#llllll#ccccccccccc#dddd#',
  '#llllll.ccccccccccc.dddd#',
  '#llllll#ccccccccccc#dddd#',
  '#llllll#ccccccccccc#dddd#',
  '####.#######.########.###',
  '#hhhhhh#eeeeeeee#uuuuuuu#',
  '#hhhhhh#eeeeeeee#uuuuuuu#',
  '#hhhhhh.eeeeeeee#uuuuuuu#',
  '#hhhhhh#eeeeeeee#uuuuuuu#',
  '#hhhhhh#eeeeeeee#uuuuuuu#',
  '###########G#############',
];

export const ROOMS = {
  k: { ar: 'المطبخ', en: 'Kitchen' },
  a: { ar: 'المضافة', en: 'Guest room' },
  b: { ar: 'غرفة الجدة', en: "Grandma's room" },
  l: { ar: 'الليوان', en: 'Liwan' },
  c: { ar: 'الحوش', en: 'Courtyard', openSky: true },
  d: { ar: 'الحمّام القديم', en: 'Old bathroom' },
  h: { ar: 'غرفة الأطفال', en: "Children's room" },
  e: { ar: 'المدخل', en: 'Entrance' },
  u: { ar: 'القبو', en: 'Cellar', dark: true },
};

// أماكن الاختباء والأشياء الثابتة (x = عمود، y = صف)
export const HIDE_SPOTS = [
  { id: 'wardrobe_b', kind: 'wardrobe', x: 23, y: 1, room: 'b' },
  { id: 'bed_b', kind: 'bed', x: 19, y: 1, room: 'b' },
  { id: 'wardrobe_h', kind: 'wardrobe', x: 1, y: 16, room: 'h' },
  { id: 'bed_h', kind: 'bed', x: 5, y: 12, room: 'h' },
  { id: 'wardrobe_k', kind: 'wardrobe', x: 1, y: 1, room: 'k' },
  { id: 'wardrobe_a', kind: 'wardrobe', x: 15, y: 4, room: 'a' },
];
export const WELL = { x: 13, y: 8 };
export const GATE = { x: 11, y: 17 };
export const PLAYER_START = { x: 11, y: 15 };
export const MONSTER_LAIR = { x: 21, y: 15 };

// الأغراض المطلوبة: الخلخال دائماً بالقبو
export const ITEMS = [
  { id: 'rosary', ar: 'مسبحة الجدة', en: "Grandma's rosary", rooms: ['b', 'l', 'a'] },
  { id: 'anklet', ar: 'الخلخال الفضي', en: 'Silver anklet', rooms: ['u'], jingles: true },
  { id: 'photo', ar: 'صورة العائلة القديمة', en: 'Old family photo', rooms: ['h', 'a', 'k'] },
];

export const W = LAYOUT[0].length;
export const H = LAYOUT.length;

const blocked = new Set([...HIDE_SPOTS.map((s) => `${s.x},${s.y}`), `${WELL.x},${WELL.y}`]);

export function charAt(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return '#';
  return LAYOUT[y][x];
}

export function isWall(x, y) {
  const c = charAt(x, y);
  return c === '#' || c === 'G';
}

export function isWalkable(x, y) {
  return !isWall(x, y) && !blocked.has(`${x},${y}`);
}

export function roomAt(x, y) {
  const c = charAt(x, y);
  return ROOMS[c] ? c : null;
}

export function tileCenter(x, y) {
  return { x: (x + 0.5) * TILE, z: (y + 0.5) * TILE };
}

export function worldToTile(wx, wz) {
  return { x: Math.floor(wx / TILE), y: Math.floor(wz / TILE) };
}

export function roomTiles(room) {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (LAYOUT[y][x] === room && isWalkable(x, y)) out.push({ x, y });
  return out;
}

export function doorTiles() {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (LAYOUT[y][x] === '.') out.push({ x, y });
  return out;
}

// خط رؤية بين نقطتين بالعالم (DDA على الشبكة)
export function lineOfSight(ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const dist = Math.hypot(dx, dz);
  const steps = Math.ceil(dist / (TILE * 0.25));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const { x, y } = worldToTile(ax + dx * t, az + dz * t);
    if (isWall(x, y)) return false;
  }
  return true;
}

// A* على الشبكة (4 اتجاهات). goal يجوز يكون خانة غير قابلة للمشي (مخبأ)، فنوقف جنبها.
export function findPath(start, goal) {
  const key = (x, y) => y * W + x;
  const goalKey = key(goal.x, goal.y);
  const goalOk = isWalkable(goal.x, goal.y);
  const open = [{ x: start.x, y: start.y, g: 0, f: 0 }];
  const came = new Map();
  const gScore = new Map([[key(start.x, start.y), 0]]);
  const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    const reached = goalOk ? ck === goalKey : h(cur.x, cur.y) === 1;
    if (reached || ck === goalKey) {
      const path = [{ x: cur.x, y: cur.y }];
      let k = ck;
      while (came.has(k)) {
        k = came.get(k);
        path.push({ x: k % W, y: Math.floor(k / W) });
      }
      return path.reverse();
    }
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + ox;
      const ny = cur.y + oy;
      if (!isWalkable(nx, ny)) continue;
      const nk = key(nx, ny);
      const g = cur.g + 1;
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g);
        came.set(nk, ck);
        open.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
      }
    }
  }
  return null;
}
