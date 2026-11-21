import { M } from '../materials.js';
import { slab, MEET_X1, MEET_Z1, W, BACK_Z, CORNER_Z, CAB_BACK, CAB_FRONT, CAB_X0, CAB_X1, SHELF_Z, LOGO_X, LOGO_T, LOBBY_E, LOBBY_S } from './helpers.js';
import { buildCeilings } from './ceiling.js';
import { buildLobby } from './lobby.js';
import { buildCorridor } from './corridor.js';
import { buildWorkspace } from './workspace.js';
import { buildExterior } from './exterior.js';
import { buildMeetingRoom } from './meeting.js';
import { buildGameRoom } from './game.js';
import * as THREE from 'three';
import { lvl } from '../colliders.js';
import { buildHall, buildGroundFloor, GROUND_Y, setHallDevSigns } from './hall.js';
export { setHallDevSigns };

// Start in reception, facing the logo wall (west).
export const SPAWN = { x: 12.75, z: 17.72, yaw: 1.05 };

export function buildWorld(root) {
  slab(root, M.floorBeige, 0, 0, CAB_X0, SHELF_Z, 0);                   // corner cabin + lounge
  slab(root, M.floorBeige, CAB_X0, CAB_BACK, LOBBY_E, SHELF_Z, 0);       // cabins + corridor + reception (north part)
  slab(root, M.floorBeige, LOGO_X - LOGO_T, SHELF_Z, LOBBY_E, LOBBY_S, 0); // reception (south part)
  slab(root, M.floorDark, 0, SHELF_Z, LOGO_X - LOGO_T, LOBBY_S, 0);        // open workspace
  slab(root, M.floorDark, 0, LOBBY_S, W, BACK_Z, 0);
  buildCeilings(root);
  buildLobby(root);
  buildHall(root);
  // ground floor: directly under the 4th floor (same x/z), its own collision level
  const gg = new THREE.Group(); gg.position.y = GROUND_Y; root.add(gg);
  lvl.build = 1; buildGroundFloor(gg); lvl.build = 0;
  buildCorridor(root);
  buildWorkspace(root);
  buildExterior(root);
  buildMeetingRoom(root);
  buildGameRoom(root);
}

/** Named areas for the on-screen zone label. */
export function zoneAt(x, z, y) {
  if (y !== undefined ? y < GROUND_Y / 2 : lvl.cur === 1) return 'Ground Floor'; // y: a pinned point's height; without it, the floor I am on
  if (x > LOBBY_E) return 'Building Hall';
  if (x < 0) return 'Terrace';
  if (z > MEET_Z1) return 'Game Room';
  if (z > BACK_Z) return x < MEET_X1 ? 'Meeting Room' : 'Workspace';
  if (z < CORNER_Z && x < CAB_X0) return 'Corner Cabin';
  if (z < CAB_FRONT && z > CAB_BACK && x > CAB_X0 && x < CAB_X1) return x < 7 ? 'Cabin 2' : 'Cabin 1';
  if (x >= LOGO_X && z < LOBBY_S) return 'Reception';
  if (z < SHELF_Z) return x < CAB_X0 ? 'Window Lounge' : 'Cabin Corridor';
  return 'Workspace';
}
