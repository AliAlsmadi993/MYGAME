// نقطة البداية: القوائم، المايك، الإدخال، والحلقة الرئيسية.
import * as THREE from 'three';
import { AudioEngine } from './audio/engine.js';
import { Mic } from './audio/mic.js';
import { Mimic } from './audio/mimic.js';
import { loadMemory, clearMemory, emptyMemory } from './monster/memory.js';
import { DIFFICULTIES, NIGHTS, nightConfig } from './config.js';
import { Game } from './game.js';
import { loadProgress, clearProgress, emptyProgress, ACHIEVEMENTS, nightTwoUnlocked } from './progress.js';
import { loadSettings, saveSettings } from './settings.js';
import { TAPES } from './story/tapes.js';
import { ENDINGS } from './story/endings.js';
import { TOOLS } from './inventory.js';
import { ITEMS } from './world/map.js';
import { Clipper } from './clipper.js';
import { TwitchChat, ACTIONS } from './audience.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

const canvas = $('view');
const LOW = params.has('low');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(LOW ? 0.6 : Math.min(devicePixelRatio, 1.25));
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  if (game) {
    game.camera.aspect = innerWidth / innerHeight;
    game.camera.updateProjectionMatrix();
    game.post.setSize(innerWidth, innerHeight);
  }
}

const audio = new AudioEngine();
const mic = new Mic(audio);
const mimic = new Mimic(audio);
let mem = loadMemory();
let progress = loadProgress();
const settings = loadSettings();
let game = null;
let paused = false;
let difficulty = 'normal';
let night = 1;
let lastEnd = null;
let chat = null;
const clipper = new Clipper(canvas, audio);
const keys = {};

// ---------- الواجهة ----------
const show = (id) => {
  for (const s of ['warn', 'menu', 'book', 'calib', 'pause', 'end']) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', id !== null);
};

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

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
    document.querySelector('.bars').style.visibility = h.showBars ? '' : 'hidden';
    const names = h.carried.map((id) => ITEMS.find((i) => i.id === id)?.ar).join('، ');
    $('items').innerHTML = h.showItems
      ? `الأغراض: ${h.placed}/${h.total} بالبير<br><span class="small">${esc(names ? `معك: ${names}` : 'إيديك فاضية')}</span>`
      : `<span class="small">Tab: الأغراض</span>`;
    const bag = h.bag;
    const sig = bag.slots.map((s) => (s ? `${s.tool}${s.count}` : '-')).join() + bag.sel;
    if (sig !== this.bagSig) {
      this.bagSig = sig;
      $('bag').innerHTML = bag.slots
        .map((s, i) => `<div class="slot${i === bag.sel ? ' sel' : ''}" title="${s ? TOOLS[s.tool].ar : ''}"><small class="k">${i + 1}</small>${s ? TOOLS[s.tool].icon : ''}${s && s.count > 1 ? `<small class="n">${s.count}</small>` : ''}</div>`)
        .join('');
    }
    $('hint').textContent = h.hint ? `[E] ${h.hint}` : bag.selected ? `[G] ${TOOLS[bag.selected].ar}` : '';
    $('dot').style.display = h.hidden ? 'none' : '';
    $('hideMask').className = h.hidden ? ({ chest: 'blind', curtain: 'curtain', tank: 'tank' }[h.hidden] ?? '') : 'hidden';
    $('breath').classList.toggle('hidden', !h.breath);
    $('vote').classList.toggle('hidden', !h.vote);
    if (h.vote) $('vote').textContent = `🗳 ${Object.entries(h.vote.tally).map(([a, n]) => `${ACTIONS[a].cmd} ${n}`).join(' · ')} (${h.vote.left})`;
  },
  fade(on) {
    $('fade').classList.toggle('on', on);
  },
  toast(text) {
    const d = document.createElement('div');
    d.textContent = text;
    $('toasts').append(d);
    setTimeout(() => d.remove(), 4200);
  },
  debug(state) {
    if (DEBUG) $('dbg').textContent = `monster: ${state}`;
  },
  end(r) {
    document.exitPointerLock?.();
    $('subs').innerHTML = '';
    lastEnd = r;
    $('endTitle').textContent = r.text.title;
    $('endTaunt').textContent = r.taunt ? `«${r.taunt.ar}»` : r.text.taunt;
    const story = [];
    if (r.text.lines) story.push(`<p>${esc(r.text.lines[0])}</p><p class="en">${esc(r.text.lines[1])}</p>`);
    if (r.wiped) story.push('<p>بلا رحمة: الموت مسح ذاكرتها كلها… بتبلّش تتعرّف عليك من الصفر.</p>');
    $('endStory').innerHTML = story.join('');
    $('endStory').classList.toggle('hidden', !story.length);
    $('endAch').innerHTML = r.achievements.length
      ? `<h3>🏆 إنجازات جديدة</h3><ul>${r.achievements.map((id) => `<li>${ACHIEVEMENTS[id].ar} — <span class="small">${ACHIEVEMENTS[id].desc}</span></li>`).join('')}</ul>`
      : '';
    $('endAch').classList.toggle('hidden', !r.achievements.length);
    $('endStats').innerHTML = statRows(r).map((t) => `<li>${esc(t)}</li>`).join('');
    $('endLearned').innerHTML = (r.learned.length ? r.learned : ['لسا بتتعرّف عليك…']).map((t) => `<li>${esc(t)}</li>`).join('');
    show('end');
    updateMemInfo();
    renderNights();
    // آخر لحظات كفيديو
    const clipBtn = $('btnClip');
    if (clipBtn.href) URL.revokeObjectURL(clipBtn.href);
    clipBtn.removeAttribute('href');
    clipBtn.classList.add('hidden');
    clipper.grab().then((blob) => {
      if (!blob) return;
      clipBtn.href = URL.createObjectURL(blob);
      clipBtn.classList.remove('hidden');
    });
  },
};

function statRows(r) {
  const s = r.stats;
  return [
    `${NIGHTS[r.night].ar} · المحاولة رقم ${r.attempt}`,
    `صمدت حتى ${r.clock}`,
    `سمعتك ${s.heard} مرة`,
    mic.enabled ? `أعلى صرخة: ${Math.round(s.loudestDb + 100)} ديسيبل تقريباً` : 'بدون مايك',
    `قلّدت صوتك ${s.mimics} مرة`,
    `مخبأك المفضّل: ${r.favHide ?? 'ما تخبّيت'}`,
    ...(s.tapes.length ? [`لقيت ${s.tapes.length} شريط للجدة`] : []),
  ];
}

// بطاقة للمشاركة (قسم 21): صورة فيها نتيجة الليلة، بدون أي معلومات شخصية
function shareCard(r) {
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 630;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(600, 300, 50, 600, 315, 700);
  grd.addColorStop(0, '#1a0c0a');
  grd.addColorStop(1, '#030202');
  g.fillStyle = grd;
  g.fillRect(0, 0, 1200, 630);
  g.direction = 'rtl';
  g.textAlign = 'right';
  g.fillStyle = '#8e1b1b';
  g.font = 'bold 110px Amiri, serif';
  g.fillText('السعلوة', 1140, 140);
  g.fillStyle = '#e8dcc4';
  g.font = 'bold 54px Amiri, serif';
  g.fillText(r.text.title, 1140, 225);
  g.font = '30px "Noto Kufi Arabic", sans-serif';
  statRows(r).forEach((t, i) => g.fillText(t, 1140, 300 + i * 46));
  g.fillStyle = '#d9b8b8';
  g.font = 'italic 34px Amiri, serif';
  g.textAlign = 'left';
  g.fillText(r.taunt ? `«${r.taunt.ar}»` : r.text.taunt, 60, 580);
  c.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'salwa-night.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
}

// دفتر الجدة: الأشرطة والنهايات والإنجازات
function renderBook() {
  $('bookTapes').innerHTML = TAPES.map((t) => {
    if (!progress.tapes.includes(t.id)) return `<div class="tape locked">📼 ${esc(t.title.ar)} — لسا ما لقيته</div>`;
    const lines = t.lines.map(([ar, en]) => `<p>«${esc(ar)}»</p><p class="en">${esc(en)}</p>`).join('');
    return `<div class="tape">📼 <b>${esc(t.title.ar)}</b>${lines}<p class="note">✎ ${esc(t.note.ar)}</p></div>`;
  }).join('');
  const endIds = ['escape', 'dawn', 'true', 'secret'];
  $('bookEndings').innerHTML = endIds
    .map((id) => `<li class="${progress.endings.includes(id) ? '' : 'off'}">${progress.endings.includes(id) ? esc(ENDINGS[id].title) : '؟؟؟'}</li>`)
    .join('');
  $('bookAch').innerHTML = Object.entries(ACHIEVEMENTS)
    .map(([id, a]) => `<li class="${progress.achievements.includes(id) ? '' : 'off'}">${progress.achievements.includes(id) ? '🏆' : '🔒'} ${esc(a.ar)} — <span class="small">${esc(a.desc)}</span></li>`)
    .join('');
}

function renderNights() {
  $('nights').innerHTML = '';
  for (const n of Object.keys(NIGHTS).map(Number)) {
    const b = document.createElement('button');
    const open = n === 1 || nightTwoUnlocked(progress);
    b.textContent = open ? NIGHTS[n].ar : `🔒 ${NIGHTS[n].ar} (انجُ مرة)`;
    b.disabled = !open;
    if (!open && night === n) night = 1;
    b.classList.toggle('on', n === night);
    b.onclick = () => {
      night = n;
      renderNights();
    };
    $('nights').append(b);
  }
}

function updateMemInfo() {
  $('memInfo').textContent = mem.attempts
    ? `بتتذكّرك: ${mem.attempts} محاولة، ${mem.wins} نجاة. ${mimic.clips.length} مقطع من صوتك.`
    : 'ما بتعرفك… لسا.';
}

// أزرار الصعوبة
const DIFF_NOTES = {
  story: 'أبطأ وسمعها أضعف، والأغراض دايماً ظاهرة.',
  normal: 'التجربة المقصودة.',
  friday: 'أسرع، بتتكيّف أسرع، وبطاريات أقل.',
  merciless: 'بلا مؤشرات وبلا خرزة زرقاء. الموت بيمسح ذاكرتها… وبتبلّش من الصفر.',
};
const renderDiffNote = () => ($('diffNote').textContent = DIFF_NOTES[difficulty]);
for (const [id, d] of Object.entries(DIFFICULTIES)) {
  const b = document.createElement('button');
  b.textContent = d.ar;
  b.classList.toggle('on', id === difficulty);
  b.onclick = () => {
    difficulty = id;
    [...$('diffs').children].forEach((c) => c.classList.toggle('on', c === b));
    renderDiffNote();
  };
  $('diffs').append(b);
}
renderDiffNote();
renderNights();

// الإعدادات
const bindSetting = (el, key, prop = 'checked', parse = (v) => v) => {
  $(el)[prop] = settings[key];
  $(el).oninput = () => {
    settings[key] = parse($(el)[prop]);
    saveSettings(settings);
    applySettings();
  };
};
function applySettings() {
  audio.screamScale = settings.reduceScreams ? 0.45 : 1;
  if (game) {
    game.player.sensitivity = settings.sensitivity;
    game.player.invertY = settings.invertY;
  }
  $('micBar').style.display = settings.showMic ? '' : 'none';
  mic.gain = settings.micGain;
}
// تغيير جهاز المايك أو إعادة المعايرة: بنطفيه وبيرجع يتعاير ببداية الليلة الجاية
const resetMic = (msg) => {
  if (mic.enabled) mic.disable();
  ui.subtitle(msg, 'The microphone will be recalibrated next night.', 3);
};
async function listMics() {
  try {
    const devs = (await navigator.mediaDevices?.enumerateDevices()) ?? [];
    const sel = $('setMicDevice');
    sel.innerHTML = '<option value="">الافتراضي</option>';
    devs.filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default').forEach((d, i) => {
      const o = document.createElement('option');
      o.value = d.deviceId;
      // وضع الستريمر: بدون أسماء الأجهزة
      o.textContent = settings.streamer || !d.label ? `مايك ${i + 1}` : d.label;
      sel.append(o);
    });
    sel.value = settings.micDevice;
  } catch {
    /* ما في صلاحية لسا */
  }
}
listMics();
bindSetting('setSens', 'sensitivity', 'value', Number);
bindSetting('setInvert', 'invertY');
bindSetting('setFlash', 'reduceFlashes');
bindSetting('setScream', 'reduceScreams');
bindSetting('setMicMeter', 'showMic');
bindSetting('setStreamer', 'streamer');
bindSetting('setMicGain', 'micGain', 'value', Number);
bindSetting('setVoice', 'voiceLang', 'value');
bindSetting('setDialect', 'dialect', 'value');
bindSetting('setClip', 'clip');
bindSetting('setTwitch', 'twitch', 'value', (v) => v.trim());
bindSetting('setMicDevice', 'micDevice', 'value');
$('setMicDevice').addEventListener('input', () => resetMic('رح نشغّل المايك الجديد ونعايره بالليلة الجاية.'));
$('setStreamer').addEventListener('input', listMics);
$('btnRecalib').onclick = () => resetMic('رح نعيد المعايرة ببداية الليلة الجاية.');
applySettings();

$('btnWarnOk').onclick = () => show('menu');
$('btnBook').onclick = () => {
  renderBook();
  show('book');
};
$('btnBookBack').onclick = () => show('menu');
$('btnShare').onclick = () => lastEnd && shareCard(lastEnd);
$('btnWipeBook').onclick = () => {
  clearProgress();
  progress = emptyProgress();
  renderNights();
  ui.subtitle('انمسح دفتر الجدة.', "Grandma's notebook erased.", 3);
};
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
    // الجهاز المحفوظ ممكن ما عاد موجود: نرجع للافتراضي
    await mic.enable(settings.micDevice).catch(() => mic.enable());
    listMics();
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
  ui.bagSig = null;
  if (settings.clip) clipper.start();
  if (settings.twitch) {
    chat = new TwitchChat(settings.twitch, (user, text) => game?.chat(user, text));
    chat.connect();
  }
  const cfg = { ...nightConfig(DIFFICULTIES[difficulty], night), id: difficulty };
  game = new Game({ renderer, audio, mic, mimic, cfg, mem, progress, settings, ui });
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
  renderNights();
  show('menu');
};

function resetScene() {
  clipper.stop();
  chat?.close();
  chat = null;
  game?.monster.song?.stop();
  game = null;
  window.speechSynthesis?.cancel();
}

// ---------- الإدخال ----------
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (!game || game.state !== 'play') return;
  if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyE') game.interact();
  if (e.code === 'KeyF') game.toggleFlashlight();
  if (e.code === 'KeyC') game.player.crouch = !game.player.crouch;
  if (e.code === 'KeyG') game.useTool();
  if (e.code === 'KeyX') game.dropTool();
  const digit = /^Digit([1-4])$/.exec(e.code);
  if (digit) game.bag.select(Number(digit[1]) - 1);
});
addEventListener('wheel', (e) => {
  if (game?.state === 'play' && document.pointerLockElement === canvas) game.bag.cycle(e.deltaY > 0 ? 1 : -1);
});
addEventListener('keyup', (e) => (keys[e.code] = false));
addEventListener('mousemove', (e) => {
  if (game && document.pointerLockElement === canvas) game.player.look(e.movementX, e.movementY);
});
addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (!game || game.state !== 'play') return;
  if (document.pointerLockElement !== canvas) return canvas.requestPointerLock?.();
  if (e.button === 2) game.useTool();
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
