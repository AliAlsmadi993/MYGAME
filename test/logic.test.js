import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYOUT, W, H, HIDE_SPOTS, ITEMS, WELL, GATE, PLAYER_START, MONSTER_LAIR, ROOMS, findPath, isWalkable, roomTiles, lineOfSight, tileCenter,
} from '../src/world/map.js';
import * as M from '../src/monster/memory.js';
import { pickTaunt, TAUNTS } from '../src/monster/taunts.js';
import { levelToNoise } from '../src/audio/mic.js';

test('map rows all have the same width', () => {
  for (const row of LAYOUT) assert.equal(row.length, W);
  assert.equal(LAYOUT.length, H);
});

test('every room and hide spot is reachable from the start', () => {
  for (const r of Object.keys(ROOMS)) {
    const t = roomTiles(r)[0];
    assert.ok(t, `room ${r} has tiles`);
    assert.ok(findPath(PLAYER_START, t), `path to room ${r}`);
  }
  for (const s of HIDE_SPOTS) {
    assert.equal(LAYOUT[s.y][s.x], s.room, `${s.id} sits in its room`);
    assert.ok(findPath(MONSTER_LAIR, s), `monster reaches ${s.id}`);
  }
  assert.ok(findPath(PLAYER_START, WELL), 'well reachable');
  assert.equal(LAYOUT[GATE.y][GATE.x], 'G');
});

test('item rooms exist and have free tiles', () => {
  for (const it of ITEMS) for (const r of it.rooms) assert.ok(roomTiles(r).length > 0, `${it.id} in ${r}`);
});

test('path never crosses walls or hide spots', () => {
  const path = findPath(PLAYER_START, { x: 21, y: 15 });
  for (const t of path) assert.ok(isWalkable(t.x, t.y));
  for (let i = 1; i < path.length; i++) {
    assert.equal(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y), 1);
  }
});

test('line of sight is blocked by walls', () => {
  const a = tileCenter(3, 3); // المطبخ
  const b = tileCenter(3, 8); // الليوان
  assert.equal(lineOfSight(a.x, a.z, b.x, b.z), false);
  const c = tileCenter(10, 7);
  const d = tileCenter(16, 9);
  assert.equal(lineOfSight(c.x, c.z, d.x, d.z), true);
});

test('memory decays old habits and orders hide spots', () => {
  const mem = M.emptyMemory();
  M.noteHide(mem, 'bed_h');
  M.noteHide(mem, 'wardrobe_b');
  M.noteHide(mem, 'wardrobe_b');
  const order = M.hideSearchOrder(mem, HIDE_SPOTS);
  assert.equal(order[0].id, 'wardrobe_b');
  assert.equal(order[1].id, 'bed_h');
  assert.equal(M.favoriteHide(mem), 'wardrobe_b');
  M.beginRun(mem);
  assert.equal(mem.attempts, 1);
  assert.ok(Math.abs(mem.hideCounts.wardrobe_b - 1.4) < 1e-9);
});

test('memory finds the hottest escape route', () => {
  const mem = M.emptyMemory();
  assert.equal(M.hottestRoute(mem), null);
  for (let i = 0; i < 5; i++) M.noteRoute(mem, 12, 11);
  assert.deepEqual(M.hottestRoute(mem), { x: 12, y: 11 });
});

test('memory round-trips through storage', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const mem = M.emptyMemory();
  M.noteHide(mem, 'bed_b');
  mem.attempts = 3;
  M.saveMemory(mem, storage);
  const back = M.loadMemory(storage);
  assert.equal(back.attempts, 3);
  assert.equal(back.hideCounts.bed_b, 1);
  M.clearMemory(storage);
  assert.equal(M.loadMemory(storage).attempts, 0);
});

test('habits blend toward run behaviour', () => {
  const mem = M.emptyMemory();
  M.blendHabits(mem, { moveTime: 100, sprintTime: 100, time: 120, flashlightTime: 120, screams: 10 });
  assert.ok(mem.runRatio > 0.35);
  assert.ok(mem.flashlightRatio > 0.5);
  assert.ok(mem.loudness > 0.6);
});

test('taunts react to what she learned and never repeat in a run', () => {
  const mem = M.emptyMemory();
  mem.attempts = 4;
  mem.lastDeath = { cause: 'hide', spot: 'wardrobe_b', time: 300 };
  const used = new Set();
  const ctx = { mem, run: { time: 10, screams: 0, heard: 0, hour: 0 }, lastDeathLabel: 'الخزانة' };
  const t = pickTaunt('start', ctx, used);
  assert.equal(t.id, 'died_hide');
  assert.match(t.ar, /الخزانة/);
  assert.notEqual(pickTaunt('start', ctx, used)?.id, 'died_hide');
  const first = pickTaunt('start', { ...ctx, mem: M.emptyMemory() }, new Set());
  assert.equal(first.id, 'first');
});

test('every taunt has Arabic and English text', () => {
  for (const t of TAUNTS) {
    assert.ok(t.ar && t.en, t.id);
  }
});

test('mic level maps to hearing radius per the design table', () => {
  assert.equal(levelToNoise(0.1), null);
  assert.equal(levelToNoise(0.5).label, 'whisper');
  assert.equal(levelToNoise(1).label, 'talk');
  assert.equal(levelToNoise(1.8).label, 'loud');
  assert.equal(levelToNoise(3).label, 'scream');
  assert.ok(levelToNoise(3).radius > levelToNoise(1).radius);
});
