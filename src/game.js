// الجولة الواحدة (ليلة): الوقت، الأغراض والأدوات، الضجيج، التمسخر، التقليد، الأحداث، الفوز والموت.
import * as THREE from 'three';
import {
  HIDE_SPOTS, HIDE_KINDS, ITEMS, ROOMS, WELL, GATE, PLAYER_START, RADIO, PHONE, NEST, MONSTER_STARTS, TILE, STAIRWAYS, GLASS,
  roomTiles, roomAt, tileCenter, worldToTile, isWall, findPath, doorTiles, lineOfSight, reachable,
} from './world/map.js';
import { buildWorld, pickupMesh } from './world/build.js';
import { buildBody, animateBody } from './monster/body.js';
import { Player } from './player.js';
import { Monster } from './monster/monster.js';
import * as M from './monster/memory.js';
import { pickTaunt } from './monster/taunts.js';
import { levelToNoise } from './audio/mic.js';
import { DAWN_HOUR } from './config.js';
import { createPost } from './post.js';
import { horror } from './audio/horror.js';
import { Bag, TOOLS } from './inventory.js';
import { Director, pickScare } from './director.js';
import { tapesForNight } from './story/tapes.js';
import { resolveEnding, ENDINGS } from './story/endings.js';
import { noteTape, saveProgress, finishRun, recorderUnlocked } from './progress.js';

export const spotLabel = (s) => `${HIDE_KINDS[s.kind].ar} (${ROOMS[s.room].ar})`;
const SALT_SECONDS = 45;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export class Game {
  constructor({ renderer, audio, mic, mimic, cfg, mem, progress, settings, ui }) {
    Object.assign(this, { renderer, audio, mic, mimic, cfg, mem, progress, settings, ui });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 80);
    const world = (this.world = buildWorld(this.scene));
    this.hideMeshes = world.hideMeshes;
    this.post = createPost(renderer, this.scene, this.camera);
    this.player = new Player(this.camera, this.scene, cfg, world.colliders);
    this.player.place(PLAYER_START.x, PLAYER_START.y);
    this.player.sensitivity = settings.sensitivity;
    this.player.invertY = settings.invertY;
    audio.screamScale = settings.reduceScreams ? 0.45 : 1;

    // الليلة الثانية: مخبأ أو أكثر مسكّر بمسامير
    this.sealed = new Set();
    const wardrobes = HIDE_SPOTS.filter((s) => s.kind === 'wardrobe').sort(() => Math.random() - 0.5);
    for (const s of wardrobes.slice(0, cfg.sealed)) {
      this.sealed.add(s.id);
      this.#nailShut(s);
    }

    this.monster = new Monster(this.scene, audio, cfg, mem);
    this.monster.spots = HIDE_SPOTS.filter((s) => !this.sealed.has(s.id));
    this.monster.place(pick(MONSTER_STARTS));
    this.monster.onCatch = (cause, spot) => this.#caught(cause, spot);
    this.monster.onOpen = (spot, opening) => this.#animateOpen(spot, opening);
    this.monster.onSalt = () => this.#saltBlocked();
    this.monster.onMiss = () => this.#taunt('miss');
    this.monster.onStairs = (from, to) => {
      for (const p of [from, to]) this.audio.playAt('creak', { x: p.x, y: 1, z: p.z }, 0.8);
    };
    this.monster.onState = (s, prev) => {
      this.ui.debug?.(s);
      // أول ما تشوفك: نغمة فزع وخرخرة
      if (s === 'chase' && prev !== 'chase') {
        horror.sting(audio, this.audio.screamScale);
        const mp = this.monster.pos;
        setTimeout(() => horror.growl(audio, { x: mp.x, y: 2, z: mp.z }, 1), 300);
      }
    };

    this.time = 0;
    this.state = 'play';
    this.carried = new Set();
    this.placed = new Set();
    this.ankletReturned = false;
    this.gateOpen = false;
    this.bag = new Bag();
    this.bag.add('bell', cfg.bells);
    this.usedTaunts = new Set();
    this.favHideAtStart = M.favoriteHide(mem);
    this.stats = {
      time: 0, moveTime: 0, sprintTime: 0, flashlightTime: 0, heard: 0, screams: 0, loudestDb: -100, mimics: 0, hideUses: {},
      deathCause: null, bellsThrown: 0, spoke: false, beadSaved: false, saltBlocked: false, tapes: [], lures: 0,
    };
    this.lastRunClip = null;
    this.noiseCd = 0;
    this.screamCd = 0;
    this.chimeMask = 0;
    this.lastRoom = null;
    this.routeCd = 0;
    this.pantCd = 0;
    this.breathNoiseCd = 0;
    this.nextTaunt = 70;
    this.nextMimic = null;
    this.climaxDone = false;
    this.nextLightning = 25 + Math.random() * 30;
    this.nextCreak = 8;
    this.nextDrip = 3;
    this.nextHowl = 60;
    this.nextTeleport = 90;
    this.breathCd = 0;
    this.inhale = true;
    this.director = new Director();
    this.salt = []; // { key, until, mesh }
    this.radio = { on: false, stop: null, uses: 0 };
    this.phone = { ringing: false, until: 0, next: 0 };
    this.recorders = [];
    this.lureUses = 0;

    this.#setupDoors();
    this.glass = new Set(GLASS.map((g) => `${g.x},${g.y}`));
    this.nextHouseScare = 10;
    this.ghost = null;
    this.pickups = [];
    this.#spawnPickups();
    M.beginRun(mem);
    M.saveMemory(mem);
  }

  start() {
    this.monster.initAudio();
    setTimeout(() => this.#taunt('start'), 4000);
    this.ui.subtitle(
      `لازم ترجّع غراض ستّك الخمسة للبير بالحوش… أو تصمد للفجر.`,
      "Return grandma's five things to the well… or survive until dawn.",
      6,
    );
    if (this.sealed.size) setTimeout(() => this.ui.subtitle('في خزانة مسكّرة بمسامير… مين سكّرها؟', 'A wardrobe is nailed shut… who did that?', 4), 8000);
  }

  get hour() {
    return this.time / this.cfg.hourSeconds;
  }

  get needed() {
    return ITEMS.length - (this.ankletReturned ? 1 : 0);
  }

  // ---------- الأغراض ----------
  #spawnPickups() {
    const taken = new Set();
    const place = (kind, rooms, extra = {}, ok = () => true) => {
      const blocked = this.world.blockedTiles;
      const tiles = rooms.flatMap((r) => roomTiles(r)).filter((t) => !taken.has(`${t.x},${t.y}`) && !blocked.has(`${t.x},${t.y}`) && ok(t));
      const t = pick(tiles);
      taken.add(`${t.x},${t.y}`);
      const c = tileCenter(t.x, t.y);
      this.#dropPickup(kind, c.x + (Math.random() - 0.5), c.z + (Math.random() - 0.5), extra);
    };
    for (const it of ITEMS) place(it.id, it.rooms, { item: it, glint: true });
    const all = Object.keys(ROOMS);
    const cfg = this.cfg;
    for (let i = 0; i < cfg.batteries; i++) place('battery', all);
    for (let i = 0; i < 2; i++) place('bell', all);
    place('matches', ['k', 'l', 'b']);
    for (let i = 0; i < cfg.salt; i++) place('salt', ['k', 'd', 'a']);
    if (Math.random() < cfg.bead) place('bead', all);
    if (recorderUnlocked(this.progress)) place('recorder', ['a', 'l']);
    for (const tape of tapesForNight(this.progress.tapes, 2)) place('tape', all, { tape, glint: true });
    // مفاتيح الأبواب المقفلة: دايماً بمكان بتوصله بدون ما تفتح قفل
    const locked = new Set(this.doors.filter((d) => d.locked).map((d) => d.key));
    const free = reachable(PLAYER_START, locked);
    for (let i = 0; i < locked.size; i++) place('doorkey', all, { glint: true }, (t) => free.has(`${t.x},${t.y}`));
  }

  #dropPickup(kind, x, z, extra = {}) {
    const mesh = pickupMesh(kind);
    mesh.position.x = x;
    mesh.position.z = z;
    mesh.traverse((o) => (o.castShadow = true));
    this.scene.add(mesh);
    // لمعة صغيرة بتبيّن لما الكشاف يوقع عليها
    if (extra.glint) {
      const sp = new THREE.Sprite(this.#sparkMat());
      sp.scale.set(0.12, 0.12, 1);
      sp.position.set(x, 0.12, z);
      this.scene.add(sp);
      extra.spark = sp;
    }
    this.pickups.push({ kind, mesh, ...extra });
  }

  #sparkMat() {
    if (!this.sparkMaterial) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,240,1)');
      grd.addColorStop(0.2, 'rgba(255,245,220,0.5)');
      grd.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      g.fillRect(30, 0, 4, 64);
      g.fillRect(0, 30, 64, 4);
      this.sparkMaterial = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    }
    return this.sparkMaterial;
  }

  #pickupLabel(pk) {
    if (pk.item) return pk.item.ar;
    if (pk.tape) return `شريط كاسيت: ${pk.tape.title.ar}`;
    return TOOLS[pk.kind].ar;
  }

  // ---------- الأبواب ----------
  #setupDoors() {
    this.closed = new Set(); // مسكّرة (ومنها المقفلة)
    this.doors = this.world.doors.map((d) => ({ ...d, key: `${d.x},${d.y}`, open: true, locked: false }));
    const shuffled = [...this.doors].sort(() => Math.random() - 0.5);
    for (const d of shuffled.slice(0, this.cfg.lockedDoors)) d.locked = true;
    for (const d of this.doors) if (d.locked || Math.random() < 0.3) this.#setDoor(d, false, true);
    this.monster.closed = this.closed;
    this.player.blockTiles = this.closed;
  }

  #setDoor(d, open, silent = false) {
    d.open = open;
    if (open) this.closed.delete(d.key);
    else this.closed.add(d.key);
    if (!silent) this.audio.playAt('creak', { ...tileCenter(d.x, d.y), y: 1.2 }, open ? 0.9 : 0.6);
  }

  // حدا واقف بخانة الباب؟ (ما بنسكّر عليه)
  #doorBusy(d) {
    const c = tileCenter(d.x, d.y);
    const near = (p) => Math.abs(p.x - c.x) < TILE / 2 + 0.4 && Math.abs(p.z - c.z) < TILE / 2 + 0.4;
    return near(this.player.pos) || near(this.monster.pos);
  }

  #updateDoors(dt) {
    const mon = this.monster;
    for (const d of this.doors) {
      // حركة الباب
      const target = d.open ? Math.PI / 2 * 0.95 : 0;
      d.angle += (target - d.angle) * Math.min(1, dt * (d.slow ? 1.8 : 6));
      d.hinge.rotation.y = d.base + d.angle;
      if (d.open) continue;
      const c = tileCenter(d.x, d.y);
      if (Math.hypot(mon.pos.x - c.x, mon.pos.z - c.z) > 1.5 || mon.opening) continue;
      if (!d.locked) this.#setDoor(d, true);
      else if ((d.passCd ?? 0) < this.time) {
        // المقفول ما بيوقفها: بتعدّي منه بخرمشة وهمس
        d.passCd = this.time + 6;
        this.audio.playAt('whisper', { ...c, y: 1.5 }, 0.6);
        this.audio.playAt('knock', { ...c, y: 1.2 }, 0.4);
        if (!this.lockedTaunted && Math.hypot(this.player.pos.x - c.x, this.player.pos.z - c.z) < 10) {
          this.lockedTaunted = true;
          this.#taunt('locked');
        }
      }
    }
    // بتسكّر أبواب وراها (بتغيّر طرق الهروب)
    const mt = mon.tile();
    const prev = this.monPrevTile;
    if (prev && (prev.x !== mt.x || prev.y !== mt.y)) {
      const d = this.doors.find((q) => q.x === prev.x && q.y === prev.y);
      const pd = Math.hypot(this.player.pos.x - mon.pos.x, this.player.pos.z - mon.pos.z);
      if (d && d.open && mon.state === 'wander' && pd > 6 && Math.random() < this.cfg.doorClose) {
        setTimeout(() => this.state === 'play' && !this.#doorBusy(d) && this.#setDoor(d, false), 700);
      }
    }
    this.monPrevTile = mt;
  }

  // ---------- المانيكان والمراية والمهد ----------
  #houseScares(dt, room) {
    const p = this.player;
    const fw = new THREE.Vector3();
    this.camera.getWorldDirection(fw);
    const looking = (x, z) => {
      const dx = x - this.camera.position.x;
      const dz = z - this.camera.position.z;
      const d = Math.hypot(dx, dz);
      return { d, dot: (dx * fw.x + dz * fw.z) / (d || 1) };
    };
    // الشبح بالمراية: بيختفي أول ما تلف
    if (this.ghost) {
      this.ghost.t -= dt;
      animateBody(this.ghost.mesh, this.time, { moving: false, chase: false, searching: false });
      if (this.ghost.t <= 0 || Math.abs(p.yaw - this.ghost.yaw) > 0.7 || room !== 'b') {
        this.scene.remove(this.ghost.mesh);
        if (Math.abs(p.yaw - this.ghost.yaw) > 0.7) horror.sting(this.audio, 0.5 * this.audio.screamScale);
        this.ghost = null;
      }
    }
    this.world.rock = Math.max(0, this.world.rock - dt * 0.1);
    this.nextHouseScare -= dt;
    if (this.nextHouseScare > 0 || p.hidden) return;
    this.nextHouseScare = 2;
    // المانيكان بتلف لتطلّع عليك لما ما تكون شايفها
    const mq = this.world.mannequin.position;
    const m = looking(mq.x, mq.z);
    if (room === 'm' && m.dot < -0.2 && Math.random() < 0.3) {
      this.world.mannequin.rotation.y = Math.atan2(p.pos.x - mq.x, p.pos.z - mq.z);
      horror.creak(this.audio, { x: mq.x, y: 1, z: mq.z }, 0.4);
      this.nextHouseScare = 25;
      return;
    }
    // المراية: أحياناً بتبيّن واقفة وراك
    const mr = this.world.mirror.position;
    const mv = looking(mr.x, mr.z);
    if (room === 'b' && !this.ghost && mv.d < 4.5 && mv.dot > 0.85 && Math.random() < 0.3) {
      const mesh = buildBody();
      const back = p.forward().multiplyScalar(-1.4);
      mesh.position.set(p.pos.x + back.x, 0, p.pos.z + back.z);
      mesh.rotation.y = Math.atan2(-back.x, -back.z) + Math.PI;
      // ضو بارد خفيف حتى يبيّن شكلها بالمراية
      const glow = new THREE.PointLight(0x9aaccc, 50, 4, 1.5);
      glow.position.set(0, 2, 0.6);
      mesh.add(glow);
      this.scene.add(mesh);
      this.ghost = { mesh, t: 2.2, yaw: p.yaw };
      this.audio.playAt('whisper', { x: p.pos.x + back.x, y: 1.7, z: p.pos.z + back.z }, 0.5);
      this.nextHouseScare = 45;
    }
  }

  // ---------- الدرج والسطح ----------
  #climb(way, up) {
    const p = this.player;
    const to = up ? way.up : way.down;
    this.ui.fade(true);
    horror.step(this.audio, 'stone', 0.8);
    this.#noise({ radius: 5, precision: 1.5 });
    p.frozen = 0.5;
    setTimeout(() => {
      if (this.state !== 'play') return;
      const c = tileCenter(to.x, to.y);
      if (up) {
        p.pos.set(c.x, 0, c.z - 0.9);
        p.yaw = 0;
      } else {
        const b = tileCenter(to.x - 1, to.y);
        p.pos.set(b.x, 0, b.z);
        p.yaw = Math.PI / 2;
      }
      horror.step(this.audio, 'stone', 0.8);
      this.ui.fade(false);
    }, 380);
  }

  // ---------- التفاعل ----------
  #interactTarget() {
    const p = this.player;
    if (p.hidden) return { type: 'unhide', label: 'اطلع من المخبأ' };
    const fw = p.forward();
    const near = (x, z, max) => {
      const dx = x - p.pos.x;
      const dz = z - p.pos.z;
      const d = Math.hypot(dx, dz);
      return d < max && (d < 0.8 || (dx * fw.x + dz * fw.z) / d > 0.5) ? d : null;
    };
    let best = null;
    const consider = (obj, d) => {
      if (d !== null && (!best || d < best.d)) best = { ...obj, d };
    };
    const at = (t, max, oz = 0) => {
      const c = tileCenter(t.x, t.y);
      return near(c.x, c.z + oz, max);
    };
    for (const pk of this.pickups) consider({ type: 'pickup', pk, label: `التقط: ${this.#pickupLabel(pk)}` }, near(pk.mesh.position.x, pk.mesh.position.z, 1.8));
    for (const s of HIDE_SPOTS) {
      const sealed = this.sealed.has(s.id);
      consider({ type: sealed ? 'none' : 'hide', spot: s, label: sealed ? 'مسكّرة بمسامير…' : `اختبئ: ${HIDE_KINDS[s.kind].ar}` }, at(s, 2.7));
    }
    if (this.carried.size) consider({ type: 'well', label: 'ارمِ الأغراض بالبير' }, at(WELL, 2.7));
    if (this.carried.has('anklet')) consider({ type: 'nest', label: 'رجّعلها خلخالها لعشّها' }, at(NEST, 2.2));
    consider({ type: 'gate', label: this.gateOpen ? 'اهرب!' : 'البوابة مقفلة… كمّل الطقس أول' }, at(GATE, 2.2, -TILE * 0.5));
    consider({ type: 'radio', label: this.radio.on ? 'طفّي الراديو' : 'شغّل الراديو (بيشتّتها… وبتتعلّم)' }, near(...this.#radioXZ(), 1.9));
    if (this.phone.ringing) consider({ type: 'phone', label: 'ردّ عالتلفون' }, at(PHONE, 2.2, -0.7));
    for (const d of this.doors) {
      const label = d.open ? 'سكّر الباب' : d.locked ? (this.bag.count('doorkey') ? 'افتح القفل (مفتاح باب)' : 'مقفول… بدك مفتاح') : 'افتح الباب';
      consider({ type: 'door', door: d, label }, at(d, 1.9));
    }
    for (const way of STAIRWAYS) {
      consider({ type: 'stairs', way, up: true, label: way.upLabel }, at(way.down, 2.3));
      consider({ type: 'stairs', way, up: false, label: way.downLabel }, at(way.up, 2));
    }
    if (this.bag.count('matches'))
      for (const c of this.world.candles) if (!c.lit) consider({ type: 'candle', candle: c, label: 'ولّع الشمعة (عود كبريت)' }, near(c.pos.x, c.pos.z, 1.8));
    return best;
  }

  #radioXZ() {
    const c = tileCenter(RADIO.x, RADIO.y);
    return [c.x - 0.7, c.z + 0.7];
  }

  interact() {
    if (this.state !== 'play') return;
    const t = this.#interactTarget();
    if (!t) return;
    const p = this.player;
    switch (t.type) {
      case 'unhide':
        p.exitHide();
        this.#noise({ radius: 3, precision: 1 });
        break;
      case 'door': {
        const d = t.door;
        // منحني = ببطء وبصمت (بس بياخذ وقت)، واقف = بسرعة وبصوت
        const slow = p.crouch;
        d.slow = slow;
        if (d.open) {
          if (this.#doorBusy(d)) return this.ui.subtitle('ابعد عن العتبة لتسكّر', 'Step off the threshold to close it', 2);
          this.#setDoor(d, false, slow);
        } else if (d.locked) {
          if (!this.bag.take('doorkey')) return this.audio.playAt('knock', null, 0.3);
          d.locked = false;
          this.audio.playAt('unlock', { ...tileCenter(d.x, d.y), y: 1 }, slow ? 0.4 : 1);
          this.#setDoor(d, true, slow);
        } else this.#setDoor(d, true, slow);
        if (slow) {
          p.frozen = 1;
          horror.creak(this.audio, { ...tileCenter(d.x, d.y), y: 1.2 }, 0.2);
          this.#noise({ radius: 1, precision: 1 });
        } else this.#noise({ radius: 4, precision: 1.5 });
        break;
      }
      case 'stairs':
        this.#climb(t.way, t.up);
        break;
      case 'hide':
        if (HIDE_KINDS[t.spot.kind].enterTime) {
          // الخزان: بدك وقت لتطلع عليه وتنزل بالمي
          p.frozen = HIDE_KINDS[t.spot.kind].enterTime;
          this.audio.playAt('splash', { ...tileCenter(t.spot.x, t.spot.y), y: 1.5 });
          this.#noise({ radius: 6, precision: 1 });
          setTimeout(() => this.state === 'play' && !p.hidden && this.#hide(t.spot), p.frozen * 1000);
        } else this.#hide(t.spot);
        break;
      case 'pickup':
        this.#pickup(t.pk);
        break;
      case 'well':
        for (const id of this.carried) this.placed.add(id);
        this.carried.clear();
        this.audio.playAt('ritual');
        if (this.placed.size >= this.needed) this.#openGate();
        else this.ui.subtitle(`${this.placed.size} من ${this.needed}`, '', 3);
        break;
      case 'nest':
        this.#returnAnklet();
        break;
      case 'gate':
        if (this.gateOpen) this.#end('escape');
        break;
      case 'radio':
        if (this.radio.on) this.#radioOff();
        else this.#radioOn(true);
        break;
      case 'phone':
        this.#answerPhone();
        break;
      case 'candle':
        this.bag.take('matches');
        this.world.setCandle(t.candle, true);
        this.audio.playAt('match', null, 0.8);
        break;
    }
  }

  #hide(spot) {
    const p = this.player;
    p.enterHide(spot);
    p.hiddenFor = 0;
    this.stats.hideUses[spot.id] = (this.stats.hideUses[spot.id] || 0) + 1;
    if (spot.id === this.favHideAtStart) this.stats.usedFav = true;
    // التمسخر قبل ما نسجّل: بتعلّق بس إذا المكان كان مفضّل من قبل
    if (Math.random() < 0.5) this.#taunt('hide', { hideId: spot.id, hideKind: spot.kind, lit: !!p.light });
    M.noteHide(this.mem, spot.id);
    if (HIDE_KINDS[spot.kind].locks) this.audio.playAt('click', null, 0.8);
  }

  #pickup(pk) {
    const tool = TOOLS[pk.kind];
    if (tool && !this.bag.canAdd(pk.kind)) {
      this.ui.subtitle('الحقيبة مليانة… (X بترمي الخانة المختارة)', 'Bag full… (X drops the selected slot)', 3);
      return;
    }
    this.scene.remove(pk.mesh);
    if (pk.spark) this.scene.remove(pk.spark);
    this.pickups.splice(this.pickups.indexOf(pk), 1);
    this.audio.playAt('pickup');
    if (pk.item) {
      this.carried.add(pk.item.id);
      // السعلوة بتعرف فوراً وبتصرّخ
      const mp = this.monster.pos;
      this.audio.playAt('shriek', { x: mp.x, y: 2, z: mp.z });
      this.#taunt(pk.item.id === 'anklet' ? 'anklet' : 'item');
      this.ui.subtitle(`أخذت ${pk.item.ar}`, pk.item.en, 3);
    } else if (pk.tape) this.#playTape(pk.tape);
    else {
      this.bag.add(pk.kind, pk.count ?? tool.per ?? 1);
      if (pk.kind === 'bead') this.ui.subtitle('خرزة زرقاء… بتحميك مرة وحدة من إيدها', 'A blue bead… it will save you from her grasp once', 4);
    }
  }

  // ---------- الأدوات ----------
  useTool() {
    if (this.state !== 'play') return;
    const tool = this.bag.selected;
    const p = this.player;
    if (!tool) return;
    if (p.hidden && tool !== 'battery') return;
    switch (tool) {
      case 'bell':
        this.#throwBell();
        break;
      case 'battery':
        if (p.battery > 0.95) return this.ui.subtitle('البطارية لسا مليانة', 'Battery still full', 2);
        this.bag.take('battery');
        p.battery = Math.min(1, p.battery + 0.6);
        this.audio.playAt('click');
        break;
      case 'matches':
        if (p.matchT > 0) return;
        this.bag.take('matches');
        p.lightMatch(25);
        this.audio.playAt('match');
        break;
      case 'salt':
        this.#placeSalt();
        break;
      case 'recorder':
        this.#placeRecorder();
        break;
      case 'bead':
        this.ui.subtitle('الخرزة بتشتغل لحالها لما تمسكك', 'The bead works on its own when she grabs you', 3);
        break;
    }
  }

  toggleFlashlight() {
    this.player.flashlightOn = !this.player.flashlightOn;
  }

  dropTool() {
    if (this.state !== 'play' || this.player.hidden) return;
    const s = this.bag.drop();
    if (!s) return;
    const fw = this.player.forward();
    this.#dropPickup(s.tool, this.player.pos.x + fw.x * 0.6, this.player.pos.z + fw.z * 0.6, { count: s.count });
  }

  #throwBell() {
    this.bag.take('bell');
    this.stats.bellsThrown++;
    const p = this.player;
    const fw = p.forward();
    let land = p.pos.clone();
    for (let d = 0.5; d < 9; d += 0.25) {
      const x = p.pos.x + fw.x * d;
      const z = p.pos.z + fw.z * d;
      const t = worldToTile(x, z);
      if (isWall(t.x, t.y)) break;
      land.set(x, 0, z);
    }
    setTimeout(() => {
      this.audio.playAt('bell', { x: land.x, y: 0.3, z: land.z });
      // بتتعلّم تتجاهل الجرس إذا كثر استخدامه
      const ignore = Math.min(0.7, (this.stats.bellsThrown - 1) * 0.2 * this.cfg.adapt);
      if (Math.random() >= ignore) this.#noise({ x: land.x, z: land.z, radius: 16, precision: 1, fromPlayer: false });
    }, 450);
  }

  // خط ملح عند أقرب باب: ما بتقطعه لحد ما يذوب
  #placeSalt() {
    const p = this.player;
    const pt = p.tile();
    const door = doorTiles()
      .map((t) => ({ ...t, d: Math.abs(t.x - pt.x) + Math.abs(t.y - pt.y) }))
      .filter((t) => t.d <= 1)
      .sort((a, b) => a.d - b.d)[0];
    if (!door) return this.ui.subtitle('الملح بينرش عند عتبة باب', 'Salt must be poured at a doorway', 3);
    const mt = this.monster.tile();
    if (mt.x === door.x && mt.y === door.y) return;
    this.bag.take('salt');
    const key = `${door.x},${door.y}`;
    const c = tileCenter(door.x, door.y);
    const alongX = isWall(door.x - 1, door.y) && isWall(door.x + 1, door.y);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(alongX ? TILE * 0.8 : 0.18, 0.02, alongX ? 0.18 : TILE * 0.8),
      new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 1, emissive: 0x222222 }),
    );
    mesh.position.set(c.x, 0.01, c.z);
    this.scene.add(mesh);
    this.salt.push({ key, until: this.time + SALT_SECONDS, mesh, warned: false });
    this.monster.avoid.add(key);
    this.audio.playAt('salt', { x: c.x, y: 0.3, z: c.z });
    this.ui.subtitle('خط ملح عالعتبة… ما رح تقطعه (لفترة)', "A salt line on the threshold… she won't cross (for a while)", 3);
  }

  #saltBlocked() {
    if (this.saltCd > this.time) return;
    this.saltCd = this.time + 8;
    this.stats.saltBlocked = true;
    const mp = this.monster.pos;
    this.audio.playAt('growl', { x: mp.x, y: 2, z: mp.z });
    this.#taunt('salt');
  }

  // مسجّل الكاسيت: بتسجّل صوتك وبتتركه يشتغل لحاله ليشتّتها
  async #placeRecorder() {
    this.bag.take('recorder');
    const p = this.player;
    const pos = { x: p.pos.x, y: 0.4, z: p.pos.z };
    const mesh = pickupMesh('recorder');
    mesh.position.set(pos.x, 0.04, pos.z);
    this.scene.add(mesh);
    this.audio.playAt('click', pos);
    let clip = null;
    if (this.mic.enabled) {
      this.ui.subtitle('🔴 عم يسجّل… احكي شي (3 ثواني)', 'Recording… say something (3 seconds)', 3);
      clip = await this.mic.recordNext(3);
      this.audio.playAt('click', pos);
      this.ui.subtitle('سجّلت. بيشتغل بعد شوي… ابعد عنه', 'Recorded. It will play soon… get away from it', 3);
    }
    this.recorders.push({ pos, clip, next: this.time + 6, plays: 4 });
  }

  // ---------- الراديو والتلفون ----------
  #radioOn(byPlayer) {
    const [x, z] = this.#radioXZ();
    this.radio.on = true;
    this.radio.byPlayer = byPlayer;
    this.radio.next = 0;
    this.radio.stop = this.audio.radio({ x, y: 1, z }, 22);
    this.radio.until = this.time + 22;
    if (byPlayer) {
      this.radio.uses++;
      this.lureUses++;
      this.stats.lures++;
      M.noteLure(this.mem);
    }
  }

  #radioOff() {
    this.radio.stop?.();
    this.radio.on = false;
  }

  // ضجيج تشتيت: بتتعلّم تتجاهل الحيل المكررة (بهالجولة ومن الجولات الماضية)
  #lureNoise(x, z, radius) {
    const ignore = M.lureIgnoreChance(this.mem, this.lureUses, this.cfg.adapt);
    if (Math.random() < ignore) {
      if (!this.lureMocked && this.lureUses > 1) {
        this.lureMocked = true;
        this.#taunt('lure');
      }
      return;
    }
    this.#noise({ x, z, radius, precision: 1, fromPlayer: false });
  }

  #ringPhone() {
    this.phone.ringing = true;
    this.phone.until = this.time + 12;
    this.phone.next = 0;
  }

  #answerPhone() {
    this.phone.ringing = false;
    const c = tileCenter(PHONE.x, PHONE.y);
    const pos = { x: c.x, y: 1, z: c.z - 0.7 };
    this.audio.playAt('click', pos);
    const clip = this.hour >= 2 && Math.random() < 0.6 ? this.mimic.pick('talk') : null;
    if (clip) {
      setTimeout(() => this.#playVoice(clip, pos, 0.5), 800);
      this.ui.subtitle('…هاد صوتك إنت؟', '…is that your own voice?', 4);
      setTimeout(() => this.audio.playAt('laugh', pos, 0.5), 3500);
    } else {
      const lines = [
        ['حبيبي… لا تطلع من مخبأك لما تسكت الغنّية.', "Dear… don't leave your hiding place when the singing stops."],
        ['الملح عالعتبة يا ابني… الملح.', 'Salt on the threshold, son… salt.'],
        ['ستّك هون… لا تخاف… تعال لعندي عالقبو.', "Grandma's here… don't be afraid… come to me in the cellar."],
      ];
      // آخر جملة كذبة: هي اللي بتحكي
      const [ar, en] = pick(this.hour >= 2 ? lines : lines.slice(0, 2));
      this.audio.grandma(ar, pos);
      this.ui.subtitle(`«${ar}»`, en, 5);
    }
  }

  // ---------- شريط الجدة ----------
  #playTape(tape) {
    const fresh = noteTape(this.progress, tape.id);
    saveProgress(this.progress);
    this.stats.tapes.push(tape.id);
    const p = this.player.pos;
    tape.lines.forEach(([ar, en], i) =>
      setTimeout(() => {
        if (this.state !== 'play') return;
        this.audio.grandma(ar, { x: p.x, y: 1, z: p.z });
        this.ui.subtitle(`📼 «${ar}»`, en, 6);
        this.#noise({ radius: 5, precision: 2 }); // الشريط بيطلع صوت
      }, i * 6500),
    );
    if (fresh) setTimeout(() => this.ui.toast(`انكتب بدفتر الجدة: ${tape.title.ar}`), 13500);
    if (Math.random() < 0.5) setTimeout(() => this.state === 'play' && this.#taunt('tape'), 15000);
  }

  // ---------- الطقس والنهايات ----------
  #openGate() {
    this.gateOpen = true;
    this.audio.playAt('shriek', { x: this.monster.pos.x, y: 2, z: this.monster.pos.z }, 1.3);
    this.ui.subtitle('انفتحت البوابة… اهرب!', 'The gate is open… RUN!', 5);
    this.monster.cfg = { ...this.monster.cfg, monsterSpeed: this.monster.cfg.monsterSpeed * 1.15 };
  }

  // النهاية السرّية: الخلخال بيرجع لصاحبته بدل البير
  #returnAnklet() {
    this.carried.delete('anklet');
    this.ankletReturned = true;
    const c = tileCenter(NEST.x, NEST.y);
    const m = pickupMesh('anklet');
    m.position.set(c.x, 0.05, c.z);
    this.scene.add(m);
    this.audio.playAt('jingle', { x: c.x, y: 0.3, z: c.z });
    this.#taunt('anklet_back');
    // بتهدى: بتتراجع وبتغني فترة، وبعدين بترجع أبطأ
    this.monster.retreat();
    this.monster.waitFor = 45;
    this.monster.cfg = { ...this.monster.cfg, monsterSpeed: this.monster.cfg.monsterSpeed * 0.85 };
    this.ui.subtitle('رجّعتلها خلخالها… سكتت. البيت كلّه سكت.', 'You gave back her anklet… she went quiet. The whole house went quiet.', 5);
    if (this.placed.size >= this.needed) this.#openGate();
  }

  // ---------- الضجيج ----------
  #noise({ x, z, radius, precision, kind, fromPlayer = true }) {
    const p = this.player;
    const n = { x: x ?? p.pos.x, z: z ?? p.pos.z, radius, precision, kind };
    if (fromPlayer && p.hidden && kind !== 'scream') n.radius *= HIDE_KINDS[p.hidden.spot.kind].muffle; // المخبأ بيكتم الصوت
    if (this.monster.hear(n, p) && fromPlayer) this.stats.heard++;
  }

  #micNoise(dt) {
    if (!this.mic.enabled) return;
    const lvl = this.mic.level;
    this.ui.meter(lvl);
    this.noiseCd -= dt;
    this.screamCd -= dt;
    if (this.chimeMask > 0) return; // دقات الساعة بتغطي صوتك
    const n = levelToNoise(lvl);
    if (!n) return;
    if (n.label !== 'whisper') this.stats.spoke = true;
    this.stats.loudestDb = Math.max(this.stats.loudestDb, this.mic.db);
    if (n.label === 'scream' && this.screamCd <= 0) {
      this.stats.screams++;
      this.screamCd = 1.5;
    }
    if (this.noiseCd > 0) return;
    this.noiseCd = 0.3;
    this.#noise({ radius: n.radius, precision: n.precision, kind: n.label });
  }

  onClip(clip) {
    this.lastRunClip = clip;
    this.mimic.add(clip);
  }

  // تشغيل تسجيل من صوت اللاعب. وضع الستريمر: تنبيه قبلها
  #playVoice(clip, pos, distortion) {
    if (!this.settings.streamer) return this.mimic.play(clip, pos, distortion);
    this.ui.toast('⚠ تسجيل من صوتك');
    setTimeout(() => this.mimic.play(clip, pos, distortion), 1500);
  }

  // ---------- التمسخر ----------
  #tauntCtx(extra = {}) {
    const ld = this.mem.lastDeath;
    const ldSpot = ld?.spot && HIDE_SPOTS.find((s) => s.id === ld.spot);
    return {
      mem: this.mem,
      run: { ...this.stats, hour: this.hour },
      night: this.cfg.night,
      favHide: M.favoriteHide(this.mem),
      hasRoute: !!M.hottestRoute(this.mem, 2.5),
      carryingAnklet: this.carried.has('anklet'),
      room: roomAt(this.player.tile().x, this.player.tile().y),
      lastDeathLabel: ldSpot ? spotLabel(ldSpot) : 'نفس المكان',
      ...extra,
    };
  }

  #taunt(trigger, extra) {
    const t = pickTaunt(trigger, this.#tauntCtx(extra), this.usedTaunts);
    if (!t) return;
    const mp = this.monster.pos;
    const en = this.settings.voiceLang === 'en';
    this.audio.speak(en ? t.en : t.ar, { x: mp.x, y: 2, z: mp.z }, en ? 'en' : 'ar');
    this.ui.subtitle(`«${t.ar}»`, t.en, 5, true);
    return t;
  }

  // ---------- التقليد ----------
  #mimicEvent() {
    const p = this.player.hidden ? this.player.hidden.spot : this.player.tile();
    const candidates = [];
    for (const r of Object.keys(ROOMS)) {
      for (const t of roomTiles(r)) {
        const d = Math.abs(t.x - p.x) + Math.abs(t.y - p.y);
        if (d >= 4 && d <= 9) candidates.push(t);
      }
    }
    const t = pick(candidates);
    if (!t || !findPath(this.monster.tile(), t)) return;
    const c = tileCenter(t.x, t.y);
    const clip = this.mimic.pick(this.hour > 3 ? 'scream' : 'talk');
    const distortion = Math.min(1, Math.max(0, (this.hour - 2) / 2.5));
    if (clip) {
      this.#playVoice(clip, { x: c.x, y: 1.5, z: c.z }, distortion);
      this.stats.mimics++;
    } else {
      // ما في تسجيلات: بتقلّد صوت الجدة
      this.audio.speak('تعال يا حبيبي… تعال لستّك', { x: c.x, y: 1.5, z: c.z });
      this.ui.subtitle('«تعال يا حبيبي… تعال لستّك»', 'Come here, dear… come to grandma', 4, true);
    }
    this.monster.ambushAt(t, 16);
  }

  #climax() {
    // الساعة 3: أصواتك من كل مكان
    const clips = this.mimic.clips.slice(0, 3);
    const rooms = ['k', 'b', 'u', 'h'];
    if (clips.length && this.settings.streamer) this.ui.toast('⚠ تسجيلات من صوتك');
    clips.forEach((clip, i) => {
      const tiles = roomTiles(rooms[i]);
      const t = tiles[Math.floor(tiles.length / 2)];
      const c = tileCenter(t.x, t.y);
      const delay = i * 700 + (this.settings.streamer ? 1500 : 0);
      setTimeout(() => this.state === 'play' && this.mimic.play(clip, { x: c.x, y: 1.5, z: c.z }, 0.8), delay);
      this.stats.mimics++;
    });
    if (!clips.length) this.audio.playAt('laugh', null, 0.6);
  }

  // ---------- أحداث ومدير التوتر ----------
  #randomRoomPos(y = 2) {
    const t = pick(roomTiles(pick(Object.keys(ROOMS))));
    return { ...tileCenter(t.x, t.y), y };
  }

  #scare() {
    const A = this.audio;
    const p = this.player.hidden ? this.player.hidden.pos : this.player.pos;
    const id = pickScare({ phoneRinging: this.phone.ringing, radioOn: this.radio.on, hour: this.hour, hasClips: this.mimic.clips.length > 0 });
    switch (id) {
      case 'door': {
        const doors = doorTiles().filter((t) => {
          const c = tileCenter(t.x, t.y);
          const d = Math.hypot(c.x - p.x, c.z - p.z);
          return d > 4 && d < 16;
        });
        const t = pick(doors.length ? doors : doorTiles());
        A.playAt('slam', { ...tileCenter(t.x, t.y), y: 1.5 });
        break;
      }
      case 'toys': {
        const tiles = roomTiles('h');
        A.playAt('toys', { ...tileCenter(tiles[3].x, tiles[3].y), y: 0.5 });
        break;
      }
      case 'ceiling':
        // خطوات فوق السقف… ما في طابق فوق
        for (let i = 0; i < 6; i++) {
          setTimeout(() => A.playAt('mstep', { x: p.x - 3 + i * 1.2, y: 3.8, z: p.z + Math.sin(i) }, 0.9), i * 480);
        }
        break;
      case 'radio':
        this.#radioOn(false);
        break;
      case 'phone':
        this.#ringPhone();
        break;
      case 'cradle': {
        this.world.rock = 1;
        const t = roomTiles('n')[8];
        const c = { ...tileCenter(t.x, t.y), y: 0.5 };
        for (let i = 0; i < 6; i++) setTimeout(() => horror.creak(A, c, 0.35), i * 900);
        break;
      }
      case 'laugh':
        A.playAt('laugh', this.#randomRoomPos(), 0.6);
        break;
      case 'whisper':
        A.playAt('whisper', { x: p.x + 0.4, y: 1.6, z: p.z }, 0.5);
        break;
    }
  }

  #direct(dt, fear) {
    const mon = this.monster;
    const action = this.director.update(dt, { chasing: mon.state === 'chase', fear, hour: this.hour });
    if (action === 'scare') this.#scare();
    else if (action === 'relief' && mon.state === 'chase') {
      // "تختفي مؤقتاً مع ضحكة بعيدة"
      mon.retreat();
      setTimeout(() => this.audio.playAt('laugh', { x: mon.pos.x, y: 2, z: mon.pos.z }, 0.5), 1500);
    } else if (action === 'nudge') {
      if (this.cfg.teleport && Math.random() < 0.5 && this.#teleport()) return;
      // بتقرّب: صوت وهمي بغرفة اللاعب (مش غش: بتروح على الغرفة مش عليه)
      const pt = this.player.hidden ? this.player.hidden.spot : this.player.tile();
      const tiles = roomTiles(roomAt(pt.x, pt.y) || 'c');
      const t = pick(tiles);
      const c = tileCenter(t.x, t.y);
      this.monster.hear({ x: c.x, z: c.z, radius: 999, precision: 4 }, this.player);
    }
  }

  // بتختفي وبتظهر بمكان بعيد عنك، ودايماً بصوت إنذار (قواعد العدالة)
  #teleport() {
    const mon = this.monster;
    if (mon.state === 'chase' || mon.state === 'search') return false;
    const p = this.player.hidden ? this.player.hidden.pos : this.player.pos;
    const options = Object.keys(ROOMS)
      .flatMap((r) => roomTiles(r))
      .filter((t) => {
        const c = tileCenter(t.x, t.y);
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        return d > 12 && d < 22 && !lineOfSight(c.x, c.z, p.x, p.z);
      });
    const t = pick(options);
    if (!t) return false;
    this.audio.playAt('teleport', { x: mon.pos.x, y: 2, z: mon.pos.z });
    mon.teleport(t);
    const c = tileCenter(t.x, t.y);
    setTimeout(() => this.audio.playAt('teleport', { ...c, y: 2 }), 1300);
    if (Math.random() < 0.4) setTimeout(() => this.#taunt('teleport'), 2200);
    return true;
  }

  // ---------- الموت والنهاية ----------
  #caught(cause, spot) {
    if (this.state !== 'play') return;
    // الخرزة الزرقاء: فرصة نجاة وحدة
    if (this.bag.count('bead') && !this.cfg.permadeath) {
      this.bag.take('bead');
      this.stats.beadSaved = true;
      this.monster.stun(5);
      this.audio.playAt('shriek', { x: this.monster.pos.x, y: 2, z: this.monster.pos.z }, 0.8);
      this.#taunt('bead');
      this.ui.subtitle('🧿 انكسرت الخرزة… اهرب! (5 ثواني)', 'The bead shattered… RUN! (5 seconds)', 4);
      if (this.player.hidden) this.player.exitHide();
      return;
    }
    this.#die(cause, spot);
  }

  #die(cause, spot) {
    this.state = 'dying';
    this.stats.deathCause = cause;
    const p = this.player;
    this.audio.playAt('grab');
    // السعلوة قدّام وجهك
    const fw = p.forward();
    const cam = this.camera.position;
    this.monster.pos.set(cam.x + fw.x * 0.9, 0, cam.z + fw.z * 0.9);
    this.monster.facing.set(-fw.x, 0, -fw.z);
    this.monster.mesh.position.set(this.monster.pos.x, cam.y - 2.3, this.monster.pos.z);
    this.monster.mesh.rotation.y = Math.atan2(-fw.x, -fw.z) + Math.PI;
    const t = this.player.tile();
    this.mem.lastDeath = { cause, spot: spot?.id ?? null, room: roomAt(t.x, t.y), time: this.time };
    // بتكرر آخر كلمة قلتها
    if (this.lastRunClip) {
      setTimeout(() => this.#playVoice(this.lastRunClip, { x: cam.x, y: cam.y, z: cam.z }, 0.9), 1200);
    }
    setTimeout(() => this.#end('death'), 2600);
  }

  #end(result) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.stats.time = this.time;
    this.#radioOff();
    M.blendHabits(this.mem, this.stats);
    if (result !== 'death') this.mem.wins++;
    this.mem.bestSurvival = Math.max(this.mem.bestSurvival, this.time);
    M.saveMemory(this.mem);
    // بلا رحمة: الموت بيمسح ذاكرتها كلها
    let wiped = false;
    if (result === 'death' && this.cfg.permadeath) {
      M.clearMemory();
      Object.assign(this.mem, M.emptyMemory());
      wiped = true;
    }
    const ending = resolveEnding({ result, ankletReturned: this.ankletReturned, tapesFound: this.progress.tapes });
    const fresh = finishRun(this.progress, {
      ending,
      night: this.cfg.night,
      difficulty: this.cfg.id,
      micOn: this.mic.enabled,
      spoke: this.stats.spoke,
      mimics: this.stats.mimics,
      favHideAtStart: this.favHideAtStart,
      usedFav: !!this.stats.usedFav,
      beadSaved: this.stats.beadSaved,
      saltBlocked: this.stats.saltBlocked,
    });
    saveProgress(this.progress);
    const deathTaunt = result === 'death' ? pickTaunt('death', this.#tauntCtx(), this.usedTaunts) : null;
    if (deathTaunt) this.audio.speak(deathTaunt.ar);
    // الفجر: تلفونك بيرن… وصوتك بيقول "ارجع"
    if (ending === 'dawn') {
      const clip = this.mimic.pick('talk');
      const cam = this.camera.position;
      setTimeout(() => {
        this.audio.playAt('ring', null, 0.8);
        if (clip) setTimeout(() => this.#playVoice(clip, { x: cam.x + 0.5, y: cam.y, z: cam.z }, 0.6), 1500);
      }, 2500);
    }
    const spotsById = Object.fromEntries(HIDE_SPOTS.map((s) => [s.id, { label: spotLabel(s) }]));
    const favId = Object.entries(this.stats.hideUses).sort((a, b) => b[1] - a[1])[0]?.[0];
    this.audio.fear = 0;
    this.ui.end({
      result,
      ending,
      text: ENDINGS[ending],
      taunt: deathTaunt,
      attempt: this.mem.attempts,
      stats: this.stats,
      favHide: favId ? spotsById[favId].label : null,
      learned: M.learnedSummary(this.mem, spotsById, ROOMS),
      clock: this.clock(),
      achievements: fresh,
      wiped,
      night: this.cfg.night,
    });
  }

  clock() {
    const h = Math.min(DAWN_HOUR, this.hour);
    const hh = Math.floor(h) === 0 ? 12 : Math.floor(h);
    const mm = Math.floor((h % 1) * 60);
    return `${hh}:${String(mm).padStart(2, '0')}`;
  }

  #animateOpen(spot, opening) {
    const m = this.hideMeshes[spot.id];
    const kind = HIDE_KINDS[spot.kind];
    m.userData.shake = opening ? kind.open : 0;
    const pos = { ...tileCenter(spot.x, spot.y), y: 1 };
    if (kind.locks && opening) {
      // بتخبط عالباب لحد ما ينكسر القفل
      for (let i = 0; i < 3; i++) setTimeout(() => this.audio.playAt('slam', pos, 0.7), i * 1000);
    } else this.audio.playAt('knock', pos, 0.7);
  }

  // خزانة مسكّرة بمسامير (الليلة الثانية)
  #nailShut(s) {
    const g = this.hideMeshes[s.id];
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
    for (const [y, r] of [[0.8, 0.15], [1.6, -0.12]]) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.05), mat);
      plank.position.set(0, y, 0.64);
      plank.rotation.z = r;
      g.add(plank);
    }
  }

  // ---------- الحلقة ----------
  update(dt, keys) {
    if (this.state === 'dying') {
      this.camera.position.x += (Math.random() - 0.5) * 0.04;
      this.camera.position.y += (Math.random() - 0.5) * 0.04;
      this.world.update(dt, this.time);
      this.post.render(dt, { fear: 1, hit: 1 });
      return;
    }
    if (this.state !== 'play') return;
    const prevHour = Math.floor(this.hour);
    this.time += dt;
    const hour = this.hour;
    const p = this.player;
    const mon = this.monster;

    // الخوف: قرب السعلوة، المطاردة، العتمة
    const dist = mon.pos.distanceTo(p.hidden ? p.hidden.pos : p.pos);
    const fear = Math.min(1, (mon.state === 'chase' ? 0.55 : 0) + Math.max(0, 1 - dist / 14) * 0.6 + (p.light ? 0 : 0.1));
    this.audio.fear += (fear - this.audio.fear) * Math.min(1, dt * 2);

    // حبس النفَس (Space) جوّا المخبأ
    p.holdingBreath = !!(p.hidden && keys.Space && (p.holdingBreath || p.stamina > 0.1));
    const mv = p.update(dt, keys, this.audio.fear);
    if (mv.gasp) {
      this.audio.playAt('gasp');
      this.#noise({ radius: 6, precision: 1 });
    }
    if (p.hidden) p.hiddenFor = (p.hiddenFor || 0) + dt;
    // نفَسك وإنت مخبّى: إذا قرّبت كثير بتسمعه (إلا إذا حابسه)
    this.breathNoiseCd -= dt;
    if (p.hidden && !p.holdingBreath && dist < 3.2 && this.breathNoiseCd <= 0) {
      this.breathNoiseCd = 2;
      this.#noise({ radius: 3.5, precision: 0.5 });
    }
    this.stats.time = this.time;
    if (mv.moving) this.stats.moveTime += dt;
    if (mv.sprinting) this.stats.sprintTime += dt;
    if (p.light === 'flash') this.stats.flashlightTime += dt;

    // ضو الشموع
    p.inCandleLight = !p.hidden && this.world.candles.some((c) => c.lit && Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < 2.8);

    // خطوات اللاعب
    if (mv.step) {
      const pt0 = p.tile();
      const ch = roomAt(pt0.x, pt0.y);
      const wood = ch === 'b' || ch === 'h' || ROOMS[ch]?.upper;
      horror.step(this.audio, wood ? 'wood' : ch === 'c' ? 'dirt' : 'stone', mv.sprinting ? 1.6 : p.crouch ? 0.4 : 1);
      const runBoost = 1 + this.mem.runRatio * 0.5 * this.cfg.adapt;
      let radius = p.crouch ? 1 : mv.sprinting ? 13 * runBoost : 4;
      // خشب الممر الفوقاني بيصرّ
      if (ROOMS[ch]?.creaky && (!p.crouch || Math.random() < 0.3)) {
        horror.creak(this.audio, { x: p.pos.x, y: 0.1, z: p.pos.z }, p.crouch ? 0.3 : 0.7);
        radius = Math.max(radius, p.crouch ? 3 : 7);
      }
      // زجاج مكسور
      if (this.glass.has(`${pt0.x},${pt0.y}`)) {
        this.audio.playAt('glass', { x: p.pos.x, y: 0.1, z: p.pos.z }, p.crouch ? 0.5 : 1);
        radius = Math.max(radius, p.crouch ? 5 : 10);
      }
      this.#noise({ radius, precision: mv.sprinting ? 1 : 2 });
      if (this.carried.has('anklet')) {
        this.audio.playAt('jingle', null);
        this.#noise({ radius: 6, precision: 1.5 });
      }
      // كل غرض بتحمله بيطلع صوت خفيف (قسم 13)
      if (this.carried.size >= 3) this.#noise({ radius: 2 + this.carried.size, precision: 2 });
    }
    this.pantCd -= dt;
    if (p.exhausted && this.pantCd <= 0) {
      this.pantCd = 1.3;
      this.audio.playAt('pant');
      this.#noise({ radius: 7, precision: 1.5 });
    }
    this.#micNoise(dt);

    // الذاكرة: الغرف وطرق الهروب
    const pt = p.tile();
    const room = roomAt(pt.x, pt.y);
    if (room && room !== this.lastRoom && room !== 'e') {
      M.noteRoom(this.mem, room, this.time < 90 ? 1.5 : 0.3);
      this.lastRoom = room;
    }
    this.routeCd -= dt;
    if (mon.state === 'chase' && mv.moving && this.routeCd <= 0) {
      M.noteRoute(this.mem, pt.x, pt.y);
      this.routeCd = 0.5;
    }

    mon.update(dt, p, { hour });
    if (this.state !== 'play') return;

    this.#updateTools(dt);
    this.#updateDoors(dt);
    this.#direct(dt, fear);
    // السطح: الضباب أخف (بتشوف القرية تحت)
    this.world.setSky(!ROOMS[room]?.upper);
    const mr = this.world.mirror.position;
    this.world.mirror.visible = Math.hypot(mr.x - p.pos.x, mr.z - p.pos.z) < 11;
    this.#houseScares(dt, room);
    const fogTarget = room === 'r' ? 0.03 : 0.07;
    this.scene.fog.density += (fogTarget - this.scene.fog.density) * Math.min(1, dt * 2);

    // ساعة الحيط: كل ساعة
    this.chimeMask -= dt;
    if (Math.floor(hour) > prevHour) {
      const c = tileCenter(3, 6);
      for (let i = 0; i < Math.floor(hour); i++) setTimeout(() => this.audio.playAt('chime', { x: c.x, y: 2, z: c.z }), i * 1300);
      this.chimeMask = 1.3 * Math.floor(hour) + 1;
      if (Math.floor(hour) === 3 && !this.climaxDone) {
        this.climaxDone = true;
        setTimeout(() => this.#climax(), 4000);
      }
    }

    // تمسخر دوري
    this.nextTaunt -= dt;
    if (this.nextTaunt <= 0 && mon.state !== 'chase') {
      this.#taunt('idle');
      this.nextTaunt = 70 + Math.random() * 40;
    }

    // التقليد بعد الساعة 2 (أو 1:30 إذا عندها تسجيلات من ليالي سابقة)
    const mimicFrom = this.mimic.clips.length && this.mem.attempts > 1 ? 1.5 : 2;
    if (hour >= mimicFrom) {
      if (this.nextMimic === null) this.nextMimic = 5;
      this.nextMimic -= dt;
      if (this.nextMimic <= 0 && mon.state !== 'chase' && !this.audio.speaking) {
        this.#mimicEvent();
        this.nextMimic = Math.max(35, 90 - hour * 12) + Math.random() * 30;
      }
    }

    // الليلة الثانية: بتختفي وبتظهر أحياناً
    if (this.cfg.teleport && mon.state === 'wander') {
      this.nextTeleport -= dt;
      if (this.nextTeleport <= 0) {
        this.nextTeleport = rand(80, 140);
        this.#teleport();
      }
    }

    // بتطفي الشموع وهي ماشية
    for (const c of this.world.candles) {
      if (!c.lit || mon.state === 'chase' || Math.hypot(c.pos.x - mon.pos.x, c.pos.z - mon.pos.z) > 2.2 || (c.nextCheck ?? 0) > this.time) continue;
      c.nextCheck = this.time + 30;
      if (Math.random() < this.cfg.lightsOut) {
        this.world.setCandle(c, false);
        this.audio.playAt('whisper', c.pos, 0.4);
      }
    }

    // خزاين بتهتز لما تفتّشها
    for (const m of Object.values(this.hideMeshes)) {
      if (m.userData.shake > 0) {
        m.userData.shake -= dt;
        m.rotation.z = Math.sin(this.time * 40) * 0.03;
      } else m.rotation.z = 0;
    }
    // اللمعة: بس لما الكشاف مصوّب عليها
    const camFwd = new THREE.Vector3();
    this.camera.getWorldDirection(camFwd);
    for (const pk of this.pickups) {
      if (!pk.spark) continue;
      const to = pk.spark.position.clone().sub(this.camera.position);
      const d = to.length();
      const lit = p.light === 'flash' && d < 12 && to.normalize().dot(camFwd) > 0.93;
      pk.spark.visible = lit && Math.sin(this.time * 3 + pk.mesh.position.x) > 0.2;
    }
    this.world.update(dt, this.time);
    this.audio.drone?.setFear(this.audio.fear);
    this.#ambient(dt, p, mon);

    // الفجر
    if (hour >= DAWN_HOUR) {
      this.audio.playAt('shriek', { x: mon.pos.x, y: 2, z: mon.pos.z });
      this.#end('dawn');
      return;
    }

    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    this.audio.setListener(this.camera.position, fwd);
    this.ui.hud({
      clock: this.clock(),
      battery: p.battery,
      stamina: p.stamina,
      carried: [...this.carried],
      placed: this.placed.size,
      total: this.needed,
      bag: this.bag,
      hint: this.#interactTarget()?.label ?? '',
      hidden: p.hidden ? p.hidden.spot.kind : null,
      breath: p.holdingBreath,
      showItems: this.cfg.hints === 'full' || keys.Tab,
      showBars: this.cfg.hints !== 'none' || keys.Tab,
    });
    this.post.render(dt, { fear: this.audio.fear, hidden: p.hidden ? 1 : 0 });
  }

  // الملح بيذوب، الراديو بيجذبها، المسجّل بيشتغل، والتلفون بيرن
  #updateTools(dt) {
    const mon = this.monster;
    for (const s of [...this.salt]) {
      if (!s.warned && this.time > s.until - 8) {
        s.warned = true;
        s.mesh.material.opacity = 0.5;
        s.mesh.material.transparent = true;
      }
      if (this.time >= s.until) {
        this.scene.remove(s.mesh);
        this.salt.splice(this.salt.indexOf(s), 1);
        mon.avoid.delete(s.key);
      }
    }
    if (this.radio.on) {
      const [x, z] = this.#radioXZ();
      this.radio.next -= dt;
      if (this.radio.next <= 0) {
        this.radio.next = 2;
        if (this.radio.byPlayer) this.#lureNoise(x, z, 22);
        else this.#noise({ x, z, radius: 22, precision: 1, fromPlayer: false });
      }
      // وصلت عنده: بتكسّره
      if (Math.hypot(mon.pos.x - x, mon.pos.z - z) < 2.4) {
        this.#radioOff();
        this.audio.playAt('slam', { x, y: 1, z });
        setTimeout(() => this.audio.playAt('laugh', { x, y: 2, z }, 0.6), 600);
      } else if (this.time >= this.radio.until) this.radio.on = false;
    }
    for (const r of [...this.recorders]) {
      if (this.time < r.next) continue;
      r.next = this.time + 6;
      r.plays--;
      if (r.clip) this.#playVoice(r.clip, r.pos, 0);
      else this.audio.playAt('knock', r.pos, 0.8);
      if (r.plays === 3) {
        this.lureUses++;
        this.stats.lures++;
        M.noteLure(this.mem);
      }
      this.#lureNoise(r.pos.x, r.pos.z, 16);
      if (r.plays <= 0) this.recorders.splice(this.recorders.indexOf(r), 1);
    }
    if (this.phone.ringing) {
      this.phone.next -= dt;
      if (this.phone.next <= 0) {
        this.phone.next = 3;
        const c = tileCenter(PHONE.x, PHONE.y);
        this.audio.playAt('ring', { x: c.x, y: 1, z: c.z - 0.7 });
      }
      if (this.time > this.phone.until) this.phone.ringing = false;
    }
  }

  // أصوات البيت: رعد وبرق، صرير، نقط مي، عواء، ونفَس السعلوة
  #ambient(dt, p, mon) {
    const A = this.audio;
    this.nextLightning -= dt;
    if (this.nextLightning <= 0) {
      this.nextLightning = rand(35, 80);
      if (!this.settings.reduceFlashes) this.world.lightning();
      horror.thunder(A, rand(0.4, 1.6), rand(0.7, 1));
    }
    this.nextCreak -= dt;
    if (this.nextCreak <= 0) {
      this.nextCreak = rand(6, 16);
      horror.creak(A, this.#randomRoomPos(2.5), rand(0.5, 1));
    }
    this.nextDrip -= dt;
    if (this.nextDrip <= 0) {
      this.nextDrip = rand(2, 6);
      const t = roomTiles('u')[5];
      horror.drip(A, { ...tileCenter(t.x, t.y), y: 2.8 });
    }
    this.nextHowl -= dt;
    if (this.nextHowl <= 0) {
      this.nextHowl = rand(80, 150);
      horror.howl(A, rand(0.5, 0.9));
    }
    // خطواتها عالخشب الفوقاني بتصرّ (إنذار)
    this.monCreakCd = (this.monCreakCd ?? 0) - dt;
    const mt = mon.tile();
    if (ROOMS[roomAt(mt.x, mt.y)]?.creaky && mon.path?.length && this.monCreakCd <= 0) {
      this.monCreakCd = 1.1;
      horror.creak(A, { x: mon.pos.x, y: 0.1, z: mon.pos.z }, 0.9);
    }
    // نفَسها: بتسمعه لما تكون قريبة
    this.breathCd -= dt;
    const d = mon.pos.distanceTo(p.hidden ? p.hidden.pos : p.pos);
    if (this.breathCd <= 0 && d < 12) {
      this.breathCd = this.inhale ? 1.2 : 1.6;
      horror.breath(A, { x: mon.pos.x, y: 2.3, z: mon.pos.z }, mon.state === 'chase' ? 1.4 : 1, this.inhale);
      this.inhale = !this.inhale;
      if (mon.state === 'chase' && Math.random() < 0.15) horror.growl(A, { x: mon.pos.x, y: 2, z: mon.pos.z }, 0.8);
    }
  }
}
