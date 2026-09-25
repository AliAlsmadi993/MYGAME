// خلفية القائمة (قسم 21): البيت من برّا تحت المطر، شباك بيضوي وبينطفي، وبرق أحياناً.
import * as THREE from 'three';
import { materials } from './world/textures.js';

export function createMenuScene(renderer) {
  const M = materials();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070b);
  scene.fog = new THREE.FogExp2(0x05070b, 0.045);
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 120);
  camera.position.set(0, 1.7, 14);

  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.receiveShadow = m.castShadow = true;
    scene.add(m);
    return m;
  };
  // الأرض الموحلة والطريق
  add(new THREE.PlaneGeometry(80, 60).rotateX(-Math.PI / 2), M.cobbles, 0, 0, 0);
  // واجهة البيت: حجر، بوابة خشب، وشبابيك
  add(new THREE.BoxGeometry(18, 7, 1.2), M.stone, 0, 3.5, 0);
  add(new THREE.BoxGeometry(18.6, 0.4, 1.6), M.stone, 0, 7.1, 0);
  add(new THREE.BoxGeometry(2.6, 3.4, 0.3), M.woodDark, 0, 1.7, 0.65);
  add(new THREE.TorusGeometry(1.3, 0.12, 6, 16, Math.PI), M.stone, 0, 3.4, 0.7);
  const dark = new THREE.MeshStandardMaterial({ color: 0x06080c, roughness: 0.3 });
  const warm = new THREE.MeshStandardMaterial({ color: 0x1a0e04, emissive: 0xffa040, emissiveIntensity: 0 });
  const wins = [];
  for (const [x, y] of [[-5.5, 4.6], [-2.8, 4.6], [2.8, 4.6], [5.5, 4.6], [-5.5, 1.8], [5.5, 1.8]]) {
    const lit = x === 2.8 && y === 4.6;
    add(new THREE.PlaneGeometry(1.1, 1.5), lit ? warm : dark, x, y, 0.61);
    for (const o of [-0.3, 0, 0.3]) add(new THREE.BoxGeometry(0.05, 1.5, 0.05), M.metal, x + o, y, 0.66);
    if (lit) wins.push(x, y);
  }
  const winLight = new THREE.PointLight(0xffa040, 0, 9, 1.6);
  winLight.position.set(wins[0], wins[1], 1.6);
  scene.add(winLight);
  // شجرة يابسة
  const trunk = new THREE.Group();
  const branch = (len, rad, depth, parent) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.6, rad, len, 5).translate(0, len / 2, 0), M.woodDark);
    m.castShadow = true;
    g.add(m);
    parent.add(g);
    if (depth > 0)
      for (let i = 0; i < 3; i++) {
        const c = branch(len * 0.7, rad * 0.6, depth - 1, g);
        c.position.y = len * (0.7 + Math.random() * 0.3);
        c.rotation.set((Math.random() - 0.5) * 1.4, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 1.4);
      }
    return g;
  };
  branch(2.4, 0.2, 3, trunk);
  trunk.position.set(-8, 0, 5);
  scene.add(trunk);

  // ضو القمر والسماء
  const hemi = new THREE.HemisphereLight(0x223047, 0x080604, 0.5);
  const moon = new THREE.DirectionalLight(0x8ea6d8, 0.9);
  moon.position.set(-10, 20, 16);
  moon.castShadow = true;
  scene.add(hemi, moon);

  // المطر: خطوط نازلة بميل الريح
  const N = 1400;
  const pos = new Float32Array(N * 6);
  const drops = [];
  for (let i = 0; i < N; i++) drops.push({ x: (Math.random() - 0.5) * 40, y: Math.random() * 16, z: Math.random() * 18 - 2, v: 14 + Math.random() * 6 });
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x8898aa, transparent: true, opacity: 0.35 })));

  let t = 0;
  let flash = 0;
  let nextFlash = 6;
  let winOn = 1;
  let nextWin = 2;
  return {
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    render(dt) {
      t += dt;
      for (let i = 0; i < N; i++) {
        const d = drops[i];
        d.y -= d.v * dt;
        d.x -= 2 * dt;
        if (d.y < 0) {
          d.y = 16;
          d.x = (Math.random() - 0.5) * 40;
        }
        pos.set([d.x, d.y, d.z, d.x + 0.08, d.y + 0.5, d.z], i * 6);
      }
      rainGeo.attributes.position.needsUpdate = true;
      // الشباك: بيضوي، بيرجف، وبينطفي فجأة
      nextWin -= dt;
      if (nextWin <= 0) {
        winOn = winOn ? 0 : 1;
        nextWin = winOn ? 2 + Math.random() * 5 : 0.3 + Math.random() * 1.5;
      }
      const flicker = winOn * (0.8 + Math.sin(t * 13) * 0.1 + (Math.random() - 0.5) * 0.15);
      warm.emissiveIntensity = flicker * 1.4;
      winLight.intensity = flicker * 14;
      // البرق
      nextFlash -= dt;
      if (nextFlash <= 0) {
        flash = 0.45;
        nextFlash = 7 + Math.random() * 10;
      }
      flash = Math.max(0, flash - dt);
      const k = flash > 0.3 ? 1 : flash > 0.2 ? 0.2 : flash > 0.1 ? 0.7 : flash * 3;
      hemi.intensity = 0.5 + k * 2.5;
      moon.intensity = 0.9 + k * 6;
      // الكاميرا بتتمايل ببطء
      camera.position.x = Math.sin(t * 0.07) * 2.5;
      camera.position.y = 1.7 + Math.sin(t * 0.11) * 0.2;
      camera.lookAt(0, 3.2, 0);
      renderer.render(scene, camera);
    },
  };
}
