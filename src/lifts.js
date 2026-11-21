import { LIFTS, GROUND_LIFTS, GROUND_LIGHTS, CABINS, GROUND_Y, LIFT_DEPTH as DEPTH, setLiftDisplay } from './world/hall.js';
import { colliders, lvl } from './colliders.js';
import { thud, join, liftOpen, liftClose } from './sfx.js';

/**
 * Working lifts (suggestion 54).
 *   F in front of a lift (or inside it)  → the doors slide open / shut
 *   walk in, press E                     → doors close, the cabin shakes a little, then the doors open on the other floor
 * The ground floor is built right under the 4th floor (same x/z, GROUND_Y lower). Each lift is ONE cabin (a loose group) that really
 * slides down / up the shaft; anyone inside is carried with it (player.state.baseY).
 */
const OW = 1.16;               // door opening
const OPEN_TIME = 3.5;         // s: matches the recorded door-open sound (slide, then the thunk at the end)
const CLOSE_TIME = 2.6;        // s: matches the recorded door-close sound (slide, then the slam)
const AUTO_CLOSE = 8;          // s an open door waits before closing by itself
const FRONT =[0.1, 2.4];      // "in front of the doors" reach (m)
const TRAVEL_TIME = 8;         // seconds the cabin takes from 4th to G (it passes 3, 2, 1 on the way: 2 s a floor)
const FLOORS = ['4', '3', '2', '1', 'G'];

export function initLifts({ scene, camera, player, navigate }) {
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
    if (!!L.ground === onGround() && !!open !== !!L.target) (open ? liftOpen : liftClose)();
    L.target = open ? 1 : 0;
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

  // ---- lifts stay locked for a new player until they have found the Game Room ----
  const LOCK_KEY = 'pixbit-lifts-unlocked';
  let unlocked = false;
  try { unlocked = localStorage.getItem(LOCK_KEY) === '1'; } catch {}
  const card = document.createElement('div');
  card.style.cssText = 'position:fixed;z-index:20;left:50%;top:16%;transform:translate(-50%,-10px);max-width:min(92vw,380px);padding:14px 20px;border-radius:14px;'
    + 'background:rgba(18,22,34,.92);color:#fff;font:14px/1.45 system-ui,sans-serif;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.45);'
    + 'border:1px solid rgba(255,255,255,.18);opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;';
  document.body.appendChild(card);
  let cardT = 0;
  let asking = false;   // the locked card is waiting for Y / N
  function showCard(icon, title, text, color, ms, extra = '') {
    asking = !!extra;
    card.innerHTML = `<div style="font-size:26px">${icon}</div><div style="font-weight:700;font-size:16px;color:${color};margin:2px 0 4px">${title}</div><div style="opacity:.9">${text}</div>${extra}`;
    card.style.opacity = '1'; card.style.transform = 'translate(-50%,0)';
    clearTimeout(cardT); cardT = setTimeout(() => { asking = false; card.style.opacity = '0'; card.style.transform = 'translate(-50%,-10px)'; }, ms);
  }

  // ---- achievement popup ----
  // full-screen "mission passed" style popup: dark vignette, big gold title zooming in, fades out after a few seconds
  const ach = document.createElement('div');
  ach.style.cssText = 'position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;'
    + 'background:radial-gradient(ellipse at center,rgba(0,0,0,.55) 0%,rgba(0,0,0,.85) 100%);color:#fff;font-family:system-ui,sans-serif;'
    + 'opacity:0;pointer-events:none;transition:opacity .6s;';
  document.body.appendChild(ach);
  let achT = 0;
  function achievement(icon, head, title, text) {
    ach.innerHTML = `<div id="ach-i" style="font-size:min(18vw,110px);filter:drop-shadow(0 0 24px #ffd34a);transition:transform .9s cubic-bezier(.2,1.4,.4,1);transform:scale(.2) rotate(-25deg)">${icon}</div>`
      + `<div style="margin-top:10px;font-size:min(3.4vw,15px);letter-spacing:.5em;text-transform:uppercase;color:#ffd34a;opacity:.9">${head}</div>`
      + `<div id="ach-t" style="margin:6px 0 10px;font-weight:900;font-size:min(11vw,84px);letter-spacing:.06em;text-transform:uppercase;color:#ffd34a;text-shadow:0 0 30px rgba(255,211,74,.6),0 4px 0 #8a6a00;transition:transform 1.2s cubic-bezier(.1,.9,.2,1),letter-spacing 1.2s;transform:scale(1.6)">${title}</div>`
      + `<div style="max-width:min(90vw,520px);font-size:min(4vw,18px);opacity:.85;line-height:1.5">${text}</div>`;
    ach.style.opacity = '1';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const i = ach.querySelector('#ach-i'), t = ach.querySelector('#ach-t');
      if (i) i.style.transform = 'scale(1) rotate(0)'; if (t) t.style.transform = 'scale(1)';
    }));
    clearTimeout(achT); achT = setTimeout(() => { ach.style.opacity = '0'; }, 5000);
    try {   // little rising chime
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [660, 880, 1320].forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.12;
        o.type = 'triangle'; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.start(t); o.stop(t + 0.4);
      });
      setTimeout(() => ac.close(), 1500);
    } catch {}
  }

  // typing "lift" replays the achievement toast (for testing)
  let typed = '';
  addEventListener('keydown', (e) => {
    if (e.repeat || !/^Key[A-Z]$/.test(e.code)) return;   // no dev/input checks: "L" opens the dev suggestion box, which would swallow "ift"
    typed = (typed + e.code.slice(3).toLowerCase()).slice(-4);
    if (typed === 'lift') { typed = ''; achievement('🏆', 'Achievement unlocked', 'Lifts unlocked', 'You found the Game Room. You can now ride the lifts between floors.'); }
  });

  const free = () => !player.state.paused && document.getElementById('overlay')?.classList.contains('hidden');
  addEventListener('keydown', (e) => {
    if (e.repeat || !free() || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (asking && (e.code === 'KeyY' || e.code === 'KeyN')) {   // answer to "show me the way?"
      asking = false; clearTimeout(cardT); card.style.opacity = '0'; card.style.transform = 'translate(-50%,-10px)';
      if (e.code === 'KeyY') { navigate?.(true); showCard('🧭', 'Route on the map', 'Follow the yellow dotted line on the minimap to the Game Room.', '#ffd34a', 4000); }
      return;
    }
    const L = current();
    if (!L) return;
    const s = S[L.n];
    if (e.code === 'KeyF') {
      e.stopImmediatePropagation();
      if (s.phase !== 'idle') return;
      if (s.at !== floorOf(L)) { go(L.n, floorOf(L)); return; }            // the cabin is elsewhere: call it
      if (L.target) { if (inDoorway(L)) return; setOpen(L, false); } else setOpen(L, true);
      emit({ t: 'lift', op: 'door', n: L.n, floor: floorOf(L), open: L.target });
    } else if (e.code === 'KeyE' && inCabin(L) && s.at === floorOf(L) && s.phase === 'idle') {   // works with the doors open or shut
      if (!unlocked) { showCard('🔒', 'Lift locked', 'Take a look around Pixbit first and visit the Game Room. The lift unlocks as soon as you get there.', '#ffd34a', 9000,
        '<div style="margin-top:10px;font-weight:600">Want a route to the Game Room on your map?</div><div style="margin-top:6px"><b style="color:#6ee7a0">Y</b> Yes, show me the way &nbsp;·&nbsp; <b style="color:#ff8a8a">N</b> No thanks</div>'); return; }
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
      if (s.t > 0.5) { setOpen(cabinAt(s.n, s.at), true); s.phase = 'opening'; s.t = 0; }
    } else if (s.phase === 'opening') {
      if (cabinAt(s.n, s.at).t === 1) { s.phase = 'idle'; if (s.carried) { player.state.paused = false; s.carried = false; } }
    }
  }

  function update(dt) {
    for (const L of all) {
      if (L.t !== L.target) {
        L.t = L.target > L.t ? Math.min(1, L.t + dt / OPEN_TIME) : Math.max(0, L.t - dt / CLOSE_TIME);
        if (L.target && L.t > 0.5) { const i = colliders.indexOf(L.block); if (i >= 0) colliders.splice(i, 1); }   // walkable once half open
        const e = L.t * L.t * (3 - 2 * L.t);
        // each leaf folds away into its own jamb: it narrows toward the outer edge instead of sliding over the wall
        const sc = Math.max(0.001, 1 - e * 0.97);
        L.leaves.forEach((g, i) => { const pivot = L.z + (i ? 1 : -1) * 0.55; g.scale.z = sc; g.position.z = pivot * (1 - sc); g.visible = sc > 0.02; });
        if (L.t === 0 && !colliders.includes(L.block)) colliders.push(L.block);
      }
    }
    for (const n in S) if (S[n].phase !== 'idle') step(S[n], dt);
    // open doors shut by themselves after a while (not while someone stands in the doorway)
    for (const L of all) {
      if (L.target === 1 && L.t === 1 && S[L.n].phase === 'idle') {
        L.openFor = (L.openFor || 0) + dt;
        if (L.openFor > AUTO_CLOSE && !(!!L.ground === onGround() && inDoorway(L))) { L.openFor = 0; setOpen(L, false); }
      } else L.openFor = 0;
    }
  }

  /** put lift n's cabin straight on floor `at` (0 upper, 1 ground): position, display and doors, no animation */
  function park(n, at) {
    const s = S[n];
    if (!s || s.at === at && s.parked) return;
    s.at = at; s.parked = true;
    setLiftDisplay(n, '', FLOORS[at ? 4 : 0]);
    if (cabins[n]) cabins[n].position.y = at ? GROUND_Y : 0;
    const a = cabinAt(n, at), b = cabinAt(n, 1 - at);
    if (b) { b.target = 0; if (b.t === 0 && !colliders.includes(b.block)) colliders.push(b.block); }
    if (a) a.target = 0;                                  // doors start shut
  }
  // by default every lift starts on the ground floor (a player joining an existing game is synced by the snapshot)
  for (const n in S) park(+n, 1);

  return {
    update,
    /** called when the player reaches the Game Room: unlocks the lifts (once, remembered) and shows a card */
    unlock() {
      if (unlocked) return;
      unlocked = true; navigate?.(false);
      try { localStorage.setItem(LOCK_KEY, '1'); } catch {}
      achievement('🏆', 'Achievement unlocked', 'Lifts unlocked', 'You found the Game Room. You can now ride the lifts between floors.');
    },
    onChange: (f) => listeners.push(f),
    /** true while I am being carried (doors shut, cabin travelling) */
    riding: () => Object.values(S).some((s) => s.carried && s.phase !== 'idle'),
    /** a message from another player (only sent when something changes) */
    apply(m) {
      if (m.op === 'go') go(m.n, m.to, true);
      else if (m.op === 'door') { const s = S[m.n], L = s && cabinAt(m.n, m.floor); if (L && s.phase === 'idle' && s.at === m.floor) setOpen(L, !!m.open); }
      else if (m.op === 'snap' && Array.isArray(m.s)) {
        for (const n in S) if (S[n].phase === 'idle') park(+n, m.s.includes(+n) || m.s.includes(n) ? 1 : 0);
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
      if (inCabin(L)) return `E ${onGround() ? 'go up' : 'go to the ground floor'}`;
      if (L.target) return inDoorway(L) ? '' : `F close lift ${L.n}`;
      return `F open lift ${L.n}`;
    },
  };
}
