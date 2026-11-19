import * as THREE from 'three';
import { M } from '../materials.js';
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
  box(root, M.wallWarm, BW, FLOOR_DROP, GAME_Z1 + 1.2, TX + BW / 2, -FLOOR_DROP / 2 - 0.01, (GAME_Z1 - 1) / 2 + 0.1, { shadow: false });
  for (let i = 1; i < 12; i++) box(root, M.blackMatte, 0.05, 0.25, GAME_Z1 + 1.3, TX - 0.01, -i * 3.4, (GAME_Z1 - 1) / 2 + 0.1, { shadow: false });
  void LOBBY_E; void W;

  // ---- Ground, palm canopy, hill and the one distant tower cluster (photo IMG_5660) ----
  buildLandscape(root);
}
