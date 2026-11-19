import { M } from '../materials.js';
import { box, cyl, spot, cassetteAC } from '../props.js';
import { slab, H, LOBBY_CEIL, W, BACK_Z, CORNER_Z, CAB_BACK, CAB_FRONT, CAB_X0, CAB_X1, SHELF_Z, LOGO_X, LOBBY_E, LOBBY_S } from './helpers.js';

export function buildCeilings(root) {
  // Yellow diamond-grid false ceiling: lounge, corridor, reception.
  slab(root, M.diamond, 0, CORNER_Z, CAB_X0, SHELF_Z, LOBBY_CEIL, { down: true });
  slab(root, M.diamond, CAB_X0, CAB_FRONT, LOGO_X, SHELF_Z, LOBBY_CEIL, { down: true });
  slab(root, M.diamond, LOGO_X, CAB_FRONT, LOBBY_E, LOBBY_S, LOBBY_CEIL, { down: true });
  for (const [x, z] of [[1.0, 4.4], [1.0, 6.8], [2.4, 6.8], [4.0, 7.0], [5.6, 7.0], [7.9, 6.9], [9.4, 8.6], [8.2, 8.9]]) spot(root, x, z, LOBBY_CEIL);
  // Yellow fascia where the false ceiling meets the exposed workspace slab (seen from the workspace).
  box(root, M.yellow, LOGO_X, H - LOBBY_CEIL, 0.08, LOGO_X / 2, LOBBY_CEIL + (H - LOBBY_CEIL) / 2, SHELF_Z + 0.04, { shadow: false });
  box(root, M.yellow, LOGO_X, 0.07, 0.14, LOGO_X / 2, LOBBY_CEIL - 0.035, SHELF_Z, { shadow: false });

  // Cabins: plain white ceilings with square diffusers.
  slab(root, M.white, 0, 0, CAB_X0, CORNER_Z, LOBBY_CEIL, { down: true });
  slab(root, M.white, CAB_X0, CAB_BACK, CAB_X1, CAB_FRONT, LOBBY_CEIL, { down: true });
  for (const [x, z] of [[1.5, 1.6], [5.0, 4.5], [8.2, 4.5]]) box(root, M.whiteGloss, 0.35, 0.02, 0.35, x, LOBBY_CEIL - 0.01, z, { shadow: false });

  // Open workspace: exposed black slab, beams, ducts, cassette ACs, red sprinkler pipe.
  slab(root, M.ceilingBlack, 0, SHELF_Z, W, BACK_Z, H, { down: true });
  for (const z of [12.3, 15.3]) box(root, M.ceilingBlack, W, 0.5, 0.4, W / 2, H - 0.25, z, { shadow: false });
  cyl(root, M.ceilingBlack, 0.2, 0.2, W, W / 2, H - 0.45, 9.2, { rz: Math.PI / 2, shadow: false, seg: 14 });
  cyl(root, M.red, 0.04, 0.04, BACK_Z - SHELF_Z, 4.6, H - 0.3, (SHELF_Z + BACK_Z) / 2, { rx: Math.PI / 2, shadow: false, seg: 8 });
  cyl(root, M.red, 0.04, 0.04, W, W / 2, H - 0.3, 17.9, { rz: Math.PI / 2, shadow: false, seg: 8 });
  for (const [x, z] of [[2.0, 12.2], [5.5, 12.2], [2.0, 15.3], [5.5, 15.3], [8.6, 12.2]]) cassetteAC(root, x, z, H - 0.62);
}
