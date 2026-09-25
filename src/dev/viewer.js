// عارض للتطوير بس (مش جزء من اللعبة): بيعرض مجسّم بإضاءة واضحة من زاوية معيّنة.
// viewer.html?m=monster&a=0.6&pose=chase|walk|cover&d=4&y=1.4
import * as THREE from 'three';
import { buildBody, animateBody } from '../monster/body.js';
import { props } from '../world/props.js';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(q.get('bg') || 0x2a2a2e);
const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 100);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 1 }));
floor.receiveShadow = true;
scene.add(floor);
scene.add(new THREE.HemisphereLight(0xbfc8d8, 0x302820, 0.8));
const key = new THREE.DirectionalLight(0xfff0dd, q.has('dark') ? 0.6 : 2.4);
key.position.set(3, 5, -4);
key.castShadow = true;
scene.add(key);
const rim = new THREE.DirectionalLight(0x8899ff, 1.2);
rim.position.set(-4, 3, 4);
scene.add(rim);

const m = q.get('m') || 'monster';
let obj;
if (m === 'monster') {
  obj = buildBody();
  const pose = q.get('pose') || 'idle';
  animateBody(obj, Number(q.get('t') || 1), { moving: pose === 'walk' || pose === 'chase', chase: pose === 'chase', searching: false, covering: pose === 'cover' });
} else obj = props[m]();
obj.traverse((o) => (o.castShadow = true));
if (q.has('redhair')) obj.traverse((o) => o.material?.alphaTest === 0.35 && (o.material = o.material.clone(), o.material.color.set(0xff0000)));
if (q.has('nohair')) obj.traverse((o) => o.material?.alphaTest === 0.35 && (o.visible = false));
scene.add(obj);
const box = new THREE.Box3().setFromObject(obj);
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());
const a = Number(q.get('a') || 0.5);
const d = Number(q.get('d') || Math.max(size.x, size.y, size.z) * 1.9);
const y = q.has('y') ? Number(q.get('y')) : center.y;
if (q.has('lz')) center.z = Number(q.get('lz'));
if (q.has('lx')) center.x = Number(q.get('lx'));
cam.position.set(center.x + Math.sin(a) * d, y + Number(q.get('up') || 0.2), center.z - Math.cos(a) * d);
cam.lookAt(center.x, y, center.z);
// flash: زي اللعبة: عتمة وكشاف من الكاميرا
if (q.has('flash')) {
  scene.background = new THREE.Color(0x010102);
  scene.fog = new THREE.FogExp2(0x020203, 0.07);
  scene.children.filter((o) => o.isLight).forEach((l) => (l.intensity *= 0.04));
  const spot = new THREE.SpotLight(0xfff1d6, 130, 26, Math.PI / 6.5, 0.55, 2);
  spot.position.copy(cam.position);
  spot.target.position.set(center.x, y, center.z);
  spot.castShadow = true;
  scene.add(spot, spot.target);
  renderer.toneMappingExposure = 1.15;
}
renderer.render(scene, cam);
window.__ready = true;
