import * as THREE from 'three';
import { M, rand } from '../materials.js';
import { box, cyl, snakePlant, pottedPlant } from '../props.js';
import { addBox } from '../colliders.js';
import { slab, LOBBY_CEIL, SHELF_Z, TERRACE_Z1 } from './helpers.js';

const D = TERRACE_Z1; // terrace now runs past the meeting room (suggestion 13)

/**
 * West terrace / balcony, rebuilt from photos IMG_5658–5668:
 * - beige stone tiles, low concrete curb + frameless glass balustrade with a steel handrail
 * - lavender-pink polycarbonate roof sloping outward on rusty grey steel rafters, track spots on a centre pipe
 * - thin galvanised posts at the outer edge, the middle ones wrapped in coir rope with hanging coir pots
 * - ribbed cladding above the windows, potted plants along the facade
 * - north end: sloping stair beam over a mesh vertical garden
 * - middle: hanging macramé egg chair + bar ledge with tall black stools along the rail
 * - glass double door into the meeting room (src/doors.js), then the pantry corner at the far end
 *   (counter, kettles, sink + AC on the plaster facade, wooden table + stools, water cans, palms)
 */
export const TX = -3.6;          // outer edge of the terrace slab
const CURB = 0.25;               // concrete upstand under the glass
const ROOF_IN = 3.85, SLOPE = 0.12, ROOF_OUT = -3.95; // roof height at the facade, fall per metre outward
const roofY = (x) => ROOF_IN + x * SLOPE;

const std = (o) => new THREE.MeshStandardMaterial(o);
const T = {
  curb: std({ color: '#6f6c66', roughness: 0.95 }),
  steel: std({ color: '#8e8d88', roughness: 0.55, metalness: 0.55 }),
  rust: std({ color: '#9b8a78', roughness: 0.7, metalness: 0.35 }),
  galv: std({ color: '#a9aca9', roughness: 0.45, metalness: 0.6 }),
  steelRail: std({ color: '#c4c7c9', roughness: 0.22, metalness: 0.95 }),
  poly: new THREE.MeshStandardMaterial({ color: '#d2a8c8', transparent: true, opacity: 0.42, roughness: 0.35, depthWrite: false, side: THREE.DoubleSide }),
  glass: new THREE.MeshStandardMaterial({ color: '#d6e6e2', transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  clad: std({ color: '#cfc6b2', roughness: 0.6, metalness: 0.25 }),
  plaster: std({ color: '#e9e6df', roughness: 0.95 }),
  coir: std({ color: '#6e4b30', roughness: 1 }),
  potWhite: std({ color: '#efede8', roughness: 0.55 }),
  leafDark: std({ color: '#355e2a', roughness: 0.75 }),
  leafMid: std({ color: '#5e8a3a', roughness: 0.75 }),
  leafPale: std({ color: '#a9bf83', roughness: 0.75 }),
  leafRed: std({ color: '#a6473a', roughness: 0.75 }),
  palm: std({ color: '#4f7a2f', roughness: 0.8, side: THREE.DoubleSide }),
  macrame: std({ color: '#6d5a4b', roughness: 1, side: THREE.DoubleSide }),
  cushion: std({ color: '#d9cdb8', roughness: 1 }),
  tableTop: std({ color: '#8a6142', roughness: 0.55 }),
  rattan: std({ color: '#7b6c60', roughness: 0.9 }),
  water: new THREE.MeshStandardMaterial({ color: '#a9cde8', transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false }),
  capBlue: std({ color: '#2464b0', roughness: 0.5 }),
  counterTop: std({ color: '#222222', roughness: 0.35, metalness: 0.2 }),
  acGrey: std({ color: '#d9d9d4', roughness: 0.6 }),
};

// Woven doormat (photo IMG_5667: multicoloured rag rug).
const rugTex = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  const cols = ['#a4553f', '#d9b26a', '#5b6f8a', '#c98a5a', '#7a8a5a', '#e6d6b8', '#8a4a5a'];
  for (let y = 0; y < 256; y += 3) { g.fillStyle = cols[Math.floor(rand() * cols.length)]; g.fillRect(0, y, 128, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
T.rug = std({ map: rugTex, roughness: 1 });

// Net pattern for the macramé chair + mesh green wall (alpha tested).
const netTex = (cell = 16) => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.lineWidth = 3;
  for (let i = -128; i <= 256; i += cell) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke();
    g.beginPath(); g.moveTo(i, 128); g.lineTo(i + 128, 0); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const macrameNet = netTex(22); macrameNet.repeat.set(5, 3);
T.macrameNet = std({ color: '#6d5a4b', alphaMap: macrameNet, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide });
const gridTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 3); g.fillRect(0, 0, 3, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})();

function group(parent, x, y, z, label) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (label) g.userData.label = label;
  parent.add(g);
  return g;
}

/** Cylinder along z from z0 to z1. */
function rodZ(parent, mat, r, x, y, z0, z1, seg = 8) {
  return cyl(parent, mat, r, r, z1 - z0, x, y, (z0 + z1) / 2, { rx: Math.PI / 2, seg, shadow: false });
}

/** Leafy clump (low-poly blobs) sitting at y. */
function bush(parent, x, y, z, r, mats, n = 7) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mats[i % mats.length]);
    const s = r * (0.45 + rand() * 0.4);
    m.scale.set(s, s * (0.7 + rand() * 0.5), s);
    const a = rand() * Math.PI * 2, d = rand() * r * 0.6;
    m.position.set(x + Math.cos(a) * d, y + s * 0.8 + rand() * r * 0.6, z + Math.sin(a) * d);
    m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
  }
}

/** Drooping fern / palm fronds radiating from a point. */
function fronds(parent, x, y, z, { n = 12, len = 0.6, mat = T.leafMid, droop = 0.5, w = 0.12 } = {}) {
  for (let i = 0; i < n; i++) {
    const f = new THREE.Group();
    f.position.set(x, y, z);
    f.rotation.y = (i / n) * Math.PI * 2 + rand() * 0.4;
    parent.add(f);
    const tilt = droop * (0.5 + rand());
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(len, w), mat);
    leaf.position.set(Math.cos(tilt) * len / 2, Math.sin(-tilt + 0.9) * len / 2 - 0.05, 0);
    leaf.rotation.set(Math.PI / 2 - 0.3, 0, -tilt + 0.9 - Math.PI / 4);
    leaf.castShadow = true;
    f.add(leaf);
  }
}

/** Round white pot with a plant. kind: snake | bush | fern | variegated | croton | tree */
function roundPot(parent, x, z, kind = 'snake', { r = 0.18, h = 0.32 } = {}) {
  const g = group(parent, x, 0, z, 'Plant');
  cyl(g, T.potWhite, r, r * 0.78, h, 0, h / 2, 0, { seg: 16 });
  cyl(g, M.soil, r - 0.02, r - 0.02, 0.01, 0, h - 0.01, 0, { seg: 12, shadow: false });
  if (kind === 'snake') snakePlant(g, 0, h, 0, 10, 0.75);
  else if (kind === 'bush') bush(g, 0, h, 0, r * 1.6, [T.leafDark, T.leafMid]);
  else if (kind === 'variegated') bush(g, 0, h, 0, r * 1.7, [T.leafPale, T.leafMid, T.leafPale], 9);
  else if (kind === 'croton') bush(g, 0, h, 0, r * 1.4, [T.leafRed, T.leafMid, T.leafRed]);
  else if (kind === 'fern') fronds(g, 0, h + 0.08, 0, { n: 16, len: 0.55, mat: T.leafPale, droop: 0.9, w: 0.16 });
  else if (kind === 'tree') {
    cyl(g, M.woodDark, 0.015, 0.02, 0.9, 0, h + 0.45, 0, { seg: 5 });
    bush(g, 0, h + 0.55, 0, 0.35, [T.leafMid, T.leafPale, T.leafDark], 8);
  }
  addBox(x - r, z - r, x + r, z + r);
  return g;
}

/** Hanging coir pot / basket. */
function hangingPot(parent, x, z, top, y, mat = T.coir) {
  cyl(parent, M.blackMatte, 0.004, 0.004, top - y, x, (top + y) / 2, z, { seg: 3, shadow: false });
  cyl(parent, mat, 0.07, 0.11, 0.3, x, y - 0.15, z, { seg: 10 });
}

/** Tall black bar stool with a low back. */
function barStool(parent, x, z, ry = 0) {
  const g = group(parent, x, 0, z, 'Bar stool');
  g.rotation.y = ry;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(g, M.black, 0.025, 0.78, 0.025, sx * 0.15, 0.39, sz * 0.15, { rx: sz * 0.05, rz: -sx * 0.05 });
  box(g, M.black, 0.34, 0.04, 0.34, 0, 0.78, 0);
  for (const sz of [-1, 1]) box(g, M.black, 0.025, 0.36, 0.025, 0.15, 0.96, sz * 0.13);
  box(g, M.black, 0.025, 0.06, 0.3, 0.15, 1.12, 0);
  box(g, M.black, 0.3, 0.02, 0.02, 0, 0.3, 0.15, { shadow: false });
  box(g, M.black, 0.3, 0.02, 0.02, 0, 0.3, -0.15, { shadow: false });
}

/** Low round stool with a black ring frame and wooden seat (pantry). */
function pantryStool(parent, x, z, h = 0.62) {
  const g = group(parent, x, 0, z, 'Stool');
  cyl(g, T.tableTop, 0.17, 0.17, 0.04, 0, h, 0, { seg: 16 });
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    box(g, M.black, 0.02, h, 0.02, Math.cos(a) * 0.14, h / 2, Math.sin(a) * 0.14, { rz: Math.cos(a) * 0.1, rx: -Math.sin(a) * 0.1 });
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 4, 20), M.black);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.22;
  g.add(ring);
  addBox(x - 0.18, z - 0.18, x + 0.18, z + 0.18);
}

export function buildTerrace(root) {
  const g = group(root, 0, 0, 0, 'Terrace');
  const len = D;

  // ---- Floor, curb, glass balustrade ----
  slab(g, M.floorTerrace, TX, 0, 0, D, 0.0);
  box(g, T.curb, 0.3, CURB, len, TX + 0.15, CURB / 2, len / 2);
  box(g, T.curb, 0.32, 0.03, len, TX + 0.15, CURB + 0.015, len / 2, { shadow: false }); // coping
  addBox(TX - 0.1, 0, TX + 0.32, D);
  addBox(TX, -0.15, 0, 0);
  addBox(TX, D, 0, D + 0.15);
  const gx = TX + 0.1, railTop = CURB + 1.0;
  for (let z = 0; z < len - 0.01; z += 1.2) {
    const w = Math.min(1.2, len - z) - 0.02;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, railTop - CURB - 0.06), T.glass);
    p.position.set(gx, (CURB + railTop) / 2, z + 0.01 + w / 2);
    p.rotation.y = Math.PI / 2; p.renderOrder = 2;
    g.add(p);
    box(g, M.chrome, 0.03, 0.06, 0.05, gx, railTop - 0.04, z + 0.06, { shadow: false }); // glass clamps
    box(g, M.chrome, 0.03, 0.06, 0.05, gx, CURB + 0.06, z + 0.06, { shadow: false });
  }
  rodZ(g, T.steelRail, 0.028, gx, railTop + 0.03, 0, len, 12);              // round handrail on the glass
  rodZ(g, T.galv, 0.035, TX + 0.42, 0.55, 0.4, len - 0.4, 10);              // conduit pipe along the inside of the rail
  for (let z = 1.5; z < len; z += 3.1) box(g, T.galv, 0.03, 0.3, 0.03, TX + 0.42, 0.4, z, { shadow: false });
  for (const z of [0.12, len - 0.12]) {                                     // stainless end posts
    cyl(g, T.steelRail, 0.025, 0.025, railTop, TX + 0.35, railTop / 2, z, { seg: 10 });
    box(g, T.steelRail, 0.25, 0.04, 0.04, TX + 0.23, railTop + 0.03, z, { shadow: false });
  }

  // ---- Ribbed cladding above the windows ----
  const cladFrom = (z) => (z < SHELF_Z ? LOBBY_CEIL : 2.8);
  for (const [z0, z1] of [[0, SHELF_Z], [SHELF_Z, D]]) { // workspace, meeting room + plaster facade share the 2.8 m line
    const y0 = cladFrom(z0), h = ROOF_IN + 0.2 - y0;
    box(g, T.clad, 0.03, h, z1 - z0, -0.09, y0 + h / 2, (z0 + z1) / 2, { shadow: false });
    for (let z = z0 + 0.08; z < z1; z += 0.16) box(g, T.clad, 0.025, h, 0.035, -0.115, y0 + h / 2, z, { shadow: false });
    box(g, T.steel, 0.12, 0.08, z1 - z0, -0.12, y0 + 0.04, (z0 + z1) / 2, { shadow: false });
  }

  // ---- Roof: translucent polycarbonate on rusty steel ----
  const span = -ROOF_OUT, rz = Math.atan2(span * SLOPE, span), rl = span / Math.cos(rz);
  const midX = ROOF_OUT / 2;
  const sheet = box(g, T.poly, rl, 0.012, len + 0.4, midX, roofY(midX) + 0.06, len / 2, { shadow: false, rz });
  sheet.renderOrder = 3;
  for (let z = 0; z <= len + 0.01; z += len / 16) {
    box(g, Math.round(z / (len / 16)) % 3 === 1 ? T.rust : T.steel, rl, 0.1, 0.06, midX, roofY(midX), z, { rz });   // rafters
  }
  for (const x of [-0.35, -1.25, -2.15, -3.05, -3.85]) rodZ(g, T.steel, 0.025, x, roofY(x) + 0.03, -0.2, len + 0.2);
  box(g, T.steel, 0.16, 0.14, len + 0.4, ROOF_OUT, roofY(ROOF_OUT) - 0.02, len / 2);    // outer gutter beam
  box(g, T.steel, 0.12, 0.12, len, -0.18, ROOF_IN - 0.06, len / 2);                    // wall plate
  // centre pipe with track spotlights
  const px = -1.8, py = roofY(px) - 0.28;
  rodZ(g, T.galv, 0.02, px, py, 0, len);
  for (let z = 0.5; z < len; z += 1.55) {
    cyl(g, T.galv, 0.006, 0.006, 0.26, px, py + 0.13, z, { seg: 4, shadow: false });
    cyl(g, M.white, 0.055, 0.045, 0.1, px, py - 0.07, z, { seg: 12, shadow: false });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), M.spotGlow);
    glow.rotation.x = Math.PI / 2; glow.position.set(px, py - 0.121, z);
    g.add(glow);
  }

  // ---- Outer posts (galvanised; middle ones wrapped in coir rope) ----
  const postX = TX + 0.36;
  for (let i = 0; i <= 8; i++) {
    const z = 0.25 + i * (len - 0.5) / 8;
    const top = roofY(postX);
    cyl(g, T.galv, 0.045, 0.045, top - CURB, postX, (top + CURB) / 2, z, { seg: 10 });
    if (i >= 3 && i <= 5) {
      cyl(g, T.coir, 0.085, 0.085, 2.5, postX, CURB + 1.3, z, { seg: 12 });
      for (const y of [0.9, 1.6, 2.3]) cyl(g, T.plaster, 0.088, 0.088, 0.06, postX, y, z, { seg: 12, shadow: false });
      hangingPot(g, postX + 0.16, z + 0.05, top - 0.1, 2.75);
    }
    addBox(postX - 0.09, z - 0.09, postX + 0.09, z + 0.09);
  }

  // ---- Plants along the facade ----
  const fx = -0.32;
  const facadePlants = [
    [1.4, 'tree'], [1.95, 'fern'], [2.6, 'croton'], [3.2, 'variegated'],
    [4.35, 'snake'], [7.0, 'snake'], [7.5, 'variegated'], [8.0, 'bush'], [8.5, 'snake'],
    [10.6, 'bush'], [11.1, 'snake'], [11.6, 'variegated'], [12.1, 'snake'],
    [13.6, 'tree'], [14.6, 'bush'], [16.3, 'snake'], [17.2, 'variegated'], [18.2, 'snake'], [19.3, 'croton'],
    [22.0, 'fern'],
  ];
  for (const [z, kind] of facadePlants) roundPot(g, fx - (kind === 'fern' ? 0.1 : 0), z, kind, kind === 'tree' ? { r: 0.2, h: 0.34 } : {});
  roundPot(g, TX + 0.75, 12.0, 'variegated', { r: 0.22, h: 0.4 });     // big square-ish pot by the bar ledge
  roundPot(g, TX + 0.75, 8.3, 'tree', { r: 0.18, h: 0.34 });
  for (const z of [6.2, 9.9, 13.0]) hangingPot(g, -0.55, z, ROOF_IN - 0.1, 2.55, T.potWhite);

  // doormat at the lounge balcony door + a second rag rug further along
  box(g, T.rug, 0.55, 0.012, 0.85, -0.45, 0.007, 5.7, { shadow: false });
  box(g, T.rug, 0.5, 0.012, 0.8, -0.4, 0.007, 20.8, { shadow: false, ry: 0.08 }); // at the meeting room door

  // ---- Hanging macramé egg chair ----
  {
    const cx = -0.95, cz = 9.3, seatY = 0.55;
    const c = group(g, cx, 0, cz, 'Hanging chair');
    cyl(c, T.coir, 0.012, 0.012, roofY(cx) - 1.75, 0, (roofY(cx) + 1.75) / 2, 0, { seg: 4 });
    const hub = new THREE.Vector3(0, 1.75, 0);
    for (const a of [-0.6, 0.6, Math.PI - 0.5, Math.PI + 0.5]) {
      const end = new THREE.Vector3(Math.cos(a) * 0.46, seatY + 0.5, Math.sin(a) * 0.46);
      const dir = end.clone().sub(hub);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, dir.length(), 4), T.coir);
      r.position.copy(hub).addScaledVector(dir, 0.5);
      r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      c.add(r);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 32), T.macrame);
    ring.position.set(0, seatY + 0.5, 0); ring.rotation.x = Math.PI / 2;
    c.add(ring);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.42), T.macrameNet);
    shell.position.y = seatY + 0.42;
    shell.castShadow = true;
    c.add(shell);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 10, -Math.PI / 2, Math.PI, 0.15 * Math.PI, 0.38 * Math.PI), T.macrameNet);
    back.position.y = seatY + 0.42; back.castShadow = true;
    c.add(back);
    cyl(c, T.cushion, 0.36, 0.36, 0.1, 0, seatY + 0.07, 0, { seg: 20 });
    for (let i = 0; i < 14; i++) { // tassels
      const a = i / 14 * Math.PI * 2;
      cyl(c, T.macrame, 0.012, 0.004, 0.1, Math.cos(a) * 0.3, seatY - 0.02, Math.sin(a) * 0.3, { seg: 4, shadow: false });
    }
    addBox(cx - 0.45, cz - 0.45, cx + 0.45, cz + 0.45);
  }

  // ---- Bar ledge along the rail with tall stools ----
  {
    const z0 = 10.3, z1 = 13.4, lx = TX + 0.58;
    box(g, T.tableTop, 0.38, 0.05, z1 - z0, lx, 1.05, (z0 + z1) / 2);
    for (const z of [z0 + 0.15, (z0 + z1) / 2, z1 - 0.15]) {
      box(g, M.black, 0.04, 1.03, 0.04, lx - 0.05, 0.52, z);
      box(g, M.black, 0.3, 0.03, 0.03, lx, 0.98, z, { shadow: false });
    }
    addBox(lx - 0.2, z0, lx + 0.2, z1);
    for (const z of [10.8, 11.6, 12.4, 13.1]) barStool(g, lx + 0.5, z, Math.PI);
    for (const z of [10.8, 11.6, 12.4, 13.1]) addBox(lx + 0.33, z - 0.18, lx + 0.67, z + 0.18);
  }

  // ---- North end: sloping stair beam over a mesh vertical garden ----
  {
    const ez = 0.06;
    const ax = -0.3, ay = ROOF_IN + 0.1, bx = TX + 0.45, by = 0.9;  // beam from high at the facade down to the rail
    const bl = Math.hypot(ax - bx, ay - by), ang = Math.atan2(ay - by, ax - bx);
    box(g, T.curb, bl, 0.42, 0.3, (ax + bx) / 2, (ay + by) / 2, ez + 0.1, { rz: ang });
    const tri = new THREE.Shape([new THREE.Vector2(bx, 0), new THREE.Vector2(ax, 0), new THREE.Vector2(ax, ay), new THREE.Vector2(bx, by)]);
    const endWall = new THREE.Mesh(new THREE.ShapeGeometry(tri), std({ color: '#cfccc4', roughness: 0.95, side: THREE.DoubleSide }));
    endWall.position.z = ez - 0.04; endWall.receiveShadow = true;
    g.add(endWall);
    box(g, T.curb, ax - bx, 0.3, 0.3, (ax + bx) / 2, 0.15, ez + 0.1);                // plinth under the mesh
    box(g, T.plaster, 0.35, ROOF_IN, 0.2, -0.17, ROOF_IN / 2, ez + 0.05);              // plaster pier at the facade corner
    // mesh panel under the beam (alpha-tested grid), black planter pockets with spiky plants
    const mx0 = -2.75, mx1 = -0.4, mH = 2.55;
    const grid = gridTex.clone(); grid.needsUpdate = true; grid.repeat.set((mx1 - mx0) / 0.1, mH / 0.1);
    const meshMat = std({ color: '#2a2a2a', alphaMap: grid, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
    const mp = new THREE.Mesh(new THREE.PlaneGeometry(mx1 - mx0, mH), meshMat);
    mp.position.set((mx0 + mx1) / 2, mH / 2, ez + 0.02);
    g.add(mp);
    for (const x of [mx0, (mx0 + mx1) / 2, mx1]) box(g, M.black, 0.03, mH, 0.03, x, mH / 2, ez + 0.03, { shadow: false });
    box(g, M.black, mx1 - mx0, 0.03, 0.03, (mx0 + mx1) / 2, mH, ez + 0.03, { shadow: false });
    const beamY = (x) => by + (x - bx) * (ay - by) / (ax - bx);
    for (let row = 0; row < 5; row++) {
      const y = 0.45 + row * 0.42;
      for (let x = mx0 + 0.2; x < mx1 - 0.1; x += 0.36) {
        if (y > beamY(x) - 0.35) continue;
        box(g, M.blackMatte, 0.2, 0.13, 0.1, x, y, ez + 0.08, { shadow: false });
        snakePlant(g, x, y + 0.06, ez + 0.1, 6, 0.32).rotation.x = 0.25;
      }
    }
    roundPot(g, -0.75, 0.45, 'tree', { r: 0.17, h: 0.3 });
    roundPot(g, -1.15, 0.4, 'bush');
  }

  // ---- South end: pantry corner ----
  {
    const ez = D - 0.12;
    box(g, T.plaster, -TX, 1.15, 0.24, TX / 2, 0.575, ez);                    // end parapet
    box(g, T.plaster, -TX, 0.5, 0.6, TX / 2, 1.4, D + 0.3);                  // planter box beyond it
    for (let x = TX + 0.4; x < -0.2; x += 0.7) {
      cyl(g, M.woodDark, 0.03, 0.04, 0.9, x, 2.05, D + 0.3, { seg: 6 });
      fronds(g, x, 2.45 + rand() * 0.3, D + 0.3, { n: 9, len: 0.9, mat: T.palm, droop: 0.45, w: 0.22 });
    }
    // wash basin + outdoor AC unit on the plaster facade past the meeting room
    box(g, M.whiteGloss, 0.4, 0.14, 0.45, -0.42, 0.86, 23.3);              // wash basin
    cyl(g, M.chrome, 0.012, 0.012, 0.14, -0.27, 1.0, 23.3, { seg: 6, shadow: false });
    addBox(-0.64, 23.05, -0.2, 23.55);
    { const ac = group(g, -0.42, 2.25, 24.2, 'AC outdoor unit');
      box(ac, T.acGrey, 0.32, 0.55, 0.78, 0, 0, 0);
      const fan = new THREE.Mesh(new THREE.CircleGeometry(0.2, 18), M.metalDark);
      fan.rotation.y = -Math.PI / 2; fan.position.set(-0.161, 0, -0.1);
      ac.add(fan);
      box(ac, M.metalDark, 0.3, 0.03, 0.3, 0.05, -0.29, 0, { shadow: false }); }
    // counter along the parapet: white cabinets, black top, kettles, open shelf
    const cx0 = -2.45, cx1 = -0.6, cz = ez - 0.42;
    box(g, M.white, cx1 - cx0, 0.86, 0.58, (cx0 + cx1) / 2, 0.43, cz);
    box(g, T.counterTop, cx1 - cx0 + 0.04, 0.04, 0.62, (cx0 + cx1) / 2, 0.88, cz);
    for (let x = cx0 + 0.45; x < cx1; x += 0.45) box(g, M.metalDark, 0.008, 0.78, 0.005, x, 0.43, cz - 0.292, { shadow: false });
    box(g, M.blackMatte, 0.4, 0.5, 0.02, -1.75, 0.45, cz - 0.29, { shadow: false }); // open shelf
    for (let i = 0; i < 6; i++) box(g, [M.bottleTeal, M.red, M.cream][i % 3], 0.04, 0.2 + rand() * 0.06, 0.15, -1.9 + i * 0.055, 0.35, cz - 0.2, { shadow: false });
    for (const [x, m] of [[-2.25, M.chrome], [-1.98, M.black], [-1.2, M.chrome]]) {
      cyl(g, m, 0.07, 0.085, 0.2, x, 1.0, cz, { seg: 14 });
      box(g, M.black, 0.03, 0.12, 0.03, x + 0.09, 1.0, cz, { shadow: false });
    }
    box(g, M.blackMatte, 0.18, 0.08, 0.18, -1.55, 0.94, cz, { shadow: false });      // induction plate
    addBox(cx0, cz - 0.3, cx1, D);
    // tall wooden table with stools
    const tx = -1.75, tz = 22.95;
    box(g, T.tableTop, 0.72, 0.05, 1.4, tx, 0.95, tz);
    for (const s of [-1, 1]) {
      box(g, M.black, 0.04, 0.95, 0.04, tx + s * 0.25, 0.48, tz - 0.5, { rz: s * 0.18 });
      box(g, M.black, 0.04, 0.95, 0.04, tx + s * 0.25, 0.48, tz + 0.5, { rz: s * 0.18 });
    }
    box(g, M.black, 0.04, 0.04, 1.0, tx, 0.3, tz, { shadow: false });
    addBox(tx - 0.36, tz - 0.7, tx + 0.36, tz + 0.7);
    for (const [x, z] of [[tx - 0.6, tz - 0.35], [tx - 0.6, tz + 0.35], [tx + 0.6, tz - 0.3], [tx + 0.6, tz + 0.4], [tx + 0.1, tz + 0.95]]) pantryStool(g, x, z);
    { const rs = group(g, tx - 0.05, 0, tz - 0.95, 'Rattan stool');            // woven stool
      box(rs, T.rattan, 0.34, 0.5, 0.34, 0, 0.25, 0);
      box(rs, T.rattan, 0.4, 0.05, 0.4, 0, 0.52, 0);
      addBox(tx - 0.25, tz - 1.15, tx + 0.15, tz - 0.75); }
    // 20 L water cans by the rail
    for (const [x, z] of [[TX + 0.75, D - 1.15], [TX + 0.75, D - 0.8], [TX + 1.05, D - 0.95]]) {
      cyl(g, T.water, 0.14, 0.14, 0.46, x, 0.23, z, { seg: 16, shadow: false }).renderOrder = 2;
      cyl(g, T.capBlue, 0.04, 0.04, 0.06, x, 0.49, z, { seg: 10, shadow: false });
    }
    addBox(TX + 0.55, D - 1.35, TX + 1.25, D - 0.6);
    roundPot(g, -0.4, 22.75, 'bush');
  }

  // a few leaves on the floor
  for (let i = 0; i < 40; i++) {
    const l = box(g, rand() > 0.5 ? T.leafPale : M.woodDark, 0.04, 0.003, 0.025, TX + 0.5 + rand() * 2.8, 0.004, 1 + rand() * (D - 2), { shadow: false, ry: rand() * 3 });
    l.receiveShadow = false;
  }
  void pottedPlant;
}
