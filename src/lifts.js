import { LIFTS, GROUND_LIFTS, GROUND_LIGHTS, GROUND_DX, LIFT_DEPTH as DEPTH } from './world/hall.js';
import { colliders } from './colliders.js';
import { thud, join, whoosh } from './sfx.js';

/**
 * Working lifts (suggestion 54).
 *   F in front of a lift (or inside it)  → the doors slide open / shut
 *   walk in, press E                     → doors close, the cabin shakes a little, then the doors open on the other floor
 * The ground floor is the hall's twin built GROUND_DX metres east (buildGroundFloor), with the same lifts in the same places.
 */
const OW = 1.16;               // door opening
const DOOR_SPEED = 1.1;        // 1 / s
const FRONT = [0.1, 2.4];      // "in front of the doors" reach (m)
const SHAKE_TIME = 1.7;        // seconds of rumble with the doors shut

export function initLifts({ scene, camera, player }) {
  const all = [...LIFTS, ...GROUND_LIFTS];
  for (const l of GROUND_LIGHTS) scene.add(l);
  for (const L of all) {
    L.t = 0; L.target = 0;
    L.leaves.forEach((g) => scene.add(g));
    L.back = L.x - L.out * 0.1;                      // back face of the wall the door sits in
    L.block = { minX: Math.min(L.x, L.back), maxX: Math.max(L.x, L.back), minZ: L.z - OW / 2, maxZ: L.z + OW / 2 };
    colliders.push(L.block);                         // shut doors are solid
  }

  const onGround = () => player.pos.x > GROUND_DX - 50;
  const mine = () => all.filter((L) => !!L.ground === onGround());
  const inCabin = (L) => { const d = (player.pos.x - L.back) * -L.out; return d > 0 && d < DEPTH && Math.abs(player.pos.z - L.z) < L.cw / 2; };
  const inDoorway = (L) => Math.abs(player.pos.x - L.x) < 0.5 && Math.abs(player.pos.z - L.z) < OW / 2 + 0.2;
  const inFront = (L) => { const d = (player.pos.x - L.x) * L.out; return d > FRONT[0] && d < FRONT[1] && Math.abs(player.pos.z - L.z) < 1.2; };
  /** the lift you are in, else the one you stand in front of */
  const current = () => {
    const l = mine();
    return l.find(inCabin) || l.find(inFront) || null;
  };

  function setOpen(L, open) {
    L.target = open ? 1 : 0;
    if (open) { const i = colliders.indexOf(L.block); if (i >= 0) colliders.splice(i, 1); }
  }

  // ---- the ride ----
  let ride = null; // { L, dest, phase, t, nextShake }
  const twin = (L) => all.find((o) => o.n === L.n && o.ground !== L.ground);
  function startRide(L) {
    ride = { L, dest: twin(L), phase: 'closing', t: 0 };
    player.state.paused = true;
    setOpen(L, false);
  }

  const free = () => !ride && !player.state.paused && document.getElementById('overlay')?.classList.contains('hidden');
  addEventListener('keydown', (e) => {
    if (e.repeat || !free() || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const L = current();
    if (!L) return;
    if (e.code === 'KeyF') {
      if (L.target) { if (!inDoorway(L)) setOpen(L, false); } else setOpen(L, true);
      e.stopImmediatePropagation();
    } else if (e.code === 'KeyE' && inCabin(L) && L.target === 1 && L.t === 1) { startRide(L); }
  });

  let shakeT = 0;
  function update(dt) {
    for (const L of all) {
      if (L.t !== L.target) {
        L.t = L.target > L.t ? Math.min(1, L.t + dt * DOOR_SPEED) : Math.max(0, L.t - dt * DOOR_SPEED);
        const e = L.t * L.t * (3 - 2 * L.t);
        // each leaf folds away into its own jamb: it narrows toward the outer edge instead of sliding over the wall
        const sc = Math.max(0.001, 1 - e * 0.97);
        L.leaves.forEach((g, i) => { const pivot = L.z + (i ? 1 : -1) * 0.55; g.scale.z = sc; g.position.z = pivot * (1 - sc); g.visible = sc > 0.02; });
        if (L.t === 0 && !colliders.includes(L.block)) colliders.push(L.block);
      }
    }
    if (!ride) return;
    const { L, dest } = ride;
    ride.t += dt;
    if (ride.phase === 'closing') {               // doors slide shut
      if (L.t === 0) { ride = { ...ride, phase: 'moving', t: 0 }; thud(); }
    } else if (ride.phase === 'moving') {         // the cabin shakes a little, then "arrives"
      shakeT += dt;
      const k = Math.min(1, ride.t / 0.25) * Math.min(1, (SHAKE_TIME - ride.t) / 0.3);
      const a = 0.012 * Math.max(0, k);
      camera.position.x += Math.sin(shakeT * 61) * a;
      camera.position.y += Math.sin(shakeT * 47 + 1) * a * 1.4;
      camera.position.z += Math.sin(shakeT * 53 + 2) * a;
      if (ride.t >= SHAKE_TIME) {
        // step through to the other floor while the doors are shut: same spot inside the same-numbered lift
        const off = dest.ground ? GROUND_DX : -GROUND_DX;
        player.pos.x += off;
        camera.rotation.set(0, L.out > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 'YXZ'); // turn to face the doors
        ride = { ...ride, L: dest, phase: 'arrive', t: 0 };
        join();                                    // ding
      }
    } else if (ride.phase === 'arrive') {          // a beat, then the doors open on the other floor
      if (ride.t > 0.5) { whoosh(0.4); setOpen(dest, true); ride = { ...ride, phase: 'opening', t: 0 }; }
    } else if (ride.phase === 'opening') {
      if (dest.t === 1) { player.state.paused = false; ride = null; }
    }
  }

  return {
    update,
    prompt() {
      if (ride) return '';
      const L = current();
      if (!L) return '';
      if (inCabin(L) && L.target && L.t === 1) return `E ${onGround() ? 'go up' : 'go to the ground floor'}`;
      if (L.target) return inDoorway(L) ? '' : `F close lift ${L.n}`;
      return `F open lift ${L.n}`;
    },
  };
}
