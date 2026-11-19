import * as THREE from 'three';
import { M } from './materials.js';
import { box } from './props.js';
import { colliders } from './colliders.js';
import { doorLeaves, MEET_DOOR } from './world/helpers.js';

/**
 * Doors you can open: walk up and press F. Kept out of the static mesh merge so the leaves can move.
 * Lounge balcony door (suggestion 10, photo IMG_5653): frameless glass double door in the west window wall,
 * long chrome pull handles, both leaves swing inward.
 * Meeting room door: the same glass double door, from the terrace into the meeting room (suggestion 13).
 * Cabin glass doors (suggestion 12) come from glassWall() via doorLeaves; they start closed.
 */
const REACH = 1.8;     // how close you need to be to use a door (m)
const SPEED = 2.2;     // open/close speed (1 / s)

function glassLeaf(parent, len, dir, h = 2.4) {
  // leaf runs along local z from the hinge (0) to dir * len
  const leaf = new THREE.Group();
  parent.add(leaf);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(0.012, h - 0.04, len - 0.02), M.glass);
  pane.position.set(0, h / 2, dir * len / 2);
  pane.renderOrder = 2;
  leaf.add(pane);
  box(leaf, M.chrome, 0.02, 0.1, len - 0.04, 0, 0.05, dir * len / 2);            // bottom patch rail
  box(leaf, M.chrome, 0.02, 0.06, 0.12, 0, h - 0.06, dir * 0.08);                // top pivot patch
  box(leaf, M.chrome, 0.02, 0.06, 0.12, 0, 0.12, dir * 0.08);                    // bottom pivot patch
  const hz = dir * (len - 0.12);                                                 // pull handles near the meeting edge
  for (const s of [-1, 1]) {
    box(leaf, M.chrome, 0.028, 1.0, 0.028, s * 0.07, 1.05, hz);
    for (const y of [0.62, 1.48]) box(leaf, M.chrome, 0.12, 0.02, 0.02, s * 0.035, y, hz);
  }
  if (dir > 0) box(leaf, M.blackMatte, 0.03, 0.14, 0.2, 0, 1.05, dir * (len - 0.02)); // round lock in the middle
  return leaf;
}

export function initDoors({ scene, player }) {
  const doors = [];

  // ---- Frameless glass double doors in the west window wall (x = 0), both leaves swing inward ----
  const glassDoubleDoor = (z0, z1, name) => {
    const half = (z1 - z0) / 2;
    const g = new THREE.Group();
    scene.add(g);
    const left = new THREE.Group(); left.position.set(0, 0, z0); g.add(left);
    const right = new THREE.Group(); right.position.set(0, 0, z1); g.add(right);
    glassLeaf(left, half, 1);
    glassLeaf(right, half, -1);
    const block = { minX: -0.08, maxX: 0.08, minZ: z0, maxZ: z1 };
    colliders.push(block);
    doors.push({
      name, x: 0, z: (z0 + z1) / 2, t: 0, target: 0, block,
      apply(t) {
        const a = t * Math.PI / 2 * 0.95; // both leaves swing in toward +x
        left.rotation.y = a;
        right.rotation.y = -a;
      },
    });
  };
  glassDoubleDoor(4.9, 6.5, 'balcony door');                         // lounge (suggestion 10)
  glassDoubleDoor(MEET_DOOR[0], MEET_DOOR[1], 'meeting room door');  // meeting room ↔ terrace (same style)

  // ---- Cabin doors (built by glassWall) ----
  for (const d of doorLeaves) {
    scene.add(d.leaf);
    colliders.push(d.block);
    doors.push({ name: d.name, x: d.x, z: d.z, t: 0, target: 0, block: d.block, apply(t) { d.leaf.rotation.y = d.closed + (d.open - d.closed) * t; } });
  }

  const nearest = () => {
    let best = null, bestD = REACH;
    for (const d of doors) {
      const dist = Math.hypot(player.pos.x - d.x, player.pos.z - d.z);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    return best;
  };

  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyF' || player.state.paused || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const d = nearest();
    if (!d) return;
    d.target = d.target ? 0 : 1;
    if (d.target) { const i = colliders.indexOf(d.block); if (i >= 0) colliders.splice(i, 1); }
  });

  function update(dt) {
    for (const d of doors) {
      if (d.t === d.target) continue;
      d.t = d.target > d.t ? Math.min(1, d.t + dt * SPEED) : Math.max(0, d.t - dt * SPEED);
      d.apply(d.t * d.t * (3 - 2 * d.t));
      if (d.t === 0 && !colliders.includes(d.block)) colliders.push(d.block); // closed again → solid
    }
  }

  /** HUD hint when standing next to a door. */
  function prompt() {
    const d = nearest();
    return d ? `F ${d.target ? 'close' : 'open'} ${d.name.toLowerCase()}` : '';
  }

  return { update, prompt };
}
