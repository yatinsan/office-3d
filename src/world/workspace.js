import * as THREE from 'three';
import { M } from '../materials.js';
import { box, plane, cyl, benchDesk, linearLight, lockers, wallClock, pottedPlant } from '../props.js';
import { solid, addBox } from '../colliders.js';
import LAYOUT from '../../floorplan/layout.json';
import { wall, H, W, BACK_Z, LOBBY_S } from './helpers.js';

function yellowDoor(root, x, z, facing) {
  // Amber frosted glass door set into a wall; facing = ry of the visible side.
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = facing;
  root.add(g);
  box(g, M.black, 1.0, 2.4, 0.04, 0, 1.2, 0.11);
  box(g, M.glassYellow, 0.86, 2.26, 0.02, 0, 1.17, 0.135, { shadow: false });
  box(g, M.black, 0.04, 2.26, 0.03, -0.2, 1.17, 0.14, { shadow: false });
  box(g, M.chrome, 0.03, 0.35, 0.03, 0.32, 1.05, 0.17);
}

// Table types used by the floor plan editor (floorplan/editor.html → floorplan/layout.json).
// len = long side, width = short side, seatW = space per seat along the long side.
const TABLES = {
  W: { len: 1.4, width: 1.2, seatW: 0.7 },  // 4-seat window table
  L: { len: 2.8, width: 1.2, seatW: 0.7 },  // 8-seat long table
  E: { len: 1.3, width: 0.8, seatW: 1.2 },  // 2-seat east-wall desk, one chair at each end
};

/** Double-sided table centred on (cx, cz); rot 0 = long side along x, 90 = along z. Chairs on both long sides. */
function table(root, cx, cz, { len, width, seatW }, rot = 0) {
  const opts = { width, seatW, chairOff: 0.12 };
  if (rot % 180) {
    benchDesk(root, cx, cz - len / 2, cz + len / 2, { ...opts, solidFn: (a, b, c, d) => addBox(a, b, c, d) });
    return;
  }
  const g = new THREE.Group();
  g.position.set(0, 0, cz);
  g.rotation.y = Math.PI / 2; // benchDesk builds along local z → world x; local x → world -z
  root.add(g);
  benchDesk(g, 0, cx - len / 2, cx + len / 2, { ...opts, solidFn: (a, b, c, d) => addBox(b, cz - c, d, cz - a) });
}

/** Black-framed glass door with grey concrete shards (same style as the reception panel). */
function shardDoor(root, x, z, facing, w = 0.85) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = facing;
  root.add(g);
  box(g, M.black, w, 2.4, 0.04, 0, 1.2, 0.11);
  const p = plane(g, M.glassFrost, w - 0.1, 2.28, 0, 1.18, 0.135);
  p.renderOrder = 2;
  for (const [y, r] of [[0.6, 0.5], [1.3, -0.45], [2.0, 0.55]]) box(g, M.concrete, w * 0.55, 0.45, 0.01, 0, y, 0.145, { rz: r, shadow: false });
}

/**
 * Open workspace (x 0..9.95, z 8..18.7). Shell, pillar and window column from the LiDAR scan; tables, east-wall
 * desks and lockers come from floorplan/layout.json (drag them in floorplan/editor.html). Back wall kept clear.
 */
export function buildWorkspace(root) {
  // ---- Shell ----
  wall(root, 0, BACK_Z, W, BACK_Z, { h: H });
  wall(root, W, LOBBY_S, W, BACK_Z, { h: H });
  box(root, M.ceilingBlack, W, 0.45, 0.05, W / 2, H - 0.225, BACK_Z - 0.13, { shadow: false });
  box(root, M.ceilingBlack, 0.05, 0.45, BACK_Z - LOBBY_S, W - 0.13, H - 0.225, (LOBBY_S + BACK_Z) / 2, { shadow: false });
  box(root, M.white, 0.6, H, 0.6, 7.35, H / 2, 15.7); // pillar (aligned scan: x 7.05..7.65, z 15.4..16.0)
  addBox(7.05, 15.4, 7.65, 16.0);
  wallClock(root, 7.35, 2.35, 15.39, Math.PI);
  box(root, M.white, 1.25, H, 0.4, 0.62, H / 2, 15.7); // structural column at the window (scan L at x 0.1..1.3)
  addBox(0, 15.5, 1.25, 15.9);

  // ---- Tables + east-wall desks: positions from the floor plan editor (floorplan/layout.json) ----
  for (const it of LAYOUT) {
    const spec = TABLES[it.id[0]];
    if (!spec || it.id === 'LOCK') continue;
    table(root, it.x, it.z, spec, it.rot || 0);
    linearLight(root, it.x, it.z, Math.min(2.4, spec.len - 0.1), it.rot % 180 ? Math.PI / 2 : 0);
  }

  // ---- Back wall (photos 5573-5580), east → west, on a beige-tiled strip; kept clear of desks ----
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(W - 3.3, BACK_Z - 17.6), M.floorBeige);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set((3.3 + W) / 2, 0.004, (17.6 + BACK_Z) / 2);
  strip.receiveShadow = true;
  root.add(strip);
  shardDoor(root, 9.6, BACK_Z - 0.1, Math.PI);
  yellowDoor(root, 7.35, BACK_Z - 0.1, Math.PI);
  plane(root, M.gallery, 1.0, 1.55, 6.2, 1.85, BACK_Z - 0.11, Math.PI);
  const spk = cyl(root, M.blackMatte, 0.16, 0.16, 0.6, 4.2, 0.3, BACK_Z - 0.3, { seg: 16 }); // party speaker
  solid(spk);
  box(root, M.glassYellow, 0.18, 0.38, 0.02, 4.2, 0.34, BACK_Z - 0.47, { shadow: false });
  yellowDoor(root, 3.78, BACK_Z - 0.1, Math.PI);
  plane(root, M.gallery, 1.0, 1.6, W - 0.11, 1.95, 12.3, -Math.PI / 2);

  // ---- Lockers against the thin logo wall (workspace side), doors facing west to the windows (photos 5531/5532) ----
  const lk = LAYOUT.find(o => o.id === 'LOCK');
  if (lk) {
    lockers(root, lk.x, lk.z - 0.625, lk.z + 0.625, Math.PI); // doors face local +x; π turns them to world −x
    addBox(lk.x - 0.275, lk.z - 0.625, lk.x + 0.275, lk.z + 0.625);
  }

  for (const [x, z] of [[0.35, 8.6]]) solid(pottedPlant(root, x, z, { size: 0.4, h: 0.5, mat: M.blackMatte }));
}
