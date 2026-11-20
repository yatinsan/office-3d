import * as THREE from 'three';
import { M } from '../materials.js';
import { box, cyl, plane } from '../props.js';
import { addBox } from '../colliders.js';
import { slab, worldUV, LOBBY_E, LOBBY_S, CAB_BACK, EAST_DOORS, DOOR_HALF, DOOR_TOP } from './helpers.js';

/**
 * Building common hall outside the office entrance (suggestions 23 + 24, photos IMG_5704–5707).
 * Runs north–south along the office's east glass front:
 *  - glossy beige marble floor with a darker brown marble band along the east side, dark skirting
 *  - 600 mm grid false ceiling with lowered side bulkheads + warm cove light, square AC diffusers, downlights, CCTV
 *  - west (office) side: white wall with fire-hose cabinet + fire exit door, concrete pillar, the glass entrance,
 *    then concrete wall with switch + fingerprint reader + the pixbit sign and a frosted glass panel
 *  - east side: glass door, gents toilet (wood-laminate door with vision slot, blade sign, fire ball), caution sign,
 *    the neighbour office (black glass double door, diamond-pattern wall with sign between wood strips), more glass fronts
 *  - window walls at both ends with a low sill, hanging FIRE EXIT sign at the north end; the north end is wider on the
 *    east side (glass door in that bay); beyond the office both sides are black-framed glass office fronts (27–30)
 */
const X0 = LOBBY_E;   // office side (west)
const X1 = LOBBY_E + 5.8; // east wall: one straight wall, hall pulled in closer (suggestion 33, was 24 ft)
const Z0 = -2.0;      // north window
const Z1 = 42.0;      // south window (long corridor with offices both sides, IMG_5707 / suggestion 30)
const CEIL = 3.2;     // grid ceiling
const BULK = 3.0;     // side bulkheads (meet the top of the entrance glass)
const BW = 0.6;       // bulkhead width
const BAND = 2.4;     // brown marble band along the east wall

// Local deterministic random (keeps the shared rand() sequence of the rest of the office unchanged).
let s = 4242;
const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

function tex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Polished marble: 2x2 tiles per texture (0.8 m tiles when the texture spans 1.6 m), soft veins, fine grout. */
function marble(base, vein, grout) {
  return tex(1024, 1024, (g, w) => {
    const n = 2, t = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = (rnd() - 0.5) * 14;
      g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`;
      g.fillRect(i * t, j * t, t, t);
      g.save();
      g.beginPath(); g.rect(i * t, j * t, t, t); g.clip();
      for (let k = 0; k < 7; k++) { // veins
        g.strokeStyle = vein.replace('A', (0.06 + rnd() * 0.14).toFixed(2));
        g.lineWidth = 0.8 + rnd() * 2;
        g.beginPath();
        let x = i * t + rnd() * t, y = j * t;
        g.moveTo(x, y);
        for (let q = 0; q < 6; q++) { x += (rnd() - 0.4) * t * 0.5; y += t / 5; g.quadraticCurveTo(x + (rnd() - 0.5) * 60, y - t / 10, x, y); }
        g.stroke();
      }
      for (let k = 0; k < 400; k++) { // cloudiness
        const d = (rnd() - 0.5) * 18;
        g.fillStyle = `rgba(${base[0] + d},${base[1] + d},${base[2] + d},0.25)`;
        g.beginPath(); g.arc(i * t + rnd() * t, j * t + rnd() * t, 4 + rnd() * 18, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
    g.strokeStyle = grout; g.lineWidth = 2;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, w); g.stroke();
      g.beginPath(); g.moveTo(0, i * t); g.lineTo(w, i * t); g.stroke();
    }
  });
}

const gridTex = tex(256, 256, (g, w) => { // 2x2 ceiling tiles of 0.6 m
  g.fillStyle = '#f1f0ec'; g.fillRect(0, 0, w, w);
  for (let k = 0; k < 1500; k++) { g.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * w, 1.5, 1.5); }
  g.strokeStyle = '#c9c7c0'; g.lineWidth = 3;
  for (const p of [0, w / 2, w]) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, w); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); }
});
const diffuserTex = tex(128, 128, (g, w) => {
  g.fillStyle = '#e9e8e4'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 6; i++) { const m = 8 + i * 9; g.strokeStyle = i % 2 ? '#bdbbb5' : '#8e8c86'; g.lineWidth = 4; g.strokeRect(m, m, w - 2 * m, w - 2 * m); }
  g.fillStyle = '#55534f'; g.fillRect(56, 56, 16, 16);
}, false);
const diamondTex = tex(256, 256, (g, w) => { // white wall panel with fine diamond grooves
  g.fillStyle = '#ecebe6'; g.fillRect(0, 0, w, w);
  g.strokeStyle = '#c6c4bd'; g.lineWidth = 2;
  for (const [a, b, c, d] of [[0, w / 2, w / 2, 0], [w / 2, 0, w, w / 2], [w, w / 2, w / 2, w], [w / 2, w, 0, w / 2]]) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
});
const laminateTex = tex(256, 512, (g, w, h) => { // toilet door: light grey-beige laminate with horizontal grooves
  g.fillStyle = '#d9d2c3'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 600; k++) { g.fillStyle = `rgba(120,105,85,${0.05 + rnd() * 0.08})`; g.fillRect(rnd() * w, rnd() * h, 10 + rnd() * 50, 1); }
  g.fillStyle = 'rgba(110,100,85,.55)';
  for (let y = 22; y < h; y += 26) g.fillRect(0, y, w, 2);
}, false);

/** Text sign texture. */
function sign(text, { bg = '#0f8a3c', fg = '#ffffff', w = 512, h = 128, font = 'bold 64px system-ui, sans-serif', icon = '' } = {}) {
  return tex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font;
    g.fillText(icon ? `${icon}  ${text}` : text, w / 2, h / 2 + 2);
  }, false);
}
const std = (o) => new THREE.MeshStandardMaterial(o);
const glowSign = (t) => std({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.55, roughness: 0.4 });

const H = {
  floor: std({ map: marble([214, 196, 170], 'rgba(150,120,90,A)', '#b9a487'), roughness: 0.08, metalness: 0.05, envMapIntensity: 1.6 }),
  floorBrown: std({ map: marble([104, 82, 66], 'rgba(205,190,170,A)', '#4e3c30'), roughness: 0.08, metalness: 0.05, envMapIntensity: 1.6 }),
  skirting: std({ color: '#4a3326', roughness: 0.25 }),
  wall: std({ color: '#ecebe6', roughness: 0.92 }),
  grid: std({ map: gridTex, roughness: 0.95 }),
  diffuser: std({ map: diffuserTex, roughness: 0.8 }),
  steel: std({ color: '#a7aba9', roughness: 0.45, metalness: 0.55 }),
  doorWhite: std({ color: '#efeee8', roughness: 0.6 }),
  frame: std({ color: '#d8d2c2', roughness: 0.6 }),
  laminate: std({ map: laminateTex, roughness: 0.55 }),
  diamond: std({ map: diamondTex, roughness: 0.85 }),
  woodStrip: std({ color: '#6a4126', roughness: 0.5 }),
  darkGlass: new THREE.MeshStandardMaterial({ color: '#2c3a2c', transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide }),
  orange: std({ color: '#ff6a12', roughness: 0.35 }),
  caution: std({ map: sign('CAUTION', { bg: '#f2b90f', fg: '#2a2a2a', w: 256, h: 512, font: 'bold 44px system-ui, sans-serif' }), roughness: 0.5 }),
  red: std({ color: '#c42a22', roughness: 0.5 }),
  fireExit: glowSign(sign('FIRE EXIT  ←', { w: 512, h: 112, font: 'bold 60px system-ui, sans-serif' })),
  fireExt: glowSign(sign('FIRE EXTINGUISHER', { w: 512, h: 96, font: 'bold 44px system-ui, sans-serif' })),
  pushBar: glowSign(sign('PUSH BAR TO OPEN', { w: 512, h: 96, font: 'bold 44px system-ui, sans-serif' })),
  exitSmall: glowSign(sign('EXIT', { w: 256, h: 96, font: 'bold 60px system-ui, sans-serif' })),
  gents: std({ map: sign('GENTS TOILET', { bg: '#141414', w: 512, h: 112, font: 'bold 54px system-ui, sans-serif', icon: '🚹' }), roughness: 0.4 }),
  techno: std({ map: tex(512, 280, (g, w, h) => {
    g.fillStyle = '#f7f7f5'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b5fae'; g.fillRect(w * 0.58, h * 0.3, w * 0.42, h * 0.32);
    g.font = 'bold 66px system-ui, sans-serif'; g.textBaseline = 'middle';
    g.fillStyle = '#2b5fae'; g.fillText('Techn', 22, h * 0.46);
    g.fillStyle = '#ffffff'; g.fillText('aureus', w * 0.6, h * 0.46);
    g.fillStyle = '#555'; g.font = '22px system-ui, sans-serif'; g.fillText('IT STRATEGY & TECHNOLOGY PARTNER', 24, h * 0.78);
  }, false), roughness: 0.5 }),
  pixPanel: std({ color: '#3c3e40', roughness: 0.5, metalness: 0.2 }),
  pixText: std({ map: tex(256, 96, (g, w, h) => {
    g.fillStyle = '#3c3e40'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4aa3df'; g.font = 'bold 50px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('pixbit', w / 2, h * 0.42);
    g.fillStyle = '#cfd2d4'; g.font = '16px system-ui, sans-serif'; g.fillText('solutions', w / 2, h * 0.8);
  }, false), roughness: 0.5 }),
  mat: std({ color: '#3b2620', roughness: 1 }),
  slot: std({ color: '#5d6a6e', roughness: 0.1, metalness: 0.4 }),
  room: std({ color: '#cfccc4', roughness: 0.9 }),
  roomCeil: std({ color: '#e9e7e1', roughness: 0.95 }),
  desk: std({ color: '#c8b79c', roughness: 0.7 }),
  officeGlass: new THREE.MeshStandardMaterial({ color: '#33403a', transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide }),
  pixLetters: std({ map: tex(512, 216, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#141414'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 128px system-ui, sans-serif'; g.fillText('pixbit', w / 2, h * 0.38);
    g.font = '44px system-ui, sans-serif'; g.fillText('· s o l u t i o n s ·', w / 2, h * 0.82);
  }, false), transparent: true, alphaTest: 0.3, roughness: 0.6 }),
  cam: std({ color: '#f2f2f0', roughness: 0.4 }),
  granite: std({ color: '#141416', roughness: 0.12, metalness: 0.35, envMapIntensity: 1.4 }),
  liftSteel: std({ color: '#b9bdbd', roughness: 0.42, metalness: 0.75 }),
  fireDoor: std({ color: '#9aa5a1', roughness: 0.55, metalness: 0.15 }),
  greenSign: glowSign(sign('FIRE STATION', { w: 512, h: 112, font: 'bold 50px system-ui, sans-serif' })),
  fourth: std({ map: sign('FOURTH FLOOR', { bg: '#c9ccce', fg: '#2c2c2c', w: 512, h: 128, font: 'bold 54px system-ui, sans-serif' }), roughness: 0.4, metalness: 0.3 }),
  ledRed: std({ color: '#ff2a1a', emissive: '#ff2a1a', emissiveIntensity: 1.4 }),
  numDisc: (n) => std({ map: tex(128, 128, (g, w) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, w); g.fillStyle = '#111'; g.font = 'bold 84px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), w / 2, w / 2 + 4);
  }, false), roughness: 0.4 }),
};

/** Wall face along z at x (normal dir = +1 faces east, -1 faces west), z0..z1, height h; thin box + skirting. */
function wallZ(root, x, z0, z1, dir, mat = H.wall, h = BULK) {
  box(root, mat, 0.1, h, z1 - z0, x + dir * -0.05, h / 2, (z0 + z1) / 2);
  box(root, H.skirting, 0.015, 0.1, z1 - z0, x + dir * 0.008, 0.05, (z0 + z1) / 2, { shadow: false });
  addBox(Math.min(x, x - dir * 0.1), z0, Math.max(x, x - dir * 0.1), z1);
}

/** Window wall along x at z (sill, glass with black mullions, bulkhead above). */
function endWindow(root, z, dir, wa = X0, wb = X1, xa = X0 + 0.25, xb = X1 - 0.25) {
  const sill = 0.85, top = 2.7, len = xb - xa;
  box(root, H.wall, wb - wa, sill, 0.25, (wa + wb) / 2, sill / 2, z);                       // low sill wall
  box(root, H.skirting, wb - wa, 0.1, 0.015, (wa + wb) / 2, 0.05, z + dir * 0.13, { shadow: false });
  box(root, H.wall, wb - wa, CEIL - top, 0.25, (wa + wb) / 2, (top + CEIL) / 2, z);         // header
  for (const [a, b] of [[wa, xa], [xb, wb]]) box(root, H.wall, b - a, top - sill, 0.25, (a + b) / 2, (sill + top) / 2, z); // solid wall beside the glass
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(len, top - sill), M.glass);
  gl.position.set((xa + xb) / 2, (sill + top) / 2, z); gl.renderOrder = 2;
  root.add(gl);
  for (let i = 0; i <= 5; i++) box(root, M.black, 0.06, top - sill, 0.08, xa + (i / 5) * len, (sill + top) / 2, z);
  for (const y of [sill + 0.02, top - 0.02]) box(root, M.black, len, 0.05, 0.08, (xa + xb) / 2, y, z);
  addBox(wa, z - 0.15, wb, z + 0.15);
}

/** Simple hinged door look on a wall along z (static). side: +1 = on the east wall facing west, -1 = west wall facing east. */
function flatDoor(root, xWall, zc, w, h, mat, side) {
  const x = xWall - side * 0.03;
  box(root, H.frame, 0.06, h + 0.06, w + 0.12, xWall - side * 0.015, (h + 0.06) / 2, zc);   // frame
  box(root, mat, 0.04, h, w, x, h / 2, zc);
  return x - side * 0.03; // face position for handles
}

/**
 * Black-framed dark glass office fronts along a hall wall (IMG_5707): side -1 = west wall (faces east), +1 = east wall.
 * Each unit gets a glass door with pull handles and a white pillar at its end; a dim room sits behind the glass.
 */
function glassFronts(root, xw, side, z0, z1, unit = 4.2) {
  const x = xw - side * 0.03, back = xw + side * 3.0;
  slab(root, H.room, Math.min(xw, back), z0, Math.max(xw, back), z1, 0.0);                      // floor behind the glass
  box(root, H.room, 0.1, CEIL, z1 - z0, back, CEIL / 2, (z0 + z1) / 2, { shadow: false });      // back wall
  slab(root, H.roomCeil, Math.min(xw, back), z0, Math.max(xw, back), z1, CEIL, { down: true });
  for (let z = z0; z < z1 - 0.5; z += unit) {
    const za = z + 0.2, zb = Math.min(z + unit, z1) - 0.2;
    box(root, H.wall, 0.4, CEIL, 0.4, xw, CEIL / 2, z);                                         // white pillar between offices
    const g = new THREE.Mesh(new THREE.PlaneGeometry(zb - za, BULK - 0.05), H.officeGlass);
    g.position.set(x, (BULK - 0.05) / 2, (za + zb) / 2); g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; g.renderOrder = 2;
    root.add(g);
    const n = Math.max(2, Math.round((zb - za) / 1.0));
    for (let i = 0; i <= n; i++) box(root, M.black, 0.06, BULK, 0.05, x, BULK / 2, za + (i / n) * (zb - za));
    for (const y of [0.04, 2.35, BULK - 0.03]) box(root, M.black, 0.06, 0.06, zb - za, x, y, (za + zb) / 2);
    const dz = za + (zb - za) / n;                                                              // first panel is the door
    for (const s of [-1, 1]) box(root, M.chrome, 0.03, 0.6, 0.025, x - side * s * 0.05, 1.05, dz - 0.12, { shadow: false });
    // a desk + chair silhouette inside so the offices read as occupied
    const dx = xw + side * 1.6, cz = (za + zb) / 2 + 0.6;
    box(root, H.desk, 0.7, 0.04, 1.4, dx, 0.75, cz);
    for (const s of [-1, 1]) box(root, M.black, 0.05, 0.73, 0.05, dx, 0.37, cz + s * 0.6, { shadow: false });
    box(root, M.screenDark, 0.03, 0.32, 0.55, dx + side * 0.2, 1.0, cz);
    box(root, M.black, 0.45, 0.5, 0.45, dx - side * 0.55, 0.5, cz);
  }
  box(root, H.wall, 0.4, CEIL, 0.4, xw, CEIL / 2, z1);
  addBox(Math.min(xw, x) - 0.05, z0, Math.max(xw, x) + 0.05, z1);
}

export function buildHall(root) {
  // ---- Floor: beige marble + brown band along the east wall ----
  slab(root, H.floor, X0 + 0.02, Z0, X1 - BAND, Z1, 0.001, { tile: 1.6 });
  slab(root, H.floorBrown, X1 - BAND, Z0, X1, Z1, 0.001, { tile: 1.6 });

  // ---- Ceiling: grid tiles in the middle, lowered side bulkheads with cove light ----
  slab(root, H.grid, X0 + BW, Z0, X1 - BW, Z1, CEIL, { down: true, tile: 1.2 });
  for (const [xa, xb, edge, dir, za, zb] of [[X0, X0 + BW, X0 + BW, 1, Z0, Z1], [X1 - BW, X1, X1 - BW, -1, Z0, Z1]]) {
    slab(root, H.wall, xa, za, xb, zb, BULK, { down: true });
    box(root, H.wall, 0.03, CEIL - BULK, zb - za, edge, (BULK + CEIL) / 2, (za + zb) / 2, { shadow: false });
    box(root, M.lightStrip, 0.02, 0.025, zb - za - 0.4, edge + dir * 0.03, BULK + 0.04, (za + zb) / 2, { shadow: false }); // cove LED
  }
  for (let z = Z0 + 2.2; z < Z1 - 1; z += 3.0) {
    for (const x of [X0 + BW + 0.9, X1 - BW - 0.9]) cyl(root, M.spotGlow, 0.07, 0.07, 0.01, x, CEIL - 0.006, z, { seg: 16, shadow: false });
  }
  for (let z = Z0 + 3.7; z < Z1 - 2; z += 6.0) {
    plane(root, H.diffuser, 0.6, 0.6, (X0 + X1) / 2 + (Math.round(z) % 2 ? 0.6 : -0.6), CEIL - 0.004, z, 0, Math.PI / 2);
    cyl(root, H.cam, 0.05, 0.06, 0.03, (X0 + X1) / 2, CEIL - 0.015, z + 1.5, { seg: 14, shadow: false }); // smoke detector
  }
  for (const z of [Z0 + 1.7, 12.5, 22.5]) box(root, M.spotGlow, 0.22, 0.012, 0.6, X0 + BW / 2, BULK - 0.008, z, { shadow: false }); // bulkhead downlight panels

  // ---- West (office) side, north of the cabins: white wall with fire hose cabinet + fire exit door ----
  wallZ(root, X0, Z0, CAB_BACK, 1);
  box(root, H.wall, 0.1, CEIL - BULK, CAB_BACK - Z0, X0 - 0.05, (BULK + CEIL) / 2, (Z0 + CAB_BACK) / 2, { shadow: false });
  // fire hose cabinet: grey steel door flush with the wall, chrome handle, green sign beside it
  box(root, H.steel, 0.03, 1.75, 0.82, X0 + 0.015, 1.12, 1.75);
  box(root, M.metalDark, 0.035, 0.012, 0.8, X0 + 0.016, 0.25, 1.75, { shadow: false });
  box(root, M.chrome, 0.04, 0.03, 0.12, X0 + 0.04, 1.15, 1.42, { shadow: false });
  plane(root, H.fireExt, 0.36, 0.07, X0 + 0.004, 1.35, 2.4, Math.PI / 2);
  plane(root, H.fireExt, 0.36, 0.07, X0 + 0.004, 2.35, 1.75, Math.PI / 2);
  // fire exit door (white, push bar), EXIT sign above, red call point
  const fx = flatDoor(root, X0, -0.25, 0.95, 2.15, H.doorWhite, -1);
  box(root, M.chrome, 0.05, 0.05, 0.8, fx + 0.03, 1.0, -0.25, { shadow: false });
  for (const z of [-0.62, 0.12]) box(root, M.chrome, 0.06, 0.08, 0.05, fx + 0.02, 1.0, z, { shadow: false });
  plane(root, H.pushBar, 0.3, 0.06, fx + 0.002, 1.2, -0.25, Math.PI / 2);
  plane(root, H.exitSmall, 0.28, 0.1, X0 + 0.004, 2.45, -0.25, Math.PI / 2);
  box(root, H.red, 0.04, 0.12, 0.12, X0 + 0.02, 1.4, 0.55, { shadow: false });
  box(root, M.white, 0.01, 0.12, 0.08, X0 + 0.04, 1.6, -0.25 + 0.75, { shadow: false }); // notice sheet

  // ---- West side, south of the entrance: concrete wall with switch, fingerprint reader, pixbit sign ----
  const cz0 = LOBBY_S, cz1 = 18.75;
  // concrete in pieces around the two see-through glass doors from the workspace (suggestions 25/26, src/world/workspace.js)
  const concrete = (za, zb, ya, yb) => {
    box(root, M.concrete, 0.08, yb - ya, zb - za, X0 - 0.04, (ya + yb) / 2, (za + zb) / 2, { shadow: false });
    const f = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(zb - za, yb - ya), zb - za, yb - ya, 1.6), M.concrete);
    f.position.set(X0 + 0.002, (ya + yb) / 2, (za + zb) / 2); f.rotation.y = Math.PI / 2; f.receiveShadow = true;
    root.add(f);
    if (ya === 0) {
      box(root, H.skirting, 0.015, 0.1, zb - za, X0 + 0.008, 0.05, (za + zb) / 2, { shadow: false });
      addBox(X0 - 0.1, za, X0 + 0.02, zb);
    }
  };
  const ends = [cz0, ...EAST_DOORS.flatMap((z) => [z - DOOR_HALF - 0.03, z + DOOR_HALF + 0.03]), cz1];
  for (let k = 0; k < ends.length; k += 2) concrete(ends[k], ends[k + 1], 0, BULK);
  for (const z of EAST_DOORS) concrete(z - DOOR_HALF - 0.03, z + DOOR_HALF + 0.03, DOOR_TOP + 0.03, BULK);
  box(root, H.wall, 0.1, CEIL - BULK, Z1 - cz0, X0 - 0.05, (BULK + CEIL) / 2, (cz0 + Z1) / 2, { shadow: false });
  box(root, M.white, 0.012, 0.09, 0.09, X0 + 0.006, 1.25, 9.55, { shadow: false });          // light switch
  box(root, M.blackMatte, 0.015, 0.03, 0.035, X0 + 0.012, 1.25, 9.55, { shadow: false });
  box(root, M.blackMatte, 0.03, 0.14, 0.07, X0 + 0.015, 1.25, 9.8, { shadow: false });       // fingerprint reader
  box(root, M.bottleBlue, 0.01, 0.04, 0.04, X0 + 0.031, 1.27, 9.8, { shadow: false });
  box(root, M.white, 0.012, 0.09, 0.09, X0 + 0.006, 0.4, 9.7, { shadow: false });            // socket
  // pixbit logo sign south of the glass doors (IMG_5708 / IMG_5710, suggestion 28): black square with the yellow mark,
  // "pixbit · solutions ·" letters straight on the concrete, socket below, two white track spots above
  const lz = 16.85;
  box(root, M.black, 0.03, 0.78, 0.78, X0 + 0.015, 2.05, lz);
  plane(root, M.logo, 0.42, 0.6, X0 + 0.032, 2.05, lz, Math.PI / 2);
  plane(root, H.pixLetters, 0.8, 0.34, X0 + 0.004, 1.42, lz, Math.PI / 2);
  box(root, M.white, 0.012, 0.09, 0.14, X0 + 0.006, 0.42, lz + 0.35, { shadow: false });
  box(root, M.white, 0.03, 0.03, 0.9, X0 + BW / 2, BULK - 0.015, lz, { shadow: false });
  for (const z of [lz - 0.3, lz + 0.3]) cyl(root, M.white, 0.045, 0.045, 0.16, X0 + BW / 2 - 0.05, BULK - 0.12, z, { seg: 12, shadow: false, rz: 0.6 });
  // beyond the office: white wall with a laminate door, then neighbour offices with glass fronts
  wallZ(root, X0, cz1, 20.0, 1);
  const lf = flatDoor(root, X0, 19.35, 0.95, 2.25, H.laminate, -1);
  box(root, H.slot, 0.012, 0.9, 0.12, lf, 1.45, 19.3, { shadow: false });
  box(root, M.chrome, 0.03, 0.42, 0.03, lf + 0.05, 1.05, 19.0, { shadow: false });
  // ---- Lift lobby (suggestions 35 + 36, IMG_5711 / 5712 / 5716 / 5717): fire station panel, wood door, 4 lifts in black granite ----
  const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.9), H.fireDoor);           // fire station hatch (grey steel)
  fp.position.set(X0 + 0.012, 1.15, 20.9); fp.rotation.y = Math.PI / 2; root.add(fp);
  box(root, M.chrome, 0.03, 0.1, 0.04, X0 + 0.03, 1.0, 21.2, { shadow: false });
  plane(root, H.greenSign, 0.5, 0.11, X0 + 0.012, 2.25, 20.9, Math.PI / 2);
  plane(root, H.fireExt, 0.62, 0.12, X0 + 0.012, 1.45, 22.05, Math.PI / 2);
  const LZ0 = 22.8, LZ1 = 36.0;
  wallZ(root, X0, 20.0, LZ0, 1);                                                        // white wall with the hatch
  wallZ(root, X0, LZ0, LZ1, 1, H.granite);                                              // black granite lift wall
  const lifts = [{ n: 4, z: 24.6 }, { n: 3, z: 28.0 }, { n: 2, z: 31.4 }, { n: 1, z: 34.6 }];
  for (const L of lifts) {
    const w = 1.1, h = 2.2;
    box(root, M.blackMatte, 0.12, h + 0.06, w + 0.24, X0 + 0.06, (h + 0.06) / 2, L.z, { shadow: false });   // dark reveal
    for (const s of [-1, 1]) box(root, H.liftSteel, 0.05, h, 0.03, X0 + 0.03, h / 2, L.z + s * (w / 2 + 0.01), { shadow: false });
    box(root, H.liftSteel, 0.05, 0.04, w + 0.06, X0 + 0.03, h, L.z, { shadow: false });
    for (const s of [-1, 1]) box(root, H.liftSteel, 0.03, h - 0.04, w / 2 - 0.01, X0 - 0.02, (h - 0.04) / 2 + 0.02, L.z + s * (w / 4), { shadow: false }); // sliding doors
    plane(root, H.numDisc(L.n), 0.22, 0.22, X0 + 0.012, 2.5, L.z, Math.PI / 2);        // white number disc
    box(root, H.liftSteel, 0.03, 0.12, 0.5, X0 + 0.015, 2.75, L.z, { shadow: false }); // arrow indicator
    box(root, M.blackMatte, 0.035, 0.07, 0.17, X0 + 0.02, 2.75, L.z, { shadow: false });
    box(root, H.ledRed, 0.036, 0.04, 0.1, X0 + 0.022, 2.75, L.z, { shadow: false });
  }
  box(root, M.white, 0.03, 0.14, 0.09, X0 + 0.015, 1.15, 26.3, { shadow: false });     // card reader between lifts 4 and 3
  box(root, M.white, 0.012, 0.09, 0.09, X0 + 0.006, 0.38, 29.7, { shadow: false });    // socket
  for (const z of [32.6, 33.0]) cyl(root, M.chrome, 0.22, 0.22, 0.7, X0 + 0.32, 0.35, z, { seg: 20, shadow: false }); // steel bins
  const fl = new THREE.Group(); fl.position.set(X0 + 0.9, 2.95, 24.2); root.add(fl);   // hanging FOURTH FLOOR sign
  box(fl, M.black, 0.03, 0.2, 0.62, 0, 0, 0, { shadow: false });
  plane(fl, H.fourth, 0.6, 0.18, 0.017, 0, 0, Math.PI / 2);
  plane(fl, H.fourth, 0.6, 0.18, -0.017, 0, 0, -Math.PI / 2);
  glassFronts(root, X0, -1, LZ1, Z1 - 0.15);
  box(root, H.wall, 0.1, CEIL - BULK, Z1 - 20, X0 - 0.05, (BULK + CEIL) / 2, (20 + Z1) / 2, { shadow: false });

  // ---- Entrance (suggestion 23): brown doormat outside, CCTV ----
  box(root, H.mat, 0.6, 0.012, 1.05, X0 + 0.42, 0.006, 8.12, { shadow: false });
  for (const z of [5.0, 18.3]) { // wall-bracket bullet cameras
    box(root, H.cam, 0.04, 0.04, 0.12, X0 + BW - 0.05, BULK - 0.03, z, { shadow: false });
    cyl(root, H.cam, 0.035, 0.035, 0.14, X0 + BW - 0.1, BULK - 0.08, z, { seg: 10, shadow: false, rz: Math.PI / 2 - 0.3 });
  }

  // ---- East side ----
  wallZ(root, X1, Z0, 15.0, -1);
  box(root, H.wall, 0.1, CEIL - BULK, Z1 - Z0, X1 + 0.05, (BULK + CEIL) / 2, (Z0 + Z1) / 2, { shadow: false });
  // glass door next to the north window (IMG_5705)
  const gd = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.3), M.glassFrost);
  gd.position.set(X1 - 0.03, 1.15, -1.2); gd.rotation.y = -Math.PI / 2; gd.renderOrder = 2;
  root.add(gd);
  for (const z of [-1.65, -0.75]) box(root, M.black, 0.06, 2.35, 0.05, X1 - 0.03, 1.17, z);
  for (const y of [0.05, 1.2, 2.33]) box(root, M.black, 0.06, 0.05, 0.9, X1 - 0.03, y, -1.2);
  box(root, M.chrome, 0.03, 0.4, 0.025, X1 - 0.09, 1.05, -0.88, { shadow: false });
  // gents toilet: laminate door with vision slot, chrome pull, projecting blade sign, fire ball, caution board
  const tz = 2.6;
  const tf = flatDoor(root, X1, tz, 1.0, 2.25, H.laminate, 1);
  box(root, H.slot, 0.012, 0.9, 0.12, tf, 1.45, tz - 0.05, { shadow: false }); // vision slot
  box(root, M.chrome, 0.03, 0.42, 0.03, tf - 0.05, 1.05, tz + 0.37, { shadow: false });
  for (const y of [0.86, 1.24]) box(root, M.chrome, 0.06, 0.02, 0.02, tf - 0.025, y, tz + 0.37, { shadow: false });
  cyl(root, M.chrome, 0.02, 0.02, 0.02, tf - 0.01, 0.95, tz + 0.42, { seg: 10, shadow: false, rz: Math.PI / 2 });
  const blade = new THREE.Group(); blade.position.set(X1 - 0.33, 2.62, tz - 0.75); root.add(blade);
  box(blade, M.black, 0.6, 0.15, 0.03, 0, 0, 0);
  plane(blade, H.gents, 0.56, 0.12, 0, 0, 0.017, 0);
  plane(blade, H.gents, 0.56, 0.12, 0, 0, -0.017, Math.PI);
  box(blade, M.metalDark, 0.04, 0.05, 0.04, 0.3, 0.1, 0);
  // automatic fire ball in a wire basket
  const fb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), H.orange);
  fb.position.set(X1 - 0.13, 1.78, tz + 1.4); fb.castShadow = true; root.add(fb);
  cyl(root, M.metalDark, 0.11, 0.09, 0.08, X1 - 0.13, 1.72, tz + 1.4, { seg: 16, open: true, shadow: false });
  box(root, M.metalDark, 0.08, 0.02, 0.02, X1 - 0.05, 1.72, tz + 1.4, { shadow: false });
  // neighbour office: black glass double door + transom, keypad, wood strips, diamond-pattern wall with sign
  const dz0 = 9.0, dz1 = 10.7;
  const dg = new THREE.Mesh(new THREE.PlaneGeometry(dz1 - dz0, BULK - 0.05), H.darkGlass);
  dg.position.set(X1 - 0.04, (BULK - 0.05) / 2, (dz0 + dz1) / 2); dg.rotation.y = -Math.PI / 2; dg.renderOrder = 2;
  root.add(dg);
  for (const z of [dz0, (dz0 + dz1) / 2, dz1]) box(root, M.black, 0.07, BULK, 0.06, X1 - 0.04, BULK / 2, z);
  for (const y of [0.05, 2.4, BULK - 0.03]) box(root, M.black, 0.07, 0.06, dz1 - dz0, X1 - 0.04, y, (dz0 + dz1) / 2);
  for (const z of [(dz0 + dz1) / 2 - 0.08, (dz0 + dz1) / 2 + 0.08]) {
    box(root, M.chrome, 0.03, 0.75, 0.025, X1 - 0.12, 1.1, z, { shadow: false });
    for (const y of [0.78, 1.42]) box(root, M.chrome, 0.08, 0.02, 0.02, X1 - 0.09, y, z, { shadow: false });
  }
  box(root, M.white, 0.025, 0.13, 0.09, X1 - 0.012, 1.3, dz0 - 0.3, { shadow: false });         // keypad
  box(root, M.blackMatte, 0.01, 0.05, 0.06, X1 - 0.026, 1.32, dz0 - 0.3, { shadow: false });
  const wz0 = 11.05, wz1 = 14.6;
  for (const z of [10.9, wz1 + 0.1]) box(root, H.woodStrip, 0.06, BULK, 0.16, X1 - 0.03, BULK / 2, z);
  const dw = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(wz1 - wz0, BULK), wz1 - wz0, BULK, 0.7), H.diamond);
  dw.position.set(X1 - 0.004, BULK / 2, (wz0 + wz1) / 2); dw.rotation.y = -Math.PI / 2; dw.receiveShadow = true;
  root.add(dw);
  box(root, M.white, 0.03, 0.58, 1.05, X1 - 0.02, 1.75, 12.8);
  plane(root, H.techno, 1.0, 0.55, X1 - 0.036, 1.75, 12.8, -Math.PI / 2);
  // track spotlights aimed at the sign
  box(root, M.black, 0.04, 0.03, 0.8, X1 - BW - 0.3, CEIL - 0.03, 12.8, { shadow: false });
  for (const z of [12.5, 13.1]) cyl(root, M.black, 0.04, 0.035, 0.14, X1 - BW - 0.3, CEIL - 0.12, z, { seg: 10, shadow: false, rz: -0.7 });
  // more offices further down: black-framed glass fronts (IMG_5707, suggestion 30)
  glassFronts(root, X1, 1, 15.0, Z1 - 0.15);

  // ---- End windows + hanging FIRE EXIT sign ----
  endWindow(root, Z0 - 0.12, 1, X0, X1, X0 + 0.9, X1 - 0.25);  // north: wide glass, solid wall only at the east corner (IMG_5705)
  endWindow(root, Z1 + 0.12, -1);
  const ex = new THREE.Group(); ex.position.set((X0 + X1) / 2, 2.72, Z0 + 1.6); root.add(ex);
  box(ex, M.white, 0.58, 0.14, 0.03, 0, 0, 0, { shadow: false });
  plane(ex, H.fireExit, 0.56, 0.12, 0, 0, 0.016, 0);
  plane(ex, H.fireExit, 0.56, 0.12, 0, 0, -0.016, Math.PI);
  for (const s of [-1, 1]) box(ex, M.chrome, 0.006, CEIL - 2.79, 0.006, s * 0.22, (CEIL - 2.79) / 2 + 0.07, 0, { shadow: false });
}
