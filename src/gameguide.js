import * as THREE from 'three';
import { GAME_DOOR, MEET_Z1 } from './world/helpers.js';

const KEY = 'pixbit-guide-done', OLD_KEY = 'pixbit-gamezone-guide'; // KEY: json list of finished tasks
// first-visit tasks, all shown at once: each is a glowing marker in the world that goes away when you get there
const STOPS = [
  { label: 'GAME ROOM', x: (GAME_DOOR[0] + GAME_DOOR[1]) / 2, z: MEET_Z1 - 0.45, reached: (p, ctx) => ctx.inGameRoom() },      // the white door at the back of the meeting room
  { label: 'BALCONY', x: -2.8, z: 5.7, reached: (p) => Math.hypot(p.x + 2.8, p.z - 5.7) < 1.1 },                              // straight out from the first balcony door (the lounge one), by the rail
];

/**
 * First visit only: glowing markers in the world (a light beam, a pulsing floor ring, a bobbing arrow and a sign): the Game
 * Room door and the first balcony door. Each goes away once you get there, and never comes back.
 */
export function initGameGuide({ scene, player, inGameRoom }) {
  let finished = [];
  try {
    finished = JSON.parse(localStorage.getItem(KEY) || 'null') || (localStorage.getItem(OLD_KEY) === '1' ? ['GAME ROOM'] : []);
  } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(finished)); } catch {} };
  const glow = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

  function marker(st) {
    const root = new THREE.Group(); root.position.set(st.x, 0, st.z); scene.add(root);
    const beamMat = glow('#ffd34a', 0.22), ringMat = glow('#ffd34a', 0.5), arrowMat = glow('#ffe58a', 0.95);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.2, 28, 1, true), beamMat); beam.position.y = 1.6; root.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.5, 40), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; root.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 40), glow('#ffffff', 0.35)); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.032; root.add(ring2);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), arrowMat); arrow.rotation.x = Math.PI; root.add(arrow); // points down
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const g = cv.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 64px system-ui, sans-serif'; g.shadowColor = '#ffb400'; g.shadowBlur = 24; g.fillStyle = '#fff6cf';
    g.fillText(st.label, 256, 64);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sign.scale.set(1.5, 0.375, 1); sign.position.y = 2.55; sign.renderOrder = 10; root.add(sign);
    let t = Math.random() * 6;
    return (dt) => {
      if (st.reached(player.pos, { inGameRoom })) { finished.push(st.label); save(); scene.remove(root); return true; }
      t += dt;
      const near = Math.hypot(player.pos.x - st.x, player.pos.z - st.z);
      const fade = Math.min(1, Math.max(0.35, (near - 0.6) / 1.5)); // softer once you are standing at it
      beamMat.opacity = (0.16 + 0.08 * Math.sin(t * 2.2)) * fade;
      ringMat.opacity = (0.4 + 0.25 * Math.sin(t * 3)) * fade;
      const k = 1 + 0.12 * Math.sin(t * 3); ring.scale.set(k, k, 1);
      arrow.position.y = 2.1 + 0.12 * Math.sin(t * 3.4); arrow.rotation.y = t * 1.5;
      sign.material.opacity = fade;
      return false;
    };
  }
  let active = STOPS.filter((st) => !finished.includes(st.label)).map(marker);
  return { update(dt) { if (active.length) active = active.filter((u) => !u(dt)); } };
}
