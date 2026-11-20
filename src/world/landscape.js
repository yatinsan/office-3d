import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * View from the west balcony, rebuilt from photo IMG_5660:
 * - an almost unbroken coconut-palm + broadleaf canopy rolling out to the horizon
 * - a few low houses (white flat roofs, red tile roofs) poking through the trees
 * - a tree-covered hill on the left (south-west), faint hills on the right
 * - ONE cluster of towers in the distance, centre-right, taken straight from the photo as a matte
 * - warm hazy evening sky (blue-grey up top, peach at the horizon)
 * No generic city: the only buildings are the ones in the photo.
 */
const GROUND = -40;        // office floor is ~40 m above the ground
const CX = 9;              // rough centre of the office plan (x, z) the view radiates from
const CZ = 12;

// Local deterministic RNG so the office's own random textures stay as they were.
let seed = 5660;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const range = (a, b) => a + rnd() * (b - a);

/** Handles for src/weather.js: the sky dome + tower matte get tinted, `snow` materials whiten in winter. */
export const LAND = { sky: null, matte: null, snow: [] };

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, ...extra });

export function buildLandscape(root) {
  // ---- Sky dome, colours sampled from IMG_5660: cool blue-grey to the left (south), neutral straight
  // ahead, warm cream toward the low sun on the right (north-west); paler and greyer down at the horizon.
  const SKY = { //      elevation°: 0          3          10         18         26         60         90
    cool:   ['#a4a8ac', '#a3a7aa', '#a2a9af', '#9ba9b8', '#8ea2bd', '#7d95b5', '#7890b0'],
    centre: ['#ccc8bd', '#cec8bb', '#cbc6bb', '#c4c8c7', '#b3c0ca', '#a2b4c4', '#9bb0c2'],
    warm:   ['#e6d5b9', '#ead9bd', '#efe1c4', '#f4efde', '#eaebe3', '#d0dbe0', '#bccbd6'],
  };
  const ELEV = [0, 3, 10, 18, 26, 60, 90];
  const col = (hex) => new THREE.Color(hex);
  const ramp = (name, el) => {
    const stops = SKY[name];
    if (el <= 0) return col(stops[0]);
    let i = 0; while (i < ELEV.length - 2 && el > ELEV[i + 1]) i++;
    const t = Math.min(1, (el - ELEV[i]) / (ELEV[i + 1] - ELEV[i]));
    return col(stops[i]).lerp(col(stops[i + 1]), t);
  };
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  for (let u = 0; u < c.width; u++) {
    // SphereGeometry: u = 0 is world -x (west, straight out from the balcony); u = 0.75 is -z (right)
    let az = (u / c.width) * 360; if (az > 180) az -= 360;          // + = left (south), - = right (north)
    const right = -az;
    const t = Math.max(-1, Math.min(1, right / 38)) * Math.max(0, 1 - Math.max(0, Math.abs(az) - 90) / 60);
    for (let v = 0; v < c.height; v++) {
      const el = 90 - (v / (c.height - 1)) * 180;
      const k = ramp('centre', el).lerp(ramp(t < 0 ? 'cool' : 'warm', el), Math.abs(t));
      g.fillStyle = '#' + k.getHexString(); g.fillRect(u, v, 1, 1);
    }
  }
  const skyTex = new THREE.CanvasTexture(c); skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1300, 32, 24),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  sky.renderOrder = -1;
  root.add(sky);
  LAND.sky = sky;

  // ---- Ground under the canopy ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), std('#34462a'));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND;
  root.add(ground);
  LAND.snow.push(ground.material);

  // Geometry buckets, one merged mesh per material at the end.
  const buckets = new Map();
  const put = (mat, geo, m) => {
    if (!buckets.has(mat)) buckets.set(mat, []);
    const gg = geo.clone(); gg.applyMatrix4(m); buckets.get(mat).push(gg);
  };
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const place = (mat, geo, x, y, z, sx, sy, sz, ry = 0) => {
    q.setFromEuler(e.set(0, ry, 0)); mtx.compose(p.set(x, y, z), q, s.set(sx, sy, sz)); put(mat, geo, mtx);
  };

  const PCX = 2016, PCY = 1512;                    // photo centre (full-res px); horizon on the centre row
  const ZOOM = 2.0;                                 // towers drawn 2x the true lens size so they read like the photo
  const F = 3029 / ZOOM;                            // iPhone lens: 3029 px focal length at 4032 wide
  const [PX0, PX1, PY0, PY1] = [1480, 3550, 1270, 1760]; // matte crop (full-res px), made by tools/skyline_matte.py
  const V = { x: -2.8, y: 1.6, z: 12 };            // eye on the balcony where the photo was taken
  const SKY_D = 230;                                // close enough that the matte bottom stays above the ground plane
  const zAt = (px) => V.z - ((px - PCX) / F) * SKY_D;  // photo right = world -z (looking west)
  const yAt = (py) => V.y + ((PCY - py) / F) * SKY_D;
  // Anything in front of the matte must stay below its bottom edge, the way the palms sit under the towers in the photo.
  const capY = (x, z) => {
    const dist = V.x - x;
    if (dist < 60) return Infinity;
    const px = PCX - ((z - V.z) / dist) * F;
    if (px < PX0 - 60 || px > PX1 + 60) return Infinity;
    if (dist > SKY_D) return -Infinity;              // hidden behind the matte anyway
    return V.y + ((PCY - (PY1 - 25)) / F) * dist;
  };

  // ---- Templates ----
  const blob = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();          // broadleaf crown
  const trunk = new THREE.CylinderGeometry(0.16, 0.24, 1, 5, 1, true).toNonIndexed();
  trunk.translate(0, 0.5, 0);
  const crown = palmCrown();                                                 // radial drooping fronds

  const leaf = ['#34452a', '#3d4f30', '#475a37', '#516440', '#38492d'].map((col) => std(col, { flatShading: true }));
  const fronds = ['#43552f', '#4d6136', '#3b4c2a', '#566b3c'].map((col) => std(col, { side: THREE.DoubleSide, roughness: 0.85 }));
  const bark = std('#4f4a40');
  LAND.snow.push(...leaf, ...fronds);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  const palm = (x, z, h = range(9, 17), base = GROUND) => {
    const cap = capY(x, z) - base - 2;
    if (cap < 3) { if (cap > 1) tree(x, z, cap / 2.2, base); return; }
    h = Math.min(h, cap);
    const lean = range(-0.08, 0.08);
    place(bark, trunk, x, base, z, 1, h, 1, 0);
    const sc = range(0.8, 1.15);
    q.setFromEuler(e.set(lean, rnd() * Math.PI * 2, lean));
    mtx.compose(p.set(x, base + h, z), q, s.set(sc, sc, sc));
    put(pick(fronds), crown, mtx);
  };
  function tree(x, z, r, base = GROUND) {
    r = Math.min(r, (capY(x, z) - base - 4) / 1.8);
    if (r < 0.8) return;
    place(pick(leaf), blob, x, base + r * 0.9 + range(1, 4), z, r * range(0.9, 1.2), r * range(0.6, 0.85), r * range(0.9, 1.2), rnd() * 6);
  }

  // A point in the view: west half + north + south (the windows face west and north).
  const inView = (x, z) => x < -7 || (z < -8 && x < 40) || (z > 30 && x < 20);

  // ---- Near canopy: individual palms and broadleaf trees ----
  for (let i = 0; i < 2600; i++) {
    const x = range(-190, 40), z = range(-170, 210);
    if (!inView(x, z)) continue;
    if (rnd() < 0.58) palm(x, z); else tree(x, z, range(3.5, 7));
  }
  // ---- Mid canopy: bigger clumps, still spiked with palms ----
  for (let i = 0; i < 5200; i++) {
    const ang = Math.PI * 0.4 + rnd() * Math.PI * 1.25;
    const d = range(170, 560);
    const x = CX + Math.cos(ang) * d, z = CZ + Math.sin(ang) * d;
    if (rnd() < 0.55) palm(x, z, range(10, 18)); else tree(x, z, range(6, 11));
  }
  // ---- Far canopy: broad soft masses that melt into the haze ----
  for (let i = 0; i < 1800; i++) {
    const ang = Math.PI * 0.4 + rnd() * Math.PI * 1.25;
    const d = range(540, 1150);
    tree(CX + Math.cos(ang) * d, CZ + Math.sin(ang) * d, range(14, 26));
  }

  // ---- Hill on the left (south-west), wooded all over ----
  hill(-700, 300, 260, 62, 190);   // the wooded hill left of the towers in the photo
  // faint low ridges on the right (north-west) and far left
  hill(-980, -520, 380, 75, 300);
  hill(-1050, 700, 300, 60, 260);
  hill(-1100, 60, 500, 35, 240);
  function hill(hx, hz, rx, ry, rz) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), std('#3f5230', { flatShading: true }));
    LAND.snow.push(body.material);
    body.scale.set(rx, ry, rz);
    body.position.set(hx, GROUND - 2, hz);
    root.add(body);
    const n = Math.round((rx * rz) / 90);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 0.97;
      const ux = Math.cos(a) * rr, uz = Math.sin(a) * rr;
      const y = GROUND - 2 + ry * Math.sqrt(Math.max(0, 1 - ux * ux - uz * uz));
      const x = hx + ux * rx, z = hz + uz * rz;
      if (rnd() < 0.35) palm(x, z, range(10, 16), y - 2); else tree(x, z, range(7, 13), y - 3);
    }
  }

  // ---- Low houses peeking through the trees ----
  const white = std('#c9c6be', { roughness: 0.9 });
  const offWhite = std('#b5b0a6', { roughness: 0.9 });
  const tile = std('#6e4234', { roughness: 0.9 });
  const sheet = std('#8f9496', { roughness: 0.6, metalness: 0.3 });
  const glassDark = std('#56606a', { roughness: 0.4 });
  LAND.snow.push(white, offWhite, tile, sheet);
  const cube = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const roof = new THREE.CylinderGeometry(0.5, 0.5, 1, 3, 1).toNonIndexed(); // triangular prism
  roof.rotateZ(Math.PI / 2); roof.rotateX(-Math.PI / 2); // ridge along local x, apex up
  for (let i = 0; i < 70; i++) {
    const ang = Math.PI * 0.55 + rnd() * Math.PI * 0.95;
    const d = 30 + Math.pow(rnd(), 1.4) * 420;
    const x = CX + Math.cos(ang) * d, z = CZ + Math.sin(ang) * d;
    if (!inView(x, z)) continue;
    const w = range(8, 14), dd = range(8, 13), h = range(6, 11), ry = rnd() * Math.PI;
    if (GROUND + h + 3.5 > capY(x, z)) continue;   // keep the tower matte clear
    place(rnd() < 0.7 ? white : offWhite, cube, x, GROUND + h / 2, z, w, h, dd, ry);
    place(glassDark, cube, x, GROUND + h * 0.62, z, w + 0.1, 1.0, dd * 0.6, ry);  // window band
    const kind = rnd();
    if (kind < 0.45) place(white, cube, x, GROUND + h + 0.4, z, w + 0.3, 0.8, dd + 0.3, ry);       // flat roof parapet
    else if (kind < 0.8) place(tile, roof, x, GROUND + h + 1.6, z, w + 1, 3.2, dd + 1, ry);         // red tile roof
    else place(sheet, cube, x, GROUND + h + 0.6, z, w + 1, 0.25, dd + 1, ry);                      // sheet roof on posts
  }

  // ---- The tower cluster: cut straight out of photo IMG_5660 (public/textures/skyline.png) ----
  // A photo matte placed so it lines up from the balcony: each photo pixel maps through the iPhone's
  // ~67° lens (focal length 3029 px at 4032 wide, horizon on the centre row) onto a plane SKY_D metres out.
  // At that distance the parallax from anywhere on the terrace or in the office is under a pixel or two.
  const tex = new THREE.TextureLoader().load('textures/skyline.png');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const matte = new THREE.Mesh(
    new THREE.PlaneGeometry(zAt(PX0) - zAt(PX1), yAt(PY0) - yAt(PY1)),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.03, depthWrite: false, fog: false, toneMapped: false }),
  );
  matte.rotation.y = Math.PI / 2;                  // face back toward the office; image left -> +z
  matte.position.set(V.x - SKY_D, (yAt(PY0) + yAt(PY1)) / 2, (zAt(PX0) + zAt(PX1)) / 2);
  matte.renderOrder = 1;
  root.add(matte);
  LAND.matte = matte;
  // skyline.png was made by cutting the sky out of IMG_5660 along a traced roof line (sky keyed by
  // colour difference near the roofs, soft fade at the bottom so the 3D palms take over).

  // ---- Bake buckets into a few big meshes ----
  for (const [mat, geos] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat);
    mesh.castShadow = false; mesh.receiveShadow = false;
    root.add(mesh);
  }
}

/** Coconut palm crown: 9 drooping fronds, each a tapered strip bent in 3 segments. */
function palmCrown() {
  const pos = [];
  const N = 9, L = 4.6;
  for (let f = 0; f < N; f++) {
    const a = (f / N) * Math.PI * 2 + (f % 2) * 0.2;
    const up = f % 3 === 0 ? 0.55 : 0.25; // a few fronds stand up, the rest droop
    const pts = [];
    for (let k = 0; k <= 3; k++) {
      const t = k / 3;
      const r = t * L;
      const y = up * r * 0.6 - t * t * 2.4;
      const w = 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08));
      pts.push({ r, y, w });
    }
    const dir = [Math.cos(a), Math.sin(a)], side = [-Math.sin(a), Math.cos(a)];
    const v = (pt, sgn) => [dir[0] * pt.r + side[0] * pt.w * sgn, pt.y, dir[1] * pt.r + side[1] * pt.w * sgn];
    for (let k = 0; k < 3; k++) {
      const A = v(pts[k], -1), B = v(pts[k], 1), C = v(pts[k + 1], -1), D = v(pts[k + 1], 1);
      pos.push(...A, ...C, ...B, ...B, ...C, ...D);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return geo;
}
