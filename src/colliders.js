import * as THREE from 'three';

// Axis-aligned boxes on the floor plan (x/z). Everything solid is a box.
export const colliders = [];

export function addBox(minX, minZ, maxX, maxZ) {
  colliders.push({ minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX), minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ) });
}

const _box = new THREE.Box3();
/** Adds a collider covering an object's world bounding box (call after positioning). */
export function solid(obj, pad = 0) {
  obj.updateMatrixWorld(true);
  _box.setFromObject(obj);
  addBox(_box.min.x - pad, _box.min.z - pad, _box.max.x + pad, _box.max.z + pad);
  return obj;
}

/** True if a circle of radius r at (x,z) touches a solid box. */
export function blocked(x, z, r) { return !!hits(x, z, r); }

function hits(x, z, r) {
  for (const c of colliders) {
    if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return c;
  }
  return null;
}

/** Moves a circle of radius r from (x,z) by (dx,dz), sliding along boxes. */
export function moveWithCollisions(pos, dx, dz, r) {
  // Sub-step so fast movement can't tunnel through thin walls.
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (r * 0.5)));
  const sx = dx / steps, sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    if (sx) {
      const nx = pos.x + sx;
      const c = hits(nx, pos.z, r);
      if (!c) pos.x = nx;
      else pos.x = sx > 0 ? c.minX - r - 1e-4 : c.maxX + r + 1e-4;
    }
    if (sz) {
      const nz = pos.z + sz;
      const c = hits(pos.x, nz, r);
      if (!c) pos.z = nz;
      else pos.z = sz > 0 ? c.minZ - r - 1e-4 : c.maxZ + r + 1e-4;
    }
  }
}
