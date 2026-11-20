import * as THREE from 'three';
import { M } from './materials.js';
import { box } from './props.js';
import { colliders } from './colliders.js';
import { doorLeaves, lockerDoors, MEET_DOOR } from './world/helpers.js';

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

/** Floating "F" key marker that sits on a door handle and rides with the leaf. */
let keyTex = null;
function keyTexture() {
  if (keyTex) return keyTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(15,18,24,.8)';
  g.strokeStyle = '#fff'; g.lineWidth = 8;
  g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 72px system-ui, sans-serif';
  g.fillText('F', 64, 68);
  return (keyTex = new THREE.CanvasTexture(c));
}
function handleMarker(parent, x, y, z) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: keyTexture(), depthTest: false, transparent: true }));
  m.scale.set(0.11, 0.11, 1);
  m.position.set(x, y, z);
  m.renderOrder = 20;
  m.visible = false;
  parent.add(m);
  return m;
}

export function initDoors({ scene, player, camera }) {
  const doors = [];

  // ---- Frameless glass double doors in the west window wall (x = 0), both leaves swing inward ----
  const glassDoubleDoor = (z0, z1, name) => {
    const half = (z1 - z0) / 2;
    const g = new THREE.Group();
    scene.add(g);
    const left = new THREE.Group(); left.position.set(0, 0, z0); g.add(left);
    const right = new THREE.Group(); right.position.set(0, 0, z1); g.add(right);
    const marker = handleMarker(left, 0.1, 1.25, half - 0.12);
    glassLeaf(left, half, 1);
    glassLeaf(right, half, -1);
    const block = { minX: -0.08, maxX: 0.08, minZ: z0, maxZ: z1 };
    colliders.push(block);
    doors.push({
      name, x: 0, z: (z0 + z1) / 2, t: 0, target: 0, block, marker,
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
    const marker = handleMarker(d.leaf, d.handle[0], d.handle[1], d.handle[2]);
    doors.push({ name: d.name, x: d.x, z: d.z, t: 0, target: 0, block: d.block, marker, apply(t) { d.leaf.rotation.y = d.closed + (d.open - d.closed) * t; } });
  }

  // ---- Locker doors: each one opens separately; F works on the one you are looking at ----
  const noMarker = { visible: false, material: { opacity: 1 } };
  const lockers = lockerDoors.map((d) => {
    scene.add(d.leaf);
    return { name: 'locker door', x: d.center.x, z: d.center.z, center: d.center, t: 0, target: 0, block: null, marker: noMarker,
      apply(t) { d.leaf.rotation.y = d.closed + (d.open - d.closed) * t; } };
  });
  doors.push(...lockers);
  const _v = new THREE.Vector3(), _dir = new THREE.Vector3();
  const aimedLocker = () => {
    camera.getWorldDirection(_dir);
    let best = null, bestDot = 0.96;
    for (const d of lockers) {
      _v.copy(d.center).sub(camera.position);
      const dist = _v.length();
      if (dist > 1.8) continue;
      const dot = _v.normalize().dot(_dir);
      if (dot > bestDot) { bestDot = dot; best = d; }
    }
    return best;
  };

  const nearest = () => {
    const lk = aimedLocker();
    if (lk) return lk;
    let best = null, bestD = REACH;
    for (const d of doors) {
      if (d.center || d.locked?.()) continue; // locked from this side (entrance door, src/unlock.js)
      const dist = Math.hypot(player.pos.x - d.x, player.pos.z - d.z);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    return best;
  };

  const toggle = (d) => {
    d.target = d.target ? 0 : 1;
    if (d.target && d.block) { const i = colliders.indexOf(d.block); if (i >= 0) colliders.splice(i, 1); }
  };
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyF' || player.state.paused || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const d = nearest();
    if (d) toggle(d);
  });
  // Mouse click opens/closes the locker door you are looking at (ignore drags used for looking around)
  let downX = 0, downY = 0;
  addEventListener('mousedown', (e) => { downX = e.clientX; downY = e.clientY; });
  addEventListener('click', (e) => {
    if (e.button !== 0 || player.state.paused) return;
    if (!player.controls.isLocked && !player.state.dragMode) return;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5 && !player.controls.isLocked) return;
    const d = aimedLocker();
    if (d) toggle(d);
  });

  function update(dt) {
    const near = nearest();
    for (const d of doors) {
      const dist = Math.hypot(player.pos.x - d.x, player.pos.z - d.z);
      d.marker.visible = dist < 4.5 && (!d.locked?.() || d.askToOpen); // askToOpen: locked, but F still asks (ladies toilet)
      d.marker.material.opacity = d === near || (d.askToOpen && d.locked?.() && dist < REACH) ? 1 : 0.55;
    }
    for (const d of doors) {
      if (d.t === d.target) continue;
      d.t = d.target > d.t ? Math.min(1, d.t + dt * SPEED) : Math.max(0, d.t - dt * SPEED);
      d.apply(d.t * d.t * (3 - 2 * d.t));
      if (d.block && d.t === 0 && !colliders.includes(d.block)) colliders.push(d.block); // closed again → solid
    }
  }

  /** HUD hint when standing next to a door. */
  function prompt() {
    const d = nearest();
    return d ? `${d.center ? 'F / click' : 'F'} ${d.target ? 'close' : 'open'} ${d.name.toLowerCase()}` : '';
  }

  /** Door by its name (e.g. 'entrance door'), so other modules can open, close or lock it. */
  const byName = (name) => doors.find((d) => d.name === name);
  return { update, prompt, byName, toggle };
}
