import * as THREE from 'three';
import { M, rand } from '../materials.js';
import { box } from '../props.js';
import { buildTerrace, TX } from './terrace.js';
import { windowWall, wall, H, W, D, MEET_Z1, MEET_DOOR, TERRACE_Z1, LOBBY_CEIL, CORNER_Z, CAB_X0, SHELF_Z, LOBBY_E } from './helpers.js';

const FLOOR_DROP = 40; // the office is high up – ground is far below

/** West window wall, terrace with pergola, and a hazy city/hill backdrop. */
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
  wall(root, -0.1, MEET_Z1, -0.1, TERRACE_Z1, { h: H + 0.3, mat: M.wallWarm, t: 0.2 });
  windowWall(root, 0, 0, CAB_X0, 0, LOBBY_CEIL);               // corner cabin, north side
  wall(root, 0, 0, CAB_X0, 0, { h: H - LOBBY_CEIL, y0: LOBBY_CEIL, collide: false });
  void CORNER_Z;

  // ---- Terrace along the west facade (photos IMG_5658–5668) ----
  buildTerrace(root);

  // ---- Building body below the floor ----
  const BW = 20 - TX;
  box(root, M.wallWarm, BW, FLOOR_DROP, TERRACE_Z1 + 1, TX + BW / 2, -FLOOR_DROP / 2 - 0.01, (TERRACE_Z1 - 1) / 2, { shadow: false });
  for (let i = 1; i < 12; i++) box(root, M.blackMatte, 0.05, 0.25, TERRACE_Z1 + 1.1, TX - 0.01, -i * 3.4, (TERRACE_Z1 - 1) / 2, { shadow: false });
  void LOBBY_E; void W;

  // ---- Ground + city ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: '#6f7a64', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -FLOOR_DROP;
  root.add(ground);

  const tones = ['#c8ccca', '#b9bec0', '#d6d4cc', '#a9b0b3', '#ddd9d0'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  const winMat = new THREE.MeshStandardMaterial({ color: '#7d8a92', roughness: 0.4 });
  const city = new THREE.Group();
  root.add(city);
  for (let i = 0; i < 220; i++) {
    const ang = Math.PI * 0.45 + rand() * Math.PI * 1.15; // west half + north (seen from the windows)
    const dist = 160 + Math.pow(rand(), 0.8) * 520;
    const x = Math.cos(ang) * dist;
    const z = D / 2 + Math.sin(ang) * dist;
    const w = 12 + rand() * 22, d = 12 + rand() * 22;
    const h = 10 + Math.pow(rand(), 2.2) * 110;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tones[Math.floor(rand() * tones.length)]);
    b.position.set(x, -FLOOR_DROP + h / 2, z);
    city.add(b);
    if (h > 45) { // window bands on tall towers
      for (let y = 6; y < h - 3; y += 6) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 1.4, d + 0.2), winMat);
        s.position.set(x, -FLOOR_DROP + y, z);
        city.add(s);
      }
    }
  }
  // Green hills on the horizon
  const hillMat = new THREE.MeshStandardMaterial({ color: '#5d6f55', roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), hillMat);
    hill.scale.set(120, 70 + rand() * 60, 220 + rand() * 200);
    hill.position.set(-760 - rand() * 160, -FLOOR_DROP - 10, -500 + i * 130 + rand() * 60);
    root.add(hill);
  }
  // Trees near the base of the building
  const treeMat = new THREE.MeshStandardMaterial({ color: '#4f6b3a', roughness: 1 });
  for (let i = 0; i < 70; i++) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(3 + rand() * 3, 8, 6), treeMat);
    t.position.set(-10 - rand() * 60, -FLOOR_DROP + 2, -50 + rand() * 120);
    root.add(t);
  }
}
