// اللاعب: الحركة، التحمّل، الانحناء، الكشاف، والاختباء.
import * as THREE from 'three';
import { TILE, HIDE_KINDS, isWalkable, worldToTile, tileCenter, isWall } from './world/map.js';

const RADIUS = 0.35;
const EYE = 1.6;
const CROUCH_EYE = 0.95;
const FLASH = 130;

// نقشة ضوء الكشاف: بقعة بحلقات وعيوب عدسة
function flashlightCookie() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, '#fff');
  grd.addColorStop(0.18, '#f4f0e6');
  grd.addColorStop(0.3, '#c9c4b8');
  grd.addColorStop(0.36, '#e8e2d4');
  grd.addColorStop(0.55, '#8a857a');
  grd.addColorStop(0.7, '#5a564e');
  grd.addColorStop(0.72, '#78736a');
  grd.addColorStop(1, '#000');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
    g.beginPath();
    g.arc(128 + (Math.random() - 0.5) * 160, 128 + (Math.random() - 0.5) * 160, 4 + Math.random() * 14, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Player {
  constructor(camera, scene, cfg, colliders = []) {
    this.cfg = cfg;
    this.colliders = colliders;
    this.camera = camera;
    this.yaw = 0; // بيطلّع على جوّا البيت
    this.pitch = 0;
    this.pos = new THREE.Vector3();
    this.stamina = 1;
    this.exhausted = false;
    this.crouch = false;
    this.battery = 1;
    this.flashlightOn = true;
    this.hidden = null; // المخبأ الحالي
    this.frozen = 0; // ثواني ما بتقدر تتحرّك فيها (عم تطلع عالخزان)
    this.blockTiles = null; // الأبواب المسكّرة
    this.holdingBreath = false;
    this.matchT = 0; // عود كبريت مولّع (ثواني)
    this.sensitivity = 1;
    this.invertY = false;
    this.bobT = 0;
    this.stepAcc = 0;

    // الكشاف: ضوء مخروطي بظلال ونقشة عدسة حقيقية، مربوط بالكاميرا
    const spot = new THREE.SpotLight(0xfff1d6, FLASH, 26, Math.PI / 6.5, 0.55, 2);
    spot.map = flashlightCookie();
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0008;
    spot.shadow.normalBias = 0.03;
    spot.shadow.camera.near = 0.2;
    spot.position.set(0.18, -0.2, 0.05);
    spot.target.position.set(0, -0.15, -1);
    camera.add(spot, spot.target);
    const glow = new THREE.PointLight(0xfff1d0, 0.25, 3.5, 2); // ارتداد خفيف حوالين اللاعب
    camera.add(glow);
    // عود الكبريت: ضوء دافي صغير بيرجف
    const match = new THREE.PointLight(0xffa040, 0, 7, 1.6);
    match.position.set(0.25, -0.25, -0.4);
    camera.add(match);
    this.match = match;
    this.spot = spot;
    this.glow = glow;
    scene.add(camera);
  }

  place(tx, ty) {
    const p = tileCenter(tx, ty);
    this.pos.set(p.x, 0, p.z);
  }

  // مصدر الضوء اللي بتشوفه السعلوة
  get light() {
    if (this.flashlightOn && this.battery > 0) return 'flash';
    return this.matchT > 0 ? 'match' : null;
  }

  lightMatch(seconds = 25) {
    this.matchT = seconds;
  }

  look(dx, dy) {
    dx *= this.sensitivity;
    dy *= this.sensitivity * (this.invertY ? -1 : 1);
    if (this.hidden) {
      // جوّا المخبأ: نظر محدود من الفتحة
      this.yaw = THREE.MathUtils.clamp(this.yaw - dx * 0.002, this.hidden.yaw - 0.5, this.hidden.yaw + 0.5);
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.002, -0.3, 0.3);
      return;
    }
    this.yaw -= dx * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0022, -1.4, 1.4);
  }

  forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  tile() {
    return worldToTile(this.pos.x, this.pos.z);
  }

  // بترجع معلومات الحركة لهالإطار
  update(dt, keys, fear) {
    const out = { moving: false, sprinting: false, step: false, pant: false };
    let lightTarget = this.flashlightOn && this.battery > 0 ? FLASH : 0;
    // الكشاف بيرمش لما البطارية ضعيفة
    if (this.battery < 0.15 && Math.random() < 0.08) lightTarget *= 0.2;
    if (this.flashlightOn && this.battery > 0) this.battery = Math.max(0, this.battery - dt / this.cfg.batterySeconds);
    this.spot.intensity = lightTarget * (0.4 + 0.6 * Math.min(1, this.battery * 4));
    this.glow.intensity = lightTarget ? 0.25 : 0;
    if (this.matchT > 0) {
      this.matchT -= dt;
      const dying = this.matchT < 3 ? this.matchT / 3 : 1;
      this.match.intensity = (2.2 + Math.sin(performance.now() * 0.03) * 0.3 + (Math.random() - 0.5) * 0.5) * dying;
    } else this.match.intensity = 0;

    if (this.hidden) {
      // حبس النفَس بيستهلك التحمّل، ولما يخلص بتشهق غصب عنك
      if (this.holdingBreath) {
        this.stamina -= dt / 5;
        if (this.stamina <= 0) {
          this.stamina = 0;
          this.holdingBreath = false;
          out.gasp = true;
        }
      } else this.stamina = Math.min(1, this.stamina + dt * 0.15);
      this.#applyCamera(dt, 0, fear);
      return out;
    }

    if (this.frozen > 0) {
      this.frozen -= dt;
      this.#applyCamera(dt, 0, fear);
      return out;
    }
    const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const moving = f !== 0 || s !== 0;
    const wantSprint = keys.ShiftLeft || keys.ShiftRight;
    const sprint = moving && wantSprint && !this.crouch && !this.exhausted;
    let speed = this.crouch ? 1.3 : sprint ? 5 : 2.6;
    if (this.exhausted) speed *= 0.8;

    if (sprint) {
      this.stamina -= dt / 6;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.exhausted = true;
        out.pant = true;
      }
    } else {
      this.stamina = Math.min(1, this.stamina + dt * (moving ? 0.12 : 0.22));
      if (this.exhausted && this.stamina > 0.4) this.exhausted = false;
    }

    if (moving) {
      const fw = this.forward();
      const right = new THREE.Vector3(-fw.z, 0, fw.x);
      const dir = fw.multiplyScalar(f).add(right.multiplyScalar(s)).normalize().multiplyScalar(speed * dt);
      this.#move(dir.x, 0);
      this.#move(0, dir.z);
      this.stepAcc += speed * dt;
      const stride = sprint ? 2.2 : 1.6;
      if (this.stepAcc > stride) {
        this.stepAcc = 0;
        out.step = true;
      }
    }
    out.moving = moving;
    out.sprinting = sprint;
    out.speed = moving ? speed : 0;
    this.#applyCamera(dt, moving ? speed : 0, fear);
    return out;
  }

  #solidAt(wx, wz) {
    const { x, y } = worldToTile(wx, wz);
    return !isWalkable(x, y) || !!this.blockTiles?.has(`${x},${y}`);
  }

  #move(dx, dz) {
    const nx = this.pos.x + dx;
    const nz = this.pos.z + dz;
    const r = RADIUS;
    const hit =
      this.#solidAt(nx - r, nz - r) || this.#solidAt(nx + r, nz - r) || this.#solidAt(nx - r, nz + r) || this.#solidAt(nx + r, nz + r);
    const blocked = hit || this.colliders.some((c) => nx + r > c.minX && nx - r < c.maxX && nz + r > c.minZ && nz - r < c.maxZ);
    if (!blocked) {
      this.pos.x = nx;
      this.pos.z = nz;
    }
  }

  #applyCamera(dt, speed, fear) {
    const eye = this.hidden ? this.hidden.eye : this.crouch ? CROUCH_EYE : EYE;
    this.bobT += dt * speed * 2.2;
    const bob = Math.sin(this.bobT) * 0.04 * Math.min(1, speed / 2.6);
    // ارتجاف مع الخوف
    const shake = fear > 0.5 ? (Math.random() - 0.5) * 0.012 * fear : 0;
    const base = this.hidden ? this.hidden.pos : this.pos;
    this.camera.position.set(base.x, THREE.MathUtils.lerp(this.camera.position.y || eye, eye + bob, 0.2), base.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw + shake);
    this.camera.rotateX(this.pitch + shake);
  }

  // الدخول للمخبأ: الكاميرا بتنحط جوّاه وبتطلّع على الغرفة
  enterHide(spot) {
    const c = tileCenter(spot.x, spot.y);
    const open = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dy]) => !isWall(spot.x + dx, spot.y + dy) && isWalkable(spot.x + dx, spot.y + dy)) || [0, 1];
    const yaw = Math.atan2(-open[0], -open[1]);
    this.exitTile = { x: spot.x + open[0], y: spot.y + open[1] };
    this.hidden = {
      spot,
      yaw,
      eye: HIDE_KINDS[spot.kind].eye,
      pos: new THREE.Vector3(c.x + open[0] * TILE * 0.3, 0, c.z + open[1] * TILE * 0.3),
    };
    this.yaw = yaw;
    this.pitch = 0;
    this.crouch = false;
  }

  exitHide() {
    if (!this.hidden) return;
    this.hidden = null;
    this.holdingBreath = false;
    this.place(this.exitTile.x, this.exitTile.y);
  }
}
