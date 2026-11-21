import * as THREE from 'three';
import { M } from '../materials.js';
import { X0, X1, Z1, LNZ0, LNZ1, CEIL, GROUND_Y, FLOOR_H, LIFTS, LIFT_DEPTH } from './hall.js';
import { buildLandscape } from './landscape.js';
import { box } from '../props.js';
import { buildTerrace, TX } from './terrace.js';
import { windowWall, wall, H, W, D, MEET_Z1, MEET_DOOR, TERRACE_Z1, GAME_Z1, LOBBY_CEIL, CORNER_Z, CAB_X0, SHELF_Z, LOBBY_E } from './helpers.js';

const FLOOR_DROP = 40; // the office is high up – ground is far below

/** West window wall, terrace with pergola, and a the palm-canopy view from the balcony. */
export function buildExterior(root) {
  // Corner cabin + lounge windows run up to the false ceiling; workspace windows stop at 2.8 m under a grooved fascia.
  // lounge balcony door opening z 4.9..6.5 (suggestion 10); the glass leaves themselves are in src/doors.js
  windowWall(root, 0, 0, 0, 4.9, LOBBY_CEIL);
  windowWall(root, 0, 6.5, 0, SHELF_Z, LOBBY_CEIL);
  box(root, M.black, 0.12, 0.08, 1.6, 0, 2.44, 5.7);                  // door head
  box(root, M.chrome, 0.1, 0.015, 1.6, 0, 0.008, 5.7, { shadow: false }); // threshold
  const fan = new THREE.Mesh(new THREE.PlaneGeometry(1.6, LOBBY_CEIL - 2.48), M.glass); // fixed glass above the door
  fan.position.set(0, (2.48 + LOBBY_CEIL) / 2, 5.7);
  fan.rotation.y = Math.PI / 2;
  fan.renderOrder = 2;
  root.add(fan);
  wall(root, 0, 0, 0, SHELF_Z, { h: H - LOBBY_CEIL, y0: LOBBY_CEIL, collide: false });
  // workspace + meeting room windows (meeting room has a glass double door onto the terrace, see src/doors.js)
  const [md0, md1] = MEET_DOOR;
  windowWall(root, 0, SHELF_Z, 0, md0, 2.8);
  windowWall(root, 0, md1, 0, MEET_Z1, 2.8);
  box(root, M.black, 0.12, 0.08, md1 - md0, 0, 2.44, (md0 + md1) / 2);
  box(root, M.chrome, 0.1, 0.015, md1 - md0, 0, 0.008, (md0 + md1) / 2, { shadow: false });
  const fan2 = new THREE.Mesh(new THREE.PlaneGeometry(md1 - md0, 2.8 - 2.48), M.glass);
  fan2.position.set(0, (2.48 + 2.8) / 2, (md0 + md1) / 2);
  fan2.rotation.y = Math.PI / 2;
  fan2.renderOrder = 2;
  root.add(fan2);
  box(root, M.wall, 0.12, H - 2.8, MEET_Z1 - SHELF_Z, 0.02, 2.8 + (H - 2.8) / 2, (SHELF_Z + MEET_Z1) / 2, { shadow: false });
  for (let y = 2.95; y < H - 0.05; y += 0.14) box(root, M.wallWarm, 0.02, 0.03, D - SHELF_Z, 0.09, y, (SHELF_Z + D) / 2, { shadow: false });
  // past the meeting room the facade is solid plaster (pantry sink + AC hang on it, photos IMG_5667/5668)
  wall(root, -0.1, MEET_Z1, -0.1, GAME_Z1 + 0.2, { h: H + 0.3, mat: M.wallWarm, t: 0.2 }); // runs on past the terrace along the game room
  windowWall(root, 0, 0, CAB_X0, 0, LOBBY_CEIL);               // corner cabin, north side
  wall(root, 0, 0, CAB_X0, 0, { h: H - LOBBY_CEIL, y0: LOBBY_CEIL, collide: false });
  void CORNER_Z;

  // ---- Terrace along the west facade (photos IMG_5658–5668) ----
  buildTerrace(root);

  // ---- Building body below the 4th floor: floors 3, 2, 1 (solid, same height as the 4th) and the ground floor G ----
  // The ground floor (src/world/hall.js) is built inside this body, so G is cut out of it: solid below G's slab and above
  // its ceiling, and in between only where the corridors / lift shafts are not.
  const zA = -0.5, zB = GAME_Z1 + 0.7, gy = GROUND_Y - 0.02, gt = GROUND_Y + CEIL + 0.05; // old body z range, G floor level, top of G's ceiling
  const part = (xa, xb, za, zb, ya, yb) => { if (xb > xa + 0.01 && zb > za + 0.01 && yb > ya + 0.01) box(root, M.wallWarm, xb - xa, yb - ya, zb - za, (xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2, { shadow: false }); };
  const xe = X1 + 15.0;                           // end of the ground-floor side corridor
  const shafts = LIFTS.map((L) => { const xs = [L.x - L.out * 0.1, L.x - L.out * (0.1 + LIFT_DEPTH + 0.36)]; return [Math.min(...xs), Math.max(...xs), L.z - L.cw / 2 - 0.36, L.z + L.cw / 2 + 0.36]; });
  // the cabin cavity of every lift: hollow from the ground floor up to the 4th floor, so the cabin really travels through an open shaft
  const holes = LIFTS.map((L) => { const xs = [L.x - L.out * 0.1, L.x - L.out * (0.1 + LIFT_DEPTH + 0.06)]; return [Math.min(...xs), Math.max(...xs), L.z - L.cw / 2 - 0.06, L.z + L.cw / 2 + 0.06]; });
  const cut = (rects, hs) => { for (const hole of hs) rects = rects.flatMap(([xa, xb, za, zb]) => {
    if (hole[1] <= xa || hole[0] >= xb || hole[3] <= za || hole[2] >= zb) return [[xa, xb, za, zb]];
    return [[xa, hole[0], za, zb], [hole[1], xb, za, zb], [Math.max(xa, hole[0]), Math.min(xb, hole[1]), za, hole[2]], [Math.max(xa, hole[0]), Math.min(xb, hole[1]), hole[3], zb]];
  }); return rects; };
  // the whole footprint, including the block west of the hall and south of the game room (suggestion 60), so the building is one square box
  const columns = [[TX, 20, zA, zB], [TX, X0 - 0.1, zB, Z1 + 0.1], [X0 - 0.1, X1 + 0.1, zB, Z1 + 0.1], [X1 + 0.1, xe + 0.1, LNZ0 - 0.1, LNZ1 + 0.1], ...shafts];
  for (const [xa, xb, za, zb] of columns) part(xa, xb, za, zb, -FLOOR_DROP, gy);        // under the ground floor
  for (const [xa, xb, za, zb] of cut(columns, holes)) part(xa, xb, za, zb, gt, -0.02);  // floors 3, 2, 1 (up to the 4th floor)
  // the ground-floor level: west of the hall (and south of the game room), east of it up to the side corridor, and the lift shafts, minus the cabin cavities
  const band = cut([[TX, X0 - 0.1, zA, Z1 + 0.1], [X1 + 0.02, 20, zA, Math.min(zB, LNZ0)], [X1 + 0.02, 20, Math.max(zA, LNZ1), zB], ...shafts], holes);
  for (const [xa, xb, za, zb] of band) part(xa, xb, za, zb, gy, gt);
  // dark floor lines every storey on the west facade and on the south end of the hall block
  for (let i = 1; i < 12; i++) box(root, M.blackMatte, 0.05, 0.25, Z1 + 0.6, TX - 0.01, -i * FLOOR_H, (Z1 - 0.5) / 2 + 0.1, { shadow: false });
  for (let i = 1; i < 4; i++) box(root, M.blackMatte, X1 - TX + 0.3, 0.25, 0.05, (TX + X1) / 2, -i * FLOOR_H, Z1 + 0.11, { shadow: false });
  void LOBBY_E; void W;

  // ---- Ground, palm canopy, hill and the one distant tower cluster (photo IMG_5660) ----
  buildLandscape(root);
}
