import * as THREE from 'three';
import { zoneAt } from './world/index.js';
import { lockerDoors } from './world/helpers.js';

/**
 * Scavenger Hunt game mode: 8 small gold items are hidden around the office. Look at one (within ~2.5 m) and press F
 * to collect it. One is inside a locker - open the door first. Timer + best time are kept; H shows a hint.
 */
const BEST_KEY = 'pixbit-hunt-best';
const REACH = 2.5;

// name, kind, candidate spots [x, y, z] (a new one is picked at random on every round)
const ITEMS = [
  { name: 'Keycard', kind: 'card', locker: true },
  { name: 'Golden mug', kind: 'mug', spots: [[-1.6, 1.15, 12.5], [-1.2, 1.15, 17.0]] },
  { name: 'Stapler', kind: 'stapler', spots: [[7.5, 1.1, 4.4], [8.3, 1.1, 3.6]] },
  { name: 'Game controller', kind: 'pad', spots: [[4.6, 0.9, 24.3], [5.4, 1.1, 26.4]] },
  { name: 'Sticky note', kind: 'note', spots: [[4.5, 1.25, 12.0], [2.2, 1.25, 13.6]] },
  { name: 'Trophy star', kind: 'star', spots: [[9.85, 1.5, 6.1], [9.4, 1.3, 7.2]] },
  { name: 'Marker pen', kind: 'pen', spots: [[2.0, 1.1, 20.4], [1.4, 1.1, 21.6]] },
  { name: 'Plant badge', kind: 'badge', spots: [[1.2, 1.2, 7.0], [2.4, 1.2, 4.2]] },
];

const GOLD = new THREE.MeshStandardMaterial({ color: '#ffcf3a', emissive: '#c88a00', emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.6 });
const HALO = new THREE.SpriteMaterial({ map: null, color: '#ffe27a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function shape(kind) {
  const g = new THREE.Group();
  const add = (geo, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, GOLD); m.position.set(x, y, z); g.add(m); return m; };
  switch (kind) {
    case 'card': add(new THREE.BoxGeometry(0.085, 0.054, 0.004)); break;
    case 'mug': add(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 16)); add(new THREE.TorusGeometry(0.028, 0.008, 8, 14), 0.05, 0, 0); break;
    case 'stapler': add(new THREE.BoxGeometry(0.15, 0.03, 0.04)); add(new THREE.BoxGeometry(0.12, 0.02, 0.035), -0.01, 0.02, 0); break;
    case 'pad': add(new THREE.BoxGeometry(0.13, 0.035, 0.07)); add(new THREE.SphereGeometry(0.03, 10, 8), -0.05, -0.01, 0.04); add(new THREE.SphereGeometry(0.03, 10, 8), 0.05, -0.01, 0.04); break;
    case 'note': add(new THREE.BoxGeometry(0.1, 0.1, 0.004)); break;
    case 'star': { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.025 : 0.06, a = Math.PI / 5 * i + Math.PI / 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); add(new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: false })); break; }
    case 'pen': { const m = add(new THREE.CylinderGeometry(0.01, 0.01, 0.14, 10)); m.rotation.z = Math.PI / 2; break; }
    default: add(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 20)).rotation.x = Math.PI / 2; // badge
  }
  return g;
}

export function initHunt({ scene, camera, player }) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  HALO.map = haloTexture();

  // Pick the first locker door at mid height: the keycard lives inside it.
  const lk = lockerDoors.find((d) => d.center.y > 0.9 && d.center.y < 1.4) || lockerDoors[0];

  let items = [];
  let on = false, found = 0, time = 0, running = false, finished = false;
  let best = null;
  try { best = parseFloat(localStorage.getItem(BEST_KEY)) || null; } catch {}

  // ---- HUD + win card ----
  const hud = document.createElement('div');
  Object.assign(hud.style, { position: 'fixed', top: '14px', right: '14px', zIndex: '5', color: '#fff', font: '600 14px system-ui, sans-serif',
    background: 'rgba(0,0,0,.5)', borderLeft: '4px solid #ecc828', borderRadius: '6px', padding: '8px 12px', display: 'none', pointerEvents: 'none', minWidth: '170px' });
  document.body.appendChild(hud);
  const win = document.createElement('div');
  Object.assign(win.style, { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: '8', color: '#fff', textAlign: 'center',
    font: '600 15px system-ui, sans-serif', background: 'rgba(20,20,20,.92)', border: '1px solid #ecc828', borderRadius: '14px', padding: '24px 32px', display: 'none' });
  document.body.appendChild(win);
  let hint = '', hintT = 0;
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  function drawHud() {
    const left = items.filter((i) => !i.got);
    hud.innerHTML = `<div style="color:#ecc828;letter-spacing:.5px">SCAVENGER HUNT</div>
      <div>Found ${found} / ${items.length} &nbsp;·&nbsp; ${fmt(time)}</div>
      ${best ? `<div style="font-weight:400;color:#bbb">Best ${fmt(best)}</div>` : ''}
      <div style="font-weight:400;color:#ddd;margin-top:4px">${hint || (left.length ? 'H = hint' : '')}</div>`;
  }

  function spotOf(it) {
    if (it.locker) {
      const ry = lk.closed;
      return new THREE.Vector3(lk.center.x - 0.12 * Math.cos(ry), lk.center.y - 0.04, lk.center.z + 0.12 * Math.sin(ry));
    }
    const s = it.spots[Math.floor(Math.random() * it.spots.length)];
    return new THREE.Vector3(s[0], s[1], s[2]);
  }

  function build() {
    root.clear();
    items = ITEMS.map((def) => {
      const mesh = shape(def.kind);
      const pos = spotOf(def);
      mesh.position.copy(pos);
      if (def.locker) mesh.scale.setScalar(0.9); else {
        const h = new THREE.Sprite(HALO); h.scale.setScalar(0.5); mesh.add(h);
      }
      root.add(mesh);
      return { ...def, mesh, base: pos, got: false, zone: zoneAt(pos.x, pos.z) };
    });
    found = 0; time = 0; finished = false; running = true; hint = '';
    win.style.display = 'none';
    drawHud();
  }

  const _v = new THREE.Vector3(), _d = new THREE.Vector3();
  function aimed() {
    camera.getWorldDirection(_d);
    let best2 = null, bd = 0.93;
    for (const it of items) {
      if (it.got) continue;
      if (it.locker && Math.abs(lk.leaf.rotation.y - lk.closed) < 0.5) continue; // locker door still shut
      _v.copy(it.mesh.position).sub(camera.position);
      const dist = _v.length();
      if (dist > REACH) continue;
      const dot = _v.normalize().dot(_d);
      if (dot > bd) { bd = dot; best2 = it; }
    }
    return best2;
  }

  function collect(it) {
    it.got = true; found++;
    root.remove(it.mesh);
    hint = `Got the ${it.name.toLowerCase()}!`; hintT = 2.5;
    if (found === items.length) finish(); else drawHud();
  }
  function finish() {
    running = false; finished = true;
    const isBest = !best || time < best;
    if (isBest) { best = time; try { localStorage.setItem(BEST_KEY, String(time)); } catch {} }
    drawHud();
    win.innerHTML = `<div style="font-size:24px;color:#ecc828;margin-bottom:6px">All 8 found!</div>
      <div>Time ${fmt(time)}${isBest ? ' &nbsp;🏆 new best' : ` &nbsp;·&nbsp; best ${fmt(best)}`}</div>
      <div style="font-weight:400;color:#bbb;margin-top:10px">Press Enter to play again, or Esc to change the game mode</div>`;
    win.style.display = 'block';
  }

  addEventListener('keydown', (e) => {
    if (!on || player.state.paused || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.code === 'KeyF') { const it = aimed(); if (it) collect(it); }
    else if (e.code === 'KeyH' && running) {
      const next = items.find((i) => !i.got);
      if (next) { hint = `Hint: ${next.name} – ${next.locker ? 'inside a locker in the ' : 'in the '}${next.zone}`; hintT = 6; drawHud(); }
    } else if (e.code === 'Enter' && finished) build();
  });

  return {
    id: 'hunt', name: 'Scavenger Hunt',
    desc: 'Find 8 hidden gold items. F to collect, H for a hint. One is in a locker.',
    start() { on = true; root.visible = true; hud.style.display = 'block'; build(); },
    stop() { on = false; running = false; root.visible = false; hud.style.display = 'none'; win.style.display = 'none'; },
    update(dt, active) {
      if (!on) return;
      const t = performance.now() / 1000;
      for (const it of items) {
        if (it.got || it.locker) continue;
        it.mesh.rotation.y = t * 1.6;
        it.mesh.position.y = it.base.y + Math.sin(t * 2 + it.base.x) * 0.03;
      }
      if (running && active) { time += dt; if (hintT > 0 && (hintT -= dt) <= 0) hint = ''; drawHud(); }
    },
    prompt() {
      if (!on || !running) return '';
      const it = aimed();
      return it ? `F collect ${it.name.toLowerCase()}` : '';
    },
  };
}
