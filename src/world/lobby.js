import * as THREE from 'three';
import { M } from '../materials.js';
import { box, cyl, plane, sofa, conePendant, pottedPlant } from '../props.js';
import { solid, addBox } from '../colliders.js';
import { slab, wall, glassWall, worldUV, LOBBY_CEIL, H, LOBBY_E, CAB_BACK, CAB_FRONT, CAB_X1, LOGO_X, LOGO_T, LOBBY_S } from './helpers.js';

/** Thin dark inlay line on the east-facing logo wall, from (z0,y0) to (z1,y1). */
function lineE(root, z0, y0, z1, y1) {
  const len = Math.hypot(z1 - z0, y1 - y0);
  box(root, M.blackMatte, 0.01, 0.012, len, LOGO_X + 0.008, (y0 + y1) / 2, (z0 + z1) / 2, { shadow: false, rx: Math.atan2(-(y1 - y0), z1 - z0) });
}

/**
 * Reception (x 7.1..10.4, z 6.0..9.55), measured from the LiDAR scan.
 *  - West: concrete logo wall facing east, black sofa against it; the cabin corridor runs west past its north end.
 *  - East: glass wall + entrance door onto the building's common hall; reception desk in front of the glass.
 *  - South: frosted glass with grey shards (workspace behind).
 *  - North: cabin 1's glass front and the concrete pillar with the trophy niche + fingerprint reader.
 */
export function buildLobby(root) {
  const z0 = 7.4; // logo wall runs z 7.4..9.25 (scan); thin partition
  // ---- Logo wall ----
  box(root, M.concrete, LOGO_T, LOBBY_CEIL, LOBBY_S - z0 + 0.35, LOGO_X - LOGO_T / 2, LOBBY_CEIL / 2, (z0 + LOBBY_S + 0.35) / 2);
  box(root, M.wall, LOGO_T, H - LOBBY_CEIL, LOBBY_S - z0 + 0.35, LOGO_X - LOGO_T / 2, LOBBY_CEIL + (H - LOBBY_CEIL) / 2, (z0 + LOBBY_S + 0.35) / 2, { shadow: false });
  addBox(LOGO_X - LOGO_T, z0, LOGO_X, LOBBY_S + 0.35);
  const fw = LOBBY_S - z0;
  const face = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(fw, LOBBY_CEIL), fw, LOBBY_CEIL, 1.6), M.concrete);
  face.position.set(LOGO_X + 0.003, LOBBY_CEIL / 2, (z0 + LOBBY_S) / 2);
  face.rotation.y = Math.PI / 2;
  face.receiveShadow = true;
  root.add(face);
  lineE(root, LOBBY_S, 3.0, z0 + 0.1, 1.0);
  lineE(root, z0 + 0.1, 1.0, z0 + 0.9, 0.0);
  plane(root, M.logo, 0.5, 0.72, LOGO_X + 0.03, 2.35, 8.25, Math.PI / 2);
  plane(root, M.logoText, 1.0, 0.35, LOGO_X + 0.02, 1.78, 8.3, Math.PI / 2);
  solid(sofa(root, LOGO_X + 0.47, 8.4, Math.PI / 2, 2));
  // Concrete fin at the logo wall's north end (the corridor turns west here)
  box(root, M.concrete, 0.5, LOBBY_CEIL, 0.3, LOGO_X - 0.15, LOBBY_CEIL / 2, z0 + 0.15);

  // ---- South: frosted shard glass onto the workspace ----
  wall(root, LOGO_X - LOGO_T, LOBBY_S + 0.175, 8.3, LOBBY_S + 0.175, { h: H, t: 0.35 }); // 0.35 m thick (scan: faces at 9.25 / 9.6)
  const fp = plane(root, M.glassFrost, LOBBY_E - 8.3, LOBBY_CEIL - 0.1, (8.3 + LOBBY_E) / 2, LOBBY_CEIL / 2, LOBBY_S);
  fp.renderOrder = 2;
  for (const [x, y, r] of [[8.7, 1.5, 0.5], [9.25, 0.9, -0.4], [9.25, 2.2, 0.6], [9.85, 1.4, -0.5]]) {
    box(root, M.concrete, 0.45, 1.0, 0.01, x, y, LOBBY_S - 0.02, { rz: r, shadow: false });
  }
  for (const x of [8.3, 9.35, LOBBY_E]) box(root, M.black, 0.05, LOBBY_CEIL, 0.06, x, LOBBY_CEIL / 2, LOBBY_S);
  box(root, M.black, LOBBY_E - 8.3, 0.06, 0.06, (8.3 + LOBBY_E) / 2, 0.03, LOBBY_S);
  box(root, M.wall, LOBBY_E - 8.3, H - LOBBY_CEIL, 0.15, (8.3 + LOBBY_E) / 2, LOBBY_CEIL + (H - LOBBY_CEIL) / 2, LOBBY_S, { shadow: false });
  addBox(8.3, LOBBY_S - 0.08, LOBBY_E, LOBBY_S + 0.08);

  // ---- East: glass wall + entrance door ----
  glassWall(root, { x0: LOBBY_E, z0: CAB_FRONT, x1: LOBBY_E, z1: 7.6, h: LOBBY_CEIL, panel: 0.8 });
  glassWall(root, { x0: LOBBY_E, z0: 8.65, x1: LOBBY_E, z1: LOBBY_S, h: LOBBY_CEIL, panel: 0.9 });
  const door = plane(root, M.glass, 1.0, 2.35, LOBBY_E, 1.2, 8.12, Math.PI / 2);
  door.renderOrder = 2;
  for (const z of [7.62, 8.63]) box(root, M.black, 0.08, 2.4, 0.05, LOBBY_E, 1.2, z);
  box(root, M.black, 0.08, 0.08, 1.05, LOBBY_E, 2.38, 8.12);
  box(root, M.black, 0.08, 0.1, 1.05, LOBBY_E, 0.05, 8.12);
  box(root, M.glass, 0.02, LOBBY_CEIL - 2.42, 1.0, LOBBY_E, (LOBBY_CEIL + 2.42) / 2, 8.12, { shadow: false }).renderOrder = 2;
  box(root, M.metalDark, 0.06, 0.05, 0.4, LOBBY_E - 0.06, 2.3, 8.4, { shadow: false }); // door closer
  for (const s of [-1, 1]) box(root, M.chrome, 0.03, 0.45, 0.03, LOBBY_E + s * 0.06, 1.05, 7.8);
  addBox(LOBBY_E - 0.08, 7.6, LOBBY_E + 0.08, 8.65);
  box(root, M.wall, 0.15, H - LOBBY_CEIL, LOBBY_S - CAB_FRONT, LOBBY_E, LOBBY_CEIL + (H - LOBBY_CEIL) / 2, (CAB_FRONT + LOBBY_S) / 2, { shadow: false });
  box(root, M.blackMatte, 0.6, 0.01, 1.0, LOBBY_E - 0.45, 0.005, 8.12, { shadow: false }); // doormat

  // ---- Concrete pillar east of cabin 1 with the trophy niche (faces south into reception) ----
  box(root, M.concrete, LOBBY_E - CAB_X1, H, CAB_FRONT - CAB_BACK, (CAB_X1 + LOBBY_E) / 2, H / 2, (CAB_BACK + CAB_FRONT) / 2);
  addBox(CAB_X1, CAB_BACK, LOBBY_E + 0.05, CAB_FRONT);
  const niche = new THREE.Group();
  niche.position.set(9.85, 0, CAB_FRONT);
  root.add(niche);
  box(niche, M.cream, 0.56, 2.3, 0.3, 0, 1.25, 0.15);
  for (const y of [0.75, 1.3, 1.85, 2.35]) box(niche, M.white, 0.58, 0.035, 0.32, 0, y, 0.16);
  for (const [x, y, h] of [[-0.14, 1.87, 0.3], [0.14, 1.87, 0.26], [0.0, 2.37, 0.34]]) cyl(niche, M.bottleYellow, 0.035, 0.05, h, x, y + h / 2, 0.16, { seg: 10 });
  for (const [x, y, c] of [[-0.12, 1.32, M.gallery], [0.13, 1.32, M.red], [0.0, 0.77, M.gallery]]) {
    box(niche, M.black, 0.2, 0.26, 0.03, x, y + 0.14, 0.16, { rx: -0.12 });
    box(niche, c, 0.16, 0.2, 0.01, x, y + 0.14, 0.178, { shadow: false, rx: -0.12 });
  }
  addBox(9.55, CAB_FRONT, 10.15, CAB_FRONT + 0.32);
  box(root, M.white, 0.13, 0.16, 0.04, 9.2, 1.35, CAB_FRONT + 0.02); // fingerprint reader
  box(root, M.bottleBlue, 0.07, 0.05, 0.01, 9.2, 1.38, CAB_FRONT + 0.045, { shadow: false });

  // ---- Reception desk (white, angled front) against the glass ----
  const desk = new THREE.Group();
  desk.position.set(9.3, 0, 6.6); // scan: desk top x 8.9..9.6, z 6.15..6.95
  root.add(desk);
  box(desk, M.cream, 0.7, 0.05, 1.25, 0, 0.8, 0);
  box(desk, M.cream, 0.05, 0.78, 1.25, -0.33, 0.39, 0, { rz: 0.12 });
  for (const s of [-1, 1]) box(desk, M.cream, 0.65, 0.78, 0.05, 0, 0.39, s * 0.6);
  box(desk, M.black, 0.05, 0.05, 1.15, -0.4, 0.03, 0);
  cyl(desk, M.black, 0.035, 0.035, 0.01, 0.1, 0.83, 0.3, { seg: 12 });
  solid(desk);
  conePendant(root, 9.1, 6.5, 2.15, LOBBY_CEIL, 1.3);
  box(root, M.white, 0.08, 0.08, 0.06, LOGO_X + 0.05, 2.85, 9.1); // CCTV dome
  solid(pottedPlant(root, 9.95, 8.95, { size: 0.4, h: 0.45 }));

  // ---- Building common hall beyond the glass ----
  slab(root, M.floorCorridor, LOBBY_E + 0.05, 0, 20, 16, 0.0);
  slab(root, M.white, LOBBY_E + 0.05, 0, 20, 16, 3.1, { down: true });
  wall(root, 20, 0, 20, 16, { h: 3.1, mat: M.wallWarm });
  wall(root, LOBBY_E, 16, 20, 16, { h: 3.1, mat: M.wallWarm });
  wall(root, LOBBY_E, 0, 20, 0, { h: 3.1, mat: M.wallWarm });
  wall(root, LOBBY_E, LOBBY_S, LOBBY_E, 16, { h: 3.1, mat: M.wallWarm, collide: false });
  for (let x = 12; x < 20; x += 3) for (let z = 1.5; z < 16; z += 3) box(root, M.lightStrip, 0.5, 0.02, 0.5, x, 3.09, z, { shadow: false });
  for (const z of [5, 11]) {
    box(root, M.chrome, 0.05, 2.2, 1.2, 19.88, 1.1, z);
    box(root, M.metalDark, 0.06, 2.2, 0.02, 19.86, 1.1, z, { shadow: false });
  }
  box(root, M.wood, 1.0, 2.2, 0.05, 14, 1.1, 15.88); // neighbour office door
}
