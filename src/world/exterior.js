import * as THREE from 'three';
import { M, rand } from '../materials.js';
import { box, pottedPlant } from '../props.js';
import { addBox } from '../colliders.js';
import { slab, windowWall, wall, H, W, D, LOBBY_CEIL, CORNER_Z, CAB_X0, SHELF_Z, LOBBY_E } from './helpers.js';

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
  windowWall(root, 0, SHELF_Z, 0, D, 2.8);
  box(root, M.wall, 0.12, H - 2.8, D - SHELF_Z, 0.02, 2.8 + (H - 2.8) / 2, (SHELF_Z + D) / 2, { shadow: false });
  for (let y = 2.95; y < H - 0.05; y += 0.14) box(root, M.wallWarm, 0.02, 0.03, D - SHELF_Z, 0.09, y, (SHELF_Z + D) / 2, { shadow: false });
  windowWall(root, 0, 0, CAB_X0, 0, LOBBY_CEIL);               // corner cabin, north side
  wall(root, 0, 0, CAB_X0, 0, { h: H - LOBBY_CEIL, y0: LOBBY_CEIL, collide: false });
  void CORNER_Z;

  // ---- Terrace along the west facade ----
  const TX = -3.6;
  slab(root, M.floorTerrace, TX, 0, 0, D, 0.0);
  addBox(TX - 0.1, 0, TX + 0.05, D);      // glass railing
  addBox(TX, -0.15, 0, 0);                 // terrace ends
  addBox(TX, D, 0, D + 0.15);
  // outside the balcony door: a doormat and a plant each side (photo IMG_5653)
  box(root, M.wallWarm, 0.6, 0.01, 0.9, -0.5, 0.006, 5.7, { shadow: false });
  for (const z of [4.55, 6.85]) pottedPlant(root, -0.35, z, { size: 0.35, h: 0.35 });
  const rail = new THREE.Mesh(new THREE.PlaneGeometry(D, 1.05), M.glass);
  rail.position.set(TX, 0.55, D / 2);
  rail.rotation.y = Math.PI / 2;
  rail.renderOrder = 2;
  root.add(rail);
  box(root, M.rail, 0.06, 0.05, D, TX, 1.1, D / 2);
  for (let z = 0; z <= D; z += 3) box(root, M.rail, 0.05, 1.1, 0.05, TX, 0.55, z);
  for (let z = 1.5; z < D; z += 3.5) pottedPlant(root, TX + 0.45, z, { size: 0.5, h: 0.45, mat: M.blackMatte });
  // Pergola (red-brown frame + translucent roof)
  for (let z = 0; z <= D; z += 4.7) box(root, M.pergola, 0.14, H + 0.3, 0.14, TX + 0.1, (H + 0.3) / 2, z);
  box(root, M.pergola, 0.14, 0.16, D, TX + 0.1, H + 0.3, D / 2);
  for (let z = 0; z <= D; z += 1.5) box(root, M.pergola, -TX + 0.3, 0.1, 0.08, TX / 2, H + 0.35, z, { shadow: false });
  box(root, new THREE.MeshStandardMaterial({ color: '#b56b52', transparent: true, opacity: 0.55, roughness: 0.6 }), -TX + 0.3, 0.02, D, TX / 2, H + 0.42, D / 2, { shadow: false });

  // ---- Building body below the floor ----
  const BW = 20 - TX;
  box(root, M.wallWarm, BW, FLOOR_DROP, D + 2, TX + BW / 2, -FLOOR_DROP / 2 - 0.01, D / 2, { shadow: false });
  for (let i = 1; i < 12; i++) box(root, M.blackMatte, 0.05, 0.25, D + 2.1, TX - 0.01, -i * 3.4, D / 2, { shadow: false });
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
