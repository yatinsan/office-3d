import * as THREE from 'three';
import { SEATS } from './props.js';
import { achievements } from './achievements.js';

/**
 * Sit at a desk: walk up to a work chair and press E. The camera settles in front of the monitor and its screen
 * becomes a small Mac-like computer (menu bar, dock, Notes / Calculator / Clock).
 * Everything on the screen is drawn locally and never sent: other players only get "seated" (tiny, sent rarely).
 * Keys: ← → pick an app in the dock, Enter opens it, Tab goes back to the desktop, Esc (or E on the desktop) stands up.
 * Touch: tap the dock / the red dot; the context button stands you up.
 */
const REACH = 1.15;           // how close to the chair centre you must be
const EYE_DIST = 0.4;         // camera distance from the screen
const CW = 832, CH = 480;     // screen canvas, same 0.52 x 0.30 m ratio as the monitor
const APPS = ['Notes', 'Calculator', 'Clock', 'Pixbit'];
const SITE = 'https://pixbitsolutions.com/';
const logo = new Image(); logo.src = 'textures/logo.png';
const BAR = 26;               // menu bar height on the screen canvas; the web page fills the rest
const DOCK = APPS.map((_, i) => ({ x: CW / 2 - 142 + i * 75, y: CH - 70, w: 60, h: 60 }));
const WIN = { x: 150, y: 50, w: 532, h: 330 };
const font = (px, w = 500) => `${w} ${px}px "Avenir Next", "Helvetica Neue", system-ui, Arial, sans-serif`;

export function initSeat({ scene, camera, player, online, overlay, touch = false }) {
  const canvas = document.createElement('canvas');
  canvas.width = CW; canvas.height = CH;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.30),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  screen.visible = false;
  scene.add(screen);

  // phones: a hidden text field brings up the on-screen keyboard while Notes is open
  let field = null;
  if (touch) {
    field = document.createElement('input');
    Object.assign(field.style, { position: 'fixed', left: '-100px', top: '0', width: '10px', height: '10px', opacity: '0' });
    field.autocapitalize = 'off'; field.autocomplete = 'off';
    document.body.appendChild(field);
    field.addEventListener('input', (e) => {
      if (!active || app !== 'Notes') return;
      if (e.inputType === 'deleteContentBackward') typeKey('Backspace', '');
      else if (e.inputType === 'insertLineBreak') typeKey('Enter', '');
      else if (e.data) for (const ch of e.data) typeKey('', ch);
      field.value = '';
    });
  }

  let active = false, seat = null, savedPos = null, savedQuat = null, clockT = 0;
  logo.addEventListener('load', () => draw());
  let browsing = false;
  let app = null;               // null = desktop, else one of APPS
  let sel = 0;
  const camPos = new THREE.Vector3();
  const tmpObj = new THREE.Camera();
  const tp = new THREE.Vector3(), tq = new THREE.Quaternion(), look = new THREE.Vector3();
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();

  // ---------- apps ----------
  let notes = '';
  try { notes = localStorage.getItem('pixbit-notes') || ''; } catch {}
  const calc = { disp: '0', acc: null, op: null, fresh: true };
  function calcKey(k) {
    const num = () => parseFloat(calc.disp);
    const apply = () => {
      if (calc.acc === null || !calc.op) return num();
      const a = calc.acc, b = num();
      return calc.op === '+' ? a + b : calc.op === '-' ? a - b : calc.op === '*' ? a * b : b === 0 ? NaN : a / b;
    };
    const fmt = (v) => (Number.isFinite(v) ? String(+v.toPrecision(10)) : 'Error');
    if (/^[0-9]$/.test(k)) { calc.disp = calc.fresh || calc.disp === '0' ? k : calc.disp + k; calc.fresh = false; }
    else if (k === '.') { if (calc.fresh) { calc.disp = '0.'; calc.fresh = false; } else if (!calc.disp.includes('.')) calc.disp += '.'; }
    else if ('+-*/'.includes(k) && k.length === 1) { const v = apply(); calc.disp = fmt(v); calc.acc = Number.isFinite(v) ? v : null; calc.op = k; calc.fresh = true; }
    else if (k === 'Enter' || k === '=') { calc.disp = fmt(apply()); calc.acc = null; calc.op = null; calc.fresh = true; }
    else if (k === 'Backspace') { calc.disp = calc.fresh || calc.disp.length <= 1 ? '0' : calc.disp.slice(0, -1); }
    else if (k === 'c' || k === 'C' || k === 'Escape') { calc.disp = '0'; calc.acc = null; calc.op = null; calc.fresh = true; }
  }
  function typeKey(code, ch) {
    if (app === 'Notes') {
      if (code === 'Backspace') notes = notes.slice(0, -1);
      else if (code === 'Enter') notes += '\n';
      else if (ch && ch.length === 1 && notes.length < 600) notes += ch;
      try { localStorage.setItem('pixbit-notes', notes); } catch {}
    } else if (app === 'Calculator') calcKey(code === 'Backspace' || code === 'Enter' ? code : ch);
    draw();
  }

  // ---------- drawing ----------
  // paint(g, st) draws one screen from a state { app, sel, notes, disp, op }: my own screen and the other players' screens
  // (their state arrives over the network) go through the same code. Params shadow the local app / sel / notes / calc.
  function paint(g, st) {
  const { app, sel } = st, notes = st.notes || '', calc = { disp: st.disp || '0', op: st.op || null };
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  function drawIcon(i, x, y, w, on) {
    const cols = [['#ffd54a', '#f2a900'], ['#7a7f8c', '#3d414c'], ['#fff', '#d8dce6'], ['#1c1c1c', '#000']][i];
    const grd = g.createLinearGradient(0, y, 0, y + w); grd.addColorStop(0, cols[0]); grd.addColorStop(1, cols[1]);
    g.fillStyle = grd; rr(x, y, w, w, 14); g.fill();
    g.fillStyle = i === 2 ? '#222' : '#fff'; g.strokeStyle = g.fillStyle; g.lineWidth = 3; g.lineCap = 'round';
    if (i === 0) { for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + 14, y + 20 + k * 11); g.lineTo(x + w - 14, y + 20 + k * 11); g.stroke(); } }
    else if (i === 1) { g.font = font(30, 700); g.textAlign = 'center'; g.fillText('+ ×', x + w / 2, y + w / 2 + 11); }
    else if (i === 3) { if (logo.complete && logo.naturalWidth) { const lh = w * 0.72, lw = lh * logo.naturalWidth / logo.naturalHeight; g.drawImage(logo, x + (w - lw) / 2, y + (w - lh) / 2, lw, lh); } }
    else { g.beginPath(); g.arc(x + w / 2, y + w / 2, 19, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(x + w / 2, y + w / 2); g.lineTo(x + w / 2, y + w / 2 - 13); g.moveTo(x + w / 2, y + w / 2); g.lineTo(x + w / 2 + 9, y + w / 2 + 4); g.stroke(); }
    if (on) { g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(x + w / 2, y + w + 7, 3, 0, Math.PI * 2); g.fill(); }
  }
  function drawWindow() {
    const { x, y, w, h } = WIN;
    g.fillStyle = 'rgba(0,0,0,.35)'; rr(x + 4, y + 8, w, h, 12); g.fill();
    g.fillStyle = '#f4f4f6'; rr(x, y, w, h, 12); g.fill();
    g.fillStyle = '#e4e4e8'; g.beginPath(); g.roundRect(x, y, w, 34, [12, 12, 0, 0]); g.fill();
    for (const [i, c] of ['#ff5f57', '#febc2e', '#28c840'].entries()) { g.fillStyle = c; g.beginPath(); g.arc(x + 20 + i * 22, y + 17, 7, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#555'; g.font = font(15, 600); g.textAlign = 'center'; g.fillText(app, x + w / 2, y + 22);
    g.save(); g.beginPath(); g.rect(x, y + 34, w, h - 34); g.clip();
    g.textAlign = 'left';
    if (app === 'Notes') {
      g.fillStyle = '#222'; g.font = font(20, 400);
      const lines = (notes + (Math.floor(performance.now() / 500) % 2 ? '|' : ' ')).split('\n');
      const wrapped = [];
      for (const ln of lines) {
        let cur = '';
        for (const word of ln.split(/(?<= )/)) { if (g.measureText(cur + word).width > w - 40 && cur) { wrapped.push(cur); cur = word; } else cur += word; }
        wrapped.push(cur);
      }
      wrapped.slice(-9).forEach((ln, i) => g.fillText(ln, x + 20, y + 68 + i * 28));
      if (!notes) { g.fillStyle = '#aaa'; g.fillText('Start typing…', x + 20, y + 68); }
    } else if (app === 'Calculator') {
      g.fillStyle = '#1c1c1e'; g.fillRect(x, y + 34, w, 90);
      g.fillStyle = '#fff'; g.font = font(54, 300); g.textAlign = 'right'; g.fillText(calc.disp.slice(0, 14), x + w - 24, y + 104);
      g.fillStyle = '#ff9f0a'; g.font = font(20, 600); g.textAlign = 'left'; if (calc.op) g.fillText(calc.op === '*' ? '×' : calc.op === '/' ? '÷' : calc.op, x + 24, y + 70);
      g.fillStyle = '#555'; g.font = font(17, 500); g.textAlign = 'center';
      g.fillText('Type numbers and + − * /   ·   Enter =   ·   C clear   ·   Backspace delete', x + w / 2, y + 170);
    } else if (app === 'Pixbit') {
      if (logo.complete && logo.naturalWidth) g.drawImage(logo, x + w / 2 - 40, y + 70, 80, 80 * logo.naturalHeight / logo.naturalWidth);
      g.fillStyle = '#111'; g.textAlign = 'center'; g.font = font(26, 700);
      g.fillText('pixbitsolutions.com', x + w / 2, y + 250);
    } else {
      const d = new Date();
      g.fillStyle = '#111'; g.textAlign = 'center'; g.font = font(96, 200);
      g.fillText(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), x + w / 2, y + 160);
      g.font = font(24, 400); g.fillStyle = '#666';
      g.fillText(d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }), x + w / 2, y + 210);
    }
    g.restore();
  }
  {
    const grd = g.createLinearGradient(0, 0, CW, CH);
    grd.addColorStop(0, '#2b3a8c'); grd.addColorStop(0.55, '#7b3fa0'); grd.addColorStop(1, '#e9707a');
    g.fillStyle = grd; g.fillRect(0, 0, CW, CH);
    // menu bar
    g.fillStyle = 'rgba(20,20,30,.55)'; g.fillRect(0, 0, CW, 26);
    g.textBaseline = 'alphabetic'; g.fillStyle = '#fff'; g.textAlign = 'left';
    g.font = font(15, 700); g.fillText('● Pixbit', 14, 18);
    g.font = font(15, 600); g.fillText(app || 'Desktop', 92, 18);
    g.textAlign = 'right'; g.font = font(14, 500);
    const low = online?.lowConnection?.();
    g.fillStyle = low ? '#ffcf5a' : 'rgba(255,255,255,.85)';
    g.fillText((low ? '⚠ Low connection · ' : online?.running?.() ? 'Online · ' : '') + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), CW - 14, 18);
    if (app) drawWindow();
    else {
      g.fillStyle = 'rgba(255,255,255,.75)'; g.font = font(18, 500); g.textAlign = 'center';
      g.fillText('← →  choose an app   ·   Enter  open   ·   E / Esc  stand up', CW / 2, 120);
    }
    // dock
    g.fillStyle = 'rgba(255,255,255,.22)'; rr(CW / 2 - 162, CH - 82, 325, 76, 20); g.fill();
    APPS.forEach((_, i) => { const d = DOCK[i]; drawIcon(i, d.x, d.y, d.w, app === APPS[i]); });
    if (!app) { g.strokeStyle = '#fff'; g.lineWidth = 3; rr(DOCK[sel].x - 4, DOCK[sel].y - 4, DOCK[sel].w + 8, DOCK[sel].h + 8, 17); g.stroke(); }
  }
  }
  const mine = () => ({ app, sel, notes, disp: calc.disp, op: calc.op });
  function draw() {
    paint(g, mine());
    tex.needsUpdate = true;
    queueSend();
  }

  // ---------- other players' screens + who sits where (state only, drawn locally; see online.js hookScreens) ----------
  const taken = new Map();      // peer id -> seat index they sit on
  const remote = new Map();     // peer id -> { mesh, g, tex, st }
  let lastSent = '', sendT = 0;
  const seatIdx = () => (active ? SEATS.indexOf(seat) : -1);
  function stateMsg() {
    const st = mine();
    return { t: 'screen', seat: seatIdx(), app: st.app ? APPS.indexOf(st.app) : -1, sel: st.sel,
      notes: st.app === 'Notes' ? st.notes : '', disp: st.app === 'Calculator' ? st.disp : '0', op: st.app === 'Calculator' ? st.op : null };
  }
  function sendNow() {
    clearTimeout(sendT); sendT = 0;
    if (!active) return;
    const m = stateMsg(), s = JSON.stringify(m);
    if (s === lastSent) return;
    lastSent = s; online?.broadcast?.(m);
  }
  function queueSend() { if (active && !sendT) sendT = setTimeout(sendNow, 100); } // typing is batched, ~10 messages a second at most
  function stateFrom(m) { return { app: APPS[m.app] || null, sel: m.sel | 0, notes: String(m.notes || '').slice(0, 600), disp: String(m.disp || '0').slice(0, 14), op: m.op || null }; }
  // someone stood up: their last screen stays on the monitor (frozen) until another person sits there
  function hideRemote(id) { const r = remote.get(id); if (r) r.on = false; }
  let mySeat = -1;              // seat where my own last screen stays after I stand up
  function clearSeat(i, except) {
    for (const r of remote.values()) if (r !== except && r.seat === i) r.mesh.visible = false;
    if (i === mySeat && !active) screen.visible = false;
  }
  function showRemote(id, m) {
    const s = SEATS[m.seat];
    if (!s) return;
    let r = remote.get(id);
    if (!r) {
      const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.30),
        new THREE.MeshBasicMaterial({ map: tx, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      scene.add(mesh);
      remote.set(id, (r = { mesh, g: cv.getContext('2d'), tex: tx, st: null, on: false }));
    }
    r.mesh.position.set(s.sx + s.nx * 0.004, s.sy, s.sz + s.nz * 0.004);
    r.mesh.rotation.y = Math.atan2(s.nx, s.nz);
    clearSeat(m.seat, r); r.seat = m.seat;
    r.mesh.visible = r.on = true; r.t = performance.now();
    r.st = stateFrom(m);
    paint(r.g, r.st); r.tex.needsUpdate = true;
  }
  function note(text) {
    const t = document.createElement('div');
    t.textContent = text;
    t.style.cssText = 'position:fixed;top:14%;left:50%;transform:translateX(-50%);background:#000a;color:#fff;padding:8px 16px;border-radius:8px;font:14px sans-serif;z-index:99;pointer-events:none';
    document.body.appendChild(t); setTimeout(() => t.remove(), 1800);
  }
  const takenBySomeone = (i) => { for (const v of taken.values()) if (v === i) return true; return false; };
  const hooks = {
    msg(id, m) {
      if (!(m.seat >= 0)) { taken.delete(id); hideRemote(id); return; }
      if (active && seatIdx() === m.seat) { // both of us sat down in the same moment: the lower id keeps the seat
        if (String(online?.uid?.()) < String(id)) return;
        exit(); note('Seat taken');
      }
      taken.set(id, m.seat);
      showRemote(id, m);
    },
    // a lost 'stood up' message must not leave their screen on: the position stream says whether they still sit
    sat(id, sitting) {
      const r = remote.get(id);
      if (!sitting && r?.on && performance.now() - r.t > 2000) { taken.delete(id); hideRemote(id); }
    },
    gone(id) { taken.delete(id); const r = remote.get(id); if (r) { scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); r.tex.dispose(); remote.delete(id); } },
    reset() { for (const id of [...remote.keys()]) hooks.gone(id); taken.clear(); },
    snap: () => (active ? stateMsg() : null),
  };
  let remoteT = 0;
  function updateRemote(dt) {
    if ((remoteT += dt) < 0.5) return;
    remoteT = 0;
    for (const r of remote.values()) {       // clock + caret blink, only for screens close enough to read
      if (!r.on || !r.st) continue;
      if (r.mesh.position.distanceTo(camera.position) > 8) continue;
      paint(r.g, r.st); r.tex.needsUpdate = true;
    }
  }

  // ---------- sitting down / standing up ----------
  const nearAny = () => {
    if (!SEATS.length || player.state.paused) return null;
    let best = null, bd = REACH;
    for (const s of SEATS) { const d = Math.hypot(player.pos.x - s.x, player.pos.z - s.z); if (d < bd) { bd = d; best = s; } }
    return best;
  };
  const near = () => { const s = nearAny(); return s && !takenBySomeone(SEATS.indexOf(s)) ? s : null; };
  function enter(s) {
    seat = s; active = true; app = null; sel = 0;
    player.state.paused = true;
    savedQuat = camera.quaternion.clone();
    savedPos = player.pos.clone();
    camPos.copy(camera.position);
    screen.position.set(s.sx + s.nx * 0.004, s.sy, s.sz + s.nz * 0.004);
    screen.rotation.y = Math.atan2(s.nx, s.nz);
    const si = SEATS.indexOf(s); clearSeat(si); mySeat = si;
    screen.visible = true;
    document.body.classList.add('cutscene');
    online?.setSeated?.(true);
    lastSent = '';
    draw();
    sendNow();                                // tell everyone at once: this seat is taken, and what is on the screen
  }
  function exit() {
    if (!active) return;
    clearTimeout(sendT); sendT = 0; lastSent = '';
    online?.broadcast?.({ t: 'screen', seat: -1 });
    active = false; seat = null;
    player.state.paused = false;
    document.body.classList.remove('cutscene');
    field?.blur(); hideBrowser();
    online?.setSeated?.(false);
    if (savedQuat) camera.quaternion.copy(savedQuat);
    if (savedPos) player.pos.copy(savedPos);   // back where you stood (the chair is a collider)
  }
  // the web page: an iframe laid exactly over the 3D screen (re-fitted every frame while the camera settles)
  let frame = null, bar = null;
  const corner = new THREE.Vector3();
  function showBrowser() {
    if (!frame) {
      frame = document.createElement('iframe');
      frame.src = SITE; frame.title = 'Monitor';
      frame.style.cssText = 'position:fixed;border:0;background:#fff;z-index:30;display:none';
      bar = document.createElement('button');
      bar.textContent = '✕ Close';
      bar.style.cssText = 'position:fixed;z-index:31;display:none;font:600 13px sans-serif;padding:5px 12px;border:0;border-radius:8px;background:#000b;color:#fff;cursor:pointer';
      bar.addEventListener('click', () => { home(); relock(); });
      document.body.append(frame, bar);
    }
    browsing = true;
    achievements.unlock('pixbit');
    if (document.pointerLockElement) document.exitPointerLock();   // the mouse is needed for the page
  }
  function hideBrowser() { browsing = false; if (frame) { frame.style.display = 'none'; bar.style.display = 'none'; } }
  function relock() { try { const p = player.controls.domElement.requestPointerLock(); if (p?.catch) p.catch(() => {}); } catch {} }
  function fitBrowser() {
    if (!browsing || !frame) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      corner.set(sx * 0.26, sy * 0.15, 0); screen.localToWorld(corner); corner.project(camera);
      const px = (corner.x + 1) / 2 * innerWidth, py = (1 - corner.y) / 2 * innerHeight;
      x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    const top = y0 + (y1 - y0) * (BAR / CH);
    Object.assign(frame.style, { display: 'block', left: x0 + 'px', top: top + 'px', width: (x1 - x0) + 'px', height: (y1 - top) + 'px' });
    Object.assign(bar.style, { display: 'block', left: Math.max(4, x1 - 80) + 'px', top: Math.max(4, y0 - 34) + 'px' });
  }
  function open(i) { sel = i; app = APPS[i]; if (app === 'Pixbit') showBrowser(); if (field && app === 'Notes') field.focus(); draw(); }
  function home() { app = null; hideBrowser(); field?.blur(); draw(); }

  // ---------- input (capture phase so nothing else reacts while you sit) ----------
  addEventListener('keydown', (e) => {
    if (!active) {
      if (e.code === 'KeyE' && !e.repeat && overlay.classList.contains('hidden')) {
        const s = near();
        if (s) { enter(s); e.stopImmediatePropagation(); }
      }
      return;
    }
    if (e.code === 'Escape') { exit(); return; }             // the browser also releases the pointer: the pause menu opens
    if (/^F\d+$/.test(e.code) || e.ctrlKey || e.metaKey) return;
    e.stopImmediatePropagation();
    if (!e.isTrusted && e.code === 'KeyE') { exit(); return; } // the on-screen context button
    e.preventDefault();
    if (!app) {
      if (e.code === 'KeyE') { if (!e.repeat) exit(); return; }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') sel = (sel + 1) % APPS.length;
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') sel = (sel + APPS.length - 1) % APPS.length;
      else if (e.code === 'Enter' || e.code === 'Space') { open(sel); return; }
      draw();
      return;
    }
    if (e.code === 'Tab') { home(); return; }
    typeKey(e.code, e.key);
  }, true);

  // tap the screen (phones): raycast to the canvas and hit-test the dock / window
  addEventListener('pointerdown', (e) => {
    if (!active || e.pointerType !== 'touch') return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(screen)[0];
    if (!hit) return;
    const x = hit.uv.x * CW, y = (1 - hit.uv.y) * CH;
    const inR = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    const i = DOCK.findIndex(inR);
    if (i >= 0) open(i);
    else if (app && Math.hypot(x - (WIN.x + 20), y - (WIN.y + 17)) < 12) home();
    else if (app === 'Notes' && inR(WIN)) field?.focus();
  }, true);

  function update(dt) {
    updateRemote(dt);
    if (!active) return;
    if (!overlay.classList.contains('hidden')) { exit(); return; } // pause menu opened
    if ((clockT += dt) > 0.5) { clockT = 0; draw(); } // clock, caret blink and the connection badge
    // the camera sits in front of the screen, looking at its centre
    tp.set(seat.sx + seat.nx * EYE_DIST, seat.sy + 0.02, seat.sz + seat.nz * EYE_DIST);
    tmpObj.position.copy(tp);
    tmpObj.lookAt(look.set(seat.sx, seat.sy, seat.sz));
    tq.copy(tmpObj.quaternion);
    const k = 1 - Math.exp(-6 * Math.min(dt, 0.05));
    camPos.lerp(tp, k);                       // own smoothed position: player.update resets camera.position every frame
    camera.position.copy(camPos);
    camera.quaternion.slerp(tq, k);
    camera.updateMatrixWorld(); fitBrowser();
    player.pos.set(seat.x, 0, seat.z);        // your body sits on the chair
  }

  return {
    update,
    prompt: () => (active ? 'E stand up' : near() ? 'E sit down' : nearAny() ? 'Seat in use' : ''),
    isActive: () => active,
    isBrowsing: () => browsing,
    exit,
    hooks,
  };
}
