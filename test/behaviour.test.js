import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { classifyClip } from '../src/audio/mic.js';
import { Monster } from '../src/monster/monster.js';
import * as M from '../src/monster/memory.js';
import { HIDE_SPOTS, tileCenter, roomAt } from '../src/world/map.js';
import { DIFFICULTIES } from '../src/config.js';

const RATE = 8000;
const tone = (secs, envFn) => {
  const out = new Float32Array(Math.floor(RATE * secs));
  for (let i = 0; i < out.length; i++) out[i] = Math.sin((i / RATE) * 2 * Math.PI * 220) * envFn(i / RATE);
  return out;
};

test('clips are sorted into scream, laugh, breath and talk', () => {
  assert.equal(classifyClip(tone(1, () => 0.9), RATE, 3), 'scream');
  // ضحكة: نبضات "ها ها ها" 5 بالثانية
  assert.equal(classifyClip(tone(1.6, (t) => (Math.sin(t * Math.PI * 10) > 0 ? 0.6 : 0.02)), RATE, 1.5), 'laugh');
  // نفَس: واطي وطويل بدون نبضات
  assert.equal(classifyClip(tone(1.8, () => 0.1), RATE, 0.8), 'breath');
  // كلام: مقطعين
  assert.equal(classifyClip(tone(1.2, (t) => (t < 0.5 || t > 0.7 ? 0.5 : 0.05)), RATE, 1.1), 'talk');
});

const audio = { playAt() {}, panner() { return {}; }, movePanner() {}, lullaby() { return { gain: { setTargetAtTime() {} } }; }, now: 0 };
const makeMonster = (mem = M.emptyMemory()) => new Monster({ add() {} }, audio, DIFFICULTIES.normal, mem);
const player = (x, y, extra = {}) => {
  const c = tileCenter(x, y);
  return { pos: new THREE.Vector3(c.x, 0, c.z), hidden: null, crouch: false, light: null, tile: () => ({ x, y }), ...extra };
};

test('a flashlight in her face makes her cover up, then she knows where you are', () => {
  const mon = makeMonster();
  mon.place({ x: 10, y: 8 });
  mon.facing.set(1, 0, 0);
  const p = player(13, 8, { light: 'flash' });
  assert.ok(mon.canSee(p));
  assert.ok(mon.dazzle(p.pos));
  assert.equal(mon.canSee(p), false, 'covering her face');
  assert.equal(mon.dazzle(p.pos), false, 'no double dazzle');
  assert.deepEqual([mon.investigateAt.x, mon.investigateAt.z], [p.pos.x, p.pos.z]);
  for (let i = 0; i < 30; i++) mon.update(0.05, player(20, 3), { hour: 1 });
  assert.equal(mon.covering, 0);
});

test('she waits inside your favourite hiding spot and leaves when she hears something', () => {
  const mem = M.emptyMemory();
  const spot = HIDE_SPOTS.find((s) => s.id === 'wardrobe_k');
  const mon = makeMonster(mem);
  mon.place({ x: 3, y: 3 });
  mon.lurkIn(spot);
  const far = player(20, 14);
  for (let i = 0; i < 200 && !mon.lurking; i++) mon.update(0.05, far, { hour: 1 });
  assert.equal(mon.lurking, spot);
  assert.equal(mon.mesh.visible, false);
  assert.equal(mon.canSee(player(3, 2)), false);
  const c = tileCenter(4, 3);
  assert.ok(mon.hear({ x: c.x, z: c.z, radius: 10, precision: 0 }, far));
  assert.equal(mon.lurking, null);
  assert.equal(mon.mesh.visible, true);
  assert.equal(roomAt(mon.tile().x, mon.tile().y), 'k');
});

test('she drops from the ceiling when she starts hunting', () => {
  const mon = makeMonster();
  let dropped = false;
  mon.onDrop = () => (dropped = true);
  mon.place({ x: 3, y: 8 });
  mon.pose = 'ceiling';
  const c = tileCenter(5, 8);
  mon.hear({ x: c.x, z: c.z, radius: 20, precision: 0 }, player(20, 14));
  assert.equal(mon.pose, 'walk');
  assert.ok(dropped);
});

test('leaning out from a corner exposes your head', () => {
  const mon = makeMonster();
  mon.place({ x: 3, y: 8 });
  mon.facing.set(1, 0, 0);
  // اللاعب ورا الحيط بالمطبخ (ما في رؤية)، بس راسه بيبيّن من الباب (4,5)
  const hidden = player(4, 4, { light: 'flash' });
  mon.facing.set(0, 0, -1);
  assert.equal(mon.canSee(hidden), true, 'straight line through the door');
  const behind = player(2, 3, { light: 'flash' });
  assert.equal(mon.canSee(behind), false);
  const d = tileCenter(4, 4);
  const leaning = player(2, 3, { light: 'flash', head: { x: d.x, z: d.z } });
  assert.equal(mon.canSee(leaning), true);
});

test('key bindings can be changed and keep the fixed alternates', async () => {
  const { buildKeymap, KEY_ACTIONS, keyLabel } = await import('../src/keymap.js');
  const def = buildKeymap();
  assert.equal(def.get('KeyW'), 'forward');
  assert.equal(def.get('ArrowUp'), 'forward');
  assert.equal(def.get('Space'), 'breath');
  const custom = buildKeymap({ interact: 'KeyT', breath: 'KeyB' });
  assert.equal(custom.get('KeyT'), 'interact');
  assert.equal(custom.get('KeyE'), undefined);
  assert.equal(custom.get('KeyB'), 'breath');
  assert.equal(new Set(Object.values(KEY_ACTIONS).map((a) => a.key)).size, Object.keys(KEY_ACTIONS).length, 'no duplicate defaults');
  assert.equal(keyLabel('KeyQ'), 'Q');
});

test('sound files map to their slots by name', async () => {
  const { slotForFile, SFX_SLOTS, MY_PROMPTS, keys } = await import('../src/audio/sounds.js');
  assert.equal(slotForFile('scream.mp3'), 'scream');
  assert.equal(slotForFile('Thunder_2.OGG'), 'thunder');
  assert.equal(slotForFile('rain_loop.wav'), 'rain_loop');
  assert.equal(slotForFile('rain-loop.wav'), 'rain_loop');
  assert.equal(slotForFile('step_wood_3.mp3'), 'step_wood');
  assert.equal(slotForFile('random song.mp3'), null);
  assert.ok(Object.keys(SFX_SLOTS).length > 25);
  assert.ok(MY_PROMPTS.name && MY_PROMPTS.come);
  assert.equal(keys.taunt('egypt', 'first'), 'taunt:egypt:first');
});
