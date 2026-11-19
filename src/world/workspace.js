import * as THREE from 'three';
import { M } from '../materials.js';
import { box, plane, cyl, benchDesk, workstation, officeChair, linearLight, conePendant, lockers, wallClock, pottedPlant } from '../props.js';
import { solid, addBox } from '../colliders.js';
import { wall, glassWall, H, W, BACK_Z, SHELF_Z, LOGO_X, LOBBY_S } from './helpers.js';

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

/** 4-6 seat double-sided pod, long axis along x (x0..x1), centred on zc. */
function pod(root, x0, x1, zc) {
  const g = new THREE.Group();
  g.position.set(0, 0, zc);
  g.rotation.y = Math.PI / 2; // benchDesk builds along local z → world x; local x → world -z
  root.add(g);
  benchDesk(g, 0, x0, x1, {
    width: 1.4, seatW: 1.05, chairOff: 0.12, // chairs tucked in like the photos
    solidFn: (a, b, c, d) => addBox(b, zc - c, d, zc - a),
  });
}

/** Small two-person desk against the back wall; the two people face the wall (+z). */
function smallDesk(root, x, z, w = 1.1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  root.add(g);
  box(g, M.wood, w, 0.04, 0.55, 0, 0.75, 0);
  for (const s of [-1, 1]) {
    box(g, M.black, 0.05, 0.78, 0.05, s * (w / 2 - 0.08), 0.37, 0, { rz: s * 0.15 });
    box(g, M.black, 0.05, 0.05, 0.5, s * (w / 2 - 0.06), 0.03, 0);
  }
  solid(g);
  for (const dx of [-w / 4, w / 4]) {
    workstation(g, dx, 0.02, Math.PI, 1); // screen faces the sitter (−z)
    solid(officeChair(root, x + dx, z - 0.55, 0), -0.12);
  }
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
 * Open workspace (x 0..9.95, z 8..18.85), laid out from the LiDAR scan: three rows of pods
 * running away from the windows, single desks along the east wall, one pillar, and the back
 * wall with yellow frosted doors and the photo gallery.
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

  // ---- Desk pods (measured) ----
  pod(root, 0.9, 2.95, 10.75);
  pod(root, 3.35, 5.9, 10.75);
  pod(root, 0.9, 2.95, 13.75);
  pod(root, 3.45, 5.1, 13.75);
  pod(root, 5.75, 7.3, 13.75);
  pod(root, 0.4, 2.4, 17.15); // inside the glass room
  pod(root, 3.9, 6.5, 16.45); // a little forward: photos show open floor in front of the back-wall desks
  // ---- One long single-sided bench along the east wall (people face the wall; photos 5609-5616) ----
  benchDesk(root, W - 0.375, 10.0, 17.1, {
    width: 0.75, sides: [-1], seatW: 1.15, chairOff: 0.12,
    solidFn: (a, b, c, d) => addBox(a, b, c, d),
  });

  // ---- Lights ----
  for (const [x0, x1, zc] of [[0.9, 2.95, 10.75], [3.35, 5.9, 10.75], [0.9, 2.95, 13.75], [3.45, 5.1, 13.75], [5.75, 7.3, 13.75], [0.4, 2.4, 17.15], [3.9, 6.5, 16.45]]) {
    linearLight(root, (x0 + x1) / 2, zc, Math.min(2.4, x1 - x0));
  }
  for (const z of [11.3, 13.6, 15.9]) linearLight(root, W - 0.55, z, 2.0, Math.PI / 2);
  for (const [x, z] of [[8.55, 18.0], [6.2, 18.0], [5.0, 18.0], [2.2, 18.0]]) conePendant(root, x, z, 2.35);

  // ---- Glass team room in the back-west corner (window side) ----
  glassWall(root, { x0: 1.25, z0: 15.7, x1: 3.3, z1: 15.7, h: H, transom: 2.4 });
  glassWall(root, { x0: 3.3, z0: 15.7, x1: 3.3, z1: BACK_Z, h: H, transom: 2.4, door: [15.85, 16.95], swing: -1 });

  // ---- Back wall (photos 5573-5580), east → west, on a beige-tiled strip ----
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(W - 3.3, BACK_Z - 17.6), M.floorBeige);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set((3.3 + W) / 2, 0.004, (17.6 + BACK_Z) / 2);
  strip.receiveShadow = true;
  root.add(strip);
  shardDoor(root, 9.6, BACK_Z - 0.1, Math.PI);
  smallDesk(root, 8.55, BACK_Z - 0.32);
  yellowDoor(root, 7.35, BACK_Z - 0.1, Math.PI);
  plane(root, M.gallery, 1.0, 1.55, 6.2, 1.85, BACK_Z - 0.11, Math.PI);
  smallDesk(root, 6.2, BACK_Z - 0.32);
  smallDesk(root, 5.0, BACK_Z - 0.32);
  const spk = cyl(root, M.blackMatte, 0.16, 0.16, 0.6, 4.2, 0.3, BACK_Z - 0.3, { seg: 16 }); // party speaker
  solid(spk);
  box(root, M.glassYellow, 0.18, 0.38, 0.02, 4.2, 0.34, BACK_Z - 0.47, { shadow: false });
  yellowDoor(root, 3.78, BACK_Z - 0.1, Math.PI);
  plane(root, M.gallery, 1.0, 1.6, W - 0.11, 1.95, 12.3, -Math.PI / 2);

  // ---- Lockers against the reception wall (workspace side), next to the shard panel ----
  const lk = new THREE.Group();
  lk.position.set(7.6, 0, LOBBY_S + 0.35 + 0.28);
  lk.rotation.y = -Math.PI / 2; // lockers face local +x → world +z (into the workspace)
  root.add(lk);
  lockers(lk, 0, -0.62, 0.62, 0);
  addBox(6.95, LOBBY_S + 0.35, 8.25, LOBBY_S + 0.92);
  // Round wall clock on the white wall beside the shelving
  wallClock(root, LOGO_X - 0.41, 2.3, 8.6, -Math.PI / 2);

  for (const [x, z] of [[0.35, 8.6]]) solid(pottedPlant(root, x, z, { size: 0.4, h: 0.5, mat: M.blackMatte }));
}
