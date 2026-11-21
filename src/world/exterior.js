import * as THREE from 'three';
import { M } from '../materials.js';
import { X0, X1, LNZ0, LNZ1, CEIL, GROUND_Y, LIFTS, LIFT_DEPTH } from './hall.js';
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

  // ---- Building body below the floor ----
  const BW = 20 - TX;
  // The ground floor (src/world/hall.js) is built inside this body, right under the 4th floor, so the body is cut around it:
  // solid below the ground floor's slab and above its ceiling, and in between only where the corridors are not.
  const zA = -0.5, zB = GAME_Z1 + 0.7, gy = GROUND_Y - 0.02, gt = GROUND_Y + CEIL + 0.05; // body z range, floor level, top of the ground ceiling
  const part = (xa, xb, za, zb, ya, yb) => { if (xb > xa + 0.01 && zb > za + 0.01) box(root, M.wallWarm, xb - xa, yb - ya, zb - za, (xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2, { shadow: false }); };
  part(TX, 20, zA, zB, -FLOOR_DROP, gy);        // under the ground floor
  part(TX, 20, zA, zB, gt, 0);                  // between its ceiling and the 4th floor
  // the middle band: west of the hall, east of the hall (up to the side corridor), minus the lift shafts the cabins stop in
  let band = [[TX, X0 - 0.1, zA, zB], [X1 + 0.02, 20, zA, Math.min(zB, LNZ0)], [X1 + 0.02, 20, Math.max(zA, LNZ1), zB]];
  for (const L of LIFTS) {
    const xs = [L.x - L.out * 0.1, L.x - L.out * (0.1 + LIFT_DEPTH + 0.06)], hole = [Math.min(...xs), Math.max(...xs), L.z - L.cw / 2 - 0.06, L.z + L.cw / 2 + 0.06];
    band = band.flatMap(([xa, xb, za, zb]) => {
      if (hole[1] <= xa || hole[0] >= xb || hole[3] <= za || hole[2] >= zb) return [[xa, xb, za, zb]];
      return [[xa, hole[0], za, zb], [hole[1], xb, za, zb], [Math.max(xa, hole[0]), Math.min(xb, hole[1]), za, hole[2]], [Math.max(xa, hole[0]), Math.min(xb, hole[1]), hole[3], zb]];
    });
  }
  for (const [xa, xb, za, zb] of band) part(xa, xb, za, zb, gy, gt);
  for (let i = 1; i < 12; i++) box(root, M.blackMatte, 0.05, 0.25, GAME_Z1 + 1.3, TX - 0.01, -i * 3.4, (GAME_Z1 - 1) / 2 + 0.1, { shadow: false });
  void LOBBY_E; void W;

  // ---- Ground, palm canopy, hill and the one distant tower cluster (photo IMG_5660) ----
  buildLandscape(root);
}
