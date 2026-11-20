import * as THREE from 'three';
import { M } from '../materials.js';
import { box, plane, cyl, benchDesk, linearLight, conePendant, lockers, wallClock, pottedPlant } from '../props.js';
import { solid, addBox } from '../colliders.js';
import LAYOUT from '../../floorplan/layout.json';
import { wall, H, W, BACK_Z, LOBBY_S, LOBBY_E, EAST_DOORS, DOOR_HALF, DOOR_TOP } from './helpers.js';

// Amber glass with frosted white graphics (photos IMG_5731 / IMG_5732). Clear parts are see-through from both sides.
const FROST = 'rgba(238,222,180,0.96)', CLEAR = 'rgba(232,186,80,0.16)';
function glassTex(shapes) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 640;
  const g = c.getContext('2d');
  const P = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([u, v], i) => (i ? g.lineTo : g.moveTo).call(g, u * 256, v * 640)); g.closePath(); g.fill(); };
  g.fillStyle = FROST; g.fillRect(0, 0, 256, 640);
  for (const [pts, frost] of shapes) {
    if (!frost) { g.save(); g.beginPath(); pts.forEach(([u, v], i) => (i ? g.lineTo : g.moveTo).call(g, u * 256, v * 640)); g.closePath(); g.clip(); g.clearRect(0, 0, 256, 640); g.fillStyle = CLEAR; g.fillRect(0, 0, 256, 640); g.restore(); }
    else P(pts, FROST);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.15, metalness: 0.05, depthWrite: false, side: THREE.DoubleSide });
}
// [polygon in pane coords (u right, v down), frosted?] drawn in order
const DOOR_GLASS = [
  glassTex([ // IMG_5731: frosted top with a small clear window, clear middle, frosted arrow on the right, frosted diagonal at the bottom
    [[[0, 0.37], [1, 0.37], [1, 1], [0, 1]], false],
    [[[0.6, 0.15], [0.77, 0.15], [0.77, 0.22], [0.6, 0.22]], false],
    [[[1, 0.37], [0.62, 0.6], [1, 0.85]], true],
    [[[0.42, 0.37], [0.62, 0.37], [0.35, 0.55], [0.25, 0.5]], true],
    [[[0, 0.55], [1, 0.9], [1, 1], [0, 1]], true],
  ]),
  glassTex([ // IMG_5732: frosted top, clear ribbon running diagonally down, frosted arrow on the left, frosted bottom right
    [[[0, 0.3], [0.75, 0.6], [0.06, 1], [0, 1]], false],
    [[[0, 0.42], [0.43, 0.62], [0, 0.82]], true],
    [[[0.75, 0.6], [1, 0.6], [1, 1], [0.06, 1], [0.3, 0.85]], true],
  ]),
];

/** See-through amber glass door with transom, spanning the wall from the workspace (x 9.95) to the hall face (x 10.3). */
function glassDoor(root, zc, mat) {
  const g = new THREE.Group();
  g.userData.label = 'Door';
  root.add(g);
  const xa = 9.95, xb = LOBBY_E, xm = 10.12, w = DOOR_HALF * 2, T = DOOR_TOP, split = 2.3;
  for (const s of [-1, 1]) box(g, M.concrete, xb - xa, T, 0.03, (xa + xb) / 2, T / 2, zc + s * (DOOR_HALF + 0.015), { shadow: false }); // reveals (concrete, like the hall wall)
  box(g, M.concrete, xb - xa, 0.03, w, (xa + xb) / 2, T + 0.015, zc, { shadow: false });
  for (const s of [-1, 1]) box(g, M.black, 0.07, T, 0.05, xm, T / 2, zc + s * (DOOR_HALF - 0.025));
  for (const y of [0.04, split, T - 0.03]) box(g, M.black, 0.07, y === split ? 0.06 : 0.08, w, xm, y, zc);
  const main = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, split - 0.1), mat);
  main.position.set(xm, (split + 0.08) / 2, zc); main.rotation.y = Math.PI / 2; main.renderOrder = 2;
  g.add(main);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, T - split - 0.1), DOOR_GLASS[0].clone());
  top.material.map = null; top.material.color.set('#f4e7c4'); top.material.opacity = 0.75; // transom: fully frosted amber
  top.position.set(xm, (split + T) / 2, zc); top.rotation.y = Math.PI / 2; top.renderOrder = 2;
  g.add(top);
  box(g, M.chrome, 0.12, 0.35, 0.025, xm, 1.05, zc + DOOR_HALF - 0.12, { shadow: false }); // pull handle through both sides
  addBox(xa, zc - DOOR_HALF, xb, zc + DOOR_HALF);
}

/** Little framed photo grid on a wall; (x, z) = wall face, ry = facing, cols × rows frames. */
function photoGrid(root, x, y, z, ry, cols = 3, rows = 4) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  g.userData.label = 'Photo gallery';
  root.add(g);
  const fw = 0.3, fh = 0.22, gap = 0.08;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (r === rows - 1 && c === cols - 1) continue; // photos show an uneven last row
    const px = (c - (cols - 1) / 2) * (fw + gap), py = ((rows - 1) / 2 - r) * (fh + gap);
    box(g, M.black, fw, fh, 0.02, px, py, 0.01, { shadow: false });
    plane(g, M.gallery, fw - 0.04, fh - 0.04, px, py, 0.021);
  }
}

/** Door bay as in the photos: amber door, white pilasters each side, black bulkhead panel above. */
function doorBay(root, x, z, facing, i) {
  glassDoor(root, z, DOOR_GLASS[i]);
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = facing;
  g.userData.label = 'Wall';
  root.add(g);
  const bw = 2 * DOOR_HALF + 0.16, t = DOOR_TOP;
  for (const s of [-1, 1]) box(g, M.white, 0.14, H, 0.08, s * (DOOR_HALF + 0.15), H / 2, 0.12);
  box(g, M.blackMatte, bw, H - t - 0.12, 0.03, 0, (t + 0.12 + H) / 2, 0.11, { shadow: false });
  box(g, M.white, bw, 0.12, 0.08, 0, t + 0.06, 0.12); // white lintel
}

// Table types used by the floor plan editor (floorplan/editor.html → floorplan/layout.json).
// len = long side, width = short side, seatW = space per seat along the long side.
const TABLES = {
  W: { len: 1.4, width: 1.2, seatW: 0.7, name: 'Window table' },  // 4-seat window table
  L: { len: 2.8, width: 1.2, seatW: 0.7, name: 'Long table' },  // 8-seat long table
  E: { len: 1.3, width: 0.8, seatW: 1.2, name: 'East-wall desk' },  // 2-seat east-wall desk, one chair at each end
};

/** Double-sided table centred on (cx, cz); rot 0 = long side along x, 90 = along z. Chairs on both long sides. */
function table(root, cx, cz, { len, width, seatW }, rot = 0, label = 'Table') {
  const opts = { width, seatW, chairOff: 0.12 };
  if (rot % 180) {
    const t = new THREE.Group();
    t.userData.label = label;
    root.add(t);
    benchDesk(t, cx, cz - len / 2, cz + len / 2, { ...opts, solidFn: (a, b, c, d) => addBox(a, b, c, d) });
    return;
  }
  const g = new THREE.Group();
  g.position.set(0, 0, cz);
  g.rotation.y = Math.PI / 2; // benchDesk builds along local z → world x; local x → world -z
  g.userData.label = label;
  root.add(g);
  benchDesk(g, 0, cx - len / 2, cx + len / 2, { ...opts, solidFn: (a, b, c, d) => addBox(b, cz - c, d, cz - a) });
}

/** Black-framed glass door with grey concrete shards (same style as the reception panel). */
function shardDoor(root, x, z, facing, w = 0.85) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = facing;
  g.userData.label = 'Door';
  root.add(g);
  box(g, M.black, w, 2.4, 0.04, 0, 1.2, 0.11);
  const p = plane(g, M.glassFrost, w - 0.1, 2.28, 0, 1.18, 0.135);
  p.renderOrder = 2;
  for (const [y, r] of [[0.6, 0.5], [1.3, -0.45], [2.0, 0.55]]) box(g, M.concrete, w * 0.55, 0.45, 0.01, 0, y, 0.145, { rz: r, shadow: false });
}

/**
 * Open workspace (x 0..9.95, z 8..18.7). Shell, pillar and window column from the LiDAR scan; tables, east-wall
 * desks and lockers come from floorplan/layout.json (drag them in floorplan/editor.html). Back wall kept plain;
 * the east wall has the amber door bays + photo grid from the photos (see suggestions/).
 */
export function buildWorkspace(root) {
  // ---- Shell ----
  // back wall with a black-framed glass window into the meeting room (suggestion 14, photo IMG_5673)
  const [wx0, wx1, wy0, wy1] = [0.45, 2.95, 0.5, 2.75];
  wall(root, 0, BACK_Z, wx0, BACK_Z, { h: H });
  wall(root, wx0, BACK_Z, wx1, BACK_Z, { h: wy0 });
  wall(root, wx0, BACK_Z, wx1, BACK_Z, { h: H - wy1, y0: wy1, collide: false });
  wall(root, wx1, BACK_Z, W, BACK_Z, { h: H });
  { const g = new THREE.Group(); g.userData.label = 'Meeting room window'; root.add(g);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(wx1 - wx0, wy1 - wy0), M.glass);
    pane.position.set((wx0 + wx1) / 2, (wy0 + wy1) / 2, BACK_Z); pane.renderOrder = 2; g.add(pane);
    const cols = [wx0, wx0 + 0.85, wx0 + 1.7, wx1], rows = [wy0, wy0 + 0.65, wy0 + 1.6, wy1];
    for (const x of cols) box(g, M.black, 0.06, wy1 - wy0 + 0.06, 0.22, x, (wy0 + wy1) / 2, BACK_Z, { shadow: false });
    for (const y of rows) box(g, M.black, wx1 - wx0, 0.06, 0.22, (wx0 + wx1) / 2, y, BACK_Z, { shadow: false }); }
  { // east wall with two see-through door openings (suggestions 25/26)
    const cuts = EAST_DOORS.flatMap((z) => [z - DOOR_HALF, z + DOOR_HALF]);
    const ends = [LOBBY_S, ...cuts, BACK_Z];
    for (let k = 0; k < ends.length; k += 2) wall(root, W, ends[k], W, ends[k + 1], { h: H });
    for (const z of EAST_DOORS) wall(root, W, z - DOOR_HALF, W, z + DOOR_HALF, { h: H - DOOR_TOP, y0: DOOR_TOP, collide: false });
  }
  box(root, M.ceilingBlack, W, 0.45, 0.05, W / 2, H - 0.225, BACK_Z - 0.13, { shadow: false });
  box(root, M.ceilingBlack, 0.05, 0.45, BACK_Z - LOBBY_S, W - 0.13, H - 0.225, (LOBBY_S + BACK_Z) / 2, { shadow: false });
  box(root, M.white, 0.6, H, 0.6, 7.35, H / 2, 15.7).userData.label = 'Pillar'; // pillar (aligned scan: x 7.05..7.65, z 15.4..16.0)
  addBox(7.05, 15.4, 7.65, 16.0);
  wallClock(root, 7.35, 2.35, 15.39, Math.PI);
  box(root, M.white, 1.25, H, 0.4, 0.62, H / 2, 15.7).userData.label = 'Window column'; // structural column at the window (scan L at x 0.1..1.3)
  addBox(0, 15.5, 1.25, 15.9);

  // ---- Tables + east-wall desks: positions from the floor plan editor (floorplan/layout.json) ----
  for (const it of LAYOUT) {
    const spec = TABLES[it.id[0]];
    if (!spec || it.id.startsWith('LOCK')) continue;
    table(root, it.x, it.z, spec, it.rot || 0, `${spec.name} ${it.id}`);
    if (it.id[0] === 'E') conePendant(root, it.x, it.z, 2.2); // black cone pendants over the wall desks (photos)
    else linearLight(root, it.x, it.z, Math.min(2.4, spec.len - 0.1), it.rot % 180 ? Math.PI / 2 : 0);
  }

  // ---- Back wall: plain (suggestion 3), beige-tiled strip along it, party speaker ----
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(W - 3.3, BACK_Z - 17.6), M.floorBeige);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set((3.3 + W) / 2, 0.004, (17.6 + BACK_Z) / 2);
  strip.receiveShadow = true;
  root.add(strip);
  const spk = cyl(root, M.blackMatte, 0.16, 0.16, 0.6, 4.2, 0.3, BACK_Z - 0.3, { seg: 16 }); // party speaker
  solid(spk);
  box(root, M.glassYellow, 0.18, 0.38, 0.02, 4.2, 0.34, BACK_Z - 0.47, { shadow: false });

  // ---- East wall like photos IMG_5651/5652 (suggestion 2): amber doors in white bays with black panels
  //      above, a photo grid above the middle desk, cone pendants over the desks ----
  EAST_DOORS.forEach((z, i) => doorBay(root, W - 0.1, z, -Math.PI / 2, i));
  photoGrid(root, W - 0.115, 1.95, 14.0, -Math.PI / 2); // wall face is at W - 0.1

  // ---- Lockers (LOCK = against the thin logo wall, LOCK2 = window-corner wall; suggestion 7) ----
  // rot as in the floor plan editor: front faces 0 west, 90 north, 180 east, 270 south
  const RY = { 0: Math.PI, 90: Math.PI / 2, 180: 0, 270: -Math.PI / 2 };
  for (const lk of LAYOUT.filter(o => o.id.startsWith('LOCK'))) {
    const rot = ((lk.rot || 0) % 360 + 360) % 360;
    lockers(root, lk.x, lk.z - 0.625, lk.z + 0.625, RY[rot]); // doors face local +x
    const [hw, hd] = rot % 180 ? [0.625, 0.275] : [0.275, 0.625];
    addBox(lk.x - hw, lk.z - hd, lk.x + hw, lk.z + hd);
  }

  for (const [x, z] of [[1.6, 8.6]]) solid(pottedPlant(root, x, z, { size: 0.4, h: 0.5, mat: M.blackMatte }));
}
