// الجولة الواحدة (ليلة): الوقت، الأغراض، الضجيج، التمسخر، التقليد، الفوز والموت.
import * as THREE from 'three';
import {
  HIDE_SPOTS, ITEMS, ROOMS, WELL, GATE, PLAYER_START, TILE, roomTiles, roomAt, tileCenter, worldToTile, isWall, findPath,
} from './world/map.js';
import { buildWorld, pickupMesh } from './world/build.js';
import { Player } from './player.js';
import { Monster } from './monster/monster.js';
import * as M from './monster/memory.js';
import { pickTaunt } from './monster/taunts.js';
import { levelToNoise } from './audio/mic.js';
import { DAWN_HOUR } from './config.js';
import { createPost } from './post.js';
import { horror } from './audio/horror.js';

const HIDE_LABELS = { wardrobe: 'الخزانة', bed: 'تحت السرير' };
export const spotLabel = (s) => `${HIDE_LABELS[s.kind]} (${ROOMS[s.room].ar})`;

export class Game {
  constructor({ renderer, audio, mic, mimic, cfg, mem, ui }) {
    Object.assign(this, { renderer, audio, mic, mimic, cfg, mem, ui });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 80);
    const world = (this.world = buildWorld(this.scene));
    this.hideMeshes = world.hideMeshes;
    this.post = createPost(renderer, this.scene, this.camera);
    this.player = new Player(this.camera, this.scene, cfg, world.colliders);
    this.player.place(PLAYER_START.x, PLAYER_START.y);
    this.monster = new Monster(this.scene, audio, cfg, mem);
    this.monster.onCatch = (cause, spot) => this.#die(cause, spot);
    this.monster.onOpen = (spot, opening) => this.#animateOpen(spot, opening);
    this.monster.onState = (s, prev) => {
      this.ui.debug?.(s);
      // أول ما تشوفك: نغمة فزع وخرخرة
      if (s === 'chase' && prev !== 'chase') {
        horror.sting(audio, 1);
        const mp = this.monster.pos;
        setTimeout(() => horror.growl(audio, { x: mp.x, y: 2, z: mp.z }, 1), 300);
      }
    };

    this.time = 0;
    this.state = 'play';
    this.carried = new Set();
    this.placed = new Set();
    this.gateOpen = false;
    this.bells = cfg.bells;
    this.usedTaunts = new Set();
    this.stats = {
      time: 0, moveTime: 0, sprintTime: 0, flashlightTime: 0, heard: 0, screams: 0, loudestDb: -100, mimics: 0, hideUses: {},
      deathCause: null, bellsThrown: 0,
    };
    this.lastRunClip = null;
    this.noiseCd = 0;
    this.screamCd = 0;
    this.chimeMask = 0;
    this.lastRoom = null;
    this.routeCd = 0;
    this.pantCd = 0;
    this.nextTaunt = 70;
    this.nextMimic = null;
    this.nextScare = 50;
    this.climaxDone = false;
    this.nextLightning = 25 + Math.random() * 30;
    this.nextCreak = 8;
    this.nextDrip = 3;
    this.nextHowl = 60;
    this.breathCd = 0;
    this.inhale = true;

    this.pickups = [];
    this.#spawnPickups();
    M.beginRun(mem);
    M.saveMemory(mem);
  }

  start() {
    this.monster.initAudio();
    setTimeout(() => this.#taunt('start'), 4000);
    this.ui.subtitle('لازم ترجّع غراض ستّك الثلاثة للبير بالحوش… أو تصمد للفجر.', 'Return grandma\'s three things to the well… or survive until dawn.', 6);
  }

  get hour() {
    return this.time / this.cfg.hourSeconds;
  }

  // ---------- الأغراض ----------
  #spawnPickups() {
    const taken = new Set();
    const place = (kind, rooms, extra = {}) => {
      const blocked = this.world.blockedTiles;
      const tiles = rooms.flatMap((r) => roomTiles(r)).filter((t) => !taken.has(`${t.x},${t.y}`) && !blocked.has(`${t.x},${t.y}`));
      const t = tiles[Math.floor(Math.random() * tiles.length)];
      taken.add(`${t.x},${t.y}`);
      const c = tileCenter(t.x, t.y);
      const mesh = pickupMesh(kind);
      mesh.position.x = c.x + (Math.random() - 0.5);
      mesh.position.z = c.z + (Math.random() - 0.5);
      mesh.traverse((o) => (o.castShadow = true));
      this.scene.add(mesh);
      // لمعة صغيرة بتبيّن لما الكشاف يوقع عليها
      if (extra.item) {
        const sp = new THREE.Sprite(this.#sparkMat());
        sp.scale.set(0.12, 0.12, 1);
        sp.position.set(mesh.position.x, 0.12, mesh.position.z);
        this.scene.add(sp);
        extra.spark = sp;
      }
      this.pickups.push({ kind, mesh, ...extra });
    };
    for (const it of ITEMS) place(it.id, it.rooms, { item: it });
    const all = Object.keys(ROOMS);
    for (let i = 0; i < this.cfg.batteries; i++) place('battery', all);
    for (let i = 0; i < 2; i++) place('bell', all);
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
    for (const pk of this.pickups) consider({ type: 'pickup', pk, label: `التقط: ${pk.item?.ar ?? (pk.kind === 'bell' ? 'جرس' : 'بطارية')}` }, near(pk.mesh.position.x, pk.mesh.position.z, 1.8));
    for (const s of HIDE_SPOTS) {
      const c = tileCenter(s.x, s.y);
      consider({ type: 'hide', spot: s, label: `اختبئ: ${HIDE_LABELS[s.kind]}` }, near(c.x, c.z, 2.7));
    }
    const w = tileCenter(WELL.x, WELL.y);
    if (this.carried.size) consider({ type: 'well', label: 'ارمِ الأغراض بالبير' }, near(w.x, w.z, 2.7));
    const g = tileCenter(GATE.x, GATE.y);
    consider({ type: 'gate', label: this.gateOpen ? 'اهرب!' : 'البوابة مقفلة… كمّل الطقس أول' }, near(g.x, g.z - TILE * 0.5, 2.2));
    return best;
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
      case 'hide':
        p.enterHide(t.spot);
        p.hiddenFor = 0;
        this.stats.hideUses[t.spot.id] = (this.stats.hideUses[t.spot.id] || 0) + 1;
        // التمسخر قبل ما نسجّل: بتعلّق بس إذا المكان كان مفضّل من قبل
        if (Math.random() < 0.5) this.#taunt('hide', { hideId: t.spot.id });
        M.noteHide(this.mem, t.spot.id);
        break;
      case 'pickup': {
        const pk = t.pk;
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
        } else if (pk.kind === 'battery') {
          p.battery = Math.min(1, p.battery + 0.6);
        } else this.bells++;
        break;
      }
      case 'well':
        for (const id of this.carried) this.placed.add(id);
        this.carried.clear();
        this.audio.playAt('ritual');
        if (this.placed.size === ITEMS.length) {
          this.gateOpen = true;
          this.audio.playAt('shriek', { x: this.monster.pos.x, y: 2, z: this.monster.pos.z }, 1.3);
          this.ui.subtitle('انفتحت البوابة… اهرب!', 'The gate is open… RUN!', 5);
          this.monster.cfg = { ...this.cfg, monsterSpeed: this.cfg.monsterSpeed * 1.15 };
        } else this.ui.subtitle(`${this.placed.size} من ${ITEMS.length}`, '', 3);
        break;
      case 'gate':
        if (this.gateOpen) this.#end('escape');
        break;
    }
  }

  throwBell() {
    if (this.state !== 'play' || this.player.hidden || this.bells <= 0) return;
    this.bells--;
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

  toggleFlashlight() {
    this.player.flashlightOn = !this.player.flashlightOn;
  }

  // ---------- الضجيج ----------
  #noise({ x, z, radius, precision, kind, fromPlayer = true }) {
    const p = this.player;
    const n = { x: x ?? p.pos.x, z: z ?? p.pos.z, radius, precision, kind };
    if (fromPlayer && p.hidden && kind !== 'scream') n.radius *= 0.5; // المخبأ بيكتم الصوت
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

  // ---------- التمسخر ----------
  #tauntCtx(extra = {}) {
    const ld = this.mem.lastDeath;
    return {
      mem: this.mem,
      run: { ...this.stats, hour: this.hour },
      favHide: M.favoriteHide(this.mem),
      hasRoute: !!M.hottestRoute(this.mem, 2.5),
      lastDeathLabel: ld?.spot ? spotLabel(HIDE_SPOTS.find((s) => s.id === ld.spot)) : 'نفس المكان',
      ...extra,
    };
  }

  #taunt(trigger, extra) {
    const t = pickTaunt(trigger, this.#tauntCtx(extra), this.usedTaunts);
    if (!t) return;
    const mp = this.monster.pos;
    this.audio.speak(t.ar, { x: mp.x, y: 2, z: mp.z });
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
    const t = candidates[Math.floor(Math.random() * candidates.length)];
    if (!t || !findPath(this.monster.tile(), t)) return;
    const c = tileCenter(t.x, t.y);
    const clip = this.mimic.pick(this.hour > 3 ? 'scream' : 'talk');
    const distortion = Math.min(1, Math.max(0, (this.hour - 2) / 2.5));
    if (clip) {
      this.mimic.play(clip, { x: c.x, y: 1.5, z: c.z }, distortion);
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
    clips.forEach((clip, i) => {
      const tiles = roomTiles(rooms[i]);
      const t = tiles[Math.floor(tiles.length / 2)];
      const c = tileCenter(t.x, t.y);
      setTimeout(() => this.state === 'play' && this.mimic.play(clip, { x: c.x, y: 1.5, z: c.z }, 0.8), i * 700);
      this.stats.mimics++;
    });
    if (!clips.length) this.audio.playAt('laugh', null, 0.6);
  }

  // ---------- الموت والنهاية ----------
  #die(cause, spot) {
    if (this.state !== 'play') return;
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
      setTimeout(() => this.mimic.play(this.lastRunClip, { x: cam.x, y: cam.y, z: cam.z }, 0.9), 1200);
    }
    setTimeout(() => this.#end('death'), 2600);
  }

  #end(result) {
    if (this.state === 'over') return;
    this.state = 'over';
    this.stats.time = this.time;
    M.blendHabits(this.mem, this.stats);
    if (result !== 'death') this.mem.wins++;
    this.mem.bestSurvival = Math.max(this.mem.bestSurvival, this.time);
    M.saveMemory(this.mem);
    const deathTaunt = result === 'death' ? pickTaunt('death', this.#tauntCtx(), this.usedTaunts) : null;
    if (deathTaunt) this.audio.speak(deathTaunt.ar);
    const spotsById = Object.fromEntries(HIDE_SPOTS.map((s) => [s.id, { label: spotLabel(s) }]));
    const favId = Object.entries(this.stats.hideUses).sort((a, b) => b[1] - a[1])[0]?.[0];
    this.audio.fear = 0;
    this.ui.end({
      result,
      taunt: deathTaunt,
      attempt: this.mem.attempts,
      stats: this.stats,
      favHide: favId ? spotsById[favId].label : null,
      learned: M.learnedSummary(this.mem, spotsById, ROOMS),
      clock: this.clock(),
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
    m.userData.shake = opening ? 1.1 : 0;
    this.audio.playAt('knock', { ...tileCenter(spot.x, spot.y), y: 1 }, 0.7);
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
    const fear = Math.min(1, (mon.state === 'chase' ? 0.55 : 0) + Math.max(0, 1 - dist / 14) * 0.6 + (p.flashlightOn ? 0 : 0.1));
    this.audio.fear += (fear - this.audio.fear) * Math.min(1, dt * 2);

    const mv = p.update(dt, keys, this.audio.fear);
    if (p.hidden) p.hiddenFor = (p.hiddenFor || 0) + dt;
    this.stats.time = this.time;
    if (mv.moving) this.stats.moveTime += dt;
    if (mv.sprinting) this.stats.sprintTime += dt;
    if (p.flashlightOn && p.battery > 0) this.stats.flashlightTime += dt;

    // خطوات اللاعب
    if (mv.step) {
      const ch = roomAt(p.tile().x, p.tile().y);
      horror.step(this.audio, ch === 'b' || ch === 'h' ? 'wood' : ch === 'c' ? 'dirt' : 'stone', mv.sprinting ? 1.6 : p.crouch ? 0.4 : 1);
      const runBoost = 1 + this.mem.runRatio * 0.5 * this.cfg.adapt;
      const radius = p.crouch ? 1 : mv.sprinting ? 13 * runBoost : 4;
      this.#noise({ radius, precision: mv.sprinting ? 1 : 2 });
      if (this.carried.has('anklet')) {
        this.audio.playAt('jingle', null);
        this.#noise({ radius: 6, precision: 1.5 });
      }
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

    // أحداث مخيفة بدون خطر
    this.nextScare -= dt;
    if (this.nextScare <= 0) {
      this.nextScare = 45 + Math.random() * 50;
      const rooms = Object.keys(ROOMS);
      const tiles = roomTiles(rooms[Math.floor(Math.random() * rooms.length)]);
      const t = tiles[Math.floor(Math.random() * tiles.length)];
      this.audio.playAt(Math.random() < 0.6 ? 'knock' : 'laugh', { ...tileCenter(t.x, t.y), y: 2 }, 0.6);
    }

    // خزاين بتهتز لما تفتّشها
    for (const [id, m] of Object.entries(this.hideMeshes)) {
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
      const lit = p.flashlightOn && p.battery > 0 && d < 12 && to.normalize().dot(camFwd) > 0.93;
      pk.spark.material.opacity = 1;
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
      carried: this.carried.size,
      placed: this.placed.size,
      total: ITEMS.length,
      bells: this.bells,
      hint: this.#interactTarget()?.label ?? '',
      hidden: !!p.hidden,
    });
    this.post.render(dt, { fear: this.audio.fear, hidden: p.hidden ? 1 : 0 });
  }

  // أصوات البيت: رعد وبرق، صرير، نقط مي، عواء، ونفَس السعلوة
  #ambient(dt, p, mon) {
    const A = this.audio;
    const rand = (a, b) => a + Math.random() * (b - a);
    const randomRoomPos = () => {
      const rooms = Object.keys(ROOMS);
      const tiles = roomTiles(rooms[Math.floor(Math.random() * rooms.length)]);
      const t = tiles[Math.floor(Math.random() * tiles.length)];
      return { ...tileCenter(t.x, t.y), y: 2.5 };
    };
    this.nextLightning -= dt;
    if (this.nextLightning <= 0) {
      this.nextLightning = rand(35, 80);
      this.world.lightning();
      horror.thunder(A, rand(0.4, 1.6), rand(0.7, 1));
    }
    this.nextCreak -= dt;
    if (this.nextCreak <= 0) {
      this.nextCreak = rand(6, 16);
      horror.creak(A, randomRoomPos(), rand(0.5, 1));
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
