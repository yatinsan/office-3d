import * as THREE from 'three';
import { M, rand } from '../materials.js';
import { box, rbox, sofa, officeChair, visitorChair, splitAC, shelfUnit, beanBag, pottedPlant, conePendant } from '../props.js';
import { solid, addBox } from '../colliders.js';
import { wall, glassWall, worldUV, LOBBY_CEIL, H, CORNER_Z, CAB_BACK, CAB_FRONT, CAB_X0, CAB_SPLIT, CAB_X1, SHELF_Z, LOGO_X } from './helpers.js';

/** White-top executive desk, long axis along x; the boss sits on -z, visitors on +z (slatted wooden front). */
function execDesk(root, x, z, len = 1.6) {
  const g = new THREE.Group();
  g.userData.label = 'Cabin desk';
  g.position.set(x, 0, z);
  root.add(g);
  box(g, M.whiteGloss, len, 0.05, 0.8, 0, 0.77, 0);
  box(g, M.woodDark, len - 0.1, 0.72, 0.05, 0, 0.38, 0.36);
  for (let i = 0; i < 6; i++) box(g, M.black, len - 0.15, 0.02, 0.01, 0, 0.15 + i * 0.1, 0.39, { shadow: false });
  box(g, M.woodDark, 0.05, 0.72, 0.75, -len / 2 + 0.05, 0.38, 0);
  box(g, M.woodDark, 0.45, 0.72, 0.6, len / 2 - 0.25, 0.38, 0);   // drawer pedestal
  box(g, M.black, 0.1, 0.01, 0.1, -0.2, 0.8, 0.15, { shadow: false }); // cable grommet
  box(g, M.black, 0.5, 0.31, 0.03, -0.25, 1.12, -0.2);
  box(g, M.black, 0.04, 0.3, 0.03, -0.25, 0.94, -0.23);
  solid(g);
}

/** Tall white built-in shelving, long axis along z, facing -x (dir=-1) or +x (dir=1), backed against x. */
function builtIns(root, x, z0, z1, dir) {
  const g = new THREE.Group();
  g.userData.label = 'Built-in shelves';
  g.position.set(x + dir * 0.2, 0, (z0 + z1) / 2);
  root.add(g);
  const w = z1 - z0;
  box(g, M.white, 0.4, 2.7, w, 0, 1.35, 0);
  const cols = Math.max(1, Math.round(w / 0.8));
  for (let c = 0; c < cols; c++) {
    const cz = -w / 2 + (c + 0.5) * (w / cols);
    for (const y of [1.2, 1.65, 2.1]) box(g, M.whiteGloss, 0.02, 0.03, w / cols - 0.06, dir * 0.2, y, cz, { shadow: false });
    for (const y of [0.25, 0.6, 0.95]) box(g, M.whiteGloss, 0.02, 0.32, w / cols - 0.06, dir * 0.205, y, cz, { shadow: false });
    if (rand() < 0.6) box(g, M.black, 0.04, 0.18, 0.2, dir * 0.12, 1.32, cz);
    if (rand() < 0.6) box(g, M.gallery, 0.12, 0.2, 0.15, dir * 0.12, 1.75, cz + 0.2);
  }
  addBox(Math.min(x, x + dir * 0.4), z0, Math.max(x, x + dir * 0.4), z1);
}

/** Concrete-finish surface facing +z on the plane z (x0..x1). */
function concreteS(root, x0, x1, z) {
  const w = x1 - x0;
  const m = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(w, LOBBY_CEIL), w, LOBBY_CEIL, 1.6), M.concrete);
  m.position.set((x0 + x1) / 2, LOBBY_CEIL / 2, z + 0.105);
  m.receiveShadow = true;
  root.add(m);
}

function cabin(root, xc, zDesk, { chairsZ, back, len = 1.6, visitors = [-0.4, 0.4] }) {
  execDesk(root, xc, zDesk, len);
  solid(officeChair(root, xc - 0.1, zDesk - 0.75, 0, { exec: true }), -0.1);
  for (const dx of visitors) solid(visitorChair(root, xc + dx, chairsZ, Math.PI), -0.05);
  splitAC(root, xc, 2.55, back + 0.11, 0);
}

/**
 * Cabin row + corridor + window lounge (scan-measured):
 *  corner cabin x 0..3, z 0..3.3 (windows west + north); cabin 2 x 3..7, cabin 1 x 7..9.6 (z 3..6);
 *  corridor z 6..8 running west from reception to the lounge (x 0..3, z 3.3..8) at the windows;
 *  black shelving with planters along z = 8 separates the corridor from the workspace.
 */
export function buildCorridor(root) {
  // ---- Walls ----
  wall(root, CAB_X0, CAB_BACK, CAB_X1, CAB_BACK, { h: H });            // cabins' back wall
  wall(root, CAB_X0, 0, CAB_X0, CAB_FRONT, { h: H });                   // corner cabin | cabin 2 / lounge
  wall(root, CAB_SPLIT, CAB_BACK, CAB_SPLIT, CAB_FRONT, { h: LOBBY_CEIL, t: 0.15 });
  concreteS(root, CAB_X0 + 0.1, CAB_SPLIT - 0.08, CAB_BACK);
  concreteS(root, CAB_SPLIT + 0.08, CAB_X1, CAB_BACK);

  // ---- Glass fronts ----
  glassWall(root, { x0: CAB_X0, z0: CAB_FRONT, x1: CAB_SPLIT, z1: CAB_FRONT, h: LOBBY_CEIL, door: [6.05, 5.15], swing: -1, name: 'Cabin 2 door' }); // hinged at the shared wall, next to cabin 1's door
  glassWall(root, { x0: CAB_SPLIT, z0: CAB_FRONT, x1: CAB_X1, z1: CAB_FRONT, h: LOBBY_CEIL, door: [6.25, 7.15], swing: -1, name: 'Cabin 1 door' }); // hinged at the shared wall, opens into the cabin
  glassWall(root, { x0: 0, z0: CORNER_Z, x1: CAB_X0, z1: CORNER_Z, h: LOBBY_CEIL, door: [0.15, 1.05], swing: -1, name: 'Corner cabin door' }); // window end of the corner cabin

  // ---- Cabin 1 (x 7..9.6): desk, built-ins on the east side ----
  cabin(root, 7.35, 4.35, { chairsZ: 5.15, back: CAB_BACK, len: 1.6, visitors: [0.35, 0.85] }); // scan: desk x 6.6..8.3, z 4.0..4.7
  builtIns(root, CAB_X1, CAB_BACK + 0.1, 5.65, -1);   // white built-ins on cabin 1's east wall (scan frames 412/416)
  // ---- Cabin 2 (x 3..7) ----
  cabin(root, 4.0, 4.35, { chairsZ: 5.15, back: CAB_BACK, len: 1.5 }); // moved west (suggestion 5)
  builtIns(root, CAB_SPLIT - 0.075, CAB_BACK + 0.1, 4.6, -1);
  solid(pottedPlant(root, 5.35, 3.45, { size: 0.35, h: 0.4 }));

  // ---- Corner cabin (x 0..3, z 0..3.3), windows behind the desk ----
  execDesk(root, 1.6, 1.85);
  solid(officeChair(root, 1.5, 1.05, 0, { exec: true }), -0.1);
  for (const x of [1.35, 2.05]) solid(visitorChair(root, x, 2.95, Math.PI), -0.05);
  box(root, M.concrete, 0.55, LOBBY_CEIL, 0.55, CAB_X0 - 0.38, LOBBY_CEIL / 2, 0.38);
  addBox(CAB_X0 - 0.65, 0, CAB_X0, 0.65);
  splitAC(root, CAB_X0 - 0.11, 2.55, 1.8, -Math.PI / 2);
  box(root, M.blackMatte, 0.25, 0.3, 0.25, 2.7, 0.15, 2.9); // waste bin

  // ---- Shelving partition along z = 8 (one walk-through gap at x 2.6..4.2) ----
  wall(root, 0, SHELF_Z, 1.3, SHELF_Z, { h: H, t: 0.3 });            // short white wall at the window corner
  const units = [[1.3, 2.6], [4.3, 5.6], [5.6, 6.9]]; // ends at the concrete fin by the logo wall
  for (const [a, b] of units) {
    const g = new THREE.Group();
    g.position.set(0, 0, SHELF_Z);
    g.rotation.y = Math.PI / 2;               // shelfUnit runs along local z → world x
    root.add(g);
    const cub = [];
    for (let i = 0; i < 3; i++) if (rand() < 0.55) cub.push({ i, row: rand() < 0.5 ? 0 : 1 });
    shelfUnit(g, 0, a, b, { yellowCubbies: cub });
    addBox(a, SHELF_Z - 0.2, b, SHELF_Z + 0.2);
  }

  // ---- Window lounge (x 0..3, z 3.3..8) ----
  solid(beanBag(root, 0.6, 7.25), -0.15);
  // Black leather sofa like the reception one (suggestion 6), back to the corner-cabin wall, facing the windows
  solid(sofa(root, CAB_X0 - 0.47, 5.0, -Math.PI / 2, 2));
  box(root, M.red, 0.55, 0.01, 0.9, 0.5, 0.005, 5.7, { shadow: false }); // doormat at the balcony door
  conePendant(root, 1.9, 4.6, 2.2, LOBBY_CEIL);
  conePendant(root, 5.0, 7.0, 2.25, LOBBY_CEIL);
}
