import * as THREE from 'three';

const loader = new THREE.TextureLoader();
let maxAniso = 8;
export function setAnisotropy(n) { maxAniso = n; }

function canvasTex(w, h, draw, { repeat = true, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  return t;
}

function photo(path, repeat = false) {
  const t = loader.load(path);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  return t;
}

// Deterministic random so the office looks the same every load.
let seed = 1337;
export function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

// ---------- Procedural textures ----------
// Tiles: 512px canvas = 4x4 tiles of 0.6m (2.4m); UVs are scaled to world metres / 2.4.
function tileTex(base, vary, grout) {
  return canvasTex(512, 512, (g, w) => {
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = (rand() - 0.5) * vary;
      g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`;
      g.fillRect(i * s, j * s, s, s);
      for (let k = 0; k < 140; k++) { // speckle
        const d = (rand() - 0.5) * vary * 1.4;
        g.fillStyle = `rgba(${base[0] + d},${base[1] + d},${base[2] + d},0.5)`;
        g.fillRect(i * s + rand() * s, j * s + rand() * s, 2 + rand() * 5, 2 + rand() * 5);
      }
    }
    g.strokeStyle = grout; g.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, w); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke();
    }
  });
}

const woodTex = canvasTex(256, 1024, (g, w, h) => {
  g.fillStyle = '#d9c7a4'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const x = rand() * w, a = 0.05 + rand() * 0.12;
    g.strokeStyle = rand() > 0.5 ? `rgba(150,120,80,${a})` : `rgba(245,235,215,${a})`;
    g.lineWidth = 1 + rand() * 3;
    g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= h; y += 64) g.lineTo(x + Math.sin(y * 0.01 + i) * 4, y);
    g.stroke();
  }
});

// Lobby ceiling: mostly black panels, a few cream triangles, yellow grid + diagonals (2.4m tile).
const diamondTex = canvasTex(512, 512, (g, w) => {
  const n = 2, s = w / n;
  g.fillStyle = '#111111'; g.fillRect(0, 0, w, w);
  g.fillStyle = '#d6ccb2';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(s, 0); g.lineTo(s, s); g.closePath(); g.fill();
  g.strokeStyle = '#ecc828'; g.lineWidth = 7;
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, w); g.stroke();
    g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke();
  }
  g.beginPath(); g.moveTo(0, 0); g.lineTo(w, w); g.moveTo(s, 0); g.lineTo(w, s); g.moveTo(0, s); g.lineTo(s, w); g.stroke();
});

const screenCode = canvasTex(256, 160, (g, w, h) => {
  g.fillStyle = '#1b1d24'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2a2d36'; g.fillRect(0, 0, 40, h);
  const cols = ['#c792ea', '#82aaff', '#c3e88d', '#f78c6c', '#89ddff', '#d0d0d0'];
  for (let y = 8; y < h - 4; y += 7) {
    let x = 48 + Math.floor(rand() * 4) * 8;
    const parts = 1 + Math.floor(rand() * 4);
    for (let p = 0; p < parts && x < w - 10; p++) {
      const len = 10 + rand() * 45;
      g.fillStyle = cols[Math.floor(rand() * cols.length)];
      g.fillRect(x, y, len, 3); x += len + 5;
    }
  }
}, { repeat: false });

const screenDash = canvasTex(256, 160, (g, w, h) => {
  g.fillStyle = '#f4f6fa'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#26324a'; g.fillRect(0, 0, 36, h);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) { g.fillRect(44 + i * 70, 10, 62, 34); }
  g.fillStyle = '#4c7cf0';
  for (let i = 0; i < 12; i++) { const bh = 10 + rand() * 50; g.fillRect(48 + i * 16, 140 - bh, 9, bh); }
  g.fillStyle = '#26c281'; g.fillRect(50, 20, 40, 6); g.fillStyle = '#f0a04c'; g.fillRect(120, 20, 40, 6);
}, { repeat: false });

const screenDark = canvasTex(256, 160, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, '#20263a'); gr.addColorStop(1, '#3b2a4f');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 4; i++) g.fillRect(30, 30 + i * 22, 120 + rand() * 60, 8);
  g.fillStyle = '#ecc828'; g.fillRect(30, 120, 60, 14);
}, { repeat: false });

export const logoTextTex = canvasTex(1024, 360, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#3a3a38';
  g.textAlign = 'center';
  g.font = '700 210px "Avenir Next", "Helvetica Neue", Arial, sans-serif';
  g.fillText('pixbit', w / 2, 200);
  g.font = '500 78px "Avenir Next", "Helvetica Neue", Arial, sans-serif';
  g.fillText('· s o l u t i o n s ·', w / 2, 320);
}, { repeat: false });

export const clockTex = canvasTex(256, 256, (g, w) => {
  const c = w / 2;
  g.fillStyle = '#f7f7f5'; g.beginPath(); g.arc(c, c, c - 4, 0, Math.PI * 2); g.fill();
  g.lineWidth = 10; g.strokeStyle = '#222'; g.stroke();
  g.fillStyle = '#222';
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(c + Math.sin(a) * 96 - 3, c - Math.cos(a) * 96 - 9, 6, 18); }
  g.lineCap = 'round';
  g.lineWidth = 8; g.beginPath(); g.moveTo(c, c); g.lineTo(c + 50, c - 30); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.moveTo(c, c); g.lineTo(c - 20, c - 85); g.stroke();
}, { repeat: false });

// ---------- Materials ----------
const std = (o) => new THREE.MeshStandardMaterial(o);

export const M = {
  floorBeige: std({ map: tileTex([196, 180, 160], 14, '#a8998a'), roughness: 0.3, metalness: 0.0 }),
  floorDark: std({ map: tileTex([78, 78, 80], 12, '#5a5a5c'), roughness: 0.6 }),
  floorTerrace: std({ map: tileTex([176, 120, 104], 18, '#8a5c4f'), roughness: 0.8 }),
  floorCorridor: std({ map: tileTex([226, 214, 196], 8, '#cbbfae'), roughness: 0.12 }),
  wall: std({ color: '#dededb', roughness: 0.92 }),
  wallWarm: std({ color: '#e6e1d6', roughness: 0.92 }),
  concrete: std({ map: photo('textures/concrete.jpg', true), roughness: 0.95 }),
  ceilingBlack: std({ color: '#151516', roughness: 0.95 }),
  diamond: std({ map: diamondTex, roughness: 0.7 }),
  yellow: std({ color: '#ecc21c', roughness: 0.5 }),
  black: std({ color: '#161616', roughness: 0.45, metalness: 0.3 }),
  blackMatte: std({ color: '#1e1e1e', roughness: 0.85 }),
  metalDark: std({ color: '#2a2a2c', roughness: 0.35, metalness: 0.7 }),
  chrome: std({ color: '#b9bcc0', roughness: 0.2, metalness: 1.0 }),
  mesh: std({ color: '#262628', roughness: 0.9 }),
  fabric: std({ color: '#2d2d30', roughness: 1.0 }),
  leather: std({ color: '#1a1a1a', roughness: 0.38, metalness: 0.05 }),
  wood: std({ map: woodTex, roughness: 0.6 }),
  woodDark: std({ color: '#7a5233', roughness: 0.6 }),
  white: std({ color: '#f3f3f1', roughness: 0.5 }),
  whiteGloss: std({ color: '#f5f5f3', roughness: 0.2 }),
  cream: std({ color: '#e8e2c8', roughness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({ color: '#cfdde0', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  glassFrost: new THREE.MeshStandardMaterial({ color: '#f2f2f0', transparent: true, opacity: 0.82, roughness: 0.5, depthWrite: false, side: THREE.DoubleSide }),
  glassYellow: std({ color: '#f1d27a', emissive: '#a8820f', emissiveIntensity: 0.35, roughness: 0.4 }),
  lightStrip: std({ color: '#ffffff', emissive: '#fff4e0', emissiveIntensity: 2.2 }),
  spotGlow: std({ color: '#ffffff', emissive: '#ffe9c4', emissiveIntensity: 3 }),
  screenCode: std({ map: screenCode, emissive: '#ffffff', emissiveMap: screenCode, emissiveIntensity: 0.9, roughness: 0.3 }),
  screenDash: std({ map: screenDash, emissive: '#ffffff', emissiveMap: screenDash, emissiveIntensity: 0.7, roughness: 0.3 }),
  screenDark: std({ map: screenDark, emissive: '#ffffff', emissiveMap: screenDark, emissiveIntensity: 0.8, roughness: 0.3 }),
  screenOff: std({ color: '#0b0b0c', roughness: 0.15, metalness: 0.3 }),
  plant: std({ color: '#3d6b2f', roughness: 0.7 }),
  plantLight: std({ color: '#7f9b3a', roughness: 0.7 }),
  soil: std({ color: '#3a2c20', roughness: 1 }),
  beanbag: std({ color: '#3b3d40', roughness: 0.95 }),
  bottleYellow: std({ color: '#f2b705', roughness: 0.3, metalness: 0.4 }),
  bottleBlue: std({ color: '#1f4fa8', roughness: 0.3, metalness: 0.4 }),
  bottleTeal: std({ color: '#3ab7a6', roughness: 0.3 }),
  red: std({ color: '#b23a2e', roughness: 0.6 }),
  pergola: std({ color: '#8a4b3a', roughness: 0.8 }),
  rail: std({ color: '#4a4a4a', roughness: 0.4, metalness: 0.6 }),
  logo: std({ map: photo('textures/logo.png'), transparent: true, alphaTest: 0.4, roughness: 0.4 }),
  logoText: std({ map: logoTextTex, transparent: true, alphaTest: 0.3, roughness: 0.6 }),
  gallery: std({ map: photo('textures/gallery.jpg'), roughness: 0.6 }),
  clock: std({ map: clockTex, roughness: 0.5 }),
};
M.screens = [M.screenCode, M.screenCode, M.screenDash, M.screenDark];
