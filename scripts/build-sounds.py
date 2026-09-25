"""بيجهّز حزمة الأصوات الحقيقية من مصادرها (مستودعات مفتوحة) إلى public/sounds/:
قص الصمت، توحيد العلوّ، أحادي 32kHz، تقطيع الرعد والهمس، وحلقات بدون وصلة للمطر والريح.
الاستعمال: python3 scripts/build-sounds.py <مجلد المصادر>
المصادر (git clone --depth 1):
  https://github.com/Regalis11/scpcb          (CC-BY-SA 3.0)
  https://github.com/redeclipse/sounds       (ambience/morph: CC-BY 3.0)
  https://github.com/sonic-pi-net/sonic-pi   (etc/samples: CC0)
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'public' / 'sounds'
RATE = 32000


def load(rel):
    d, sr = sf.read(SRC / rel, always_2d=True)
    m = d.mean(axis=1)
    if sr != RATE:  # إعادة عيّنة خطية بسيطة
        t = np.arange(0, len(m) / sr, 1 / RATE)
        m = np.interp(t, np.arange(len(m)) / sr, m)
    return m


def trim(x, thr=0.02, pre=0.02, post=0.15):
    peak = np.abs(x).max() or 1
    idx = np.where(np.abs(x) > peak * thr)[0]
    if not len(idx):
        return x
    a = max(0, idx[0] - int(pre * RATE))
    b = min(len(x), idx[-1] + int(post * RATE))
    return x[a:b]


def norm(x, peak=0.89):
    return x * (peak / (np.abs(x).max() or 1))


def fade(x, fin=0.005, fout=0.08):
    x = x.copy()
    a = int(fin * RATE)
    b = int(fout * RATE)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b and b < len(x):
        x[-b:] *= np.linspace(1, 0, b)
    return x


def resample_speed(x, k):
    # أسرع/أعلى بـ k (للضحكة)
    t = np.arange(0, len(x) - 1, k)
    return np.interp(t, np.arange(len(x)), x)


def loop(x, xf=1.0):
    # حلقة بدون وصلة: آخر ثانية بتذوب بأولها
    n = int(xf * RATE)
    head, body, tail = x[:n], x[n:-n], x[-n:]
    w = np.linspace(0, 1, n)
    return np.concatenate([body, tail * (1 - w) + head * w])


def loudest(x, secs):
    # أعلى نافذة صوت بطول secs
    n = int(secs * RATE)
    if len(x) <= n:
        return x
    e = np.convolve(x ** 2, np.ones(RATE // 10), 'same')
    c = np.convolve(e, np.ones(n), 'valid')
    i = int(np.argmax(c))
    return x[i : i + n]


def events(x, count, before=0.4, after=6.0, gap=4.0):
    # أقوى count أحداث (ضربات رعد) مع مسافة بينها
    env = np.convolve(np.abs(x), np.ones(RATE // 20) / (RATE // 20), 'same')
    picks = []
    order = np.argsort(env)[::-1]
    for i in order:
        if all(abs(i - p) > gap * RATE for p in picks):
            picks.append(i)
        if len(picks) == count:
            break
    return [x[max(0, p - int(before * RATE)) : p + int(after * RATE)] for p in sorted(picks)]


S = 'scpcb/SFX/'
M = 'sounds/ambience/morph/'
P = 'sonic-pi/etc/samples/'
LIC = {
    'scp': ('SCP – Containment Breach (Regalis11 and contributors)', 'CC BY-SA 3.0', 'https://github.com/Regalis11/scpcb'),
    'morph': ('Q009 "morph" ambient pack, Red Eclipse', 'CC BY 3.0', 'https://github.com/redeclipse/sounds'),
    'sonic': ('Sonic Pi samples (freesound.org, public domain)', 'CC0 1.0', 'https://github.com/sonic-pi-net/sonic-pi/tree/dev/etc/samples'),
}

files = []
credits = []


def save(name, x, src, origin):
    x = fade(norm(x))
    OUT.mkdir(parents=True, exist_ok=True)
    sf.write(OUT / f'{name}.mp3', x.astype(np.float32), RATE, format='MP3')
    files.append(f'{name}.mp3')
    credits.append((f'{name}.mp3', origin, *LIC[src]))


# صوتها
save('scream', loudest(trim(load(S + 'Character/Scientist/EmilyScream.ogg')), 3.2), 'scp', 'SFX/Character/Scientist/EmilyScream.ogg')
save('laugh', trim(resample_speed(load(S + 'SCP/106/Laugh.ogg'), 1.18)), 'scp', 'SFX/SCP/106/Laugh.ogg (sped up 18%)')
w = trim(load(S + 'Room/035Chamber/Whispers1.ogg'))
for i, seg in enumerate(np.array_split(w, 4)):
    save(f'whisper_{i + 1}', trim(seg), 'scp', 'SFX/Room/035Chamber/Whispers1.ogg (cut)')
for i in (1, 2, 3):
    save(f'growl_{i}', trim(load(S + f'SCP/966/Idle{i}.ogg')), 'scp', f'SFX/SCP/966/Idle{i}.ogg')
b = trim(load(S + 'SCP/106/Breathing.ogg'))
h = len(b) // 2
save('breath_in', trim(b[:h]), 'scp', 'SFX/SCP/106/Breathing.ogg (first half)')
save('breath_out', trim(b[h:]), 'scp', 'SFX/SCP/106/Breathing.ogg (second half)')
for i in (1, 2, 3, 4):
    save(f'monster_step_{i}', trim(load(S + f'Step/SCP/StepSCP{i}.ogg')), 'scp', f'SFX/Step/SCP/StepSCP{i}.ogg')
# اللاعب
for i in range(1, 7):
    x = trim(load(S + f'Step/Step{i}.ogg'))
    save(f'step_stone_{i}', x, 'scp', f'SFX/Step/Step{i}.ogg')
for i in (1, 2, 3):
    save(f'step_dirt_{i}', trim(load(S + f'Step/StepForest{i}.ogg')), 'scp', f'SFX/Step/StepForest{i}.ogg')
save('heartbeat', trim(load(S + 'Character/D9341/Heartbeat.ogg')), 'scp', 'SFX/Character/D9341/Heartbeat.ogg')
save('gasp', trim(load(S + 'Room/Intro/ClassD/Gasp.ogg')), 'scp', 'SFX/Room/Intro/ClassD/Gasp.ogg')
for i in (1, 2):
    save(f'pant_{i}', trim(load(S + f'Character/D9341/breath{i}.ogg')), 'scp', f'SFX/Character/D9341/breath{i}.ogg')
# البيت
save('creak_1', trim(load(S + 'Door/WoodenDoorBudge.ogg')), 'scp', 'SFX/Door/WoodenDoorBudge.ogg')
save('creak_2', trim(load(S + 'Door/WoodenDoorOpen.ogg'))[: int(3.5 * RATE)], 'scp', 'SFX/Door/WoodenDoorOpen.ogg (first 3.5 s)')
save('slam', trim(load(S + 'Door/WoodenDoorClose.ogg'))[: int(2.5 * RATE)], 'scp', 'SFX/Door/WoodenDoorClose.ogg (first 2.5 s)')
save('glass', trim(load(S + 'General/GlassBreak.ogg')), 'scp', 'SFX/General/GlassBreak.ogg')
for i in (1, 2, 3):
    save(f'bell_{i}', trim(load(S + f'SCP/513/Bell{i}.ogg')), 'scp', f'SFX/SCP/513/Bell{i}.ogg')
save('radio_loop', loop(trim(load(S + 'Radio/static.ogg')), 0.3), 'scp', 'SFX/Radio/static.ogg (looped)')
save('drip', trim(load(S + 'Ambient/Room ambience/drip.ogg'))[: int(2 * RATE)], 'scp', 'SFX/Ambient/Room ambience/drip.ogg (cut)')
for i in (1, 2, 5, 7):
    save(f'sting_{i}', trim(load(S + f'Horror/Horror{i}.ogg'))[: int(5 * RATE)], 'scp', f'SFX/Horror/Horror{i}.ogg (first 5 s)')
for i in range(1, 7):
    save(f'ambient_{i}', trim(load(S + f'Ambient/General/Ambient{i}.ogg')), 'scp', f'SFX/Ambient/General/Ambient{i}.ogg')
# الطقس
save('rain_loop', loop(load(M + 'rain.ogg')), 'morph', 'ambience/morph/rain.ogg (looped)')
save('wind_loop', loop(load(M + 'wind1.ogg')), 'morph', 'ambience/morph/wind1.ogg (looped)')
for i, seg in enumerate(events(load(M + 'stormbolts.ogg'), 4)):
    save(f'thunder_{i + 1}', trim(seg, thr=0.01), 'morph', 'ambience/morph/stormbolts.ogg (single bolt)')
# CC0
save('teleport', trim(load(P + 'ambi_dark_woosh.flac')), 'sonic', 'ambi_dark_woosh.flac')
save('knock', trim(load(P + 'perc_door.flac')), 'sonic', 'perc_door.flac')

(OUT / 'pack.json').write_text(json.dumps(files, indent=0) + '\n')
lines = ['# مصادر الأصوات / Sound credits', '', 'كل الأصوات بهالمجلد مأخوذة من مصادر مفتوحة، ومعدّلة (قص، توحيد علوّ، تحويل لأحادي). رخصها بتسمح بالاستعمال التجاري بشرط ذكر المصدر. ملفات CC BY-SA بتضل تحت نفس الرخصة.', '', 'All sounds here come from open sources and were modified (trimmed, normalized, converted to mono). Licenses allow commercial use with attribution; CC BY-SA files remain under CC BY-SA.', '', '| File | Original | Source | License |', '|---|---|---|---|']
for f, orig, src, lic, url in credits:
    lines.append(f'| {f} | {orig} | [{src}]({url}) | {lic} |')
(OUT / 'CREDITS.md').write_text('\n'.join(lines) + '\n')
total = sum((OUT / f).stat().st_size for f in files)
print(len(files), 'files', round(total / 1e6, 2), 'MB')
