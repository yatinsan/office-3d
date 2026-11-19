import * as THREE from 'three';
import { M } from '../materials.js';
import { box, cyl, officeChair, linearLight, splitAC } from '../props.js';
import { addBox } from '../colliders.js';
import { slab, wall, doorLeaves, H, BACK_Z, MEET_X1, MEET_Z1, GAME_DOOR } from './helpers.js';

/**
 * Meeting room behind the workspace back wall on the window side (suggestions 13 + 14, photos IMG_5669–5673):
 * white walls, exposed black slab, long grey-oak table with mesh chairs, TV on a rolling stand in front of the
 * glass window to the workspace, grey linear light + black cylinder pendants, split AC, white flush door and a
 * tall white shelf in the window corner. The glass double door to the terrace is in src/doors.js.
 */
const greyOak = new THREE.MeshStandardMaterial({ color: '#a39b91', roughness: 0.55 });
const edge = new THREE.MeshStandardMaterial({ color: '#ece7dc', roughness: 0.6 });
const doorWhite = new THREE.MeshStandardMaterial({ color: '#e9e4d6', roughness: 0.7 });
const lampGrey = new THREE.MeshStandardMaterial({ color: '#6c6a66', roughness: 0.5, metalness: 0.3 });

function cylPendant(root, x, z, y = 2.45) {
  cyl(root, M.black, 0.004, 0.004, H - y, x, (H + y) / 2, z, { seg: 3, shadow: false });
  cyl(root, M.black, 0.045, 0.045, 0.2, x, y - 0.1, z, { seg: 14 });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), M.spotGlow);
  glow.rotation.x = Math.PI / 2; glow.position.set(x, y - 0.201, z);
  root.add(glow);
}

export function buildMeetingRoom(root) {
  const g = new THREE.Group();
  g.userData.label = 'Meeting room';
  root.add(g);

  // ---- Shell ----
  slab(g, M.floorDark, 0, BACK_Z, MEET_X1, MEET_Z1, 0);
  slab(g, M.ceilingBlack, 0, BACK_Z, MEET_X1, MEET_Z1, H, { down: true });
  wall(g, MEET_X1 + 0.1, BACK_Z, MEET_X1 + 0.1, MEET_Z1 + 0.1, { h: H, mat: M.white });
  // far wall with the opening for the white door to the game room (suggestion 17)
  const [gd0, gd1] = GAME_DOOR;
  wall(g, 0, MEET_Z1 + 0.1, gd0, MEET_Z1 + 0.1, { h: H, mat: M.white });
  wall(g, gd1, MEET_Z1 + 0.1, MEET_X1 + 0.2, MEET_Z1 + 0.1, { h: H, mat: M.white });
  wall(g, gd0, MEET_Z1 + 0.1, gd1, MEET_Z1 + 0.1, { h: H - 2.12, y0: 2.12, mat: M.white, collide: false });
  cyl(g, M.ceilingBlack, 0.16, 0.16, MEET_Z1 - BACK_Z, MEET_X1 - 0.35, H - 0.3, (BACK_Z + MEET_Z1) / 2, { rx: Math.PI / 2, seg: 12, shadow: false }); // duct
  box(g, M.ceilingBlack, MEET_X1, 0.35, 0.3, MEET_X1 / 2, H - 0.18, BACK_Z + 0.25, { shadow: false });  // beam over the window
  for (const [x0, z0, x1, z1] of [[0, MEET_Z1 - 0.01, MEET_X1, MEET_Z1 - 0.01], [MEET_X1 - 0.01, BACK_Z, MEET_X1 - 0.01, MEET_Z1]]) // grey skirting
    box(g, M.concrete, Math.max(0.02, x1 - x0), 0.08, Math.max(0.02, z1 - z0), (x0 + x1) / 2, 0.04, (z0 + z1) / 2, { shadow: false });

  // ---- Long grey-oak table along z with mesh chairs ----
  const tx = 1.9, tz0 = 19.85, tz1 = 22.0, tw = 1.0, tz = (tz0 + tz1) / 2;
  { const t = new THREE.Group(); t.userData.label = 'Meeting table'; g.add(t);
    box(t, greyOak, tw, 0.04, tz1 - tz0, tx, 0.75, tz);
    box(t, edge, tw + 0.01, 0.025, tz1 - tz0 + 0.01, tx, 0.72, tz, { shadow: false });
    for (const z of [tz0 + 0.15, tz1 - 0.15]) for (const s of [-1, 1]) box(t, M.black, 0.05, 0.72, 0.05, tx + s * (tw / 2 - 0.08), 0.36, z);
    for (const z of [tz0 + 0.5, tz - 0.1, tz1 - 0.6]) { // cable grommets
      const gr = new THREE.Mesh(new THREE.CircleGeometry(0.04, 14), M.black);
      gr.rotation.x = -Math.PI / 2; gr.position.set(tx + 0.1, 0.772, z); t.add(gr);
    }
    box(t, M.black, 0.05, 0.02, 0.2, tx - 0.15, 0.78, tz - 0.4, { shadow: false, ry: 0.4 }); // remote
    addBox(tx - tw / 2, tz0, tx + tw / 2, tz1); }
  for (const z of [tz0 + 0.4, tz, tz1 - 0.4]) {
    officeChair(g, tx - tw / 2 - 0.32, z, Math.PI / 2);
    officeChair(g, tx + tw / 2 + 0.32, z, -Math.PI / 2);
  }
  officeChair(g, tx, tz1 + 0.35, Math.PI);

  // ---- TV on a rolling stand in front of the window, facing the table ----
  { const tv = new THREE.Group(); tv.userData.label = 'TV'; tv.position.set(1.75, 0, 19.25); g.add(tv);
    for (let i = 0; i < 4; i++) box(tv, M.black, 0.04, 0.03, 0.34, Math.sin(i * Math.PI / 2) * 0.15, 0.04, Math.cos(i * Math.PI / 2) * 0.15, { ry: i * Math.PI / 2 });
    cyl(tv, M.black, 0.025, 0.025, 1.5, 0, 0.78, 0, { seg: 8 });
    box(tv, M.black, 1.1, 0.64, 0.06, 0, 1.55, 0.03);
    box(tv, M.screenOff, 1.06, 0.6, 0.005, 0, 1.55, 0.062, { shadow: false });
    addBox(1.55, 19.05, 1.95, 19.45); }

  // ---- Lights, AC ----
  { const ll = linearLight(g, tx, tz, 1.8, Math.PI / 2, 2.35, H);
    ll.children[0].material = lampGrey;
    ll.children[0].scale.set(1.8, 0.09, 0.09); }
  for (const [x, z] of [[0.8, 19.6], [0.8, 21.6], [3.0, 19.6], [3.0, 21.6]]) cylPendant(g, x, z);
  splitAC(g, MEET_X1 - 0.02, 2.7, 20.6, -Math.PI / 2);

  // ---- White flush door in the far wall + tall white shelf in the window corner (IMG_5670/5671) ----
  { const d = new THREE.Group(); d.userData.label = 'Door frame'; g.add(d);
    const fz = MEET_Z1 + 0.1, w = gd1 - gd0;
    for (const x of [gd0 - 0.02, gd1 + 0.02]) box(d, edge, 0.04, 2.14, 0.22, x, 1.07, fz);   // jambs
    box(d, edge, w + 0.08, 0.04, 0.22, (gd0 + gd1) / 2, 2.14, fz);                        // head
    // the leaf opens with F (src/doors.js); hinge on the east jamb, swings into the game room
    const leaf = new THREE.Group();
    leaf.position.set(gd1, 0, fz);
    const lw = w - 0.02;
    box(leaf, doorWhite, lw, 2.08, 0.04, -lw / 2, 1.05, 0);
    for (const s of [-1, 1]) {
      box(leaf, M.chrome, 0.025, 0.32, 0.03, -lw + 0.1, 1.05, s * 0.06);
      for (const y of [0.92, 1.18]) box(leaf, M.chrome, 0.02, 0.02, 0.05, -lw + 0.1, y, s * 0.035, { shadow: false });
    }
    doorLeaves.push({
      leaf, closed: 0, open: 1.45, name: 'game room door', x: (gd0 + gd1) / 2, z: fz,
      block: { minX: gd0, maxX: gd1, minZ: fz - 0.1, maxZ: fz + 0.1 },
    }); }
  { const sh = new THREE.Group(); sh.userData.label = 'Shelf'; g.add(sh);
    const sx = 0.38, sz = MEET_Z1 - 0.3, sw = 0.5, sd = 0.38, sH = 2.3;
    for (const s of [-1, 1]) box(sh, M.white, 0.02, sH, sd, sx + s * sw / 2, sH / 2, sz);
    box(sh, M.white, sw, sH, 0.02, sx, sH / 2, sz + sd / 2);
    for (const y of [0.02, 0.55, 0.95, 1.45, 1.9, sH]) box(sh, M.white, sw, 0.02, sd, sx, y, sz);
    box(sh, M.white, sw - 0.02, 0.52, 0.02, sx, 0.28, sz - sd / 2, { shadow: false }); // bottom cupboard door
    box(sh, M.woodDark, 0.3, 0.16, 0.22, sx, 1.04, sz);                           // carton
    box(sh, M.black, 0.26, 0.02, 0.16, sx, 1.47, sz, { shadow: false });         // tray
    addBox(sx - sw / 2, sz - sd / 2, sx + sw / 2, sz + sd / 2); }

  // ---- Low wooden cabinet under the window to the workspace (IMG_5669) ----
  { const c = new THREE.Group(); c.userData.label = 'Cabinet'; g.add(c);
    box(c, M.woodDark, 0.9, 0.45, 0.4, 0.95, 0.225, BACK_Z + 0.32);
    box(c, M.white, 0.42, 0.2, 0.01, 0.75, 0.32, BACK_Z + 0.52, { shadow: false });
    addBox(0.5, BACK_Z + 0.1, 1.4, BACK_Z + 0.52); }
}
