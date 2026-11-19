import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Bakes every static mesh under `root` into one mesh per (material, shadow flags)
 * so the whole office renders in a few dozen draw calls instead of thousands.
 */
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const m of meshes) {
    const key = `${m.material.uuid}|${m.castShadow}|${m.renderOrder}`;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(m.matrixWorld);
    if (!buckets.has(key)) buckets.set(key, { material: m.material, cast: m.castShadow, order: m.renderOrder, geos: [] });
    buckets.get(key).geos.push(g);
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
    root.add(mesh);
  }
  return buckets.size;
}
