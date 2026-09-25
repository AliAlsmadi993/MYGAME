// المؤثرات السينمائية: توهّج خفيف، حبيبات فيلم، زوايا معتمة، وتشويه ألوان بيزيد مع الخوف.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const HorrorShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    fear: { value: 0 },
    hit: { value: 0 },
    hidden: { value: 0 },
    grain: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time, fear, hit, hidden, grain;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      // ارتجاف الصورة وقت الإمساك
      uv += (vec2(rand(vec2(time, 1.0)), rand(vec2(time, 2.0))) - 0.5) * 0.02 * hit;
      // تشويه ألوان من الأطراف، بيزيد مع الخوف
      float ca = 0.0015 + fear * 0.006 + hit * 0.02;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ca).b;
      // تدريج ألوان: ظلال مزرقّة، أضواء دافية، إشباع قليل
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, 0.72 - fear * 0.25);
      col *= mix(vec3(0.85, 0.95, 1.08), vec3(1.06, 1.0, 0.9), smoothstep(0.0, 0.5, l));
      // نبض أحمر وقت الخوف الشديد
      col.r += fear * fear * 0.04 * (0.5 + 0.5 * sin(time * 7.0));
      // زوايا معتمة
      float vig = smoothstep(0.85, 0.2, length(c) * (1.0 + fear * 0.4 + hidden * 0.8));
      col *= vig;
      // حبيبات فيلم
      float g = rand(uv * vec2(1920.0, 1080.0) + fract(time) * 100.0) - 0.5;
      col += g * (0.06 + fear * 0.04) * grain;
      // خطوط خفيفة وقت الإمساك
      col *= 1.0 - hit * 0.3 * step(0.5, fract(uv.y * 240.0 + time * 40.0));
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const render = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.3, 0.5, 0.95);
  const horror = new ShaderPass(HorrorShader);
  composer.addPass(render);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(horror);
  return {
    composer,
    uniforms: horror.uniforms,
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.resolution.set(w / 2, h / 2);
    },
    render(dt, { fear = 0, hit = 0, hidden = 0 } = {}) {
      const u = horror.uniforms;
      u.time.value += dt;
      u.fear.value += (fear - u.fear.value) * Math.min(1, dt * 3);
      u.hit.value = hit;
      u.hidden.value = hidden;
      composer.render(dt);
    },
  };
}
