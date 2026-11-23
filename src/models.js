import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Detailed, code-built prop geometry (monitor, keyboard, mouse, bottle, plant blades, planters, flowers).
 * Every builder is cached: the geometry is made once and shared by every instance, so building a
 * hundred workstations stays fast. mergeStatic (src/merge.js) later bakes the instances into the world.
 */
const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Rounded-rect slab extruded along +z, centred in x/y, spanning z 0..depth (bevel included). */
function slab(w, h, depth, r, bevel) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - 2 * bevel, h - 2 * bevel, Math.max(0.001, r - bevel)), {
    depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6,
  });
  g.translate(0, 0, bevel);
  return g;
}

// ---------- Monitor (24", thin bezel), local to the workstation group ----------
// Screen plane in props.js sits at (0, 0.35, -0.058) facing +z, 0.52 × 0.30.
export const monitorGeo = {
  /** Front shell: thin side/top bezel, slightly deeper chin. */
  shell: () => cached('mon.shell', () => {
    const g = slab(0.536, 0.322, 0.012, 0.008, 0.0025);
    g.translate(0, 0.35 - 0.005, -0.0592 - 0.012);
    return g;
  }),
  /** Tapered rear housing (electronics bulge) behind the panel. */
  back: () => cached('mon.back', () => {
    const a = slab(0.42, 0.22, 0.016, 0.03, 0.006); a.translate(0, 0.335, -0.0712 - 0.016);
    const b = slab(0.22, 0.13, 0.014, 0.03, 0.006); b.translate(0, 0.325, -0.0872 - 0.014);
    return mergeGeometries([a, b]);
  }),
  /** Curved stand arm from the foot up into the back of the housing. */
  arm: () => cached('mon.arm', () => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.008, -0.03), new THREE.Vector3(0, 0.05, -0.085), new THREE.Vector3(0, 0.16, -0.13),
      new THREE.Vector3(0, 0.27, -0.125), new THREE.Vector3(0, 0.31, -0.1),
    ]);
    const g = new THREE.TubeGeometry(curve, 24, 1, 10, false);
    // flatten the round tube into an oval bar (wide, thin) like a modern stand
    const p = g.attributes.position;
    const ref = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const ring = Math.floor(i / 11), t = ring / 24;
      curve.getPointAt(Math.min(1, t), c);
      ref.set(p.getX(i), p.getY(i), p.getZ(i)).sub(c); // unit radius offset
      p.setXYZ(i, c.x + ref.x * 0.024, c.y + ref.y * 0.008, c.z + ref.z * 0.008);
    }
    g.computeVertexNormals();
    return g;
  }),
  /** Rounded foot plate lying on the desk. */
  foot: () => cached('mon.foot', () => {
    const g = slab(0.24, 0.17, 0.008, 0.07, 0.003);
    g.rotateX(-Math.PI / 2); // extrusion now points +y
    g.translate(0, 0, -0.05);
    return g;
  }),
};

// ---------- Keyboard: aluminium base + individual key caps ----------
export const keyboardGeo = {
  base: () => cached('kb.base', () => {
    const g = slab(0.28, 0.108, 0.01, 0.008, 0.003);
    g.rotateX(-Math.PI / 2);
    // slight wedge: lift the back edge
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.005 && p.getZ(i) < 0) p.setY(i, p.getY(i) + 0.004 * (-p.getZ(i) / 0.054));
    g.computeVertexNormals();
    g.translate(-0.01, 0, 0.25);
    return g;
  }),
  keys: () => cached('kb.keys', () => {
    const parts = [];
    const pitch = 0.0185, cap = 0.0155, y0 = 0.0125;
    const add = (x, z, w) => {
      const k = new THREE.BoxGeometry(w, 0.004, cap);
      k.translate(x, y0 + 0.004 * (0.304 - z) / 0.108, z); // follows the wedge of the base
      parts.push(k);
    };
    for (let r = 0; r < 5; r++) {
      const z = 0.25 - 0.037 + r * pitch;
      if (r === 4) { // bottom row: modifiers + space bar
        let x = -0.01 - 0.13 + 0.008;
        for (const w of [1, 1, 1.25, 6.5, 1.25, 1, 1, 1]) { const ww = w * pitch - (pitch - cap); add(x + ww / 2, z, ww); x += w * pitch; }
        continue;
      }
      const n = 14;
      for (let c = 0; c < n; c++) add(-0.01 - 0.13 + 0.008 + cap / 2 + c * pitch + (r % 2) * 0.004, z, cap);
    }
    return mergeGeometries(parts);
  }),
};

// ---------- Mouse ----------
export const mouseGeo = {
  shell: () => cached('mouse.shell', () => {
    const g = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2); // dome
    g.scale(0.03, 0.022, 0.054);
    // raise the palm end (+z, toward the sitter) into a hump
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (1 + 0.15 * Math.max(0, p.getZ(i) / 0.054)));
    g.computeVertexNormals();
    return g;
  }),
  wheel: () => cached('mouse.wheel', () => { const g = new THREE.CylinderGeometry(0.006, 0.006, 0.005, 12); g.rotateZ(Math.PI / 2); return g; }),
};

// ---------- Water bottle ----------
export const bottleGeo = {
  body: () => cached('bottle.body', () => new THREE.LatheGeometry([
    [0, 0], [0.028, 0], [0.032, 0.006], [0.032, 0.16], [0.03, 0.18], [0.022, 0.196], [0.019, 0.2], [0, 0.2],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 18)),
  cap: () => cached('bottle.cap', () => new THREE.CylinderGeometry(0.02, 0.021, 0.03, 16).translate(0, 0.215, 0)),
};

// ---------- Plants ----------
/**
 * Snake-plant blade: unit height (scale.y = leaf height), width ~0.09 m, diamond cross-section so it
 * reads from both sides, tapers to a point, bends backwards and twists a little toward the tip.
 */
export function bladeGeo(variant = 0, { width = 0.09, thick = 0.016, bend = 0.08, twist = 0.5 } = {}) {
  return cached(`blade.${variant}.${width}.${thick}.${bend}.${twist}`, () => {
    const seg = 10, pos = [], idx = [];
    const b = bend * (0.6 + 0.4 * ((variant * 37) % 10) / 10) * (variant % 2 ? -1 : 1);
    const tw = twist * (variant % 3 === 2 ? -1 : 1);
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const w = width / 2 * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) * (1 - 0.35 * t);
      const th = thick / 2 * (1 - t * 0.85);
      const a = tw * t, ca = Math.cos(a), sa = Math.sin(a);
      const cz = b * t * t; // backward bend (uses absolute metres; y is scaled later)
      for (const [lx, lz] of [[-w, 0], [0, th], [w, 0], [0, -th]]) pos.push(lx * ca - lz * sa, t, cz + lx * sa + lz * ca);
    }
    const tip = pos.length / 3;
    pos.push(0, 1.04, b * 1.08);
    for (let i = 0; i < seg; i++) for (let k = 0; k < 4; k++) {
      const a = i * 4 + k, c = i * 4 + (k + 1) % 4, a2 = a + 4, c2 = c + 4;
      idx.push(a, c, a2, c, c2, a2);
    }
    for (let k = 0; k < 4; k++) idx.push(seg * 4 + k, seg * 4 + (k + 1) % 4, tip);
    idx.push(0, 2, 1, 0, 3, 2); // base cap
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  });
}

/** Round tapered planter with a rolled rim, fitting inside a `size` square footprint. Returns { pot, soil, soilY }. */
export function planterGeo(size, h) {
  return cached(`planter.${size}.${h}`, () => {
    const rt = size / 2 - 0.004, rb = rt * 0.78;
    const pot = new THREE.LatheGeometry([
      [0, 0.002], [rb - 0.01, 0], [rb, 0.012], [rt - 0.012, h - 0.03], [rt, h - 0.02], [rt, h - 0.004],
      [rt - 0.006, h], [rt - 0.016, h - 0.004], [rt - 0.018, h - 0.04],
    ].map(([x, y]) => new THREE.Vector2(x, y)), 32);
    const soil = new THREE.CircleGeometry(rt - 0.016, 28).rotateX(-Math.PI / 2).translate(0, h - 0.035, 0);
    return { pot, soil, soilY: h - 0.035 };
  });
}

// ---------- Flowers ----------
export const flowerGeo = {
  petal: () => cached('fl.petal', () => {
    const g = new THREE.SphereGeometry(1, 10, 6);
    g.scale(0.011, 0.0025, 0.022);
    g.translate(0, 0, 0.02); // petal grows outward from the flower centre along +z
    return g;
  }),
  centre: () => cached('fl.centre', () => new THREE.SphereGeometry(0.009, 10, 8).scale(1, 0.6, 1)),
  pot: () => cached('fl.pot', () => new THREE.LatheGeometry([
    [0, 0.002], [0.04, 0], [0.046, 0.01], [0.058, 0.1], [0.062, 0.108], [0.06, 0.112], [0.054, 0.105],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 28)),
  soil: () => cached('fl.soil', () => new THREE.CircleGeometry(0.055, 20).rotateX(-Math.PI / 2).translate(0, 0.1, 0)),
};

/** Stem tube from (0,0,0) arching to `top`. Cached per rounded endpoint. */
export function stemGeo(top) {
  const key = `stem.${top.map((v) => v.toFixed(3)).join(',')}`;
  return cached(key, () => {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(top[0] * 0.2, top[1] * 0.6, top[2] * 0.2), new THREE.Vector3(...top));
    return new THREE.TubeGeometry(curve, 10, 0.0025, 5, false);
  });
}

// ---------- Downloaded glTF models (public/models/, CC0 from Poly Haven) ----------
const gltfLoader = new GLTFLoader();

/**
 * Loads a glTF from public/ and places it under `parent` once ready (the world is built synchronously,
 * so these arrive a moment later as their own meshes instead of being merged). `onReady(obj)` can add colliders.
 */
export function placeModel(parent, url, { x = 0, y = 0, z = 0, ry = 0, scale = 1, label = '', onReady } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(scale);
  g.userData.label = label;
  gltfLoader.load(url, (gltf) => {
    gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(gltf.scene);
    parent.add(g);
    onReady?.(g);
  }, undefined, (err) => console.warn(`Model ${url} failed to load`, err));
  return g;
}

/**
 * Loads a glTF once and resolves to its scene, ready to .clone() per placement (clones share geometry).
 * Meshes with broken (NaN) positions are dropped; every mesh casts and receives shadows.
 */
const modelCache = new Map();
export function loadModelOnce(url) {
  if (!modelCache.has(url)) {
    modelCache.set(url, gltfLoader.loadAsync(url).then((gltf) => {
      const drop = [];
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        if (Number.isNaN(o.geometry.attributes.position.array[0])) { drop.push(o); return; }
        o.castShadow = true; o.receiveShadow = true;
      });
      for (const o of drop) o.parent.remove(o);
      return gltf.scene;
    }).catch((err) => { console.warn(`Model ${url} failed to load`, err); return new THREE.Group(); }));
  }
  return modelCache.get(url);
}
