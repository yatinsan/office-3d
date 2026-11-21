import { LIFTS, GROUND_LIFTS, GROUND_LIGHTS, CABINS, GROUND_Y, LIFT_DEPTH as DEPTH, setLiftDisplay } from './world/hall.js';
import { colliders, lvl } from './colliders.js';
import { thud, join, whoosh } from './sfx.js';

/**
 * Working lifts (suggestion 54).
 *   F in front of a lift (or inside it)  → the doors slide open / shut
 *   walk in, press E                     → doors close, the cabin shakes a little, then the doors open on the other floor
 * The ground floor is built right under the 4th floor (same x/z, GROUND_Y lower). Each lift is ONE cabin (a loose group) that really
 * slides down / up the shaft; anyone inside is carried with it (player.state.baseY).
 */
const OW = 1.16;               // door opening
const DOOR_SPEED = 1.1;        // 1 / s
const FRONT = [0.1, 2.4];      // "in front of the doors" reach (m)
const TRAVEL_TIME = 8;         // seconds the cabin takes from 4th to G (it passes 3, 2, 1 on the way: 2 s a floor)
const FLOORS = ['4', '3', '2', '1', 'G'];

export function initLifts({ scene, camera, player }) {
  const all = [...LIFTS, ...GROUND_LIFTS];
  for (const l of GROUND_LIGHTS) scene.add(l);
  const cabins = {};
  for (const c of CABINS) { cabins[c.n] = c.g; scene.add(c.g); }
  for (const L of all) {
    L.t = 0; L.target = 0;
    L.leaves.forEach((g) => { g.position.y = L.ground ? GROUND_Y : 0; scene.add(g); });
    L.back = L.x - L.out * 0.1;                      // back face of the wall the door sits in
    L.block = { minX: Math.min(L.x, L.back), maxX: Math.max(L.x, L.back), minZ: L.z - OW / 2, maxZ: L.z + OW / 2, lv: L.ground ? 1 : 0 };
    colliders.push(L.block);                         // shut doors are solid
  }

  const onGround = () => lvl.cur === 1;
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

  // ---- one shared cabin per lift number: it is on ONE floor at a time and really travels between them ----
  // S[n] = { at: 0 upper | 1 ground, phase: idle | closing | moving | arrive | opening, to, t, carried }
  const S = {};
  for (const L of all) S[L.n] = S[L.n] || { n: L.n, at: 0, phase: 'idle', to: 0, t: 0, carried: false };
  const floorOf = (L) => (L.ground ? 1 : 0);
  const cabinAt = (n, f) => all.find((o) => o.n === n && floorOf(o) === f);
  const listeners = [];
  const emit = (m) => listeners.forEach((f) => f(m));

  /** send the cabin to floor `to` (called by F from another floor, or E from inside). Only changes are broadcast. */
  function go(n, to, remote) {
    const s = S[n];
    if (!s || s.phase !== 'idle' || s.at === to) return false;
    s.to = to; s.phase = 'closing'; s.t = 0; s.carried = false;
    setOpen(cabinAt(n, s.at), false);
    if (!remote) emit({ t: 'lift', op: 'go', n, to });
    return true;
  }

  const free = () => !player.state.paused && document.getElementById('overlay')?.classList.contains('hidden');
  addEventListener('keydown', (e) => {
    if (e.repeat || !free() || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const L = current();
    if (!L) return;
    const s = S[L.n];
    if (e.code === 'KeyF') {
      e.stopImmediatePropagation();
      if (s.phase !== 'idle') return;
      if (s.at !== floorOf(L)) { go(L.n, floorOf(L)); return; }            // the cabin is elsewhere: call it
      if (L.target) { if (inDoorway(L)) return; setOpen(L, false); } else setOpen(L, true);
      emit({ t: 'lift', op: 'door', n: L.n, floor: floorOf(L), open: L.target });
    } else if (e.code === 'KeyE' && inCabin(L) && s.at === floorOf(L) && s.phase === 'idle' && L.target === 1 && L.t === 1) {
      go(L.n, 1 - s.at);
    }
  });

  let shakeT = 0;
  function step(s, dt) {
    const from = cabinAt(s.n, s.at);
    s.t += dt;
    if (s.phase === 'closing') {
      if (from.t === 0) {
        s.phase = 'moving'; s.t = 0; thud();
        if (cabins[s.n]) cabins[s.n].userData.shut.visible = true;          // solid front while it travels
        s.carried = onGround() === !!s.at && inCabin(from);               // I am inside: I travel with it
        if (s.carried) player.state.paused = true;
      }
    } else if (s.phase === 'moving') {
      const u = Math.min(1, s.t / TRAVEL_TIME), e = u * u * (3 - 2 * u);   // eased: slow start, slow stop
      const p = s.to ? e : 1 - e;                                          // 0 = 4th floor … 1 = ground
      const y = GROUND_Y * p;
      setLiftDisplay(s.n, s.to ? '▼' : '▲', FLOORS[Math.round(p * 4)]);
      if (cabins[s.n]) cabins[s.n].position.y = y;                         // the cabin really slides down / up the shaft
      if (s.carried) {
        camera.position.y += y - player.state.baseY;                       // and so do you (camera moves the same frame as the cabin: no jitter)
        player.state.baseY = y;
        shakeT += dt;
        const k = Math.min(1, s.t / 0.25) * Math.min(1, (TRAVEL_TIME - s.t) / 0.3);
        const a = 0.006 * Math.max(0, k);
        camera.position.x += Math.sin(shakeT * 61) * a;
        camera.position.y += Math.sin(shakeT * 47 + 1) * a * 1.4;
        camera.position.z += Math.sin(shakeT * 53 + 2) * a;
      }
      if (s.t >= TRAVEL_TIME) {
        if (s.carried) { const y2 = s.to ? GROUND_Y : 0; camera.position.y += y2 - player.state.baseY; player.state.baseY = y2; lvl.cur = s.to; }
        if (cabins[s.n]) cabins[s.n].position.y = s.to ? GROUND_Y : 0;
        if (cabins[s.n]) cabins[s.n].userData.shut.visible = false;
        s.at = s.to; s.phase = 'arrive'; s.t = 0; setLiftDisplay(s.n, '', FLOORS[s.at ? 4 : 0]);
        if (s.carried || onGround() === !!s.at) join();                   // ding for anyone on that floor
      }
    } else if (s.phase === 'arrive') {
      if (s.t > 0.5) { setOpen(cabinAt(s.n, s.at), true); s.phase = 'opening'; s.t = 0; if (onGround() === !!s.at) whoosh(0.4); }
    } else if (s.phase === 'opening') {
      if (cabinAt(s.n, s.at).t === 1) { s.phase = 'idle'; if (s.carried) { player.state.paused = false; s.carried = false; } }
    }
  }

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
    for (const n in S) if (S[n].phase !== 'idle') step(S[n], dt);
  }

  return {
    update,
    onChange: (f) => listeners.push(f),
    /** true while I am being carried (doors shut, cabin travelling) */
    riding: () => Object.values(S).some((s) => s.carried && s.phase !== 'idle'),
    /** a message from another player (only sent when something changes) */
    apply(m) {
      if (m.op === 'go') go(m.n, m.to, true);
      else if (m.op === 'door') { const s = S[m.n], L = s && cabinAt(m.n, m.floor); if (L && s.phase === 'idle' && s.at === m.floor) setOpen(L, !!m.open); }
      else if (m.op === 'snap' && Array.isArray(m.s)) {
        for (const n of m.s) { const s = S[n]; if (s && s.phase === 'idle' && s.at === 0) { s.at = 1; setLiftDisplay(n, '', 'G'); if (cabins[n]) cabins[n].position.y = GROUND_Y; setOpen(cabinAt(n, 0), false); setOpen(cabinAt(n, 1), true); } }
      }
    },
    /** lifts parked on the ground floor, for someone who just joined */
    snapshot: () => Object.values(S).filter((s) => s.at === 1 && s.phase === 'idle').map((s) => s.n),
    prompt() {
      const L = current();
      if (!L) return '';
      const s = S[L.n];
      if (s.carried) return '';
      if (s.phase !== 'idle') return `Lift ${L.n} is on its way`;
      if (s.at !== floorOf(L)) return `F call lift ${L.n}`;
      if (inCabin(L) && L.target && L.t === 1) return `E ${onGround() ? 'go up' : 'go to the ground floor'}`;
      if (L.target) return inDoorway(L) ? '' : `F close lift ${L.n}`;
      return `F open lift ${L.n}`;
    },
  };
}
