import * as THREE from 'three';
import { M } from '../materials.js';
import { box } from '../props.js';
import { addBox } from '../colliders.js';

export const H = 3.6;          // slab-to-slab height (open workspace, exposed ceiling)
export const LOBBY_CEIL = 3.0; // false ceiling over lobby + cabin corridor
// Plan measured from the LiDAR scan (metres). Window wall runs along x = 0 (west).
export const W = 10.05;        // workspace east wall
export const LOBBY_E = 10.3;   // reception's east glass wall (building hall beyond)
export const BACK_Z = 18.7;    // workspace back (south) wall
export const CORNER_Z = 3.5;   // corner cabin glass front (corner cabin x 0..3, z 0..3.5)
export const CAB_BACK = 3.0;   // back wall of cabins 1 + 2
export const CAB_FRONT = 5.75; // glass fronts of cabins 1 + 2 (corridor side)
export const CAB_X0 = 3.0;     // cabin 2 x 3..6.15, cabin 1 x 6.15..8.9
export const CAB_SPLIT = 6.15;
export const CAB_X1 = 8.9;
export const SHELF_Z = 7.95;   // shelving partition between corridor and workspace
export const LOGO_X = 7.3;     // logo wall face (faces east, into reception)
export const LOGO_T = 0.15;    // logo wall is a thin partition (lockers stand against its workspace side)
export const LOBBY_S = 9.25;   // reception's south wall, reception face (0.35 m thick; workspace face at 9.6)
export const D = BACK_Z;
// Meeting room behind the workspace back wall, on the window side (suggestions 13 + 14, photos IMG_5669–5673).
export const MEET_X1 = 3.7;    // meeting room east wall
export const MEET_Z1 = 22.6;   // meeting room far (south) wall
export const MEET_DOOR = [20.0, 21.6]; // glass double door from the terrace (like the lounge balcony door)
export const TERRACE_Z1 = 25.2; // terrace runs on past the meeting room

/** Scales a geometry's UVs so a texture tile spans `tile` metres. */
export function worldUV(geo, sx, sy, tile) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx / tile, uv.getY(i) * sy / tile);
  uv.needsUpdate = true;
  return geo;
}

/** Horizontal textured slab (floor / ceiling) covering x0..x1, z0..z1 at height y. */
export function slab(parent, mat, x0, z0, x1, z1, y, { down = false, tile = 2.4 } = {}) {
  const w = x1 - x0, d = z1 - z0;
  const geo = worldUV(new THREE.PlaneGeometry(w, d), w, d, tile);
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = down ? Math.PI / 2 : -Math.PI / 2;
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Axis-aligned solid wall from (x0,z0) to (x1,z1), thickness t. */
export function wall(parent, x0, z0, x1, z1, { h = H, mat = M.wall, t = 0.2, y0 = 0, collide = true } = {}) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const w = alongX ? Math.abs(x1 - x0) : t;
  const d = alongX ? t : Math.abs(z1 - z0);
  const m = box(parent, mat, w, h, d, (x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2);
  m.userData.label = 'Wall';
  if (collide && y0 < 1.5) addBox((x0 + x1) / 2 - w / 2, (z0 + z1) / 2 - d / 2, (x0 + x1) / 2 + w / 2, (z0 + z1) / 2 + d / 2);
  return m;
}

/**
 * Black-framed glass partition along x (fixed z) or along z (fixed x).
 * door: [a, b] gap along the run (a = hinge side). The leaf is not merged into the static world: it goes into
 * `doorLeaves` and src/doors.js opens/closes it with F. name: label for the on-screen hint.
 */
/** Openable door leaves collected while the world is built (see glassWall). */
export const doorLeaves = [];

export function glassWall(parent, { x0, z0, x1, z1, h = 3.0, door = null, transom = 2.3, frost = false, panel = 1.1, swing = 1, name = 'door' }) {
  const alongX = z0 === z1;
  const gw = new THREE.Group();
  gw.userData.label = 'Glass wall';
  parent.add(gw);
  parent = gw;
  const a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1, fixed = alongX ? z0 : x0;
  const P = (a, y, th, len, height) => alongX
    ? box(parent, M.black, len, height, th, a, y, fixed, { shadow: true })
    : box(parent, M.black, th, height, len, fixed, y, a, { shadow: true });
  const glassPane = (a, b, y0, y1) => {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(b - a, y1 - y0), frost ? M.glassFrost : M.glass);
    g.position.set(alongX ? (a + b) / 2 : fixed, (y0 + y1) / 2, alongX ? fixed : (a + b) / 2);
    if (!alongX) g.rotation.y = Math.PI / 2;
    g.renderOrder = 2;
    parent.add(g);
  };
  const segs = door ? [[a0, Math.min(...door)], [Math.max(...door), a1]] : [[a0, a1]]; // door[0] is the hinge side
  for (const [s, e] of segs) {
    if (e - s < 0.01) continue;
    glassPane(s, e, 0.05, h);
    const n = Math.max(1, Math.round((e - s) / panel));
    for (let i = 0; i <= n; i++) P(s + (i / n) * (e - s), h / 2, 0.05, 0.05, h);
    P((s + e) / 2, 0.04, 0.06, e - s, 0.08);
    if (transom && transom < h) P((s + e) / 2, transom, 0.05, e - s, 0.05);
    const mid = (s + e) / 2;
    if (alongX) addBox(s, fixed - 0.06, e, fixed + 0.06); else addBox(fixed - 0.06, s, fixed + 0.06, e);
    void mid;
  }
  P((a0 + a1) / 2, h - 0.03, 0.06, a1 - a0, 0.06);
  if (door) {
    const [da, db] = door;
    const dw = Math.abs(db - da);
    // header above door
    glassPane(Math.min(da, db), Math.max(da, db), transom, h);
    P((da + db) / 2, transom, 0.06, dw, 0.06);
    // open leaf hinged at da, swung 80° to one side
    const leaf = new THREE.Group();
    leaf.position.set(alongX ? da : fixed, 0, alongX ? fixed : da);
    const dir = Math.sign(db - da);
    const lw = dw - 0.04;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(lw, transom - 0.1), M.glass);
    pane.position.set(dir * lw / 2, transom / 2, 0);
    leaf.add(pane);
    for (const s of [0, 1]) box(leaf, M.black, 0.04, transom - 0.08, 0.04, dir * s * lw, transom / 2, 0);
    box(leaf, M.black, lw, 0.05, 0.04, dir * lw / 2, 0.06, 0);
    box(leaf, M.black, lw, 0.04, 0.04, dir * lw / 2, transom - 0.08, 0);
    box(leaf, M.chrome, 0.02, 0.35, 0.03, dir * (lw - 0.1), 1.05, 0.04);
    const closed = alongX ? 0 : -Math.PI / 2;
    const open = closed + (alongX ? -1 : 1) * swing * dir * 1.4; // swing = -1 opens to the other side
    leaf.rotation.y = closed;
    const lo = Math.min(da, db), hi = Math.max(da, db);
    doorLeaves.push({
      leaf, closed, open, name,
      x: alongX ? (da + db) / 2 : fixed, z: alongX ? fixed : (da + db) / 2,
      block: alongX ? { minX: lo, maxX: hi, minZ: fixed - 0.06, maxZ: fixed + 0.06 } : { minX: fixed - 0.06, maxX: fixed + 0.06, minZ: lo, maxZ: hi },
    });
  }
}

/** Window wall from (x0,z0) to (x1,z1) (axis-aligned) with mullions and transoms, height h. */
export function windowWall(parent, x0, z0, x1, z1, h) {
  const alongX = z0 === z1;
  const len = alongX ? x1 - x0 : z1 - z0;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(len, h), M.glass);
  glass.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  if (!alongX) glass.rotation.y = Math.PI / 2;
  glass.renderOrder = 2;
  parent.add(glass);
  const n = Math.max(1, Math.round(len / 1.2));
  for (let i = 0; i <= n; i++) {
    if (alongX) box(parent, M.black, 0.07, h, 0.1, x0 + (i / n) * len, h / 2, z0);
    else box(parent, M.black, 0.1, h, 0.07, x0, h / 2, z0 + (i / n) * len);
  }
  for (const y of [0.08, 0.55, Math.min(2.45, h - 0.3), h - 0.04]) {
    const th = y < 0.1 ? 0.16 : 0.07;
    if (alongX) box(parent, M.black, len, th, 0.1, (x0 + x1) / 2, y, z0, { shadow: y > 2 });
    else box(parent, M.black, 0.1, th, len, x0, y, (z0 + z1) / 2, { shadow: y > 2 });
  }
  if (alongX) addBox(x0, z0 - 0.08, x1, z0 + 0.08); else addBox(x0 - 0.08, z0, x0 + 0.08, z1);
}

/** Thin dark line inlaid on a wall plane that faces +z at depth z. Points in (x,y). */
export function wallLine(parent, x0, y0, x1, y1, z, mat = M.blackMatte) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  box(parent, mat, len, 0.012, 0.01, (x0 + x1) / 2, (y0 + y1) / 2, z, { shadow: false, rz: Math.atan2(y1 - y0, x1 - x0) });
}
