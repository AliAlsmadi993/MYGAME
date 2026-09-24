import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base نسبي حتى تشتغل على GitHub Pages أو itch.io.
// وضع single: ملف HTML واحد بينفتح بالدبل كليك بدون سيرفر (play.html).
export default defineConfig(({ mode }) =>
  mode === 'single'
    ? { base: './', plugins: [viteSingleFile()], build: { outDir: 'dist-single' } }
    : { base: './' },
);
