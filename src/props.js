import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M, rand } from './materials.js';
import { lockerDoors } from './world/helpers.js';
import { monitorGeo, keyboardGeo, mouseGeo, bottleGeo, bladeGeo, planterGeo, flowerGeo, stemGeo } from './models.js';

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

/** Mesh from a shared (cached) geometry. */
export function part(parent, geometry, mat, x = 0, y = 0, z = 0, { shadow = true, rx = 0, ry = 0, rz = 0, s = null } = {}) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  if (s) Array.isArray(s) ? m.scale.set(...s) : m.scale.setScalar(s);
  m.castShadow = shadow; m.receiveShadow = true;
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
  // Everything stays within ±0.33 m so it fits one 0.7 m seat (matches the 24-inch monitor in suggestion 22's photo)
  // Monitor: bevelled thin-bezel shell, tapered rear housing, curved oval arm, rounded foot (src/models.js)
  part(m, monitorGeo.foot(), M.black);
  part(m, monitorGeo.arm(), M.silver);
  part(m, monitorGeo.back(), M.black);
  part(m, monitorGeo.shell(), M.black);
  plane(m, i % 3 === 2 ? M.screenDash : M.screenCode, 0.52, 0.30, 0, 0.35, -0.058);
  box(m, M.led, 0.006, 0.0025, 0.002, 0.235, 0.35 - 0.1665, -0.0585, { shadow: false }); // power LED in the chin
  // Mac mini: rounded aluminium body, dark base plinth, logo on top, front ports + LED
  const mmx = -0.26, mmz = 0.06;
  rbox(m, M.black, 0.114, 0.006, 0.114, 0.002, mmx, 0.003, mmz);                              // base plinth
  rbox(m, M.silver, 0.12, 0.03, 0.12, 0.012, mmx, 0.021, mmz);                                // body
  plane(m, M.macTop, 0.09, 0.09, mmx, 0.0365, mmz, 0, -Math.PI / 2);                          // top with logo
  box(m, M.black, 0.012, 0.004, 0.002, mmx - 0.03, 0.021, mmz + 0.0605, { shadow: false });   // front port
  box(m, M.black, 0.012, 0.004, 0.002, mmx - 0.012, 0.021, mmz + 0.0605, { shadow: false });  // front port
  box(m, M.white, 0.004, 0.004, 0.002, mmx + 0.04, 0.021, mmz + 0.0605, { shadow: false });   // status LED
  // keyboard: wedge aluminium base + individual white key caps
  part(m, keyboardGeo.base(), M.silver, 0, 0, 0, { shadow: false });
  part(m, keyboardGeo.keys(), M.white, 0, 0, 0, { shadow: false });
  // black wireless mouse: sculpted dome, button split, scroll wheel
  const mx = 0.24, mz = 0.24;
  part(m, mouseGeo.shell(), M.blackMatte, mx, 0, mz);
  box(m, M.black, 0.0015, 0.003, 0.024, mx, 0.0195, mz - 0.02, { shadow: false, rx: 0.25 }); // button split
  part(m, mouseGeo.wheel(), M.chrome, mx, 0.0185, mz - 0.024, { shadow: false });
  if (i % 3 === 0) { part(m, bottleGeo.body(), M.bottleYellow, 0.28, 0, -0.04); part(m, bottleGeo.cap(), M.black, 0.28, 0, -0.04, { shadow: false }); }
  return m;
}

/**
 * Long bench desk (light wood top, black A-frame legs). Long axis along z.
 * sides: [-1, 1] = double-sided pod, [1] or [-1] = single-sided (against a wall).
 */
export function benchDesk(parent, cx, z0, z1, { width = 1.5, seats = true, solidFn, seatW = 1.1, chairOff = 0.12, sides = [-1, 1] } = {}) {
  const g = group(parent, cx, 0, 0); g.userData.label = 'Desk';
  const len = z1 - z0, zc = (z0 + z1) / 2;
  box(g, M.greyOak, width, 0.04, len, 0, 0.75, zc);
  box(g, M.oakEdge, width + 0.004, 0.012, len + 0.004, 0, 0.734, zc, { shadow: false }); // pale edge band
  // A-frame legs at the ends and every ~2 m
  const nLegs = Math.max(2, Math.round(len / 2) + 1);
  for (let i = 0; i < nLegs; i++) {
    const lz = z0 + 0.12 + (i / (nLegs - 1)) * (len - 0.24);
    for (const s of [-1, 1]) {
      box(g, M.black, 0.05, 0.78, 0.05, s * (width / 2 - 0.22), 0.37, lz, { rz: s * 0.2 });
      box(g, M.black, 0.05, 0.78, 0.05, s * (width / 2 - 0.22), 0.37, lz, { rz: -s * 0.2 }); // crossed legs: X frame
    }
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
    // same 7 rand() calls per leaf as before so the seeded layout of everything built later stays put
    const h = height * (0.6 + rand() * 0.6);
    const light = rand() > 0.3;
    const leaf = part(g, bladeGeo(i % 5), light ? M.plant : (i % 2 ? M.plantDark : M.plantLight), (rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.2, { s: [1, h, 1] });
    leaf.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI, (rand() - 0.5) * 0.35);
  }
  return g;
}

export function pottedPlant(parent, x, z, { size = 0.45, h = 0.45, mat = M.white } = {}) {
  const g = group(parent, x, 0, z); g.userData.label = 'Plant';
  const { pot, soil, soilY } = planterGeo(size, h);
  part(g, pot, mat);
  part(g, soil, M.soil, 0, 0, 0, { shadow: false });
  snakePlant(g, 0, soilY - 0.01, 0, 11, 0.9);
  return g;
}

/** Small ceramic pot of flowers for a table top (y = table surface). Deterministic, does not use rand(). */
export function flowerPot(parent, x, y, z, { petal = M.petalPink, n = 5, scale = 1 } = {}) {
  const g = group(parent, x, y, z); g.userData.label = 'Flowers';
  g.scale.setScalar(scale);
  part(g, flowerGeo.pot(), M.ceramic);
  part(g, flowerGeo.soil(), M.soil, 0, 0, 0, { shadow: false });
  const hash = (k) => { const v = Math.sin(k * 127.1 + x * 311.7 + z * 74.7) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(i) * 0.6;
    const r = 0.025 + hash(i + 9) * 0.06, ht = 0.16 + hash(i + 3) * 0.12;
    const top = [Math.cos(a) * r, ht, Math.sin(a) * r];
    part(g, stemGeo(top), M.stem, 0, 0.1, 0, { shadow: false });
    const head = group(g, top[0], 0.1 + top[1], top[2]);
    head.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); // face outwards a little
    const np = 6;
    for (let k = 0; k < np; k++) part(head, flowerGeo.petal(), petal, 0, 0, 0, { ry: (k / np) * Math.PI * 2 + hash(i + k) * 0.2, rx: -0.35, shadow: false });
    part(head, flowerGeo.centre(), M.flowerCentre, 0, 0.003, 0, { shadow: false });
  }
  // a ring of leaves around the stems
  for (let k = 0; k < 6; k++) {
    const leaf = part(g, bladeGeo(k, { width: 0.035, thick: 0.006, bend: 0.06, twist: 0.3 }), k % 2 ? M.plant : M.plantDark, 0, 0.098, 0, { s: [1, 0.11 + hash(k + 20) * 0.05, 1], shadow: false });
    leaf.rotation.set(0.7 + hash(k + 30) * 0.3, (k / 6) * Math.PI * 2, 0, 'YXZ');
  }
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
  const cols = Math.round(len / 0.5), rows = 5;
  const cw = len / cols, ch = (h - 0.1) / rows;
  // Hollow carcass so each compartment is a real box: back panel, shelves, dividers (no solid block behind the doors)
  box(g, M.white, 0.02, h, len, -0.265, h / 2, 0);
  box(g, M.white, 0.55, 0.1, len, 0, 0.05, 0);                                  // plinth
  for (let r = 0; r <= rows; r++) box(g, M.white, 0.55, 0.02, len, 0, r === rows ? h - 0.01 : 0.1 + r * ch, 0);
  for (let c = 0; c <= cols; c++) box(g, M.white, 0.55, h, 0.02, 0, h / 2, -len / 2 + c * cw + (c === cols ? -0.01 : c === 0 ? 0.01 : 0));
  g.updateMatrixWorld(true);
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const zz = -len / 2 + (c + 0.5) * cw;
    const yy = 0.1 + (r + 0.5) * ch;
    if (rand() < 0.35) box(g, rand() < 0.5 ? M.bottleYellow : M.black, 0.22, 0.05 + rand() * 0.12, cw - 0.16, 0, 0.1 + r * ch + 0.02 + 0.03, zz, { shadow: false }); // a folder / box inside
    // The door is its own group (not merged into the static world) hinged on its -z edge; src/doors.js swings it open.
    const leaf = new THREE.Group();
    leaf.position.copy(g.localToWorld(new THREE.Vector3(0.285, yy, zz - cw / 2 + 0.01)));
    leaf.rotation.y = g.rotation.y;
    box(leaf, M.whiteGloss, 0.01, ch - 0.02, cw - 0.02, 0, 0, cw / 2 - 0.01, { shadow: false });
    box(leaf, M.metalDark, 0.02, 0.07, 0.07, 0.01, 0.08, cw - 0.09, { shadow: false, rx: Math.PI / 4 });
    lockerDoors.push({
      leaf, closed: g.rotation.y, open: g.rotation.y + 1.9,
      center: g.localToWorld(new THREE.Vector3(0.285, yy, zz)),
    });
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
