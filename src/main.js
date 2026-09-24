// نقطة البداية: القوائم، المايك، الإدخال، والحلقة الرئيسية.
import * as THREE from 'three';
import { AudioEngine } from './audio/engine.js';
import { Mic } from './audio/mic.js';
import { Mimic } from './audio/mimic.js';
import { loadMemory, clearMemory, emptyMemory } from './monster/memory.js';
import { DIFFICULTIES } from './config.js';
import { Game } from './game.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);

function resize() {
  // دقة منخفضة مقصودة (أسلوب PS1)
  const scale = Math.max(1.5, innerHeight / 320);
  renderer.setSize(Math.round(innerWidth / scale), Math.round(innerHeight / scale), false);
  if (game) {
    game.camera.aspect = innerWidth / innerHeight;
    game.camera.updateProjectionMatrix();
  }
}

const audio = new AudioEngine();
const mic = new Mic(audio);
const mimic = new Mimic(audio);
let mem = loadMemory();
let game = null;
let paused = false;
let difficulty = 'normal';
const keys = {};

// ---------- الواجهة ----------
const show = (id) => {
  for (const s of ['menu', 'calib', 'pause', 'end']) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', id !== null);
};

let subTimer;
const ui = {
  subtitle(ar, en, secs = 4, monster = false) {
    $('subs').innerHTML = `<div class="ar${monster ? ' monster' : ''}"></div><div class="en"></div>`;
    $('subs').firstChild.textContent = ar;
    $('subs').lastChild.textContent = en;
    clearTimeout(subTimer);
    subTimer = setTimeout(() => ($('subs').innerHTML = ''), secs * 1000);
  },
  meter(level) {
    const el = $('mic');
    el.style.width = `${Math.min(100, (level / 2.5) * 100)}%`;
    el.classList.toggle('hot', level > 1.4);
  },
  hud(h) {
    $('clock').textContent = h.clock;
    $('battery').style.width = `${h.battery * 100}%`;
    $('stamina').style.width = `${h.stamina * 100}%`;
    $('items').innerHTML = `الأغراض: ${h.carried} معك · ${h.placed}/${h.total} بالبير<br>🔔 ${h.bells}`;
    $('hint').textContent = h.hint ? `[E] ${h.hint}` : '';
    $('dot').style.display = h.hidden ? 'none' : '';
    $('hideMask').classList.toggle('hidden', !h.hidden);
  },
  debug(state) {
    if (DEBUG) $('dbg').textContent = `monster: ${state}`;
  },
  end(r) {
    document.exitPointerLock?.();
    $('subs').innerHTML = '';
    const titles = { death: 'مسكتك', escape: 'نجوت… هالمرة', dawn: 'صاح الديك' };
    $('endTitle').textContent = titles[r.result];
    $('endTaunt').textContent = r.taunt ? `«${r.taunt.ar}»` : r.result === 'dawn' ? '«بكرة بالليل… بستناك»' : '«رح ترجع… كلهم بيرجعوا»';
    const s = r.stats;
    const rows = [
      `المحاولة رقم ${r.attempt}`,
      `صمدت حتى ${r.clock}`,
      `سمعتك ${s.heard} مرة`,
      mic.enabled ? `أعلى صرخة: ${Math.round(s.loudestDb + 100)} ديسيبل تقريباً` : 'بدون مايك',
      `قلّدت صوتك ${s.mimics} مرة`,
      `مخبأك المفضّل: ${r.favHide ?? 'ما تخبّيت'}`,
    ];
    $('endStats').innerHTML = rows.map((t) => `<li>${t}</li>`).join('');
    $('endLearned').innerHTML = (r.learned.length ? r.learned : ['لسا بتتعرّف عليك…']).map((t) => `<li>${t}</li>`).join('');
    show('end');
    updateMemInfo();
  },
};

function updateMemInfo() {
  $('memInfo').textContent = mem.attempts
    ? `بتتذكّرك: ${mem.attempts} محاولة، ${mem.wins} نجاة. ${mimic.clips.length} مقطع من صوتك.`
    : 'ما بتعرفك… لسا.';
}

// أزرار الصعوبة
for (const [id, d] of Object.entries(DIFFICULTIES)) {
  const b = document.createElement('button');
  b.textContent = d.ar;
  b.classList.toggle('on', id === difficulty);
  b.onclick = () => {
    difficulty = id;
    [...$('diffs').children].forEach((c) => c.classList.toggle('on', c === b));
  };
  $('diffs').append(b);
}
if (params.has('nomic')) $('optMic').checked = false;

$('btnDelClips').onclick = async () => {
  await mimic.clear();
  updateMemInfo();
  ui.subtitle('انحذفت كل تسجيلات صوتك.', 'All voice recordings deleted.', 3);
};
$('btnForget').onclick = () => {
  clearMemory();
  mem = emptyMemory();
  updateMemInfo();
  ui.subtitle('نسيتك… مؤقتاً.', 'She forgot you… for now.', 3);
};

async function setupMic() {
  const want = $('optMic').checked;
  mic.recordEnabled = $('optRec').checked;
  mimic.persist = $('optRec').checked;
  if (!want) {
    if (mic.enabled) mic.disable();
    return;
  }
  if (mic.enabled) return; // معايرة سابقة
  try {
    await mic.enable();
  } catch {
    ui.subtitle('ما قدرنا نشغّل المايك… رح تلعب بدون مايك.', 'Microphone unavailable, playing without it.', 5);
    return;
  }
  show('calib');
  mic.onLevel = (l) => ($('calibMeter').style.width = `${Math.min(100, l * 40)}%`);
  await mic.calibrate((phase) => {
    $('calibText').textContent = {
      silence: 'اسكت شوي… عم نسمع صوت غرفتك',
      speak: 'هلّق قول بصوتك العادي: «مين هون؟»',
      done: 'تمام… هي كمان سمعتك.',
    }[phase];
  });
  mic.onLevel = null;
  await new Promise((r) => setTimeout(r, 900));
}

async function startNight() {
  await audio.start();
  await mimic.load();
  await setupMic();
  mic.onClip = (clip) => game?.onClip(clip);
  $('micBar').classList.toggle('hidden', !mic.enabled);
  const cfg = DIFFICULTIES[difficulty];
  game = new Game({ renderer, audio, mic, mimic, cfg, mem, ui });
  window.__game = game;
  resize();
  show(null);
  game.start();
  canvas.requestPointerLock?.();
}

$('btnStart').onclick = startNight;
$('btnAgain').onclick = () => {
  resetScene();
  startNight();
};
$('btnMenu').onclick = () => {
  resetScene();
  show('menu');
};

function resetScene() {
  game?.monster.song?.stop();
  game = null;
  window.speechSynthesis?.cancel();
}

// ---------- الإدخال ----------
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (!game || game.state !== 'play') return;
  if (e.code === 'KeyE') game.interact();
  if (e.code === 'KeyF') game.toggleFlashlight();
  if (e.code === 'KeyC') game.player.crouch = !game.player.crouch;
  if (e.code === 'KeyG') game.throwBell();
});
addEventListener('keyup', (e) => (keys[e.code] = false));
addEventListener('mousemove', (e) => {
  if (game && document.pointerLockElement === canvas) game.player.look(e.movementX, e.movementY);
});
addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (!game || game.state !== 'play') return;
  if (document.pointerLockElement !== canvas) return canvas.requestPointerLock?.();
  if (e.button === 2) game.throwBell();
});
$('pause').onclick = () => canvas.requestPointerLock?.();
document.addEventListener('pointerlockchange', () => {
  if (!game || game.state !== 'play') return;
  const locked = document.pointerLockElement === canvas;
  paused = !locked && !params.has('nolock');
  $('pause').classList.toggle('hidden', !paused);
  if (paused) for (const k in keys) keys[k] = false;
});

// ---------- الحلقة ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game && !paused) game.update(dt, keys);
  requestAnimationFrame(frame);
}
addEventListener('resize', resize);
resize();
updateMemInfo();
mimic.load().then(updateMemInfo);
requestAnimationFrame(frame);
