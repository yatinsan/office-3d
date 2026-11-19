import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M, rand } from './materials.js';

// ---------- primitive helpers ----------
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

/** Box with size (w,h,d) centred at (x,y,z) inside parent. */
export function box(parent, mat, w, h, d, x, y, z, { shadow = true, ry = 0, rx = 0, rz = 0 } = {}) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function cyl(parent, mat, rTop, rBot, h, x, y, z, { seg = 12, shadow = true, rx = 0, rz = 0, open = false } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, 0, rz);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function rbox(parent, mat, w, h, d, r, x, y, z) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function plane(parent, mat, w, h, x, y, z, ry = 0, rx = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, 0, 'YXZ');
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function group(parent, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  parent.add(g);
  return g;
}

// ---------- furniture ----------
/** Mesh-back office chair. Faces +z (the person sits looking toward +z). */
export function officeChair(parent, x, z, ry = 0, { exec = false } = {}) {
  const g = group(parent, x, 0, z, ry); g.userData.label = 'Chair';
  // 5-star base
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = box(g, M.black, 0.04, 0.035, 0.32, Math.sin(a) * 0.15, 0.07, Math.cos(a) * 0.15, { ry: a });
    leg.castShadow = false;
    cyl(g, M.black, 0.025, 0.025, 0.04, Math.sin(a) * 0.3, 0.03, Math.cos(a) * 0.3, { seg: 6, shadow: false });
  }
  cyl(g, M.chrome, 0.025, 0.025, 0.32, 0, 0.26, 0, { seg: 8 });
  rbox(g, M.fabric, 0.5, 0.08, 0.48, 0.03, 0, 0.47, 0);
  const backH = exec ? 0.75 : 0.55;
  // back: frame + mesh
  box(g, M.black, 0.04, 0.5, 0.04, 0, 0.62, -0.25);
  const back = box(g, M.mesh, 0.46, backH, 0.05, 0, 0.62 + backH / 2, -0.27, { rx: -0.1 });
  back.material = M.mesh;
  if (exec) box(g, M.mesh, 0.3, 0.14, 0.06, 0, 1.45, -0.33, { rx: -0.1 });
  // arms
  for (const s of [-1, 1]) {
    box(g, M.black, 0.035, 0.22, 0.035, s * 0.26, 0.6, -0.02);
    box(g, M.black, 0.06, 0.025, 0.24, s * 0.26, 0.72, 0.02);
  }
  return g;
}

/** Visitor cantilever chair (glass cabins). Faces +z. */
export function visitorChair(parent, x, z, ry = 0) {
  const g = group(parent, x, 0, z, ry); g.userData.label = 'Visitor chair';
  for (const s of [-1, 1]) {
    box(g, M.chrome, 0.025, 0.025, 0.5, s * 0.22, 0.012, 0.05);
    box(g, M.chrome, 0.025, 0.45, 0.025, s * 0.22, 0.23, 0.29, { rx: 0.05 });
  }
  box(g, M.fabric, 0.48, 0.06, 0.46, 0, 0.47, 0.05);
  box(g, M.mesh, 0.46, 0.5, 0.04, 0, 0.78, -0.2, { rx: -0.12 });
  return g;
}

/** One clean, standard seat setup: monitor on a stand facing the sitter, keyboard, mouse (+ optional bottle). */
export function workstation(g, x, z, ry, i = 0) {
  const m = group(g, x, 0.77, z, ry); m.userData.label = 'Monitor';
  box(m, M.black, 0.24, 0.012, 0.18, 0, 0.006, -0.05);          // stand foot
  box(m, M.black, 0.05, 0.3, 0.035, 0, 0.16, -0.08);            // stand neck
  box(m, M.black, 0.6, 0.36, 0.025, 0, 0.42, -0.06);            // monitor
  plane(m, i % 3 === 2 ? M.screenDash : M.screenCode, 0.57, 0.33, 0, 0.42, -0.046);
  box(m, M.blackMatte, 0.44, 0.018, 0.14, 0, 0.009, 0.22, { shadow: false }); // keyboard
  box(m, M.blackMatte, 0.06, 0.02, 0.1, 0.32, 0.01, 0.22, { shadow: false });  // mouse
  if (i % 3 === 0) cyl(m, M.bottleYellow, 0.035, 0.035, 0.24, -0.38, 0.12, 0.05, { seg: 10 });
  return m;
}

/**
 * Long bench desk (light wood top, black A-frame legs). Long axis along z.
 * sides: [-1, 1] = double-sided pod, [1] or [-1] = single-sided (against a wall).
 */
export function benchDesk(parent, cx, z0, z1, { width = 1.5, seats = true, solidFn, seatW = 1.1, chairOff = 0.12, sides = [-1, 1] } = {}) {
  const g = group(parent, cx, 0, 0); g.userData.label = 'Desk';
  const len = z1 - z0, zc = (z0 + z1) / 2;
  box(g, M.wood, width, 0.04, len, 0, 0.75, zc);
  // A-frame legs at the ends and every ~2 m
  const nLegs = Math.max(2, Math.round(len / 2) + 1);
  for (let i = 0; i < nLegs; i++) {
    const lz = z0 + 0.12 + (i / (nLegs - 1)) * (len - 0.24);
    for (const s of [-1, 1]) box(g, M.black, 0.05, 0.78, 0.05, s * (width / 2 - 0.22), 0.37, lz, { rz: s * 0.2 });
    box(g, M.black, width - 0.2, 0.05, 0.05, 0, 0.72, lz);
  }
  if (solidFn) solidFn(cx - width / 2, z0, cx + width / 2, z1);
  if (!seats) return g;
  const n = Math.max(1, Math.floor(len / seatW + 1e-6)); // 2.8 / 0.7 is 3.999… in floating point
  let k = 0;
  for (const side of sides) {
    for (let i = 0; i < n; i++) {
      const sz = z0 + (i + 0.5) * (len / n);
      // screen near the desk centre line (or the wall), facing the sitter on this side
      const sx = sides.length === 2 ? side * 0.22 : -side * (width / 2 - 0.2);
      workstation(g, sx, sz, side * Math.PI / 2, k++);
      const chairX = cx + side * (width / 2 + chairOff);
      officeChair(parent, chairX, sz, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      if (solidFn) solidFn(chairX - 0.2, sz - 0.2, chairX + 0.2, sz + 0.2);
    }
  }
  return g;
}

/** Black leather 2/3-seater sofa, back along local -z, facing +z. */
export function sofa(parent, x, z, ry = 0, seatsN = 2) {
  const g = group(parent, x, 0, z, ry); g.userData.label = 'Sofa';
  const w = seatsN * 0.75 + 0.3;
  rbox(g, M.leather, w, 0.38, 0.9, 0.06, 0, 0.24, 0);
  rbox(g, M.leather, w, 0.5, 0.22, 0.08, 0, 0.62, -0.34);
  for (const s of [-1, 1]) rbox(g, M.leather, 0.18, 0.62, 0.9, 0.06, s * (w / 2 - 0.09), 0.33, 0);
  for (let i = 0; i < seatsN; i++) {
    const sx = -w / 2 + 0.15 + 0.75 * (i + 0.5);
    rbox(g, M.leather, 0.72, 0.14, 0.62, 0.06, sx, 0.49, 0.08);
    const p = rbox(g, M.leather, 0.5, 0.4, 0.14, 0.07, sx, 0.78, -0.18);
    p.rotation.x = -0.18;
  }
  return g;
}

/** Snake plant leaves on top of a planter at local y. */
export function snakePlant(parent, x, y, z, n = 9, height = 0.8) {
  const g = group(parent, x, y, z); g.userData.label = 'Plant';
  for (let i = 0; i < n; i++) {
    const h = height * (0.6 + rand() * 0.6);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.045, h, 4), rand() > 0.3 ? M.plant : M.plantLight);
    leaf.scale.z = 0.25;
    leaf.position.set((rand() - 0.5) * 0.3, h / 2, (rand() - 0.5) * 0.2);
    leaf.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI, (rand() - 0.5) * 0.35);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

export function pottedPlant(parent, x, z, { size = 0.45, h = 0.45, mat = M.white } = {}) {
  const g = group(parent, x, 0, z); g.userData.label = 'Plant';
  box(g, mat, size, h, size, 0, h / 2, 0);
  box(g, M.soil, size - 0.06, 0.02, size - 0.06, 0, h, 0, { shadow: false });
  snakePlant(g, 0, h, 0, 11, 0.9);
  return g;
}

export function beanBag(parent, x, z, mat = M.beanbag) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), mat);
  m.scale.set(1, 0.65, 1.05);
  m.position.set(x, 0.3, z);
  m.userData.label = 'Bean bag';
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Black metal grid shelving unit over a white planter box (corridor partition). Long axis along z. */
export function shelfUnit(parent, x, z0, z1, { yellowCubbies = [] } = {}) {
  const g = group(parent, x, 0, 0); g.userData.label = 'Shelving';
  const len = z1 - z0, zc = (z0 + z1) / 2, d = 0.4, top = 2.4, base = 0.55;
  box(g, M.white, d, base, len, 0, base / 2, zc);
  const nPl = Math.max(1, Math.round(len / 1.1));
  for (let i = 0; i < nPl; i++) {
    const pz = z0 + (i + 0.5) * (len / nPl);
    box(g, M.blackMatte, 0.3, 0.32, 0.3, 0, base + 0.16, pz);
    snakePlant(g, 0, base + 0.32, pz, 7, 0.6);
  }
  // frame
  for (const zz of [z0 + 0.02, z1 - 0.02]) for (const s of [-1, 1]) box(g, M.black, 0.025, top - base, 0.025, s * d / 2, base + (top - base) / 2, zz);
  for (const y of [1.55, top]) {
    for (const s of [-1, 1]) box(g, M.black, 0.025, 0.025, len, s * d / 2, y, zc, { shadow: false });
    box(g, M.black, d, 0.012, len, 0, y - 0.01, zc, { shadow: false });
  }
  const cells = Math.max(1, Math.round(len / 0.65));
  // thin vertical posts (front + back) between cells – open frame, not solid panels
  for (let i = 1; i < cells; i++) for (const s of [-1, 1]) box(g, M.black, 0.02, top - base, 0.02, s * d / 2, base + (top - base) / 2, z0 + (i / cells) * len, { shadow: false });
  for (const c of yellowCubbies) {
    if (c.i >= cells) continue;
    const cz = z0 + (c.i + 0.5) * (len / cells);
    const y = c.row === 0 ? 1.2 : 1.9;
    box(g, M.yellow, d - 0.05, 0.45, len / cells - 0.08, 0, y, cz);
  }
  // a few decor objects
  for (let i = 0; i < cells; i++) {
    if (rand() < 0.3) box(g, M.blackMatte, 0.12, 0.15 + rand() * 0.1, 0.12, 0, 1.55 + 0.09, z0 + (i + 0.5) * (len / cells));
  }
  return g;
}

/** Linear suspended LED bar light. Long axis along x unless ry. */
export function linearLight(parent, x, z, len = 2.4, ry = 0, y = 2.6, ceiling = 3.6) {
  const g = group(parent, x, y, z, ry); g.userData.label = 'Light';
  box(g, M.black, len, 0.06, 0.08, 0, 0, 0, { shadow: false });
  plane(g, M.lightStrip, len - 0.04, 0.05, 0, -0.031, 0, 0, Math.PI / 2);
  for (const s of [-0.4, 0.4]) cyl(g, M.black, 0.003, 0.003, ceiling - y, s * len, (ceiling - y) / 2, 0, { seg: 3, shadow: false });
  return g;
}

/** Black cone pendant lamp. */
export function conePendant(parent, x, z, y = 2.2, ceiling = 3.6, scale = 1) {
  const g = group(parent, x, y, z); g.userData.label = 'Pendant light';
  cyl(g, M.black, 0.004, 0.004, ceiling - y, 0, (ceiling - y) / 2, 0, { seg: 3, shadow: false });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18 * scale, 0.26 * scale, 20, 1, true), M.black);
  shade.position.y = -0.1 * scale;
  shade.material.side = THREE.DoubleSide;
  g.add(shade);
  cyl(g, M.black, 0.02, 0.02, 0.06, 0, 0.05, 0, { seg: 8, shadow: false });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.15 * scale, 16), M.spotGlow);
  glow.rotation.x = Math.PI / 2; glow.position.y = -0.22 * scale;
  g.add(glow);
  return g;
}

/** Downlight spot set into a ceiling at height y. */
export function spot(parent, x, z, y) {
  cyl(parent, M.black, 0.05, 0.05, 0.12, x, y - 0.06, z, { seg: 10, shadow: false });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), M.spotGlow);
  glow.rotation.x = Math.PI / 2; glow.position.set(x, y - 0.121, z);
  parent.add(glow);
}

/** Wall-mounted split AC; back on local -z. */
export function splitAC(parent, x, y, z, ry = 0) {
  const g = group(parent, x, y, z, ry); g.userData.label = 'AC unit';
  rbox(g, M.white, 0.9, 0.28, 0.2, 0.05, 0, 0, 0.1);
  box(g, M.metalDark, 0.8, 0.02, 0.02, 0, -0.1, 0.2, { shadow: false });
  return g;
}

export function cassetteAC(parent, x, z, y = 3.0) {
  box(parent, M.white, 0.85, 0.12, 0.85, x, y, z, { shadow: false });
  box(parent, M.metalDark, 0.55, 0.02, 0.55, x, y - 0.065, z, { shadow: false });
}

/** Tall white lockers against a wall. Long axis along z; doors face +x (use ry to turn). */
export function lockers(parent, x, z0, z1, ry = 0, h = 2.4) {
  const len = z1 - z0;
  const g = group(parent, x, 0, (z0 + z1) / 2, ry); g.userData.label = 'Lockers';
  box(g, M.white, 0.55, h, len, 0, h / 2, 0);
  const cols = Math.round(len / 0.5), rows = 5;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const zz = -len / 2 + (c + 0.5) * (len / cols);
    const yy = 0.1 + (r + 0.5) * ((h - 0.1) / rows);
    box(g, M.whiteGloss, 0.01, (h - 0.1) / rows - 0.02, len / cols - 0.02, 0.28, yy, zz, { shadow: false });
    box(g, M.metalDark, 0.02, 0.07, 0.07, 0.29, yy + 0.08, zz + len / cols / 2 - 0.08, { shadow: false, rx: Math.PI / 4 });
  }
  return g;
}

/** Wall clock facing +z in local space. */
export function wallClock(parent, x, y, z, ry = 0) {
  const g = group(parent, x, y, z, ry); g.userData.label = 'Wall clock';
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), M.clock);
  face.position.z = 0.03;
  g.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 32), M.black);
  rim.position.z = 0.03;
  g.add(rim);
  return g;
}
