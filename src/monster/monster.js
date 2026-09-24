// السعلوة: حالات السلوك، الحواس (سمع/بصر/شم)، والحركة على الشبكة.
import * as THREE from 'three';
import {
  TILE, HIDE_SPOTS, MONSTER_LAIR, ROOMS, findPath, lineOfSight, tileCenter, worldToTile, roomAt, roomTiles, isWalkable,
} from '../world/map.js';
import { hideSearchOrder, hottestRoute } from './memory.js';

const HEIGHT = 2.7;

function buildMesh() {
  const g = new THREE.Group();
  const cloth = new THREE.MeshLambertMaterial({ color: 0x1a1612 });
  const skin = new THREE.MeshLambertMaterial({ color: 0x5b5448 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x050404 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, 2.1, 6), cloth);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), skin);
  head.position.y = 2.35;
  const mane = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.3, 8, 1, true, Math.PI + 0.6, Math.PI * 2 - 1.2), hair);
  mane.material.side = THREE.DoubleSide;
  mane.position.y = 1.85;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
  const eyes = new THREE.Group();
  for (const x of [-0.07, 0.07]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), eyeMat);
    e.position.set(x, 0, -0.2);
    eyes.add(e);
  }
  eyes.position.y = 2.37;
  const arms = [];
  for (const x of [-0.32, 0.32]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.5, 0.07), skin);
    a.geometry.translate(0, -0.75, 0);
    a.position.set(x, 2.05, 0);
    arms.push(a);
    g.add(a);
  }
  const headGroup = new THREE.Group();
  headGroup.add(head, eyes);
  g.add(body, mane, headGroup);
  g.userData = { headGroup, arms };
  return g;
}

export class Monster {
  constructor(scene, audio, cfg, mem) {
    this.audio = audio;
    this.cfg = cfg;
    this.mem = mem;
    this.mesh = buildMesh();
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

  #goTo(tile) {
    this.path = findPath(this.tile(), tile);
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
    const lit = player.flashlightOn && player.battery > 0;
    let range = lit ? 18 * (1 + this.mem.flashlightRatio * 0.3) : player.crouch ? 3.5 : 6.5;
    const pt = player.tile();
    if (roomAt(pt.x, pt.y) === 'c') range += 3; // ضوء القمر بالحوش
    range *= this.cfg.sight;
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

  retreat() {
    this.#set('retreat', { waitFor: 12, waiting: false });
    this.#goTo(MONSTER_LAIR);
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

  #beginSearch(center, player) {
    if (!center) return this.#set('wander');
    // المخابئ القريبة، مرتبة حسب شو تعلّمت (مع الشمّ: اللي قاعد فيه من زمان)
    const near = HIDE_SPOTS.filter((s) => {
      const c = tileCenter(s.x, s.y);
      return Math.hypot(c.x - center.x, c.z - center.z) < 14;
    });
    let order = hideSearchOrder(this.mem, near);
    if (this.cfg.adapt === 0) order = near.sort(() => Math.random() - 0.5);
    if (player.hidden && player.hiddenFor > 25 && near.includes(player.hidden.spot)) {
      order = [player.hidden.spot, ...order.filter((s) => s !== player.hidden.spot)];
    }
    this.searchQueue = order.slice(0, 1 + Math.min(2, Math.floor(this.hour / 2) + 1));
    this.#set('search', { opening: null });
    if (!this.searchQueue.length) this.#set('wander');
  }

  #search(dt, player) {
    if (this.opening) {
      this.opening.t += dt;
      if (this.opening.t > 1.1) {
        const spot = this.opening.spot;
        this.opening = null;
        this.onOpen?.(spot, false);
        if (player.hidden?.spot === spot) {
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
    const { headGroup, arms } = m.userData;
    const twitch = Math.sin(this.t * 13) > 0.97 ? 0.5 : 0;
    headGroup.rotation.z = Math.sin(this.t * 0.8) * 0.35 + twitch;
    const moving = (this.path?.length || this.direct) && !(this.pause > 0);
    const swing = moving ? Math.sin(this.t * (this.state === 'chase' ? 9 : 4)) * 0.3 : 0;
    arms[0].rotation.x = swing - (this.state === 'chase' ? 0.9 : 0);
    arms[1].rotation.x = -swing - (this.state === 'chase' ? 0.9 : 0);
    m.position.y = moving ? Math.abs(Math.sin(this.t * 4)) * 0.05 : 0;
    if (this.panner) {
      this.audio.movePanner(this.panner, { x: this.pos.x, y: 2.2, z: this.pos.z });
      // بتغني وهي تتجوّل، وبتسكت لما تصيد
      const singing = this.state === 'wander' || this.state === 'retreat';
      this.song.gain.setTargetAtTime(singing ? 0.8 : 0.05, this.audio.now, 0.4);
    }
  }
}
