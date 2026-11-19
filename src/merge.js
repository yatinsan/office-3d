import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Bakes every static mesh under `root` into one mesh per (material, shadow flags)
 * so the whole office renders in a few dozen draw calls instead of thousands.
 * Object names (userData.label on a mesh or any parent, e.g. "Chair · Long table L2") survive as
 * per-triangle ranges on each merged mesh: use labelAt(hit) on a raycast hit to read them back.
 */
/** Every labelled object (chair, desk, plant…) that got baked in: { label, parts: [{ mesh, start, end }] } (triangle ranges). */
export const pieces = [];

export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const labelOf = (o) => {
    const parts = [];
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.label && parts.at(-1) !== p.userData.label) parts.push(p.userData.label);
    return parts.join(' · ');
  };
  // Nearest labelled ancestor = the "piece" a mesh belongs to (so a chair at a table is its own piece).
  const pidOf = new Map();
  const pieceOf = (o) => {
    for (let p = o; p && p !== root; p = p.parent) {
      if (!p.userData.label) continue;
      if (!pidOf.has(p)) { pidOf.set(p, pieces.length); pieces.push({ label: p.userData.label, parts: [] }); }
      return pidOf.get(p);
    }
    return -1;
  };
  for (const m of meshes) {
    const key = `${m.material.uuid}|${m.castShadow}|${m.renderOrder}`;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(m.matrixWorld);
    if (!buckets.has(key)) buckets.set(key, { material: m.material, cast: m.castShadow, order: m.renderOrder, geos: [], tris: 0, labels: [], pr: [] });
    const b = buckets.get(key);
    const label = labelOf(m);
    if (label && b.labels.at(-1)?.[1] !== label) b.labels.push([b.tris, label]);
    else if (!label && b.labels.length && b.labels.at(-1)[1] !== '') b.labels.push([b.tris, '']);
    const pid = pieceOf(m);
    if (b.pr.at(-1)?.[1] !== pid) b.pr.push([b.tris, pid]);
    b.geos.push(g);
    b.tris += g.attributes.position.count / 3;
  }
  // Clear the hierarchy and replace with merged meshes.
  while (root.children.length) root.remove(root.children[0]);
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos, false);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = true;
    mesh.renderOrder = b.order;
    mesh.userData.labels = b.labels; // [[firstTriangle, label], …] sorted
    mesh.userData.pieces = b.pr;     // [[firstTriangle, pieceId], …] sorted
    b.pr.forEach(([start, pid], i) => {
      if (pid >= 0) pieces[pid].parts.push({ mesh, start, end: i + 1 < b.pr.length ? b.pr[i + 1][0] : b.tris });
    });
    root.add(mesh);
  }
  return buckets.size;
}

/** Name of the object a raycast hit landed on ('' if it has none). */
export function labelAt(hit) {
  const ranges = hit.object.userData.labels;
  if (ranges) {
    let lo = 0, hi = ranges.length - 1, found = '';
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ranges[mid][0] <= hit.faceIndex) { found = ranges[mid][1]; lo = mid + 1; } else hi = mid - 1;
    }
    return found;
  }
  for (let p = hit.object; p; p = p.parent) if (p.userData.label) return p.userData.label;
  return '';
}

/** Piece id a raycast hit on a merged mesh landed on (-1 if none). */
export function pieceAt(hit) {
  const ranges = hit.object.userData.pieces;
  if (!ranges) return -1;
  let lo = 0, hi = ranges.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ranges[mid][0] <= hit.faceIndex) { found = ranges[mid][1]; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}
