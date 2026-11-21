import * as THREE from 'three';
import { M } from '../materials.js';
import { box, cyl, plane } from '../props.js';
import { addBox } from '../colliders.js';
import { slab, worldUV, doorLeaves, LOBBY_E, LOBBY_S, CAB_BACK, EAST_DOORS, DOOR_HALF, DOOR_TOP } from './helpers.js';

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
const Z1 = 47.0;      // south window (long corridor with offices both sides, IMG_5707 / 5736 / 5738, suggestions 30, 45, 46)
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
  pink: std({ color: '#e9b8c4', roughness: 0.3 }),
  mirror: std({ color: '#c9d4d8', roughness: 0.08, metalness: 0.25 }),
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
  leather: std({ color: '#1e1a19', roughness: 0.3, metalness: 0.05, envMapIntensity: 1.2 }),
  tableWood: std({ color: '#6b5646', roughness: 0.55 }),
  daylight: new THREE.MeshBasicMaterial({ color: '#f4f8ff' }),
  lamp: new THREE.MeshBasicMaterial({ color: '#fff3c9' }),
  tint: new THREE.MeshStandardMaterial({ color: '#c9d6b0', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  olive: std({ color: '#8f9a2e', roughness: 0.85 }),
  silver: std({ color: '#b8bcc0', roughness: 0.3, metalness: 0.8 }),
  tableTop: std({ color: '#e6e1d8', roughness: 0.35 }),
  ladies: std({ map: sign('LADIES TOILET', { bg: '#141414', w: 512, h: 112, font: 'bold 54px system-ui, sans-serif', icon: '🚺' }), roughness: 0.4 }),
  slate: std({ color: '#6b6e71', roughness: 0.85 }),
  navy: std({ color: '#1f2a3b', roughness: 0.6 }),
  navySlats: std({ map: tex(256, 256, (g, w, h) => {
    g.fillStyle = '#212d40'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = '#141c29'; g.fillRect(x, 0, 3, h); g.fillStyle = '#2b3950'; g.fillRect(x + 3, 0, 2, h); }
  }), roughness: 0.55 }),
  // neighbour logos: only drawn in dev mode, like the Technaureus sign (suggestion 43)
  tenCod: std({ map: tex(512, 160, (g, w, h) => {
    g.fillStyle = '#e9ecef'; g.beginPath(); g.moveTo(20, 30); g.lineTo(95, 30); g.lineTo(60, 80); g.lineTo(95, 80); g.lineTo(55, 135); g.lineTo(20, 135); g.lineTo(55, 85); g.lineTo(20, 85); g.closePath(); g.fill();
    g.font = 'bold 96px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText('10COD', 120, h / 2 + 4);
  }, false), transparent: true, alphaTest: 0.3, roughness: 0.4 }),
  eSyn: std({ map: tex(512, 256, (g, w, h) => {
    g.fillStyle = '#e8506a'; g.beginPath(); g.arc(120, 118, 100, 0, Math.PI * 2); g.fill();
    g.font = 'italic bold 150px Georgia, serif'; g.textBaseline = 'middle'; g.fillStyle = '#26334a'; g.fillText('e', 40, 120);
    g.fillStyle = '#f4e9e4'; g.fillText('S', 120, 130);
    g.font = 'bold 76px system-ui, sans-serif'; g.fillStyle = '#26334a'; g.fillText('YNERGY', 210, 150);
  }, false), transparent: true, alphaTest: 0.3, roughness: 0.5 }),
  ringLogo: std({ map: tex(256, 256, (g, w) => {
    g.strokeStyle = '#8f6cff'; g.lineWidth = 16; g.beginPath(); g.arc(w / 2, w / 2, 90, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#e5e1ff'; g.font = 'bold 54px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('dev', w / 2, w / 2);
  }, false), transparent: true, alphaTest: 0.3, roughness: 0.4 }),
  greyTile: std({ color: '#9a9c9a', roughness: 0.3 }),
  stairBlue: std({ color: '#5a6fc4', roughness: 0.8 }),
  fireRed: std({ color: '#c8231c', roughness: 0.5 }),
  granite: std({ color: '#141416', roughness: 0.12, metalness: 0.35, envMapIntensity: 1.4 }),
  liftIn: std({ color: '#7d8284', roughness: 0.45, metalness: 0.55, emissive: '#52575a', emissiveIntensity: 0.7 }), // self-lit: the cabin has no lamp of its own
  arrow: std({ map: tex(64, 64, (g, w) => { g.fillStyle = '#e8eaea'; g.fillRect(0, 0, w, w); g.fillStyle = '#6d7173'; g.beginPath(); g.moveTo(10, 14); g.lineTo(54, 14); g.lineTo(32, 52); g.fill(); }, false), roughness: 0.4 }),
  liftSeam: std({ color: '#3b3e40', roughness: 0.6 }),
  brass: std({ color: '#b8943c', roughness: 0.3, metalness: 0.9, emissive: '#5a4510', emissiveIntensity: 0.5 }),
  vent: std({ color: '#2e3032', roughness: 0.8 }),
  dispNote: std({ map: tex(128, 76, (g, w, h) => { g.fillStyle = '#1f55a8'; g.fillRect(0, 0, w, h); g.fillStyle = '#cfe0f5'; for (let i = 0; i < 9; i++) g.fillRect(8, 10 + i * 7, 20 + (i * 37) % 90, 3); }, false), roughness: 0.5 }),
  disp4: std({ map: tex(128, 64, (g, w, h) => { g.fillStyle = '#1b52c9'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 44px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText('▲ 4', 20, h / 2 + 2); }, false), emissive: '#2a62d8', emissiveIntensity: 0.6 }),
  dispG: std({ map: tex(128, 64, (g, w, h) => { g.fillStyle = '#1b52c9'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 44px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText('▼ G', 20, h / 2 + 2); }, false), emissive: '#2a62d8', emissiveIntensity: 0.6 }),
  liftFloor: std({ color: '#3a3d3f', roughness: 0.35, metalness: 0.4 }),
  liftSteel: std({ color: '#b9bdbd', roughness: 0.42, metalness: 0.75 }),
  fireDoor: std({ color: '#9aa5a1', roughness: 0.55, metalness: 0.15 }),
  greenSign: glowSign(sign('FIRE STATION', { w: 512, h: 112, font: 'bold 50px system-ui, sans-serif' })),
  groundSign: std({ map: sign('GROUND FLOOR', { bg: '#c9ccce', fg: '#2c2c2c', w: 512, h: 128, font: 'bold 54px system-ui, sans-serif' }), roughness: 0.4, metalness: 0.3 }),
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
 * Ladies toilet: openable laminate door in the east wall (hinge on the north edge, swings in) and a small tiled
 * room behind it with WC, basin and mirror. The leaf goes to doorLeaves; src/ladies.js gates it behind the
 * big "ARE U GAY?" question before it opens.
 */
function ladiesToilet(root, tw0, tw1, zc) {
  const w = 0.95, h = 2.25, d0 = zc - w / 2, d1 = zc + w / 2;
  wallZ(root, X1, tw0, d0 - 0.06, -1);
  wallZ(root, X1, d1 + 0.06, tw1, -1);
  box(root, H.wall, 0.1, BULK - h - 0.06, w + 0.12, X1 + 0.05, (BULK + h + 0.06) / 2, zc);           // header
  for (const z of [d0 - 0.03, d1 + 0.03]) box(root, H.frame, 0.14, h + 0.06, 0.06, X1 + 0.03, (h + 0.06) / 2, z); // jambs
  box(root, H.frame, 0.14, 0.06, w + 0.12, X1 + 0.03, h + 0.03, zc);
  // the leaf: hinge at the north jamb, runs along +z, swings into the room (+x)
  const leaf = new THREE.Group();
  leaf.position.set(X1 - 0.01, 0, d0);
  box(leaf, H.laminate, 0.04, h - 0.01, w - 0.01, 0, h / 2, w / 2);
  for (const s of [-1, 1]) {
    box(leaf, H.slot, 0.012, 0.9, 0.12, s * 0.022, 1.45, w / 2 - 0.05, { shadow: false });
    box(leaf, M.chrome, 0.03, 0.42, 0.03, s * 0.075, 1.05, w - 0.12, { shadow: false });
    for (const y of [0.86, 1.24]) box(leaf, M.chrome, 0.06, 0.02, 0.02, s * 0.05, y, w - 0.12, { shadow: false });
  }
  doorLeaves.push({
    leaf, closed: 0, open: Math.PI / 2 * 0.92, name: 'ladies toilet', handle: [-0.12, 1.25, w - 0.12],
    x: X1, z: zc, block: { minX: X1 - 0.05, maxX: X1 + 0.1, minZ: d0, maxZ: d1 },
  });
  // the room
  const rx0 = X1 + 0.1, rx1 = X1 + 2.3, rz0 = tw0 + 0.05, rz1 = tw1 - 0.05, RH = BULK;
  const cx = (rx0 + rx1) / 2, cz = (rz0 + rz1) / 2;
  box(root, M.floorCorridor, rx1 - rx0, 0.02, rz1 - rz0, cx, 0.01, cz, { shadow: false });
  box(root, M.white, rx1 - rx0, 0.04, rz1 - rz0, cx, RH, cz, { shadow: false });
  box(root, M.whiteGloss, 0.1, RH, rz1 - rz0 + 0.2, rx1 + 0.05, RH / 2, cz);                           // back wall
  for (const z of [rz0 - 0.05, rz1 + 0.05]) box(root, M.whiteGloss, rx1 - rx0, RH, 0.1, cx, RH / 2, z); // side walls
  box(root, H.pink, 0.02, 1.2, rz1 - rz0, rx1 - 0.005, 0.6, cz, { shadow: false });                     // pink tile dado
  for (const z of [rz0 + 0.005, rz1 - 0.005]) box(root, H.pink, rx1 - rx0, 1.2, 0.02, cx, 0.6, z, { shadow: false });
  addBox(rx1, rz0 - 0.1, rx1 + 0.1, rz1 + 0.1);
  addBox(rx0 - 0.1, rz0 - 0.1, rx1, rz0);
  addBox(rx0 - 0.1, rz1, rx1, rz1 + 0.1);
  box(root, M.lightStrip, 0.6, 0.02, 0.6, cx, RH - 0.03, cz, { shadow: false });                          // ceiling light
  // WC against the back wall (south half), basin + mirror on the north half
  const wz = cz + 0.7;
  box(root, M.whiteGloss, 0.2, 0.55, 0.42, rx1 - 0.1, 0.8, wz);                                         // cistern
  cyl(root, M.whiteGloss, 0.19, 0.15, 0.4, rx1 - 0.42, 0.2, wz, { seg: 20 });                            // bowl
  cyl(root, M.white, 0.2, 0.2, 0.03, rx1 - 0.42, 0.42, wz, { seg: 20 });                                 // seat
  addBox(rx1 - 0.65, wz - 0.25, rx1, wz + 0.25);
  const bz = cz - 0.6;
  box(root, M.whiteGloss, 0.45, 0.14, 0.55, rx1 - 0.23, 0.85, bz);                                      // basin
  box(root, M.chrome, 0.12, 0.03, 0.03, rx1 - 0.08, 0.98, bz, { shadow: false });                       // tap
  box(root, H.mirror, 0.02, 0.7, 0.55, rx1 - 0.012, 1.55, bz, { shadow: false });                       // mirror
  addBox(rx1 - 0.46, bz - 0.3, rx1, bz + 0.3);
}

const LIFT_OW = 1.16;  // door opening (m)
const LIFT_DH = 2.55;  // door opening height
export const LIFT_DEPTH = 2.6; // door to back wall (a bit shorter than the full gap up to the game room wall)
const LIFT_CW = 2.9, LIFT_CH = 2.85; // cabin width / height

/** The cabin behind a lift door: brushed-steel walls, rail, mirror, button panel, light. Solid sides, open front. */
function liftCabin(root, L) {
  const { x: fx, z: zc, out, cw } = L;
  const back = fx - out * 0.1;                        // back face of the wall the door sits in
  const cx = back - out * LIFT_DEPTH / 2, far = back - out * LIFT_DEPTH;
  box(root, H.liftIn, LIFT_DEPTH, 0.02, cw, cx, 0.012, zc, { shadow: false });
  box(root, H.liftIn, LIFT_DEPTH, 0.04, cw + 0.1, cx, LIFT_CH, zc, { shadow: false });
  box(root, M.lightStrip, LIFT_DEPTH - 0.4, 0.015, 0.5, cx, LIFT_CH - 0.03, zc, { shadow: false });
  box(root, H.liftIn, 0.05, LIFT_CH, cw + 0.1, far - out * 0.025, LIFT_CH / 2, zc, { shadow: false });
  for (const sd of [-1, 1]) box(root, H.liftIn, LIFT_DEPTH, LIFT_CH, 0.05, cx, LIFT_CH / 2, zc + sd * (cw / 2 + 0.025), { shadow: false });
  // back wall: vertical steel panels with dark seams, brass rail + kick strip (reference photo)
  for (const sd of [-1.5, -0.5, 0.5, 1.5]) box(root, H.liftSeam, 0.01, LIFT_CH - 0.2, 0.012, far + out * 0.002, LIFT_CH / 2, zc + sd * (cw / 4), { shadow: false });
  box(root, H.liftFloor, LIFT_DEPTH - 0.1, 0.02, cw - 0.1, cx, 0.03, zc, { shadow: false });                   // dark floor
  box(root, H.liftIn, 0.12, 0.03, LIFT_OW + 0.1, back - out * 0.05, 0.015, zc, { shadow: false });                  // steel threshold
  for (const sd of [-1, 1]) box(root, H.vent, 0.4, 0.015, 0.3, cx + sd * 0.0, LIFT_CH - 0.03, zc + sd * 0.4, { shadow: false }); // ceiling vents
  // door frame: steel jambs + lintel through the wall thickness
  for (const sd of [-1, 1]) box(root, H.liftSteel, 0.12, LIFT_DH, 0.04, fx - out * 0.05, LIFT_DH / 2, zc + sd * (LIFT_OW / 2 + 0.02), { shadow: false });
  box(root, H.liftSteel, 0.12, 0.04, LIFT_OW + 0.08, fx - out * 0.05, LIFT_DH + 0.02, zc, { shadow: false });
  // front wall inside the cabin: steel returns on both sides of the door (and over it), each with a car operating panel
  const fxi = back - out * 0.012, ret = (cw - LIFT_OW) / 2, rc = LIFT_OW / 2 + ret / 2, ryIn = -out * Math.PI / 2;
  for (const sd of [-1, 1]) box(root, H.liftIn, 0.024, LIFT_CH, ret, fxi, LIFT_CH / 2, zc + sd * rc, { shadow: false });
  box(root, H.liftIn, 0.024, LIFT_CH - LIFT_DH, LIFT_OW, fxi, (LIFT_DH + LIFT_CH) / 2, zc, { shadow: false });
  const disp = L.ground ? H.dispG : H.disp4, fp = back - out * 0.03;
  for (const sd of [-1, 1]) {
    const z = zc + sd * rc, d = 0.015;
    box(root, H.liftSteel, 0.01, 2.0, ret - 0.06, back - out * 0.026, 1.4, z, { shadow: false });                    // raised panel
    plane(root, disp, 0.2, 0.1, back - out * 0.036, 2.1, z, ryIn);
    plane(root, H.dispNote, 0.2, 0.12, back - out * 0.036, 1.88, z, ryIn);
    for (let i = 0; i < 6; i++) box(root, M.chrome, 0.012, 0.045, 0.045, back - out * (0.03 + d / 2), 0.62 + i * 0.1, z, { shadow: false });
    box(root, M.blackMatte, 0.012, 0.09, 0.05, back - out * 0.036, 1.15, z + 0.0, { shadow: false });
  }
  addBox(far - out * 0.05, zc - cw / 2 - 0.05, far + out * 0.01, zc + cw / 2 + 0.05);
  for (const sd of [-1, 1]) addBox(back, zc + sd * (cw / 2 + 0.05), far, zc + sd * cw / 2);
}

/**
 * A wall along z with a door opening for every lift ("bays", z centres): `mat` between the lifts, black granite around
 * each door, a header over each opening. Solid except the openings (src/lifts.js blocks those while the doors are shut).
 */
function wallWithBays(root, x, z0, z1, dir, bays, { h = BULK, mat = H.wall, bayMat = H.granite, pad = 1.25 } = {}) {
  let cur = z0;
  for (const bz of [...bays].sort((a, b) => a - b)) {
    if (bz - pad > cur + 0.01) wallZ(root, x, cur, bz - pad, dir, mat, h);
    wallZ(root, x, bz - pad, bz - LIFT_OW / 2, dir, bayMat, h);
    wallZ(root, x, bz + LIFT_OW / 2, bz + pad, dir, bayMat, h);
    box(root, bayMat, 0.1, h - LIFT_DH, LIFT_OW, x - dir * 0.05, (LIFT_DH + h) / 2, bz);
    cur = bz + pad;
  }
  if (z1 > cur + 0.01) wallZ(root, x, cur, z1, dir, mat, h);
}

/**
 * Lift front in black granite (IMG_5713): dark reveal, brushed-steel frame + sliding doors, white number disc,
 * steel floor indicator with red LED, call-button plate on one side, fire alarm horn + pull station on the other.
 * fx = granite face x, out = direction toward the hall (-1 east wall, +1 west wall).
 */
function liftFront(root, fx, zc, n, out, { alarm = true, ground = false, cw = LIFT_CW } = {}) {
  const w = 1.1, k = -out, ry = out * Math.PI / 2, x = (d) => fx + out * d;
  // the two sliding door leaves are loose groups (not merged into the static world): src/lifts.js moves them
  const leaves = [-1, 1].map((sd) => {
    const g = new THREE.Group();
    box(g, H.liftSteel, 0.03, LIFT_DH - 0.08, w / 2 - 0.01, x(0.03), (LIFT_DH - 0.08) / 2, zc + sd * w / 4, { shadow: false });
    return g;
  });
  (ground ? GROUND_LIFTS : LIFTS).push({ n, x: fx, z: zc, out, ground, leaves, cw });
  liftCabin(root, { x: fx, z: zc, out, ground, cw });
  for (const sd of [-1, 1]) box(root, H.liftSteel, 0.04, LIFT_DH - 0.04, 0.03, x(0.03), (LIFT_DH - 0.04) / 2 + 0.02, zc + sd * (w / 2 + 0.02), { shadow: false });
  box(root, H.liftSteel, 0.04, 0.03, w + 0.07, x(0.03), LIFT_DH - 0.04, zc, { shadow: false });
  plane(root, H.numDisc(n), 0.2, 0.2, x(0.012), 2.74, zc, ry);
  box(root, H.liftSteel, 0.03, 0.14, 0.62, x(0.015), 2.92, zc, { shadow: false });
  box(root, M.blackMatte, 0.035, 0.08, 0.2, x(0.02), 2.92, zc, { shadow: false });
  box(root, H.ledRed, 0.036, 0.04, 0.06, x(0.022), 2.92, zc, { shadow: false });
  for (const sd of [-1, 1]) plane(root, H.arrow, 0.1, 0.09, x(0.04), 2.92, zc + sd * 0.23, ry);
  const cz = zc + k * (w / 2 + 0.33);
  box(root, H.liftSteel, 0.02, 0.26, 0.11, x(0.01), 1.15, cz, { shadow: false });
  box(root, M.blackMatte, 0.01, 0.06, 0.05, x(0.022), 1.12, cz, { shadow: false });
  if (alarm) {
    const az = zc - k * (w / 2 + 0.42);
    box(root, H.fireRed, 0.05, 0.14, 0.12, x(0.025), 2.05, az, { shadow: false });
    box(root, H.fireRed, 0.04, 0.13, 0.1, x(0.02), 1.3, az, { shadow: false });
  }
}

/** Every working lift on the upper floor (filled while the hall is built): src/lifts.js reads it. */
export const LIFTS = [];
/** Same, for the ground floor twin. */
export const GROUND_LIFTS = [];
/** Lights for the ground floor (the static world is merged, so lights have to be added to the scene by the caller). */
export const GROUND_LIGHTS = [];
/** The ground floor is the same corridor built this far east (x offset), so nothing overlaps the office. */
export const GROUND_DX = 200;

/** Dev mode (P) shows the neighbour's sign text; normally it is a plain white board (suggestion 43). */
const DEV_SIGNS = ['techno', 'tenCod', 'eSyn', 'ringLogo'];
export function setHallDevSigns(on) { for (const k of DEV_SIGNS) H[k].visible = on; }
setHallDevSigns(false);

/**
 * Black-framed dark glass office fronts along a hall wall (IMG_5707): side -1 = west wall (faces east), +1 = east wall.
 * Each unit gets a glass door with pull handles and a white pillar at its end; a dim room sits behind the glass.
 */
function glassFronts(root, xw, side, z0, z1, unit = 4.2, { frost = false } = {}) {
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
    if (frost) {                                                                                // frosted privacy band (IMG_5738)
      const f = new THREE.Mesh(new THREE.PlaneGeometry(zb - za, 0.75), M.glassFrost);
      f.position.set(x - side * 0.006, 1.25, (za + zb) / 2); f.rotation.y = g.rotation.y; f.renderOrder = 3; root.add(f);
    }
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
  // closed square box (suggestions 49–53): side walls at both ends so nothing outside shows through the glass at an angle
  for (const z of [z0 - 0.05, z1 + 0.05]) box(root, H.room, Math.abs(back - xw), CEIL, 0.1, (xw + back) / 2, CEIL / 2, z, { shadow: false });
  box(root, H.wall, 0.4, CEIL, 0.4, xw, CEIL / 2, z1);
  addBox(Math.min(xw, x) - 0.05, z0, Math.max(xw, x) + 0.05, z1);
}

// ---- Sofa lounge off the east side (suggestions 38 + 40, IMG_5715 / 5743 / 5745) ----
// A wide open room behind lift 5: long white walls, grid ceiling, club + bench sofas, glazed door at the far end.
// NB = where the neighbour office (green room door) starts on the east wall (suggestion 44); everything south of it
// on that wall — sign panel, glass door, stair door, lift 5, this lounge — keeps its spacing relative to NB.
const NB = 14.5;
const LNZ0 = NB + 11.85, LNZ1 = LNZ0 + 6.4, LNX = X1 + 11.0;

/** Tufted 2-seat club sofa; local front faces +z (back against -z). */
function sofaClub(root, x, z, ry = 0, len = 1.6) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
  box(g, H.leather, len, 0.3, 0.82, 0, 0.24, 0);                                    // base
  box(g, H.leather, len - 0.36, 0.14, 0.62, 0, 0.45, 0.08);                         // seat cushion
  for (const e of [-1, 1]) box(g, H.leather, 0.18, 0.62, 0.82, e * (len / 2 - 0.09), 0.37, 0); // arms
  box(g, H.leather, len - 0.1, 0.36, 0.18, 0, 0.6, -0.32);                          // back frame
  for (const e of [-1, 1]) box(g, H.leather, (len - 0.4) / 2, 0.36, 0.16, e * (len - 0.4) / 4, 0.74, -0.22, { rx: -0.12 }); // tufted back cushions
  for (const e of [-1, 1]) for (const f of [-1, 1]) box(g, M.blackMatte, 0.06, 0.09, 0.06, e * (len / 2 - 0.08), 0.045, f * 0.34, { shadow: false });
  return g;
}
/** Modern bench sofa: high plain back, thin seat on a box base, chrome sled legs; front faces +z. */
function sofaBench(root, x, z, ry = 0, len = 1.9) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
  box(g, H.leather, len, 0.22, 0.72, 0, 0.27, 0.04);
  box(g, H.leather, len, 0.1, 0.7, 0, 0.42, 0.05);
  box(g, H.leather, len, 0.62, 0.16, 0, 0.73, -0.3, { rx: -0.08 });
  for (const e of [-1, 1]) {
    box(g, M.chrome, 0.03, 0.03, 0.72, e * (len / 2 - 0.12), 0.015, 0.02, { shadow: false });
    box(g, M.chrome, 0.03, 0.16, 0.03, e * (len / 2 - 0.12), 0.08, 0.34, { shadow: false });
    box(g, M.chrome, 0.03, 0.16, 0.03, e * (len / 2 - 0.12), 0.08, -0.3, { shadow: false });
  }
  return g;
}
/** Collider for a sofa whose rotation is close to 0 / PI (length along x). */
function sofaBox(x, z, len, d = 0.85) { addBox(x - len / 2, z - d / 2, x + len / 2, z + d / 2); }

function buildLounge(root) {
  const zm = (LNZ0 + LNZ1) / 2, w = LNZ1 - LNZ0;
  slab(root, H.floor, X1, LNZ0, LNX, LNZ1, 0.001, { tile: 1.6 });
  slab(root, H.grid, X1, LNZ0, LNX, LNZ1, CEIL, { down: true, tile: 1.2 });
  for (const z of [LNZ0, LNZ1]) {                                                   // long white side walls
    const dir = z === LNZ0 ? -1 : 1;
    box(root, H.wall, LNX - X1, CEIL, 0.1, (X1 + LNX) / 2, CEIL / 2, z + dir * 0.05);
    box(root, H.skirting, LNX - X1, 0.1, 0.015, (X1 + LNX) / 2, 0.05, z - dir * 0.008, { shadow: false });
    addBox(X1, z - 0.1, LNX, z + 0.1);
  }
  // black granite pillar at the south corner of the opening (IMG_5745)
  box(root, H.granite, 0.65, CEIL, 0.55, X1 + 0.08, CEIL / 2, LNZ1 + 0.275);
  addBox(X1 - 0.25, LNZ1, X1 + 0.4, LNZ1 + 0.55);
  // far end: white wall with a black-framed glazed screen + double glass door onto daylight (IMG_5715)
  box(root, H.wall, 0.1, CEIL, w, LNX + 0.05, CEIL / 2, zm);
  const gx = LNX - 0.02, gz0 = zm - 1.6, gz1 = zm + 1.6, gt = 2.55;
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(gz1 - gz0, gt), H.daylight);
  bg.position.set(gx + 0.005, gt / 2, zm); bg.rotation.y = -Math.PI / 2; root.add(bg);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(gz1 - gz0, gt), M.glass);
  gl.position.set(gx, gt / 2, zm); gl.rotation.y = -Math.PI / 2; gl.renderOrder = 2; root.add(gl);
  for (const z of [gz0, zm - 0.75, zm + 0.75, gz1]) box(root, M.black, 0.07, gt, 0.07, gx, gt / 2, z);
  for (const y of [0.04, gt]) box(root, M.black, 0.07, 0.07, gz1 - gz0, gx, y, zm);
  for (const [za, zb] of [[gz0, zm - 0.75], [zm + 0.75, gz1]]) for (const y of [0.3, 1.25, 2.15]) box(root, M.black, 0.07, 0.05, zb - za, gx, y, (za + zb) / 2);
  box(root, M.black, 0.07, 0.05, 1.5, gx, 2.15, zm);                                 // transom bar over the door
  for (const z of [zm - 0.07, zm + 0.07]) box(root, M.blackMatte, 0.04, 0.45, 0.03, gx - 0.07, 1.1, z, { shadow: false });
  addBox(LNX - 0.1, LNZ0, LNX + 0.1, LNZ1);
  // sofas: club + bench on the north wall with the coffee table, bench + club on the south wall
  sofaClub(root, X1 + 5.0, LNZ0 + 0.48, 0, 1.6); sofaBox(X1 + 5.0, LNZ0 + 0.48, 1.6);
  sofaBench(root, X1 + 7.1, LNZ0 + 0.45, 0, 1.9); sofaBox(X1 + 7.1, LNZ0 + 0.45, 1.9);
  sofaBench(root, X1 + 5.6, LNZ1 - 0.45, Math.PI, 2.2); sofaBox(X1 + 5.6, LNZ1 - 0.45, 2.2);
  sofaClub(root, X1 + 9.4, LNZ1 - 0.75, Math.PI + 0.35, 1.6); addBox(X1 + 8.5, LNZ1 - 1.3, X1 + 10.3, LNZ1 - 0.2);
  const tx = X1 + 6.2, tz = LNZ0 + 1.6;                                             // coffee table: light top, wood legs
  box(root, H.tableTop, 1.2, 0.04, 0.6, tx, 0.42, tz);
  box(root, H.tableWood, 1.1, 0.02, 0.5, tx, 0.12, tz, { shadow: false });
  for (const e of [-1, 1]) for (const f of [-1, 1]) box(root, H.tableWood, 0.04, 0.44, 0.04, tx + e * 0.52, 0.2, tz + f * 0.24, { rz: e * 0.12 });
  addBox(tx - 0.62, tz - 0.32, tx + 0.62, tz + 0.32);
  // fire station door + green sign + switch on the south wall, near the far end
  const fx = X1 + 8.4;
  box(root, H.frame, 1.05, 2.15, 0.05, fx, 1.075, LNZ1 - 0.02);
  box(root, H.fireDoor, 0.95, 2.1, 0.04, fx, 1.05, LNZ1 - 0.04);
  box(root, M.chrome, 0.14, 0.03, 0.04, fx - 0.35, 1.05, LNZ1 - 0.08, { shadow: false });
  plane(root, H.greenSign, 0.5, 0.11, fx + 0.2, 2.35, LNZ1 - 0.012, Math.PI);
  box(root, M.white, 0.09, 0.09, 0.012, fx - 0.75, 1.25, LNZ1 - 0.006, { shadow: false });
  // ceiling: square downlights, AC diffusers, smoke detectors, CCTV dome
  for (const x of [X1 + 2.0, X1 + 5.0, X1 + 8.0]) for (const z of [zm - 1.7, zm + 1.7]) box(root, H.lamp, 0.24, 0.01, 0.24, x, CEIL - 0.006, z, { shadow: false });
  for (const x of [X1 + 3.5, X1 + 6.5, X1 + 9.5]) for (const z of [zm - 2.2, zm + 2.2]) plane(root, H.diffuser, 0.6, 0.6, x, CEIL - 0.004, z, 0, Math.PI / 2);
  for (const x of [X1 + 3.0, X1 + 7.5]) cyl(root, H.cam, 0.06, 0.07, 0.03, x, CEIL - 0.015, zm - 0.6, { seg: 14, shadow: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), H.cam);
  dome.rotation.x = Math.PI; dome.position.set(X1 + 9.2, CEIL, LNZ1 - 0.5); root.add(dome);
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
  const lz = 17.4; // centred on the wall between the doors and the laminate door (suggestion 37)
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
  wallWithBays(root, X0, LZ0, LZ1, 1, [24.6, 28.0, 31.4, 34.6], { mat: H.granite });   // black granite lift wall with a door opening per lift
  const lifts = [{ n: 4, z: 24.6 }, { n: 3, z: 28.0 }, { n: 2, z: 31.4 }, { n: 1, z: 34.6 }];
  // same look as lift 5 (suggestion 42): steel frame, number disc, indicator, call button, fire alarm
  for (const L of lifts) liftFront(root, X0, L.z, L.n, 1);
  box(root, M.white, 0.012, 0.09, 0.09, X0 + 0.006, 0.38, 29.7, { shadow: false });    // socket
  for (const z of [32.6, 33.0]) cyl(root, M.chrome, 0.22, 0.22, 0.7, X0 + 0.32, 0.35, z, { seg: 20, shadow: false }); // steel bins
  const fl = new THREE.Group(); fl.position.set(X0 + 0.9, 2.95, 24.2); root.add(fl);   // hanging FOURTH FLOOR sign
  box(fl, M.black, 0.03, 0.2, 0.62, 0, 0, 0, { shadow: false });
  plane(fl, H.fourth, 0.6, 0.18, 0.017, 0, 0, Math.PI / 2);
  plane(fl, H.fourth, 0.6, 0.18, -0.017, 0, 0, -Math.PI / 2);
  // south of lift 1 (suggestions 45 + 46, IMG_5736 / 5738): grey wall with a flush door, logo + track spots,
  // glass office with a frosted band, navy slatted panel with a ring logo, then more glass up to the window
  const es0 = LZ1, es1 = LZ1 + 3.6;
  wallZ(root, X0, es0, es1, 1, H.slate);
  for (const z of [es1 - 1.25, es1 - 0.25]) box(root, M.blackMatte, 0.006, 2.2, 0.01, X0 + 0.003, 1.1, z, { shadow: false }); // flush door seams
  box(root, M.blackMatte, 0.006, 0.01, 1.0, X0 + 0.003, 2.2, es1 - 0.75, { shadow: false });
  plane(root, H.eSyn, 1.3, 0.65, X0 + 0.012, 1.75, es0 + 1.35, Math.PI / 2);
  box(root, M.white, 0.04, 0.03, 1.2, X0 + BW + 0.3, CEIL - 0.03, es0 + 1.35, { shadow: false });
  for (const z of [es0 + 0.9, es0 + 1.35, es0 + 1.8]) cyl(root, M.white, 0.045, 0.045, 0.16, X0 + BW + 0.3, CEIL - 0.12, z, { seg: 12, shadow: false, rz: 0.7 });
  box(root, H.navy, 0.4, CEIL, 0.3, X0, CEIL / 2, es1 + 0.1);                                     // dark jamb
  const gw1 = es1 + 4.2;
  glassFronts(root, X0, -1, es1 + 0.25, gw1, 4.2, { frost: true });
  const nv0 = gw1 + 0.2, nv1 = nv0 + 1.3;
  wallZ(root, X0, nv0, nv1, 1, H.navy);
  const ns = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(nv1 - nv0, BULK), nv1 - nv0, BULK, 0.8), H.navySlats);
  ns.position.set(X0 + 0.004, BULK / 2, (nv0 + nv1) / 2); ns.rotation.y = Math.PI / 2; root.add(ns);
  plane(root, H.ringLogo, 0.5, 0.5, X0 + 0.01, 1.75, (nv0 + nv1) / 2, Math.PI / 2);
  glassFronts(root, X0, -1, nv1 + 0.2, Z1 - 0.15);
  box(root, H.wall, 0.1, CEIL - BULK, Z1 - 20, X0 - 0.05, (BULK + CEIL) / 2, (20 + Z1) / 2, { shadow: false });

  // ---- Entrance (suggestion 23): brown doormat outside, CCTV ----
  box(root, H.mat, 0.6, 0.012, 1.05, X0 + 0.42, 0.006, 8.12, { shadow: false });
  for (const z of [5.0, 18.3]) { // wall-bracket bullet cameras
    box(root, H.cam, 0.04, 0.04, 0.12, X0 + BW - 0.05, BULK - 0.03, z, { shadow: false });
    cyl(root, H.cam, 0.035, 0.035, 0.14, X0 + BW - 0.1, BULK - 0.08, z, { seg: 10, shadow: false, rz: Math.PI / 2 - 0.3 });
  }

  // ---- East side ----
  wallZ(root, X1, Z0, Math.min(15.0, NB), -1); // plain white wall opposite the office doors
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
  // neighbour office (IMG_5707 / IMG_5709, suggestion 39): sits opposite the pixbit sign. White wall with a
  // fingerprint terminal, black 8-pane double door + 2-pane side light + transom (green room with pendant bulbs behind),
  // white wall, wood slat strip, diamond-pattern panel with the Technaureus sign + track spots, wood strip, glass fronts
  const dz0 = NB, dz1 = dz0 + 1.7, dTop = 2.45, dx = X1 - 0.04, dm = dz0 + 1.05;
  if (dz0 > 15.01) wallZ(root, X1, 15.0, dz0, -1);
  const dg = new THREE.Mesh(new THREE.PlaneGeometry(dz1 - dz0, BULK - 0.05), H.tint);
  dg.position.set(dx, (BULK - 0.05) / 2, (dz0 + dz1) / 2); dg.rotation.y = -Math.PI / 2; dg.renderOrder = 2;
  root.add(dg);
  const fz = (z, y0 = 0, y1 = BULK) => box(root, M.black, 0.07, y1 - y0, 0.06, dx, (y0 + y1) / 2, z);
  const fy = (y, z0 = dz0, z1 = dz1) => box(root, M.black, 0.07, 0.06, z1 - z0, dx, y, (z0 + z1) / 2);
  for (const z of [dz0, dz1]) fz(z, 0, BULK);                              // outer frame
  fy(0.03); fy(dTop); fy(BULK - 0.03);                                     // sill, transom bar, head
  for (const z of [dz0 + 0.04, dm - 0.03, dm + 0.03, dz1 - 0.04]) fz(z, 0, dTop); // leaf stiles
  fz((dz0 + dm) / 2, 0, dTop);                                             // mullion: 2 columns on the main leaf
  for (const y of [0.62, 1.22, 1.84]) fy(y, dz0, dm);                      // 4 rows of panes
  fy(1.22, dm, dz1);                                                       // side light: 2 tall panes
  for (const z of [dm - 0.09, dm + 0.09]) {
    box(root, M.chrome, 0.03, 0.6, 0.025, X1 - 0.12, 1.15, z, { shadow: false });
    for (const y of [0.88, 1.42]) box(root, M.chrome, 0.08, 0.02, 0.02, X1 - 0.09, y, z, { shadow: false });
  }
  addBox(X1 - 0.08, dz0, X1 + 0.02, dz1);
  // room seen through the door: olive-green walls, wood floor, two bare pendant bulbs
  const rz0 = dz0 - 0.6, rz1 = dz1 + 0.6, rb = X1 + 2.6;
  slab(root, H.tableWood, X1 + 0.02, rz0, rb, rz1, 0.002);
  slab(root, H.roomCeil, X1, rz0, rb, rz1, CEIL, { down: true });
  box(root, H.olive, 0.1, CEIL, rz1 - rz0, rb, CEIL / 2, (rz0 + rz1) / 2, { shadow: false });
  for (const z of [rz0, rz1]) box(root, H.olive, rb - X1 - 0.12, CEIL, 0.1, (X1 + 0.12 + rb) / 2, CEIL / 2, z, { shadow: false });
  for (const [z, l] of [[dm - 0.1, 0.9], [dm + 0.15, 1.15]]) {
    box(root, M.black, 0.01, l, 0.01, X1 + 0.9, CEIL - l / 2, z, { shadow: false });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), H.lamp);
    bulb.position.set(X1 + 0.9, CEIL - l - 0.04, z); root.add(bulb);
  }
  // fingerprint terminal left of the door, CCTV dome above
  box(root, H.silver, 0.035, 0.2, 0.15, X1 - 0.018, 1.35, dz0 - 0.4, { shadow: false });
  box(root, M.blackMatte, 0.01, 0.08, 0.09, X1 - 0.037, 1.39, dz0 - 0.4, { shadow: false });
  box(root, M.bottleBlue, 0.006, 0.05, 0.05, X1 - 0.043, 1.4, dz0 - 0.42, { shadow: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), H.cam);
  dome.rotation.x = Math.PI; dome.position.set(X1 - 0.35, BULK, dz0 + 0.3); root.add(dome);
  // white wall, then the Technaureus panel between wood slat strips
  const wz0 = dz0 + 2.85, wz1 = wz0 + 3.4;
  wallZ(root, X1, dz1, wz1 + 0.2, -1);
  box(root, M.white, 0.012, 0.09, 0.09, X1 - 0.006, 0.38, wz0 - 0.3, { shadow: false });           // socket
  for (const z of [wz0 - 0.1, wz1 + 0.1]) {
    box(root, H.woodStrip, 0.06, BULK, 0.2, X1 - 0.03, BULK / 2, z);
    for (const k of [-0.06, 0, 0.06]) box(root, M.blackMatte, 0.005, BULK, 0.008, X1 - 0.061, BULK / 2, z + k, { shadow: false });
  }
  const dw = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(wz1 - wz0, BULK), wz1 - wz0, BULK, 0.7), H.diamond);
  dw.position.set(X1 - 0.004, BULK / 2, (wz0 + wz1) / 2); dw.rotation.y = -Math.PI / 2; dw.receiveShadow = true;
  root.add(dw);
  const tz2 = (wz0 + wz1) / 2 + 0.2;
  box(root, M.white, 0.03, 0.58, 1.05, X1 - 0.02, 1.85, tz2);
  plane(root, H.techno, 1.0, 0.55, X1 - 0.036, 1.85, tz2, -Math.PI / 2);
  // track spotlights aimed at the sign
  box(root, M.black, 0.04, 0.03, 0.8, X1 - BW - 0.3, CEIL - 0.03, tz2, { shadow: false });
  for (const z of [tz2 - 0.3, tz2 + 0.05, tz2 + 0.35]) cyl(root, M.black, 0.04, 0.035, 0.14, X1 - BW - 0.3, CEIL - 0.12, z, { seg: 10, shadow: false, rz: -0.7 });
  // after the panel (suggestion 41, IMG_5713 / 5714): frameless glass door with a face-reader on the wood strip,
  // white pier with a switch, open laminate stair door (blue stairwell, black steps), then lift 5 in black granite
  const g0 = wz1 + 0.2, g1 = wz1 + 1.35, p1 = g1 + 0.6, s1 = p1 + 1.1, lf0 = s1, lf1 = LNZ0;
  box(root, M.blackMatte, 0.02, 0.17, 0.09, X1 - 0.07, 1.45, wz1 + 0.1, { shadow: false });   // face reader
  box(root, M.bottleBlue, 0.005, 0.11, 0.06, X1 - 0.081, 1.47, wz1 + 0.1, { shadow: false });
  const gdoor = new THREE.Mesh(new THREE.PlaneGeometry(g1 - g0 - 0.04, 2.38), M.glass);
  gdoor.position.set(X1 - 0.03, 1.2, (g0 + g1) / 2); gdoor.rotation.y = -Math.PI / 2; gdoor.renderOrder = 2; root.add(gdoor);
  for (const z of [g0 + 0.05, g1 - 0.05]) box(root, M.chrome, 0.03, 0.05, 0.12, X1 - 0.03, 2.36, z, { shadow: false }); // patch fittings
  box(root, M.chrome, 0.03, 1.1, 0.03, X1 - 0.11, 1.15, g0 + 0.16, { shadow: false });        // long pull handle
  for (const y of [0.62, 1.68]) box(root, M.chrome, 0.08, 0.02, 0.02, X1 - 0.07, y, g0 + 0.16, { shadow: false });
  addBox(X1 - 0.06, g0, X1 + 0.02, g1);
  // room behind the glass door: grey tile floor, white walls
  slab(root, H.greyTile, X1 + 0.02, g0, X1 + 3.0, g1 + 0.3, 0.002, { tile: 1.2 });
  slab(root, H.roomCeil, X1, g0, X1 + 3.0, g1 + 0.3, CEIL, { down: true });
  box(root, H.room, 0.1, CEIL, g1 + 0.3 - g0, X1 + 3.0, CEIL / 2, (g0 + g1 + 0.3) / 2, { shadow: false });
  box(root, M.black, 0.05, 2.6, 0.05, X1 + 1.6, 1.3, g0 + 0.5, { shadow: false });                // glimpse of a black partition
  box(root, H.room, 2.88, CEIL, 0.1, X1 + 1.56, CEIL / 2, g1 + 0.35, { shadow: false });
  box(root, H.room, 2.88, CEIL, 0.1, X1 + 1.56, CEIL / 2, g0 - 0.05, { shadow: false });            // north wall: closed box (suggestion 49)
  // white pier + headers over both doors
  wallZ(root, X1, g1, p1, -1);
  box(root, M.white, 0.012, 0.09, 0.09, X1 - 0.006, 1.25, (g1 + p1) / 2, { shadow: false });   // switch
  box(root, M.blackMatte, 0.015, 0.03, 0.035, X1 - 0.012, 1.25, (g1 + p1) / 2, { shadow: false });
  box(root, H.wall, 0.1, BULK - 2.4, g1 - g0, X1 + 0.05, (2.4 + BULK) / 2, (g0 + g1) / 2);
  box(root, H.wall, 0.1, BULK - 2.3, s1 - p1, X1 + 0.05, (2.3 + BULK) / 2, (p1 + s1) / 2);
  // stair door: laminate leaf with a vision slot, standing open into the stairwell
  box(root, H.frame, 0.12, 0.06, s1 - p1, X1 + 0.02, 2.3, (p1 + s1) / 2);
  for (const z of [p1 + 0.02, s1 - 0.02]) box(root, H.frame, 0.12, 2.3, 0.04, X1 + 0.02, 1.15, z);
  const leaf = new THREE.Group(); leaf.position.set(X1 + 0.06, 0, p1 + 0.04); leaf.rotation.y = 1.25; root.add(leaf);
  const lw = s1 - p1 - 0.08;
  box(leaf, H.laminate, 0.04, 2.25, lw, 0, 1.125, lw / 2);
  for (const sd of [-1, 1]) {
    box(leaf, H.slot, 0.012, 0.9, 0.1, sd * 0.021, 1.45, lw * 0.6, { shadow: false });
    box(leaf, M.chrome, 0.03, 0.42, 0.025, sd * 0.06, 1.05, lw - 0.12, { shadow: false });
  }
  addBox(X1 + 0.04, p1, X1 + 1.05, p1 + 0.4);
  // stairwell: blue walls, black glossy floor, black steps rising east along the far side
  const sx1 = X1 + 4.2, sz0 = p1 - 0.1, sz1 = s1 + 0.15;
  slab(root, H.granite, X1 + 0.02, sz0, sx1, sz1, 0.003, { tile: 1.2 });
  slab(root, H.roomCeil, X1, sz0, sx1, sz1, 4.5, { down: true });
  box(root, H.stairBlue, sx1 - X1 - 0.12, 4.5, 0.1, (X1 + 0.12 + sx1) / 2, 2.25, sz0 - 0.05, { shadow: false });
  box(root, H.stairBlue, sx1 - X1 - 0.12, 4.5, 0.1, (X1 + 0.12 + sx1) / 2, 2.25, sz1 + 0.05, { shadow: false });
  box(root, H.stairBlue, 0.1, 4.5, sz1 - sz0, sx1 + 0.05, 2.25, (sz0 + sz1) / 2, { shadow: false });
  box(root, H.wall, 0.1, 4.5 - BULK, s1 - p1, X1 + 0.05, (4.5 + BULK) / 2, (p1 + s1) / 2, { shadow: false });
  for (let i = 0; i < 9; i++) box(root, H.granite, 0.3, 0.17 * (i + 1), 0.95, X1 + 1.3 + i * 0.3, 0.085 * (i + 1), s1 - 0.4);
  addBox(X1 + 1.15, s1 - 0.9, sx1, sz1);
  addBox(sx1 - 0.05, sz0, sx1 + 0.1, sz1);
  // lift 5: black granite block from floor to ceiling, steel doors, number disc, indicator, call button, fire alarm
  const L5 = s1 + 1.3, lx = X1 - 0.1;
  wallWithBays(root, lx, lf0, lf1, -1, [L5], { h: CEIL, mat: H.granite, pad: 1.0 });
  box(root, H.granite, 0.1, CEIL, 0.1, X1 + 0.05, CEIL / 2, lf1 + 0.05);                        // return into the lounge
  liftFront(root, lx, L5, 5, -1, { cw: 2.3 });   // narrower: stairwell on one side, lounge wall on the other
  // hanging FOURTH FLOOR sign in front of lift 5
  const fl5 = new THREE.Group(); fl5.position.set(X1 - 0.9, 2.95, lf0 - 0.1); root.add(fl5);
  box(fl5, M.black, 0.03, 0.2, 0.62, 0, 0, 0, { shadow: false });
  plane(fl5, H.fourth, 0.6, 0.18, 0.017, 0, 0, Math.PI / 2);
  plane(fl5, H.fourth, 0.6, 0.18, -0.017, 0, 0, -Math.PI / 2);
  // south of the lounge (suggestions 45 + 46, IMG_5736 / 5738): lift 6 in black granite, ladies toilet,
  // navy slatted panel with the 10COD logo, then black-framed glass offices to the window
  const P6 = LNZ1 + 0.55, lb0 = P6 + 0.35, lb1 = lb0 + 2.6;
  wallZ(root, X1, P6, lb0, -1);
  wallWithBays(root, X1 - 0.1, lb0, lb1, -1, [lb0 + 1.3], { h: CEIL, mat: H.granite, pad: 1.0 });
  liftFront(root, X1 - 0.1, lb0 + 1.3, 6, -1, { cw: 2.4 });
  const tw0 = lb1, tw1 = tw0 + 2.8, lz6 = tw0 + 0.9;
  ladiesToilet(root, tw0, tw1, lz6);
  const lb = new THREE.Group(); lb.position.set(X1 - 0.33, 2.62, lz6 + 0.75); root.add(lb);
  box(lb, M.black, 0.6, 0.15, 0.03, 0, 0, 0);
  plane(lb, H.ladies, 0.56, 0.12, 0, 0, 0.017, 0);
  plane(lb, H.ladies, 0.56, 0.12, 0, 0, -0.017, Math.PI);
  const fb6 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), H.orange);                  // fire ball
  fb6.position.set(X1 - 0.13, 1.78, tw0 + 2.2); fb6.castShadow = true; root.add(fb6);
  cyl(root, M.metalDark, 0.11, 0.09, 0.08, X1 - 0.13, 1.72, tw0 + 2.2, { seg: 16, open: true, shadow: false });
  box(root, M.white, 0.012, 0.09, 0.09, X1 - 0.006, 0.38, tw1 - 0.25, { shadow: false });        // socket
  const np0 = tw1, np1 = np0 + 2.6;
  wallZ(root, X1, np0, np1, -1, H.navy);
  const ps = new THREE.Mesh(worldUV(new THREE.PlaneGeometry(np1 - np0, BULK), np1 - np0, BULK, 0.8), H.navySlats);
  ps.position.set(X1 - 0.004, BULK / 2, (np0 + np1) / 2); ps.rotation.y = -Math.PI / 2; root.add(ps);
  plane(root, H.tenCod, 1.5, 0.47, X1 - 0.012, 1.75, (np0 + np1) / 2, -Math.PI / 2);
  glassFronts(root, X1, 1, np1 + 0.2, Z1 - 0.15);
  buildLounge(root);

  // ---- End windows + hanging FIRE EXIT sign ----
  endWindow(root, Z0 - 0.12, 1, X0, X1, X0 + 0.9, X1 - 0.25);  // north: wide glass, solid wall only at the east corner (IMG_5705)
  endWindow(root, Z1 + 0.12, -1);
  plane(root, H.fireExit, 0.5, 0.11, (X0 + X1) / 2, 2.95, Z1 - 0.01, Math.PI); // green FIRE EXIT on the window header (IMG_5738)
  const ex = new THREE.Group(); ex.position.set((X0 + X1) / 2, 2.72, Z0 + 1.6); root.add(ex);
  box(ex, M.white, 0.58, 0.14, 0.03, 0, 0, 0, { shadow: false });
  plane(ex, H.fireExit, 0.56, 0.12, 0, 0, 0.016, 0);
  plane(ex, H.fireExit, 0.56, 0.12, 0, 0, -0.016, Math.PI);
  for (const s of [-1, 1]) box(ex, M.chrome, 0.006, CEIL - 2.79, 0.006, s * 0.22, (CEIL - 2.79) / 2 + 0.07, 0, { shadow: false });
}

/**
 * Ground floor (suggestion 54): same size as the hall, only the corridor for now. Both long sides are solid wall
 * (the offices come later); the 6 lifts sit exactly where they are upstairs, so every lift brings you to the same
 * spot one floor down (src/lifts.js).
 */
export function buildGroundFloor(root) {
  const D = GROUND_DX, x0 = X0 + D, x1 = X1 + D, xm = (x0 + x1) / 2;
  slab(root, H.floor, x0 + 0.02, Z0, x1 - BAND, Z1, 0.001, { tile: 1.6 });
  slab(root, H.floorBrown, x1 - BAND, Z0, x1, Z1, 0.001, { tile: 1.6 });
  slab(root, H.grid, x0 + BW, Z0, x1 - BW, Z1, CEIL, { down: true, tile: 1.2 });
  for (const [xa, xb, edge, dir] of [[x0, x0 + BW, x0 + BW, 1], [x1 - BW, x1, x1 - BW, -1]]) {
    slab(root, H.wall, xa, Z0, xb, Z1, BULK, { down: true });
    box(root, H.wall, 0.03, CEIL - BULK, Z1 - Z0, edge, (BULK + CEIL) / 2, (Z0 + Z1) / 2, { shadow: false });
    box(root, M.lightStrip, 0.02, 0.025, Z1 - Z0 - 0.4, edge + dir * 0.03, BULK + 0.04, (Z0 + Z1) / 2, { shadow: false });
  }
  for (let z = Z0 + 2.2; z < Z1 - 1; z += 3.0) for (const x of [x0 + BW + 0.9, x1 - BW - 0.9]) cyl(root, M.spotGlow, 0.07, 0.07, 0.01, x, CEIL - 0.006, z, { seg: 16, shadow: false });
  for (let z = Z0 + 3.7; z < Z1 - 2; z += 6.0) plane(root, H.diffuser, 0.6, 0.6, xm + (Math.round(z) % 2 ? 0.6 : -0.6), CEIL - 0.004, z, 0, Math.PI / 2);
  // solid walls the whole way along (white, black granite around each lift door)
  const bays = (out) => LIFTS.filter((L) => L.out === out).map((L) => L.z);
  wallWithBays(root, x0, Z0, Z1, 1, bays(1), { h: CEIL });
  wallWithBays(root, x1 - 0.1, Z0, Z1, -1, bays(-1), { h: CEIL });
  for (const L of LIFTS) liftFront(root, L.x + D, L.z, L.n, L.out, { ground: true, cw: L.cw });
  // end walls with a daylight window, "GROUND FLOOR" signs in front of the lifts
  endWindow(root, Z0 - 0.12, 1, x0, x1, x0 + 0.9, x1 - 0.9);
  endWindow(root, Z1 + 0.12, -1, x0, x1, x0 + 0.9, x1 - 0.9);
  for (const [z, ry] of [[Z0 + 1.6, 0], [Z1 - 1.6, Math.PI]]) plane(root, H.groundSign, 0.6, 0.18, xm, 2.95, z, ry);
  for (const L of LIFTS) {
    const g = new THREE.Group(); g.position.set(L.x + D + L.out * 0.9, 2.95, L.z - 0.4); root.add(g);
    box(g, M.black, 0.03, 0.2, 0.62, 0, 0, 0, { shadow: false });
    plane(g, H.groundSign, 0.6, 0.18, 0.017, 0, 0, Math.PI / 2);
    plane(g, H.groundSign, 0.6, 0.18, -0.017, 0, 0, -Math.PI / 2);
  }
  // soft light so the corridor is not dim (the sun does not reach in here)
  for (const z of [6, 24, 40]) { const l = new THREE.PointLight('#fff1dc', 5, 22, 1.4); l.position.set(xm, CEIL - 0.3, z); GROUND_LIGHTS.push(l); }
}
