import * as THREE from 'three';
import { M } from '../materials.js';
import { box, cyl, sofa, beanBag } from '../props.js';
import { addBox, solid } from '../colliders.js';
import { slab, wall, H, MEET_X1, MEET_Z1, GAME_X1, GAME_Z1 } from './helpers.js';

/**
 * Game room behind the meeting room's white door (suggestion 17): a compact play area, not too big.
 * West half: PS5 corner (big TV on a navy accent wall with an LED strip, white console, sofa facing it,
 * coffee table with controllers, two bean bags). East half: a pool table with balls + cues under a long
 * pendant, a cue rack on the wall and a neon "GAME ON" sign.
 */
// TV screen in the PS5 corner; src/arcade.js draws the game menu + games onto it (suggestion 18).
export const TV = { x: 0.088, y: 1.4, z: 25.35, w: 1.68, h: 0.94 };

// Pool table (long axis along z): centre, felt size, ball radius, felt top. src/pool.js plays on it.
export const POOL = { px: 5.0, pz: 25.0, pl: 2.3, pw: 1.25, r: 0.028, y: 0.82 };

const std = (o) =>new THREE.MeshStandardMaterial(o);
const G = {
  navy: std({ color: '#1e2740', roughness: 0.9 }),
  ledPurple: std({ color: '#b46cff', emissive: '#9b4dff', emissiveIntensity: 2.2 }),
  ledCyan: std({ color: '#5fe3ff', emissive: '#29c8ff', emissiveIntensity: 1.8 }),
  felt: std({ color: '#1f6b46', roughness: 0.95 }),
  railWood: std({ color: '#5a3522', roughness: 0.5 }),
  ps5White: std({ color: '#f4f4f2', roughness: 0.35 }),
  rug: std({ color: '#3a3f4b', roughness: 1 }),
  cue: std({ color: '#c79a62', roughness: 0.5 }),
  beanRed: std({ color: '#a8322d', roughness: 0.95 }),
  beanBlue: std({ color: '#2d4f8a', roughness: 0.95 }),
};

const ballColors = ['#f2c21b', '#1f4fb4', '#c8281f', '#5b2a86', '#ef7a1a', '#1d7a3c', '#7a1f1f', '#111111'];
export const ballMats = ballColors.map((c) => std({ color: c, roughness: 0.2, metalness: 0.05 }));
export const cueBallMat = G.ps5White;

const neonTex = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.font = '700 110px "Avenir Next", "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#ff4fd8'; g.shadowBlur = 24;
  g.fillStyle = '#ffd6f6';
  g.fillText('GAME ON', 256, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
G.neon = std({ map: neonTex, emissive: '#ffffff', emissiveMap: neonTex, emissiveIntensity: 1.6, transparent: true, alphaTest: 0.05 });

function grp(parent, label, x = 0, z = 0, ry = 0) {
  const g = new THREE.Group();
  g.userData.label = label;
  g.position.set(x, 0, z); g.rotation.y = ry;
  parent.add(g);
  return g;
}

function controller(parent, x, y, z, ry, mat) {
  const c = grp(parent, 'Controller', x, z, ry);
  box(c, mat, 0.16, 0.035, 0.07, 0, y, 0, { shadow: false });
  for (const s of [-1, 1]) box(c, mat, 0.05, 0.035, 0.06, s * 0.065, y, 0.04, { shadow: false, ry: s * 0.4 });
  box(c, M.black, 0.11, 0.004, 0.03, 0, y + 0.019, -0.005, { shadow: false });
}

export function buildGameRoom(root) {
  const g = grp(root, 'Game room');
  const z0 = MEET_Z1 + 0.2; // game-side face of the meeting room wall

  // ---- Shell ----
  slab(g, M.floorDark, 0, MEET_Z1, GAME_X1, GAME_Z1, 0);
  slab(g, M.ceilingBlack, 0, MEET_Z1, GAME_X1, GAME_Z1, H, { down: true });
  wall(g, MEET_X1 + 0.2, MEET_Z1 + 0.1, GAME_X1 + 0.2, MEET_Z1 + 0.1, { h: H, mat: M.white }); // north, east of the meeting room
  wall(g, GAME_X1 + 0.1, MEET_Z1, GAME_X1 + 0.1, GAME_Z1 + 0.2, { h: H, mat: M.white });        // east
  wall(g, 0, GAME_Z1 + 0.1, GAME_X1 + 0.2, GAME_Z1 + 0.1, { h: H, mat: M.white });              // south
  box(g, M.ceilingBlack, GAME_X1, 0.4, 0.3, GAME_X1 / 2, H - 0.2, (z0 + GAME_Z1) / 2, { shadow: false }); // beam

  // ---- PS5 corner on the west (facade) wall ----
  const tvZ = TV.z;
  box(g, G.navy, 0.02, H, GAME_Z1 - z0 - 0.4, 0.01, H / 2, (z0 + GAME_Z1) / 2);      // accent wall
  box(g, G.ledPurple, 0.02, 0.025, GAME_Z1 - z0 - 0.6, 0.03, H - 0.25, (z0 + GAME_Z1) / 2, { shadow: false });
  { const tv = grp(g, 'TV');
    box(tv, M.black, 0.05, 0.98, 1.72, 0.06, 1.4, tvZ);
    box(tv, M.screenDark, 0.005, 0.94, 1.68, 0.087, 1.4, tvZ, { shadow: false });
    box(tv, G.ledCyan, 0.01, 1.06, 1.8, 0.03, 1.4, tvZ, { shadow: false }); }            // glow behind the TV
  { const con = grp(g, 'TV console');
    box(con, M.white, 0.42, 0.42, 1.9, 0.24, 0.21, tvZ);
    for (const z of [tvZ - 0.48, tvZ + 0.48]) box(con, M.metalDark, 0.005, 0.32, 0.9, 0.452, 0.21, z, { shadow: false });
    addBox(0, tvZ - 0.95, 0.45, tvZ + 0.95); }
  { const ps = grp(g, 'PS5', 0.25, tvZ + 0.65);                                          // upright console
    box(ps, M.black, 0.06, 0.38, 0.22, 0, 0.62, 0);
    for (const s of [-1, 1]) box(ps, G.ps5White, 0.02, 0.4, 0.26, s * 0.04, 0.63, 0, { rz: s * 0.04 });
    box(ps, M.black, 0.1, 0.02, 0.12, 0, 0.43, 0, { shadow: false }); }
  box(g, M.blackMatte, 0.18, 0.26, 0.18, 0.25, 0.55, tvZ - 0.75);                        // speaker
  // rug, sofa facing the TV, coffee table with controllers, bean bags
  box(g, G.rug, 2.2, 0.01, 2.4, 1.75, 0.006, tvZ, { shadow: false });
  solid(sofa(g, 2.95, tvZ, -Math.PI / 2, 3), -0.05);
  { const ct = grp(g, 'Coffee table');
    box(ct, M.woodDark, 0.55, 0.04, 1.0, 1.75, 0.4, tvZ);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(ct, M.black, 0.03, 0.38, 0.03, 1.75 + sx * 0.23, 0.19, tvZ + sz * 0.45);
    addBox(1.45, tvZ - 0.52, 2.05, tvZ + 0.52); }
  controller(g, 1.72, 0.44, tvZ - 0.22, 0.3, G.ps5White);
  controller(g, 1.8, 0.44, tvZ + 0.2, -0.2, G.ps5White);
  box(g, M.black, 0.12, 0.02, 0.05, 1.68, 0.43, tvZ + 0.38, { shadow: false, ry: 0.5 });  // remote
  for (const [z, mat] of [[23.8, G.beanRed], [26.65, G.beanBlue]]) solid(beanBag(g, 1.35, z, mat), -0.15);

  // ---- Pool table (long axis along z) ----
  const { px, pz, pl, pw } = POOL;
  { const pt = grp(g, 'Pool table');
    box(pt, G.railWood, pw + 0.2, 0.2, pl + 0.2, px, 0.7, pz);                            // body
    box(pt, G.felt, pw, 0.02, pl, px, 0.81, pz, { shadow: false });                     // playing surface
    for (const s of [-1, 1]) {                                                          // cushions + wood rails
      box(pt, G.felt, 0.06, 0.05, pl, px + s * (pw / 2 - 0.03), 0.835, pz, { shadow: false });
      box(pt, G.felt, pw, 0.05, 0.06, px, 0.835, pz + s * (pl / 2 - 0.03), { shadow: false });
      box(pt, G.railWood, 0.1, 0.06, pl + 0.2, px + s * (pw / 2 + 0.05), 0.83, pz);
      box(pt, G.railWood, pw + 0.2, 0.06, 0.1, px, 0.83, pz + s * (pl / 2 + 0.05));
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(pt, G.railWood, 0.14, 0.62, 0.14, px + sx * (pw / 2 - 0.05), 0.31, pz + sz * (pl / 2 - 0.1));
    for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) {                            // pockets
      const pk = new THREE.Mesh(new THREE.CircleGeometry(0.055, 14), M.black);
      pk.rotation.x = -Math.PI / 2;
      pk.position.set(px + sx * (pw / 2 - 0.04), 0.865, pz + sz * (pl / 2 - 0.04));
      pt.add(pk);
    }
    // the balls are live meshes owned by src/pool.js (they move, so they can't be part of the merged static world)
    addBox(px - pw / 2 - 0.1, pz - pl / 2 - 0.1, px + pw / 2 + 0.1, pz + pl / 2 + 0.1); }
  { const lamp = grp(g, 'Pool light');                                                 // long pendant over the table
    box(lamp, M.black, 0.32, 0.12, 1.7, px, 1.85, pz);
    for (const dz of [-0.55, 0, 0.55]) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.4), M.lightStrip);
      glow.rotation.x = Math.PI / 2; glow.position.set(px, 1.789, pz + dz);
      lamp.add(glow);
    }
    for (const dz of [-0.7, 0.7]) cyl(lamp, M.black, 0.004, 0.004, H - 1.91, px, (H + 1.91) / 2, pz + dz, { seg: 3, shadow: false }); }
  { const rack = grp(g, 'Cue rack');                                                   // on the east wall
    box(rack, M.woodDark, 0.05, 0.08, 0.7, GAME_X1 - 0.03, 1.55, 23.6);
    box(rack, M.woodDark, 0.05, 0.06, 0.7, GAME_X1 - 0.03, 0.1, 23.6);
    for (let i = 0; i < 4; i++) cyl(rack, G.cue, 0.007, 0.013, 1.5, GAME_X1 - 0.07, 0.8, 23.35 + i * 0.16, { seg: 8 }); }

  // ---- Neon sign + light ----
  { const n = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.47), G.neon);
    n.position.set(4.7, 2.45, GAME_Z1 - 0.01); n.rotation.y = Math.PI;
    n.userData.label = 'Neon sign';
    g.add(n); }
  for (const [x, z] of [[1.8, 23.6], [1.8, 26.4]]) {
    cyl(g, M.black, 0.05, 0.05, 0.12, x, H - 0.06, z, { seg: 10, shadow: false });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), M.spotGlow);
    glow.rotation.x = Math.PI / 2; glow.position.set(x, H - 0.121, z);
    g.add(glow);
  }
}
