import * as THREE from 'three';
import { M } from '../materials.js';
import { box, plane, cyl, benchDesk, linearLight, conePendant, lockers, wallClock, pottedPlant } from '../props.js';
import { solid, addBox } from '../colliders.js';
import LAYOUT from '../../floorplan/layout.json';
import { wall, H, W, BACK_Z, LOBBY_S } from './helpers.js';

function yellowDoor(root, x, z, facing) {
  // Amber frosted glass door set into a wall; facing = ry of the visible side.
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = facing;
  g.userData.label = 'Door';
  root.add(g);
  box(g, M.black, 1.0, 2.4, 0.04, 0, 1.2, 0.11);
  box(g, M.glassYellow, 0.86, 2.26, 0.02, 0, 1.17, 0.135, { shadow: false });
  box(g, M.black, 0.04, 2.26, 0.03, -0.2, 1.17, 0.14, { shadow: false });
  box(g, M.chrome, 0.03, 0.35, 0.03, 0.32, 1.05, 0.17);
  // white diamond graphic on the frosted glass (photos IMG_5651/5652)
  box(g, M.white, 0.62, 0.62, 0.005, 0.12, 1.05, 0.15, { rz: Math.PI / 4, shadow: false });
  box(g, M.glassYellow, 0.44, 0.44, 0.006, 0.12, 1.05, 0.152, { rz: Math.PI / 4, shadow: false });
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
function doorBay(root, x, z, facing) {
  yellowDoor(root, x, z, facing);
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = facing;
  g.userData.label = 'Wall';
  root.add(g);
  for (const s of [-1, 1]) box(g, M.white, 0.14, H, 0.08, s * 0.6, H / 2, 0.12);
  box(g, M.blackMatte, 1.06, H - 2.75, 0.03, 0, (2.75 + H) / 2, 0.11, { shadow: false });
  box(g, M.white, 1.06, 0.12, 0.08, 0, 2.69, 0.12); // white lintel
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
  wall(root, 0, BACK_Z, W, BACK_Z, { h: H });
  wall(root, W, LOBBY_S, W, BACK_Z, { h: H });
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
  for (const z of [12.45, 15.45]) doorBay(root, W - 0.1, z, -Math.PI / 2);
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
