import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base نسبي حتى تشتغل على GitHub Pages أو itch.io.
// وضع single: ملف HTML واحد بينفتح بالدبل كليك بدون سيرفر (play.html، ونسخة الكمبيوتر).
// وضع demo: النسخة التجريبية المجانية (أول ساعتين من الليلة) بمجلد dist-demo.
export default defineConfig(({ mode }) => {
  const base = { base: './', define: { __DEMO__: JSON.stringify(mode === 'demo'), __SINGLE__: JSON.stringify(mode === 'single') } };
  if (mode === 'single') return { ...base, plugins: [viteSingleFile()], build: { outDir: 'dist-single' } };
  if (mode === 'demo') return { ...base, build: { outDir: 'dist-demo' } };
  return base;
});
