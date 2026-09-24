// السعلوة: حالات السلوك، الحواس (سمع/بصر/شم)، والحركة على الشبكة.
import * as THREE from 'three';
import {
  TILE, HIDE_SPOTS, HIDE_KINDS, MONSTER_LAIR, ROOMS, findPath, lineOfSight, tileCenter, worldToTile, roomAt, roomTiles, isWalkable,
} from '../world/map.js';
import { hideSearchOrder, hottestRoute, favoriteHide } from './memory.js';
import { buildBody, animateBody } from './body.js';

export class Monster {
  constructor(scene, audio, cfg, mem) {
    this.audio = audio;
    this.cfg = cfg;
    this.mem = mem;
    this.mesh = buildBody();
    scene.add(this.mesh);
    this.pos = new THREE.Vector3();
    this.facing = new THREE.Vector3(0, 0, 1);
    this.state = 'wander';
    this.path = null;
    this.timer = 0;
    this.stepAcc = 0;
    this.hour = 0;
    this.lastSeen = null;
    this.chaseTime = 0;
    this.searchQueue = [];
    this.opening = null;
    this.onCatch = null;
    this.onState = null;
    this.onSalt = null; // لما خط ملح يوقفها
    this.avoid = new Set(); // خانات الملح
    this.spots = HIDE_SPOTS; // المخابئ المتاحة بهالليلة
    this.t = 0;
    const c = tileCenter(MONSTER_LAIR.x, MONSTER_LAIR.y);
    this.pos.set(c.x, 0, c.z);
  }

  initAudio() {
    this.panner = this.audio.panner({ x: this.pos.x, y: 2, z: this.pos.z });
    this.song = this.audio.lullaby(this.panner);
  }

  tile() {
    return worldToTile(this.pos.x, this.pos.z);
  }

  #set(state, extra = {}) {
    if (this.state !== state) this.onState?.(state, this.state);
    this.state = state;
    this.timer = 0;
    Object.assign(this, extra);
  }

  place(tile) {
    const c = tileCenter(tile.x, tile.y);
    this.pos.set(c.x, 0, c.z);
    this.path = null;
    this.direct = null;
  }

  #goTo(tile) {
    this.path = findPath(this.tile(), tile, this.avoid.size ? this.avoid : null);
    if (!this.path && this.avoid.size && findPath(this.tile(), tile)) this.onSalt?.();
    if (this.path) this.path.shift();
    return !!this.path;
  }

  get speed() {
    const hourMul = 1 + 0.08 * this.hour;
    const base = { wander: 1.5, investigate: 2.8, search: 2.2, chase: 4.4, ambush: 2.6, retreat: 3, lure: 2.8 }[this.state] ?? 1.5;
    return base * hourMul * this.cfg.monsterSpeed;
  }

  // السمع: noise = { x, z, radius, precision, kind }
  hear(noise, player) {
    if (this.state === 'retreat' || this.state === 'chase') return false;
    const d = Math.hypot(noise.x - this.pos.x, noise.z - this.pos.z);
    let radius = noise.radius * this.cfg.hearing;
    if (!lineOfSight(this.pos.x, this.pos.z, noise.x, noise.z)) radius *= 0.6;
    if (d > radius) return false;
    // صوت جديد من نفس المكان اللي عم تفتّشه: بتكمّل تفتيش بدل ما تبلّش من جديد
    const busy = this.state === 'investigate' || this.state === 'search';
    if (busy && this.investigateAt && Math.hypot(noise.x - this.investigateAt.x, noise.z - this.investigateAt.z) < 5) return true;
    const off = noise.precision;
    const tx = noise.x + (Math.random() - 0.5) * 2 * off;
    const tz = noise.z + (Math.random() - 0.5) * 2 * off;
    let t = worldToTile(tx, tz);
    if (!isWalkable(t.x, t.y)) t = worldToTile(noise.x, noise.z);
    this.investigateAt = { x: tx, z: tz };
    this.#set('investigate', { rush: noise.kind === 'scream' });
    if (!this.#goTo(t)) this.#set('wander');
    return true;
  }

  // البصر
  canSee(player) {
    if (player.hidden) return false;
    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const light = player.light; // 'flash' | 'match' | null
    let range = light === 'flash' ? 18 * (1 + this.mem.flashlightRatio * 0.3) : light === 'match' ? 9 : player.crouch ? 3.5 : 6.5;
    const pt = player.tile();
    if (roomAt(pt.x, pt.y) === 'c') range += 3; // ضوء القمر بالحوش
    if (player.inCandleLight) range = Math.max(range, 9); // ضو الشمعة بيبيّنك
    range *= this.cfg.sight;
    if (this.hour >= 4) range *= 0.75; // قرب الفجر بتعمى شوي
    if (d > range) return false;
    if (d > 2.5) {
      const dot = (dx * this.facing.x + dz * this.facing.z) / d;
      if (dot < 0.35) return false;
    }
    return lineOfSight(this.pos.x, this.pos.z, player.pos.x, player.pos.z);
  }

  // كمين عند مكان معيّن (طريق الهروب المفضّل أو مكان الاستدراج)
  ambushAt(tile, seconds = 20) {
    if (this.state === 'chase') return;
    this.#set('ambush', { waitFor: seconds, waiting: false });
    if (!this.#goTo(tile)) this.#set('wander');
  }

  retreat(pause = 0) {
    this.#set('retreat', { waitFor: 12, waiting: false, opening: null, direct: null });
    this.#goTo(MONSTER_LAIR);
    this.pause = pause;
  }

  // الخرزة الزرقاء: بتنصدم وبتتراجع، واللاعب عنده 5 ثواني يهرب
  stun(seconds = 5) {
    this.retreat(seconds);
  }

  // بتختفي وبتظهر بمكان ثاني (نادر، ودايماً بصوت إنذار من اللعبة)
  teleport(tile) {
    this.place(tile);
    this.#set('wander');
  }

  // ستارة وضوّك شغّال: بيبيّن من وراها
  #exposed(player) {
    const h = player.hidden;
    if (!h || !HIDE_KINDS[h.spot.kind].lightExposed || !player.light) return false;
    const d = this.pos.distanceTo(h.pos);
    return d < 10 * this.cfg.sight && lineOfSight(this.pos.x, this.pos.z, h.pos.x, h.pos.z);
  }

  update(dt, player, ctx) {
    this.t += dt;
    this.timer += dt;
    this.hour = ctx.hour;
    const sees = this.canSee(player);

    if (sees && this.state !== 'retreat') {
      if (this.state !== 'chase') this.#set('chase', { chaseTime: 0 });
      this.lastSeen = player.pos.clone();
    }
    if (this.state !== 'retreat' && this.state !== 'search' && this.#exposed(player)) {
      const c = player.hidden.pos;
      this.#beginSearch({ x: c.x, z: c.z }, player, player.hidden.spot);
    }

    switch (this.state) {
      case 'wander':
        if (!this.path?.length) this.#pickWander(player, ctx);
        break;
      case 'investigate':
        if (!this.path?.length) {
          if (this.timer > 1.2) this.#beginSearch(this.investigateAt, player);
        }
        break;
      case 'search':
        this.#search(dt, player);
        break;
      case 'chase':
        this.chaseTime += dt;
        if (sees) {
          if (!this.path?.length || this.timer > 0.35) {
            this.timer = 0;
            this.#goTo(player.tile());
          }
          // قريبة: بتهجم عليه مباشرة بدل ما تمشي على الشبكة
          if (this.pos.distanceTo(player.pos) < TILE * 1.3) this.direct = player.pos;
          if (this.pos.distanceTo(player.pos) < 1.15) {
            this.onCatch?.('chase', null);
            return;
          }
          break;
        }
        this.direct = null;
        if (!this.path?.length) {
          // ضيّعته: بتفتّش حوالين آخر مكان شافته
          if (this.chaseTime > 25 && Math.random() < 0.5) this.retreat();
          else this.#beginSearch(this.lastSeen, player);
        } else if (this.timer > 0.35 && this.lastSeen) {
          this.timer = 0;
          this.#goTo(worldToTile(this.lastSeen.x, this.lastSeen.z));
        }
        break;
      case 'ambush':
      case 'retreat':
        if (!this.path?.length) {
          if (!this.waiting) {
            this.waiting = true;
            this.timer = 0;
          }
          if (this.timer > this.waitFor) this.#set('wander');
          // وهي مستنية بتلف راسها
          const a = this.t * 0.7;
          this.facing.set(Math.sin(a), 0, Math.cos(a));
        }
        break;
    }

    this.#followPath(dt);
    this.#animate(dt);
  }

  #pickWander(player, ctx) {
    // المخرج (Director): كل ما تقدّم الليل، بتقرّب أكثر من غرفة اللاعب
    const pt = player.hidden ? player.hidden.spot : player.tile();
    const nearChance = Math.min(0.75, 0.3 + 0.12 * ctx.hour);
    // كمين عند طريق الهروب المفضّل
    const route = hottestRoute(this.mem, 2.5);
    if (route && Math.random() < 0.18 * this.cfg.adapt) {
      this.ambushAt(route, 18);
      return;
    }
    let room;
    if (Math.random() < nearChance) room = roomAt(pt.x, pt.y) || 'c';
    else {
      const keys = Object.keys(ROOMS);
      const weights = keys.map((k) => 1 + (this.mem.roomVisits[k] || 0) * 0.5 * this.cfg.adapt);
      let r = Math.random() * weights.reduce((a, b) => a + b, 0);
      room = keys[weights.findIndex((w) => (r -= w) < 0)] ?? 'c';
    }
    const tiles = roomTiles(room);
    const target = tiles[Math.floor(Math.random() * tiles.length)];
    if (!target || !this.#goTo(target)) this.path = null;
    // وقفة غريبة أحياناً
    this.pause = Math.random() < 0.3 ? 0.6 + Math.random() : 0;
  }

  #beginSearch(center, player, first = null) {
    if (!center) return this.#set('wander');
    // المخابئ القريبة، مرتبة حسب شو تعلّمت (مع الشمّ: اللي قاعد فيه من زمان)
    const near = this.spots.filter((s) => {
      const c = tileCenter(s.x, s.y);
      return Math.hypot(c.x - center.x, c.z - center.z) < 14;
    });
    let order = hideSearchOrder(this.mem, near);
    if (this.cfg.adapt === 0) order = near.sort(() => Math.random() - 0.5);
    // السحّارة آخر شي، إلا إذا صارت تعرفها
    const fav = favoriteHide(this.mem);
    order = [...order.filter((s) => !HIDE_KINDS[s.kind].lowPriority || s.id === fav), ...order.filter((s) => HIDE_KINDS[s.kind].lowPriority && s.id !== fav)];
    const smell = player.hidden && player.hiddenFor > (HIDE_KINDS[player.hidden.spot.kind].lowPriority ? 40 : 25);
    if (smell && near.includes(player.hidden.spot)) first = player.hidden.spot;
    if (first) order = [first, ...order.filter((s) => s !== first)];
    this.searchQueue = order.slice(0, 1 + Math.min(2, Math.floor(this.hour / 2) + 1));
    this.#set('search', { opening: null });
    if (!this.searchQueue.length) this.#set('wander');
  }

  #search(dt, player) {
    if (this.opening) {
      this.opening.t += dt;
      const kind = HIDE_KINDS[this.opening.spot.kind];
      if (this.opening.t > kind.open) {
        const spot = this.opening.spot;
        this.opening = null;
        this.onOpen?.(spot, false);
        if (player.hidden?.spot === spot) {
          // حبس النفَس: فرصة إنها ما تحسّ فيك (أقل إذا هاد مخبأك المعروف)
          const save = kind.breathSave * (favoriteHide(this.mem) === spot.id ? 0.5 : 1);
          if (player.holdingBreath && Math.random() < save) {
            this.onMiss?.(spot);
            return;
          }
          this.onCatch?.('hide', spot);
          return;
        }
      }
      return;
    }
    if (this.path?.length) return;
    const next = this.searchQueue.shift();
    if (!next) {
      this.#set('wander');
      return;
    }
    const here = this.tile();
    if (Math.abs(here.x - next.x) + Math.abs(here.y - next.y) <= 1) {
      // باب بيتسكّر: بتكسره بس إذا شاكّة فعلاً
      const sure = player.hidden?.spot === next && (player.hiddenFor > 25 || favoriteHide(this.mem) === next.id);
      if (HIDE_KINDS[next.kind].locks && !sure && Math.random() < 0.5) return;
      this.opening = { spot: next, t: 0 };
      this.onOpen?.(next, true);
      const c = tileCenter(next.x, next.y);
      this.facing.set(c.x - this.pos.x, 0, c.z - this.pos.z).normalize();
    } else {
      this.searchQueue.unshift(next);
      if (!this.#goTo(next)) this.searchQueue.shift();
    }
  }

  #followPath(dt) {
    if (this.pause > 0) {
      this.pause -= dt;
      return;
    }
    if (this.state !== 'chase') this.direct = null;
    if ((!this.path?.length && !this.direct) || this.opening) return;
    const c = this.direct ? { x: this.direct.x, z: this.direct.z } : tileCenter(this.path[0].x, this.path[0].y);
    const dx = c.x - this.pos.x;
    const dz = c.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const step = this.speed * dt;
    // ما بتقطع خط الملح حتى لو كانت هاجمة مباشرة
    if (this.avoid.size && d > 0) {
      const ahead = worldToTile(this.pos.x + (dx / d) * 0.6, this.pos.z + (dz / d) * 0.6);
      if (this.avoid.has(`${ahead.x},${ahead.y}`)) {
        this.onSalt?.();
        this.path = null;
        this.direct = null;
        return;
      }
    }
    if (d <= step) {
      this.pos.x = c.x;
      this.pos.z = c.z;
      if (!this.direct) this.path.shift();
    } else {
      this.pos.x += (dx / d) * step;
      this.pos.z += (dz / d) * step;
      this.facing.lerp(new THREE.Vector3(dx / d, 0, dz / d), 0.2).normalize();
    }
    this.stepAcc += step;
    if (this.stepAcc > (this.state === 'chase' ? 1.8 : 1.3)) {
      this.stepAcc = 0;
      this.audio.playAt('mstep', { x: this.pos.x, y: 0.2, z: this.pos.z }, this.state === 'chase' ? 1.4 : 0.8);
    }
  }

  #animate(dt) {
    const m = this.mesh;
    m.position.set(this.pos.x, 0, this.pos.z);
    m.rotation.y = Math.atan2(this.facing.x, this.facing.z) + Math.PI;
    const moving = !!(this.path?.length || this.direct) && !(this.pause > 0);
    animateBody(m, this.t, { moving, chase: this.state === 'chase', searching: this.state === 'search' || (this.state === 'ambush' && this.waiting) });
    if (this.panner) {
      this.audio.movePanner(this.panner, { x: this.pos.x, y: 2.2, z: this.pos.z });
      // بتغني وهي تتجوّل، وبتسكت لما تصيد
      const singing = this.state === 'wander' || this.state === 'retreat';
      this.song.gain.setTargetAtTime(singing ? 0.8 : 0.05, this.audio.now, 0.4);
    }
  }
}
