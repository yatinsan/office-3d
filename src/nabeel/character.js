import * as THREE from 'three';

/**
 * Stylised 3D "Nabeel", modelled on the reference photos (IMG_5655-5657):
 * curly black hair, full beard, warm brown skin, cream short-sleeve shirt with
 * watercolour polka dots (pink / blue / sage / peach), loose rust-brown trousers,
 * black-and-white sneakers, silver watch on the left wrist, black bead bracelet on the right.
 * Faces +z. Feet at y = 0. ~1.75 m tall.
 */

function shirtTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#ece6dc';
  g.fillRect(0, 0, 512, 512);
  const cols = ['#e07b7f', '#d9636e', '#6f8fd6', '#5a7cc9', '#9fae9c', '#8fa39a', '#eaa58a', '#c9b8d6'];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 130; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 10 + rnd() * 18;
    const col = cols[Math.floor(rnd() * cols.length)];
    for (const [dx, dy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) {
      const gr = g.createRadialGradient(x + dx, y + dy, r * 0.15, x + dx, y + dy, r);
      gr.addColorStop(0, col + 'ee');
      gr.addColorStop(0.65, col + 'aa');
      gr.addColorStop(1, col + '00');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x + dx, y + dy, r, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.4, 1.4);
  return t;
}

function pantsTexture() {
  // subtle linen weave so the rust trousers don't look like plastic
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#a4603e';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 2) {
    g.fillStyle = `rgba(60,25,10,${0.05 + Math.random() * 0.07})`; g.fillRect(i, 0, 1, 128);
    g.fillStyle = `rgba(255,220,190,${0.03 + Math.random() * 0.05})`; g.fillRect(0, i, 128, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

const mat = {
  skin: new THREE.MeshStandardMaterial({ color: '#7a4d33', roughness: 0.6 }),
  hair: new THREE.MeshStandardMaterial({ color: '#16110f', roughness: 0.95 }),
  beard: new THREE.MeshStandardMaterial({ color: '#1d1512', roughness: 1 }),
  shirt: new THREE.MeshStandardMaterial({ map: shirtTexture(), roughness: 0.85 }),
  pants: new THREE.MeshStandardMaterial({ map: pantsTexture(), roughness: 0.95 }),
  shoeBlack: new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.7 }),
  shoeWhite: new THREE.MeshStandardMaterial({ color: '#efefea', roughness: 0.6 }),
  laces: new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.6 }),
  eyeWhite: new THREE.MeshStandardMaterial({ color: '#f1ece4', roughness: 0.4 }),
  eyeDark: new THREE.MeshStandardMaterial({ color: '#120c08', roughness: 0.3 }),
  lips: new THREE.MeshStandardMaterial({ color: '#5b3426', roughness: 0.6 }),
  silver: new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.9, roughness: 0.25 }),
  bead: new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: 0.35 }),
  gunMetal: new THREE.MeshStandardMaterial({ color: '#222326', metalness: 0.7, roughness: 0.35 }),
  gunGrip: new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: '#9a6a3c', roughness: 0.7 }),
  tape: new THREE.MeshStandardMaterial({ color: '#202020', roughness: 0.9 }),
};

function mesh(parent, geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  parent.add(o);
  return o;
}
const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

function buildHead(neck) {
  const head = pivot(neck, 0, 0.12, 0.01);
  const skull = mesh(head, new THREE.SphereGeometry(0.115, 24, 18), mat.skin, 0, 0.1, 0);
  skull.scale.set(0.93, 1.08, 1.0);
  // ears
  for (const s of [-1, 1]) mesh(head, new THREE.SphereGeometry(0.03, 10, 8), mat.skin, s * 0.108, 0.09, -0.005).scale.set(0.5, 1, 0.8);
  // nose
  mesh(head, new THREE.SphereGeometry(0.026, 10, 8), mat.skin, 0, 0.085, 0.112).scale.set(1.1, 0.9, 0.9);
  // eyes + brows
  for (const s of [-1, 1]) {
    mesh(head, new THREE.SphereGeometry(0.017, 10, 8), mat.eyeWhite, s * 0.042, 0.122, 0.095).scale.set(1.2, 0.8, 0.6);
    mesh(head, new THREE.SphereGeometry(0.009, 8, 6), mat.eyeDark, s * 0.042, 0.122, 0.104);
    const brow = mesh(head, new THREE.BoxGeometry(0.045, 0.011, 0.012), mat.hair, s * 0.043, 0.15, 0.1);
    brow.rotation.z = s * -0.12;
  }
  // full beard: a shell around the jaw + chin, moustache, lips peeking through
  const beard = mesh(head, new THREE.SphereGeometry(0.118, 22, 16, Math.PI / 2 - 1.45, 2.9, Math.PI * 0.48, Math.PI * 0.42), mat.beard, 0, 0.1, 0.008);
  beard.scale.set(0.98, 1.12, 1.04);
  mesh(head, new THREE.SphereGeometry(0.05, 14, 10), mat.beard, 0, 0.0, 0.07).scale.set(1.15, 0.8, 0.9); // chin tuft
  const stache = mesh(head, new THREE.CapsuleGeometry(0.011, 0.05, 4, 8), mat.beard, 0, 0.058, 0.111);
  stache.rotation.z = Math.PI / 2;
  mesh(head, new THREE.CapsuleGeometry(0.008, 0.032, 4, 8), mat.lips, 0, 0.042, 0.112).rotation.z = Math.PI / 2;
  // big curly hair: a mop of overlapping blobs, fuller on top
  const hair = pivot(head, 0, 0.1, -0.005);
  mesh(hair, new THREE.SphereGeometry(0.122, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.36), mat.hair, 0, 0.03, 0).scale.set(1.0, 1.1, 1.05);
  // back + sides of the head down to the nape
  mesh(hair, new THREE.SphereGeometry(0.124, 20, 14, Math.PI * 1.5 - 1.9, 3.8, 0, Math.PI * 0.72), mat.hair, 0, 0.0, -0.004).scale.set(1.0, 1.08, 1.04);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const curl = new THREE.IcosahedronGeometry(0.042, 1);
  for (let i = 0; i < 46; i++) {
    const u = rnd() * Math.PI * 2;
    const v = rnd() * 0.95; // 0 = crown, 1 = around the temples
    const r = 0.118 + rnd() * 0.02;
    const x = Math.sin(v * 1.45) * Math.cos(u) * r * 1.02;
    const z = Math.sin(v * 1.45) * Math.sin(u) * r * 1.05;
    const y = Math.cos(v * 1.45) * r * 1.05 + 0.03;
    if (z > 0.02 && y < 0.1) continue; // keep the forehead + face clear
    const c = mesh(hair, curl, mat.hair, x, y, z);
    const s = 0.7 + rnd() * 0.6;
    c.scale.setScalar(s);
    c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
  }
  return head;
}

function buildArm(torso, side) {
  // side: +1 = character's left (x+), -1 = right
  const shoulder = pivot(torso, side * 0.215, 0.43, 0);
  // short loose sleeve
  const sleeve = mesh(shoulder, new THREE.CylinderGeometry(0.075, 0.085, 0.2, 14), mat.shirt, side * 0.012, -0.08, 0);
  sleeve.rotation.z = side * 0.06;
  mesh(shoulder, new THREE.SphereGeometry(0.078, 14, 10), mat.shirt, 0, 0, 0);
  mesh(shoulder, new THREE.CapsuleGeometry(0.048, 0.2, 4, 12), mat.skin, 0, -0.16, 0);
  const elbow = pivot(shoulder, 0, -0.29, 0);
  mesh(elbow, new THREE.CapsuleGeometry(0.043, 0.2, 4, 12), mat.skin, 0, -0.12, 0);
  const wrist = pivot(elbow, 0, -0.25, 0);
  if (side > 0) {
    // silver watch (left wrist)
    mesh(wrist, new THREE.TorusGeometry(0.044, 0.011, 8, 18), mat.silver, 0, 0.02, 0).rotation.x = Math.PI / 2;
    mesh(wrist, new THREE.BoxGeometry(0.04, 0.012, 0.035), mat.silver, side * 0.042, 0.02, 0);
  } else {
    // black bead bracelet (right wrist)
    const beadGeo = new THREE.SphereGeometry(0.011, 8, 6);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      mesh(wrist, beadGeo, mat.bead, Math.cos(a) * 0.046, 0.02, Math.sin(a) * 0.046);
    }
  }
  const hand = pivot(wrist, 0, -0.05, 0);
  const fist = mesh(hand, new THREE.BoxGeometry(0.075, 0.09, 0.085), mat.skin, 0, -0.01, 0.005);
  fist.geometry.translate(0, 0, 0);
  mesh(hand, new THREE.CapsuleGeometry(0.016, 0.04, 4, 8), mat.skin, -side * 0.045, 0.01, 0.03).rotation.x = 0.6; // thumb
  // grip socket: weapons attach here, pointing forward (+z) out of the fist
  const grip = pivot(hand, 0, -0.01, 0.01);
  return { shoulder, elbow, wrist, hand, grip };
}

function buildLeg(hips, side) {
  const hip = pivot(hips, side * 0.11, 0, 0);
  // loose, wide trousers
  mesh(hip, new THREE.CylinderGeometry(0.095, 0.085, 0.46, 14), mat.pants, 0, -0.22, 0);
  const knee = pivot(hip, 0, -0.44, 0);
  mesh(knee, new THREE.CylinderGeometry(0.085, 0.09, 0.44, 14), mat.pants, 0, -0.21, 0);
  const ankle = pivot(knee, 0, -0.43, 0);
  // sneaker: black upper, white sole + toe cap + laces
  const foot = pivot(ankle, 0, 0, 0.04);
  mesh(foot, new THREE.BoxGeometry(0.11, 0.035, 0.29), mat.shoeWhite, 0, -0.055, 0.02);
  const upper = mesh(foot, new THREE.CapsuleGeometry(0.052, 0.17, 4, 10), mat.shoeBlack, 0, -0.01, 0.02);
  upper.rotation.x = Math.PI / 2; upper.scale.set(1.05, 1, 0.75);
  mesh(foot, new THREE.SphereGeometry(0.05, 10, 8), mat.shoeWhite, 0, -0.02, 0.12).scale.set(1.05, 0.6, 0.8);
  for (let i = 0; i < 3; i++) mesh(foot, new THREE.BoxGeometry(0.06, 0.006, 0.012), mat.laces, 0, 0.03, 0.0 + i * 0.03);
  return { hip, knee, ankle };
}

function buildGun() {
  const g = new THREE.Group();
  mesh(g, new THREE.BoxGeometry(0.035, 0.045, 0.2), mat.gunMetal, 0, 0.055, 0.07);   // slide
  mesh(g, new THREE.CylinderGeometry(0.009, 0.009, 0.03, 8), mat.gunMetal, 0, 0.055, 0.18).rotation.x = Math.PI / 2;
  const grip = mesh(g, new THREE.BoxGeometry(0.032, 0.1, 0.045), mat.gunGrip, 0, 0.0, 0.0);
  grip.rotation.x = -0.25;
  mesh(g, new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI), mat.gunMetal, 0, 0.03, 0.04).rotation.y = Math.PI / 2;
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.055, 0.2); g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

function buildStick() {
  // a solid wooden stick / bat with a taped handle
  const g = new THREE.Group();
  const shaft = mesh(g, new THREE.CylinderGeometry(0.03, 0.019, 0.85, 12), mat.wood, 0, 0, 0.36);
  shaft.rotation.x = Math.PI / 2;
  const tape = mesh(g, new THREE.CylinderGeometry(0.021, 0.021, 0.18, 12), mat.tape, 0, 0, 0.02);
  tape.rotation.x = Math.PI / 2;
  const tip = new THREE.Object3D(); tip.position.set(0, 0, 0.78); g.add(tip);
  g.userData.tip = tip;
  return g;
}

export function createCharacter() {
  const root = new THREE.Group();
  root.name = 'Nabeel';
  const body = pivot(root, 0, 0, 0);       // bobs / leans
  const hips = pivot(body, 0, 0.93, 0);
  const torso = pivot(hips, 0, 0.02, 0);
  // untucked shirt over a slightly round belly
  const shirt = mesh(torso, new THREE.CylinderGeometry(0.2, 0.215, 0.46, 20), mat.shirt, 0, 0.24, 0.0);
  shirt.scale.set(1.08, 1, 0.8);
  mesh(torso, new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat.shirt, 0, 0.46, 0).scale.set(1.08, 0.45, 0.8); // shoulders
  mesh(torso, new THREE.SphereGeometry(0.17, 16, 12), mat.shirt, 0, 0.15, 0.04).scale.set(1.1, 1, 0.85); // belly
  mesh(torso, new THREE.CylinderGeometry(0.205, 0.215, 0.12, 18), mat.shirt, 0, 0.0, 0).scale.set(1.05, 1, 0.8); // hem
  // open camp collar
  for (const s of [-1, 1]) {
    const lapel = mesh(torso, new THREE.BoxGeometry(0.08, 0.1, 0.012), mat.shirt, s * 0.05, 0.5, 0.135);
    lapel.rotation.set(-0.3, 0, s * 0.5);
  }
  mesh(torso, new THREE.CylinderGeometry(0.03, 0.04, 0.09, 3), mat.skin, 0, 0.5, 0.125).rotation.x = Math.PI; // V of the open collar
  // pants waist under the hem
  mesh(hips, new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16), mat.pants, 0, -0.04, 0).scale.set(1.05, 1, 0.8);
  const neck = pivot(torso, 0, 0.53, 0);
  mesh(neck, new THREE.CylinderGeometry(0.055, 0.062, 0.12, 12), mat.skin, 0, 0.05, 0);
  const head = buildHead(neck);
  const armL = buildArm(torso, 1);
  const armR = buildArm(torso, -1);
  const legL = buildLeg(hips, 1);
  const legR = buildLeg(hips, -1);

  const gun = buildGun();
  const stick = buildStick();
  armR.grip.add(gun, stick);
  gun.rotation.x = Math.PI / 2;   // held pointing along the forearm's "down" → forward when aimed
  stick.rotation.x = Math.PI / 2;
  gun.visible = stick.visible = false;

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  return { root, body, hips, torso, neck, head, armL, armR, legL, legR, gun, stick };
}
