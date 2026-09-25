// شكل السعلوة: طويلة ونحيلة، ثوب ممزّق، شعر أسود طويل بيغطي الوجه، إيدين طوال بأصابع طويلة، وأقدام معكوسة.
// وجهها باتجاه -z.
import * as THREE from 'three';

function noise3(x, y, z) {
  return Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 0.5 + Math.sin(x * 4.1 + z * 3.7) * 0.3 + Math.sin(y * 7.3 + x * 2.1) * 0.2;
}

export function buildBody() {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: 1, side: THREE.DoubleSide });
  const skin = new THREE.MeshStandardMaterial({ color: 0x5e5b4e, roughness: 0.8 });
  const skinDark = new THREE.MeshStandardMaterial({ color: 0x4a463c, roughness: 0.9 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.6, side: THREE.DoubleSide });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0 });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });

  // الثوب: مقطع دوراني مع طيّات وحافة ممزّقة
  // من الحافة للرقبة: تنّورة عريضة، خصر نحيل، صدر، أكتاف، رقبة
  const prof = [[0.5, 0], [0.46, 0.35], [0.36, 0.8], [0.22, 1.2], [0.2, 1.4], [0.24, 1.7], [0.3, 1.92], [0.26, 2.02], [0.1, 2.1], [0.06, 2.12]];
  const robeGeo = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 28, 0, Math.PI * 2);
  const pos = robeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const fold = 1 + Math.sin(a * 9) * 0.06 * (1 - y / 2.1) + noise3(x, y, z) * 0.03;
    let ny = y;
    if (y < 0.05) ny = Math.max(0, (noise3(a, 1, 2) * 0.5 + 0.5) * 0.35 * Math.abs(Math.sin(a * 5)) + 0.02); // حافة ممزّقة
    // مقطع بيضاوي مثل جسم الإنسان (أعرض من الجنب)
    pos.setXYZ(i, x * fold * 1.25, ny, z * fold * 0.7);
  }
  robeGeo.computeVertexNormals();
  const robe = new THREE.Mesh(robeGeo, cloth);
  robe.castShadow = true;
  g.add(robe);

  // أقدام معكوسة (كعبها لقدّام)
  for (const s of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.24), skinDark);
    foot.position.set(s * 0.12, 0.03, 0.08);
    g.add(foot);
  }

  // الرقبة والراس
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.28, 8), skin);
  neck.position.y = 2.18;
  g.add(neck);
  const head = new THREE.Group();
  head.position.y = 2.42;
  const skullGeo = new THREE.SphereGeometry(0.15, 20, 16);
  skullGeo.scale(0.9, 1.3, 1);
  const hp = skullGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i);
    const y = hp.getY(i);
    const z = hp.getZ(i);
    // خدود غايرة وفك طويل
    const cheek = z < -0.05 && y < 0 && y > -0.12 ? 0.85 : 1;
    hp.setXYZ(i, x * cheek, y < -0.1 ? y * 1.15 : y, z);
  }
  skullGeo.computeVertexNormals();
  const skull = new THREE.Mesh(skullGeo, skin);
  skull.castShadow = true;
  head.add(skull);
  // تجاويف العيون والعيون
  const eyes = [];
  for (const s of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), black);
    socket.position.set(s * 0.05, 0.03, -0.13);
    socket.scale.set(1.2, 0.8, 0.6);
    head.add(socket);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), eyeMat);
    eye.position.set(s * 0.05, 0.03, -0.152);
    head.add(eye);
    eyes.push(eye);
  }
  // تمّ مفتوح طويل
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), black);
  mouth.scale.set(0.7, 1.6, 0.4);
  mouth.position.set(0, -0.12, -0.13);
  head.add(mouth);

  // الشعر: خصل طويلة، بعضها قدّام الوجه
  const strands = [];
  const strandGeo = new THREE.PlaneGeometry(0.06, 1, 1, 6).translate(0, -0.5, 0);
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    const front = Math.cos(a - Math.PI / 2) > 0.6; // قدّام الوجه (باتجاه -z)
    if (front && Math.random() < 0.7) continue; // فتحات بين الخصل بتبيّن الوجه
    const len = front ? 0.55 + Math.random() * 0.4 : 0.9 + Math.random() * 0.6;
    const s = new THREE.Mesh(strandGeo, hairMat);
    s.scale.set(0.8 + Math.random() * 0.8, len, 1);
    const r = 0.13;
    s.position.set(Math.sin(a) * r, 0.14, -Math.cos(a) * r * 1.05);
    s.rotation.y = -a;
    // الخصل بتنزل على الكتاف والظهر، مش عمود مستقيم
    s.rotation.x = front ? -0.06 : -0.14;
    s.rotation.z = 0;
    s.castShadow = true;
    s.userData = { base: s.rotation.clone(), phase: Math.random() * 6 };
    head.add(s);
    strands.push(s);
  }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  crown.scale.set(0.95, 1.3, 1.05);
  crown.position.y = 0.01;
  head.add(crown);
  g.add(head);

  // الإيدين: كتف، ساعد، كف، أصابع طويلة
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.36, 1.97, 0);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.6, 8).translate(0, -0.3, 0), skin);
    upper.castShadow = true;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.6;
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.6, 8).translate(0, -0.3, 0), skin);
    fore.castShadow = true;
    elbow.add(fore);
    const hand = new THREE.Group();
    hand.position.y = -0.62;
    hand.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.03), skin));
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.004, 0.2, 5).translate(0, -0.1, 0), skinDark);
      finger.position.set(-0.03 + f * 0.02, -0.05, 0);
      finger.rotation.x = -0.35;
      hand.add(finger);
    }
    elbow.add(hand);
    shoulder.add(elbow);
    // كم ممزّق
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.6, 10, 1, true).translate(0, -0.3, 0), cloth);
    shoulder.add(sleeve);
    g.add(shoulder);
    arms.push({ shoulder, elbow, side: s });
  }
  g.userData = { head, arms, strands, eyes, robe };
  return g;
}

// الحركة: مشي متقطّع، راس بيميل، شعر بيتمرجح، وبالمطاردة بتميل لقدّام وإيديها ممدودة
export function animateBody(body, t, { moving, chase, searching, covering = false }) {
  const { head, arms, strands, robe } = body.userData;
  const twitch = Math.sin(t * 13) > 0.96 ? 0.45 : 0;
  head.rotation.z = Math.sin(t * 0.7) * 0.3 + twitch;
  head.rotation.x = chase ? 0.25 : searching ? Math.sin(t * 1.5) * 0.3 : 0.1;
  head.rotation.y = searching ? Math.sin(t * 0.9) * 0.6 : 0;
  const speed = chase ? 9 : 4;
  const swing = moving ? Math.sin(t * speed) : 0;
  for (const a of arms) {
    const reach = chase ? -1.25 : 0;
    a.shoulder.rotation.x = reach + swing * 0.25 * a.side;
    a.shoulder.rotation.z = a.side * (chase ? 0.25 : 0.08);
    a.elbow.rotation.x = chase ? -0.2 + Math.sin(t * 17 + a.side) * 0.08 : -0.15;
  }
  // الضو بوجهها: إيديها الطوال عوجهها
  if (covering) {
    for (const a of arms) {
      a.shoulder.rotation.x = -2.5;
      a.shoulder.rotation.z = -a.side * 0.5;
      a.elbow.rotation.x = -1.3;
    }
    head.rotation.x = 0.5;
  }
  body.rotation.x = chase ? -0.12 : 0; // بتميل لقدّام
  robe.scale.set(1, 1 + Math.sin(t * 1.3) * 0.01, 1);
  for (const s of strands) {
    const b = s.userData.base;
    const sway = Math.sin(t * (moving ? 5 : 1.2) + s.userData.phase) * (moving ? 0.12 : 0.04);
    s.rotation.x = b.x + (chase ? 0.25 : 0) + sway;
    s.rotation.z = b.z + sway * 0.5;
  }
  body.position.y = moving ? Math.abs(Math.sin(t * speed * 0.5)) * 0.04 : 0;
}
