// بيدمج حزمة الأصوات (public/sounds) جوّا الكود لنسخة الملف الواحد (play.html ونسخة الكمبيوتر)،
// لأن فتح الملف بدبل كليك ما بيقدر يقرأ ملفات جنبه.
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../public/sounds/', import.meta.url);
const list = JSON.parse(readFileSync(new URL('pack.json', dir)));
const sounds = Object.fromEntries(list.map((f) => [f, readFileSync(new URL(f, dir)).toString('base64')]));
writeFileSync(new URL('../src/audio/embedded.gen.js', import.meta.url), `// مولّد تلقائياً من scripts/embed-sounds.mjs، لا تعدّله\nexport const SOUNDS = ${JSON.stringify(sounds)};\n`);
console.log(`embedded ${list.length} sounds`);
