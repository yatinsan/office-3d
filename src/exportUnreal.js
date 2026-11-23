// Export the office for unreal/import_office.py (dev server only).
// In the browser console on the running dev server:  await (await import('/src/exportUnreal.js')).exportForUnreal()
//
// unreal/office.glb: every mesh baked into world space (node transform = identity), so in Unreal each
// imported static mesh is placed at the origin. Name prefixes tell the importer what to do:
//   static_*  building / furniture: gets walkable collision
//   dyn_*     things the web version moves (doors, pool balls, …): no collision, so doors don't block
//   SPAWN_A / SPAWN_B  player start and the point it looks at (removed after import)
// Objects with userData.unreal = '<asset>' (e.g. the desk chairs) are left out of office.glb: the model is
// written once to unreal/<asset>.glb and every placement goes to unreal/instances.json.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { SPAWN } from './world/index.js';
import { DESK_CHAIR_URL } from './props.js';
import { loadModelOnce } from './models.js';

const SKIP = /avatar|player|suggestion|marker|hint|label|ghost/i; // runtime overlays, not part of the building
const ASSETS = { office_chair_mg27: DESK_CHAIR_URL };

function bakeScene(scene, world) {
  scene.updateMatrixWorld(true);
  const out = new THREE.Scene();
  const matCache = new Map();
  const fixMat = (m) => {
    if (matCache.has(m)) return matCache.get(m);
    let r = m;
    if (!(m.isMeshStandardMaterial || m.isMeshBasicMaterial)) {
      r = new THREE.MeshStandardMaterial({
        color: m.color ?? m.uniforms?.color?.value ?? 0xcccccc, map: m.map ?? null, transparent: m.transparent,
        opacity: m.opacity ?? 1, side: m.side, emissive: m.emissive ?? 0x000000, roughness: 0.6,
      });
    }
    if (r.map?.isVideoTexture || r.emissiveMap?.isVideoTexture) { r = r.clone(); r.map = null; r.emissiveMap = null; }
    r.name = m.name || r.name || `mat_${matCache.size}`;
    matCache.set(m, r);
    return r;
  };
  const visible = (o) => { for (let p = o; p && !p.isScene; p = p.parent) if (!p.visible) return false; return true; };
  const inWorld = (o) => { for (let p = o; p; p = p.parent) if (p === world) return true; return false; };
  const add = (geo, mats, matrix, name) => {
    const g = geo.clone();
    g.applyMatrix4(matrix);
    const m = new THREE.Mesh(g, mats);
    m.name = name;
    out.add(m);
  };
  // shared-model placements: position in meters (three.js axes) + yaw in radians
  const instances = [];
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), eul = new THREE.Euler();
  scene.traverse((o) => {
    if (!o.userData.unreal || !visible(o)) return;
    o.matrixWorld.decompose(pos, quat, scl);
    eul.setFromQuaternion(quat, 'YXZ');
    instances.push({ asset: o.userData.unreal, x: pos.x, y: pos.y, z: pos.z, ry: eul.y, scale: scl.x });
  });
  let n = 0;
  scene.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || !visible(o)) return;
    for (let p = o; p && !p.isScene; p = p.parent) if (SKIP.test(p.name || '') || p.userData.unreal) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const sky = o.geometry.boundingSphere.radius > 300 && [o.material].flat().some((m) => m.side === THREE.BackSide);
    if (sky) return; // Unreal gets its own sky
    const mats = Array.isArray(o.material) ? o.material.map(fixMat) : fixMat(o.material);
    const prefix = inWorld(o) ? 'static' : 'dyn';
    if (o.isInstancedMesh) {
      const im = new THREE.Matrix4();
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, im); add(o.geometry, mats, new THREE.Matrix4().multiplyMatrices(o.matrixWorld, im), `${prefix}_${n++}`); }
    } else add(o.geometry, mats, o.matrixWorld, `${prefix}_${n++}`);
  });
  // spawn markers: tiny boxes at eye height and 1 m ahead along the start yaw
  const box = new THREE.BoxGeometry(0.05, 0.05, 0.05), red = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const ahead = { x: SPAWN.x - Math.sin(SPAWN.yaw), z: SPAWN.z - Math.cos(SPAWN.yaw) };
  add(box, red, new THREE.Matrix4().makeTranslation(SPAWN.x, 1, SPAWN.z), 'SPAWN_A');
  add(box, red, new THREE.Matrix4().makeTranslation(ahead.x, 1, ahead.z), 'SPAWN_B');
  return { out, n, instances };
}

const toGlb = (obj) => new GLTFExporter().parseAsync(obj, { binary: true, onlyVisible: true, maxTextureSize: 2048 });
const post = (file, body) => fetch(`/api/export-glb?file=${file}`, { method: 'POST', body }).then((r) => r.json());

export async function exportForUnreal() {
  const { scene, world } = window.__office;
  const { out, n, instances } = bakeScene(scene, world);
  const result = { meshes: n, instances: instances.length, office: await post('office.glb', await toGlb(out)) };
  for (const asset of new Set(instances.map((i) => i.asset))) {
    const model = (await loadModelOnce(ASSETS[asset])).clone();
    const solo = new THREE.Scene(); solo.add(model);
    result[asset] = await post(`${asset}.glb`, await toGlb(solo));
  }
  await post('instances.json', JSON.stringify(instances, null, 1));
  return result;
}
