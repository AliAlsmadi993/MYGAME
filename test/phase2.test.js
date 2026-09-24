import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HIDE_SPOTS, HIDE_KINDS, ITEMS, PLAYER_START, MONSTER_LAIR, MONSTER_STARTS, NEST, PHONE, RADIO, WELL, LAYOUT, findPath, isWalkable, doorTiles, roomTiles } from '../src/world/map.js';
import { Bag, TOOLS, BAG_SLOTS } from '../src/inventory.js';
import * as P from '../src/progress.js';
import { TAPES, tapesForNight } from '../src/story/tapes.js';
import { resolveEnding, ENDINGS } from '../src/story/endings.js';
import { Director, pickScare, SCARES } from '../src/director.js';
import { DIFFICULTIES, NIGHTS, nightConfig } from '../src/config.js';
import * as M from '../src/monster/memory.js';
import { pickTaunt, TAUNTS } from '../src/monster/taunts.js';

const memStorage = () => {
  const store = new Map();
  return { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
};

test('five ritual items, the anklet always in the cellar', () => {
  assert.equal(ITEMS.length, 5);
  assert.deepEqual(ITEMS.find((i) => i.id === 'anklet').rooms, ['u']);
});

test('every hide spot has a known kind and every kind is used', () => {
  for (const s of HIDE_SPOTS) assert.ok(HIDE_KINDS[s.kind], s.id);
  for (const k of Object.keys(HIDE_KINDS)) assert.ok(HIDE_SPOTS.some((s) => s.kind === k), k);
  assert.equal(new Set(HIDE_SPOTS.map((s) => s.id)).size, HIDE_SPOTS.length);
});

test('fixed props and monster starts are in open rooms', () => {
  for (const [name, t, room] of [['nest', NEST, 'u'], ['phone', PHONE, 'e'], ['radio', RADIO, 'a']]) {
    assert.equal(LAYOUT[t.y][t.x], room, name);
    assert.ok(findPath(PLAYER_START, t), `${name} reachable`);
  }
  for (const s of MONSTER_STARTS) {
    assert.ok(isWalkable(s.x, s.y));
    assert.ok(findPath(s, PLAYER_START), 'monster start connects to the house');
  }
});

test('salt on a doorway blocks the path through it', () => {
  // المطبخ ↔ الليوان بس من باب واحد (4,5)
  const kitchen = { x: 3, y: 3 };
  const liwan = { x: 3, y: 8 };
  assert.ok(findPath(kitchen, liwan));
  const doors = doorTiles().filter((d) => d.x === 4 && d.y === 5);
  assert.equal(doors.length, 1);
  const avoid = new Set(['4,5']);
  const detour = findPath(kitchen, liwan, avoid);
  // في طريق ثاني من المضافة والحوش، بس أطول ولا يمر من الملح
  assert.ok(detour.length > findPath(kitchen, liwan).length);
  assert.ok(!detour.some((t) => t.x === 4 && t.y === 5));
  // غرفة الجدة إلها مدخلين؛ إذا سكّرناهم الثنين ما في طريق
  assert.equal(findPath(PLAYER_START, { x: 20, y: 3 }, new Set(['16,3', '18,5'])), null);
});

test('bag holds four kinds of tools and stacks up to each max', () => {
  const bag = new Bag();
  assert.equal(bag.slots.length, BAG_SLOTS);
  assert.equal(bag.add('bell', 7), 7); // 5 + 2 بخانتين
  assert.equal(bag.count('bell'), 7);
  bag.add('salt');
  bag.add('matches', 3);
  assert.equal(bag.canAdd('battery'), false);
  assert.equal(bag.add('battery'), 0);
  assert.equal(bag.canAdd('matches'), true);
  assert.ok(bag.take('bell', 3));
  assert.equal(bag.count('bell'), 4);
  assert.equal(bag.take('bead'), false);
  bag.select(3);
  const dropped = bag.drop();
  assert.equal(dropped.tool, 'matches');
  assert.ok(bag.canAdd('battery'));
  bag.select(3);
  bag.cycle(1);
  assert.ok(bag.selected);
  for (const t of Object.values(TOOLS)) assert.ok(t.ar && t.icon && t.max >= 1);
});

test('tapes unlock in story order and endings resolve correctly', () => {
  assert.deepEqual(tapesForNight([], 2).map((t) => t.id), ['voices', 'salt']);
  assert.deepEqual(tapesForNight(['voices'], 2).map((t) => t.id), ['salt', 'anklet']);
  assert.equal(tapesForNight(TAPES.map((t) => t.id)).length, 0);
  assert.equal(resolveEnding({ result: 'death' }), 'death');
  assert.equal(resolveEnding({ result: 'dawn', ankletReturned: true }), 'dawn');
  assert.equal(resolveEnding({ result: 'escape' }), 'escape');
  assert.equal(resolveEnding({ result: 'escape', ankletReturned: true }), 'secret');
  assert.equal(resolveEnding({ result: 'escape', tapesFound: TAPES.map((t) => t.id) }), 'true');
  for (const e of Object.values(ENDINGS)) assert.ok(e.title && e.taunt);
  for (const t of TAPES) assert.ok(t.lines.length && t.note.ar && t.note.en);
});

test('progress awards achievements once and unlocks night two', () => {
  const p = P.emptyProgress();
  assert.equal(P.nightTwoUnlocked(p), false);
  let fresh = P.finishRun(p, { ending: 'death', mimics: 3, saltBlocked: true });
  assert.deepEqual(fresh, ['salt_line']);
  fresh = P.finishRun(p, { ending: 'dawn', night: 1, micOn: true, spoke: false, mimics: 2, favHideAtStart: 'bed_b', usedFav: false });
  for (const id of ['first_escape', 'silent', 'changed_habit', 'rooster', 'not_yours']) assert.ok(fresh.includes(id), id);
  assert.ok(P.nightTwoUnlocked(p));
  assert.equal(P.finishRun(p, { ending: 'dawn', micOn: true }).includes('first_escape'), false);
  assert.deepEqual(P.finishRun(p, { ending: 'secret', night: 2 }).sort(), ['anklet_home', 'night_two']);
  assert.deepEqual(p.endings.sort(), ['dawn', 'death', 'secret']);
  for (const t of TAPES) P.noteTape(p, t.id);
  assert.ok(P.finishRun(p, { ending: 'death' }).includes('grandma_right'));
  // الحفظ والتحميل
  const st = memStorage();
  P.saveProgress(p, st);
  assert.equal(P.loadProgress(st).wins, p.wins);
  P.clearProgress(st);
  assert.equal(P.loadProgress(st).wins, 0);
});

test('director gives relief after long chases and scares after long calm', () => {
  let r = 0.9;
  const d = new Director(() => r);
  let got = null;
  for (let i = 0; i < 45 && !got; i++) got = d.update(1, { chasing: true, fear: 1, hour: 1 });
  assert.equal(got, 'relief');
  // ما في استراحة بآخر ساعة (يأس السعلوة)
  const late = new Director(() => r);
  for (let i = 0; i < 60; i++) assert.notEqual(late.update(1, { chasing: true, fear: 1, hour: 4.2 }), 'relief');
  const calm = new Director(() => r);
  calm.nextScare = 1e9;
  const acts = [];
  for (let i = 0; i < 80; i++) {
    const a = calm.update(1, { chasing: false, fear: 0, hour: 0 });
    if (a) acts.push(a);
  }
  assert.deepEqual(acts, ['scare']);
});

test('scares respect their conditions', () => {
  for (let i = 0; i < 50; i++) {
    const s = pickScare({ phoneRinging: true, radioOn: true, hour: 3 }, Math.random);
    assert.ok(!['phone', 'radio'].includes(s));
  }
  assert.notEqual(pickScare({ phoneRinging: false, radioOn: false, hour: 0 }, () => 0.999), 'phone');
  assert.ok(SCARES.every((s) => s.weight > 0));
});

test('merciless and night two configs', () => {
  const m = DIFFICULTIES.merciless;
  assert.equal(m.bead, 0);
  assert.ok(m.permadeath);
  const n2 = nightConfig(DIFFICULTIES.normal, 2);
  assert.ok(n2.monsterSpeed > DIFFICULTIES.normal.monsterSpeed);
  assert.ok(n2.teleport && n2.sealed === 1);
  assert.equal(nightConfig(DIFFICULTIES.normal, 1).monsterSpeed, DIFFICULTIES.normal.monsterSpeed);
  assert.ok(NIGHTS[1] && NIGHTS[2]);
});

test('she learns to ignore repeated lures', () => {
  const mem = M.emptyMemory();
  assert.equal(M.lureIgnoreChance(mem, 1), 0);
  assert.ok(M.lureIgnoreChance(mem, 3) > 0.3);
  for (let i = 0; i < 20; i++) M.noteLure(mem);
  assert.equal(M.lureIgnoreChance(mem, 1), 0.8);
  assert.ok(M.learnedSummary(mem, {}, {}).some((l) => l.includes('الراديو')));
});

test('new taunt triggers fire and stay bilingual', () => {
  const mem = M.emptyMemory();
  const ctx = { mem, run: { time: 10, screams: 0, heard: 0, hour: 0 }, night: 2 };
  assert.equal(pickTaunt('start', ctx, new Set()).id, 'night2');
  for (const trig of ['salt', 'bead', 'lure', 'miss', 'tape', 'teleport', 'anklet_back']) assert.ok(pickTaunt(trig, ctx, new Set()), trig);
  assert.equal(pickTaunt('hide', { ...ctx, hideKind: 'curtain', lit: true }, new Set()).id, 'curtain_feet');
  for (const t of TAUNTS) assert.ok(t.ar && t.en, t.id);
});

test('item rooms have room for every item', () => {
  for (const it of ITEMS) for (const r of it.rooms) assert.ok(roomTiles(r).length > 2, `${it.id} in ${r}`);
  assert.ok(findPath(NEST, WELL));
  assert.ok(findPath(MONSTER_LAIR, PLAYER_START));
});
