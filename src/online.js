import * as THREE from 'three';
import { FIREBASE_CONFIG, ROOM, isConfigured } from './firebase-config.js';

/**
 * Open World: walk the office with other people, and hold V to talk (proximity voice).
 *
 *   Firebase Realtime Database = lobby + handshake only:
 *     rooms/<room>/players/<uid>      { name, color, t }   who is here (removed automatically on disconnect)
 *     rooms/<room>/signal/<uid>/<id>  { from, type, ... } WebRTC offer / answer / ICE addressed to <uid>
 *   WebRTC, peer-to-peer between every pair of players:
 *     data channel "pos"  position + facing + talking flag, ~15 times a second
 *     audio track         push-to-talk voice, played from the speaker's avatar (louder when close)
 *
 * The Firebase SDK is loaded from Google's CDN only when Open World starts, so other modes don't pay for it.
 */
const FB = 'https://www.gstatic.com/firebasejs/11.0.2/';
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const SEND_HZ = 15;
const COLORS = ['#e8505b', '#f9a73e', '#ecc828', '#4fbf6f', '#2fa4d9', '#7b68ee', '#e26fc4', '#3fc1b0'];
const NAME_KEY = 'pixbit-online-name', COLOR_KEY = 'pixbit-online-color';
const EYE = 1.65;

const CSS = `
  .ow { width: 100%; margin-top: 14px; display: none; flex-direction: column; gap: 8px; cursor: default; }
  .ow.show { display: flex; }
  .ow-row { display: flex; align-items: center; gap: 10px; }
  .ow label { width: 66px; flex: none; font: 700 12px system-ui, sans-serif; text-transform: uppercase; letter-spacing: 1px; color: #ecc828; }
  .ow input { flex: 1; min-width: 0; padding: 8px 12px; border-radius: 10px; border: 1.5px solid rgba(255,255,255,.25); background: rgba(20,20,24,.7);
    color: #fff; font: 600 15px system-ui, sans-serif; outline: none; }
  .ow input:focus { border-color: #ecc828; }
  .ow-dot { width: 22px; height: 22px; flex: none; border-radius: 50%; border: 2px solid rgba(255,255,255,.7); cursor: pointer; }
  .ow-status { font: 500 13px system-ui, sans-serif; color: rgba(255,255,255,.75); }
  .ow-status b { color: #7ee08f; }
  .ow-status.err b { color: #ff8a80; }
  #ow-hud { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 5; display: none; align-items: center; gap: 10px;
    padding: 6px 14px; border-radius: 20px; background: rgba(0,0,0,.5); color: #fff; font: 600 13px system-ui, sans-serif; pointer-events: none; }
  #ow-hud.show { display: flex; }
  #ow-hud .mic { width: 10px; height: 10px; border-radius: 50%; background: #777; }
  #ow-hud.talk .mic { background: #ff4d4d; box-shadow: 0 0 10px #ff4d4d; }
  #ow-hud kbd { background: #333; border: 1px solid #666; border-radius: 4px; padding: 0 5px; font: 700 11px system-ui; }
  #ow-ptt { position: fixed; z-index: 7; right: max(84px, calc(env(safe-area-inset-right) + 66px)); bottom: max(26px, env(safe-area-inset-bottom));
    width: 54px; height: 54px; border-radius: 50%; border: 2px solid rgba(255,255,255,.55); background: rgba(20,20,20,.5); color: #fff;
    display: none; align-items: center; justify-content: center; touch-action: none; user-select: none; -webkit-user-select: none; }
  #ow-ptt.show { display: flex; }
  #ow-ptt.on { background: rgba(255,77,77,.8); }
  #ow-ptt svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; pointer-events: none; }
`;

export function initOnline({ scene, camera, player, panel, touch = false }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);

  // ---------- Menu panel (shown while Open World is the selected mode) ----------
  let myName = '', myColor = '';
  try { myName = localStorage.getItem(NAME_KEY) || ''; myColor = localStorage.getItem(COLOR_KEY) || ''; } catch {}
  if (!myName) myName = 'Guest ' + Math.floor(100 + Math.random() * 900);
  if (!COLORS.includes(myColor)) myColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  const box = document.createElement('div');
  box.className = 'ow';
  box.innerHTML = `
    <div class="ow-row"><label for="ow-name">Name</label><input id="ow-name" maxlength="18" autocomplete="off" spellcheck="false">
      <span class="ow-dot" title="Change colour"></span></div>
    <div class="ow-row"><label>Online</label><span class="ow-status"></span></div>`;
  panel.insertBefore(box, panel.querySelector('.m-hint'));
  const nameIn = box.querySelector('input'), dot = box.querySelector('.ow-dot'), statusEl = box.querySelector('.ow-status');
  nameIn.value = myName; dot.style.background = myColor;
  box.addEventListener('click', (e) => e.stopPropagation()); // don't start the game while editing
  nameIn.addEventListener('keydown', (e) => { if (e.code !== 'Escape') e.stopPropagation(); if (e.code === 'Enter') nameIn.blur(); });
  nameIn.addEventListener('keyup', (e) => e.stopPropagation());
  nameIn.addEventListener('change', () => {
    myName = nameIn.value.trim().slice(0, 18) || myName; nameIn.value = myName;
    try { localStorage.setItem(NAME_KEY, myName); } catch {}
    publishMe();
  });
  dot.addEventListener('click', () => {
    myColor = COLORS[(COLORS.indexOf(myColor) + 1) % COLORS.length]; dot.style.background = myColor;
    try { localStorage.setItem(COLOR_KEY, myColor); } catch {}
    publishMe();
  });
  function setStatus(html, err = false) { statusEl.innerHTML = html; statusEl.classList.toggle('err', err); }

  // ---------- In-game HUD pill + touch talk button ----------
  const hud = document.createElement('div'); hud.id = 'ow-hud';
  hud.innerHTML = '<span class="mic"></span><span class="txt"></span>';
  document.body.appendChild(hud);
  const pttBtn = document.createElement('button'); pttBtn.id = 'ow-ptt'; pttBtn.type = 'button'; pttBtn.setAttribute('aria-label', 'Hold to talk');
  pttBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  document.body.appendChild(pttBtn);
  pttBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); setTalk(true); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) pttBtn.addEventListener(ev, () => setTalk(false));

  // ---------- State ----------
  let on = false, fb = null, db = null, uid = null, unsubs = [];
  const peers = new Map(); // uid -> { pc, dc, avatar, name, color, initiator, pendingIce, audioEl }
  let listener = null;    // THREE.AudioListener on the camera, made on first use
  let mic = null, micAsked = false, talking = false;

  // ---------- Firebase (lobby + handshake) ----------
  async function loadFirebase() {
    if (fb) return fb;
    if (window.__owFake) return (fb = window.__owFake); // test hook: a local stand-in for Firebase (two-tab testing)
    const [app, auth, rtdb] = await Promise.all([
      import(/* @vite-ignore */ FB + 'firebase-app.js'),
      import(/* @vite-ignore */ FB + 'firebase-auth.js'),
      import(/* @vite-ignore */ FB + 'firebase-database.js'),
    ]);
    const a = app.initializeApp(FIREBASE_CONFIG, 'pixbit-online');
    // in-memory sign-in: every tab is its own player (the default would share one player id across tabs)
    fb = { auth: auth.initializeAuth(a, { persistence: auth.inMemoryPersistence }), signIn: auth.signInAnonymously, ...rtdb };
    return fb;
  }
  const path = (p) => fb.ref(db, `rooms/${ROOM}/${p}`);

  async function connect() {
    if (!isConfigured() && !window.__owFake) { setStatus('<b>Not set up yet</b> · add your Firebase config (see MULTIPLAYER.md)', true); return; }
    setStatus('Connecting…');
    try {
      await loadFirebase();
      db = fb.getDatabase(fb.auth.app);
      const cred = await fb.signIn(fb.auth);
      if (!on) return;
      uid = cred.user.uid;
      await fb.remove(path(`signal/${uid}`)); // drop any old handshake messages addressed to me
      fb.onDisconnect(path(`players/${uid}`)).remove();
      fb.onDisconnect(path(`signal/${uid}`)).remove();
      await publishMe();
      const players = path('players');
      unsubs.push(fb.onChildAdded(players, (s) => { if (s.key !== uid) meet(s.key, s.val()); refreshStatus(); }));
      unsubs.push(fb.onChildChanged(players, (s) => { const p = peers.get(s.key); if (p) { p.name = s.val().name; p.color = s.val().color; p.avatar.setLook(p.name, p.color); } }));
      unsubs.push(fb.onChildRemoved(players, (s) => { drop(s.key); refreshStatus(); }));
      unsubs.push(fb.onChildAdded(path(`signal/${uid}`), (s) => { const m = s.val(); fb.remove(s.ref); onSignal(m).catch((e) => console.warn('[online] signal', e)); }));
      refreshStatus();
    } catch (e) {
      console.warn('[online]', e);
      setStatus(`<b>Couldn't connect</b> · ${String(e.code || e.message || e).replace(/</g, '&lt;')}`, true);
    }
  }
  function publishMe() {
    if (!on || !uid) return Promise.resolve();
    return fb.set(path(`players/${uid}`), { name: myName, color: myColor, t: fb.serverTimestamp() });
  }
  function send(to, msg) { if (uid) fb.push(path(`signal/${to}`), { ...msg, from: uid }); }

  function disconnect() {
    for (const u of unsubs) u(); unsubs = [];
    for (const id of [...peers.keys()]) drop(id);
    if (fb && uid) { fb.remove(path(`players/${uid}`)); fb.remove(path(`signal/${uid}`)); }
    uid = null;
  }

  // ---------- WebRTC peers ----------
  function meet(id, info) {
    if (peers.has(id)) return peers.get(id);
    const p = makePeer(id, info || {});
    if (p.initiator) offer(p);
    return p;
  }
  function makePeer(id, info) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const p = { id, pc, dc: null, name: info.name || 'Guest', color: info.color || '#999', initiator: uid < id, pendingIce: [], audioEl: null, last: null };
    p.avatar = makeAvatar(p.name, p.color);
    p.avatar.group.visible = false; // until the first position arrives
    scene.add(p.avatar.group);
    peers.set(id, p);
    pc.onicecandidate = (e) => { if (e.candidate) send(id, { type: 'ice', c: JSON.stringify(e.candidate.toJSON()) }); };
    pc.ontrack = (e) => attachVoice(p, e.streams[0] || new MediaStream([e.track]));
    pc.onconnectionstatechange = () => {
      refreshStatus();
      if (pc.connectionState === 'failed' && on && peers.get(id) === p) { // retry once the network settles
        drop(id); setTimeout(() => { if (on && uid) fb.get(path(`players/${id}`)).then((s) => { if (s.exists()) meet(id, s.val()); }); }, 3000);
      }
    };
    if (p.initiator) {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      useChannel(p, pc.createDataChannel('pos', { ordered: false, maxRetransmits: 0 }));
    } else {
      pc.ondatachannel = (e) => useChannel(p, e.channel);
    }
    return p;
  }
  async function offer(p) {
    const o = await p.pc.createOffer();
    await p.pc.setLocalDescription(o);
    send(p.id, { type: 'offer', sdp: o.sdp });
  }
  async function onSignal(m) {
    if (!m || !m.from) return;
    let p = peers.get(m.from);
    if (m.type === 'offer') {
      if (!p || p.initiator) { if (p) drop(m.from); p = makePeer(m.from, {}); p.initiator = false; }
      const s = await fb.get(path(`players/${m.from}`)); if (s.exists()) { p.name = s.val().name; p.color = s.val().color; p.avatar.setLook(p.name, p.color); }
      await p.pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
      for (const t of p.pc.getTransceivers()) if (t.receiver.track.kind === 'audio') { t.direction = 'sendrecv'; if (mic) t.sender.replaceTrack(mic); }
      await flushIce(p);
      const a = await p.pc.createAnswer();
      await p.pc.setLocalDescription(a);
      send(m.from, { type: 'answer', sdp: a.sdp });
    } else if (m.type === 'answer' && p) {
      await p.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
      if (mic) for (const s of p.pc.getSenders()) if (!s.track) s.replaceTrack(mic);
      await flushIce(p);
    } else if (m.type === 'ice' && p) {
      const c = JSON.parse(m.c);
      if (p.pc.remoteDescription) await p.pc.addIceCandidate(c).catch(() => {}); else p.pendingIce.push(c);
    }
  }
  async function flushIce(p) { for (const c of p.pendingIce.splice(0)) await p.pc.addIceCandidate(c).catch(() => {}); }
  function useChannel(p, dc) {
    p.dc = dc;
    dc.onopen = () => { refreshStatus(); sendPos(true); };
    dc.onclose = () => refreshStatus();
    dc.onmessage = (e) => {
      try {
        const [x, y, z, yaw, talk] = JSON.parse(e.data);
        p.avatar.target(x, y, z, yaw, !!talk);
      } catch {}
    };
  }
  function drop(id) {
    const p = peers.get(id);
    if (!p) return;
    peers.delete(id);
    try { p.dc?.close(); } catch {}
    try { p.pc.close(); } catch {}
    if (p.audioEl) { p.audioEl.srcObject = null; p.audioEl.remove(); }
    p.avatar.dispose();
  }

  // ---------- Voice: push to talk, played from the speaker's avatar ----------
  function ensureListener() {
    if (!listener) { listener = new THREE.AudioListener(); camera.add(listener); }
    if (listener.context.state === 'suspended') listener.context.resume();
    return listener;
  }
  function attachVoice(p, stream) {
    // Chrome only feeds a remote WebRTC stream into WebAudio if it is also attached to a (muted) media element.
    if (!p.audioEl) { p.audioEl = document.createElement('audio'); p.audioEl.muted = true; p.audioEl.autoplay = true; document.body.appendChild(p.audioEl); }
    p.audioEl.srcObject = stream;
    const voice = new THREE.PositionalAudio(ensureListener());
    voice.setMediaStreamSource(stream);
    voice.setRefDistance(2.5); voice.setRolloffFactor(1.4); voice.setDistanceModel('inverse'); voice.setMaxDistance(40);
    p.avatar.setVoice(voice);
  }
  async function getMic() {
    if (mic || micAsked) return mic;
    micAsked = true;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      mic = s.getAudioTracks()[0];
      mic.enabled = talking;
      for (const p of peers.values()) for (const t of p.pc.getTransceivers()) if (t.receiver.track.kind === 'audio' && t.currentDirection !== 'stopped') t.sender.replaceTrack(mic);
    } catch (e) {
      console.warn('[online] mic', e);
      hudNote = 'Microphone blocked: allow it in the browser to talk';
    }
    return mic;
  }
  let hudNote = '';
  function setTalk(v) {
    if (!on || v === talking) return;
    talking = v;
    ensureListener();
    if (v && !mic) getMic().then(() => { if (mic) mic.enabled = talking; });
    if (mic) mic.enabled = v;
    pttBtn.classList.toggle('on', v);
    sendPos(true);
    drawHud();
  }
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || player.state.paused;
  addEventListener('keydown', (e) => { if (e.code === 'KeyV' && !e.repeat && !typing(e)) setTalk(true); });
  addEventListener('keyup', (e) => { if (e.code === 'KeyV') setTalk(false); });
  addEventListener('blur', () => setTalk(false));
  addEventListener('pointerdown', () => { if (on && listener) ensureListener(); });

  // ---------- Sending my position ----------
  const dir = new THREE.Vector3();
  let sendT = 0, lastSent = '', heartbeat = 0;
  function sendPos(force = false) {
    camera.getWorldDirection(dir);
    const yaw = Math.atan2(-dir.x, -dir.z);
    const msg = JSON.stringify([+player.pos.x.toFixed(2), +Math.max(0, camera.position.y - EYE).toFixed(2), +player.pos.z.toFixed(2), +yaw.toFixed(2), talking ? 1 : 0]);
    if (!force && msg === lastSent && heartbeat < 1) return;
    lastSent = msg; heartbeat = 0;
    for (const p of peers.values()) if (p.dc && p.dc.readyState === 'open') { try { p.dc.send(msg); } catch {} }
  }

  // ---------- Status ----------
  function connectedCount() { let n = 0; for (const p of peers.values()) if (p.dc && p.dc.readyState === 'open') n++; return n; }
  function refreshStatus() {
    if (!on || !uid) return;
    const n = connectedCount(), seen = peers.size;
    const lost = seen - n;
    setStatus(`<b>Connected</b> · ${n + 1} in the world${lost ? ` · ${lost} joining…` : ''} · hold <b>V</b> to talk`);
    drawHud();
  }
  function drawHud() {
    hud.classList.toggle('talk', talking);
    const n = connectedCount() + 1;
    hud.querySelector('.txt').innerHTML = hudNote || (talking ? 'Talking…' : `${n} online · hold <kbd>V</kbd> to talk`);
  }

  return {
    id: 'online', name: 'Open World',
    desc: 'Explore with other people online. Hold V to talk.',
    start() {
      on = true; box.classList.add('show'); hud.classList.add('show'); if (touch) pttBtn.classList.add('show');
      drawHud(); connect();
    },
    stop() {
      on = false; setTalk(false); box.classList.remove('show'); hud.classList.remove('show'); pttBtn.classList.remove('show');
      disconnect();
    },
    update(dt) {
      if (!on) return;
      for (const p of peers.values()) p.avatar.update(dt);
      sendT += dt; heartbeat += dt;
      if (sendT >= 1 / SEND_HZ) { sendT = 0; sendPos(); }
      if (hudNote && (hudT += dt) > 5) { hudNote = ''; hudT = 0; drawHud(); }
    },
    prompt() { return ''; },
  };
}
let hudT = 0;

// ---------- Avatar: a simple capsule person with a visor (shows facing) and a floating name tag ----------
function makeAvatar(name, color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.85, 6, 14), bodyMat);
  body.position.y = 0.24 + 0.425 + 0.02;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), new THREE.MeshStandardMaterial({ color: '#f1d3b8', roughness: 0.7 }));
  head.position.y = 1.5;
  head.castShadow = true;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.08), new THREE.MeshStandardMaterial({ color: '#15171c', roughness: 0.2, metalness: 0.4 }));
  visor.position.set(0, 1.53, -0.14);
  group.add(body, head, visor);

  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  tag.scale.set(1.1, 0.275, 1);
  tag.position.y = 1.95;
  tag.renderOrder = 10;
  group.add(tag);
  let curName = name, curColor = color, talk = false;
  function drawTag() {
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, 512, 128);
    g.font = '700 54px system-ui, sans-serif';
    const w = Math.min(500, g.measureText(curName).width + (talk ? 110 : 60));
    const x0 = (512 - w) / 2;
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.beginPath(); g.roundRect(x0, 20, w, 88, 44); g.fill();
    g.fillStyle = curColor; g.beginPath(); g.arc(x0 + 36, 64, 12, 0, Math.PI * 2); g.fill();
    if (talk) { g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(x0 + w - 36, 64, 14, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillText(curName, x0 + 58, 66, w - (talk ? 120 : 70));
    tex.needsUpdate = true;
  }
  drawTag();

  const to = new THREE.Vector3(), cur = new THREE.Vector3();
  let toYaw = 0, yaw = 0, started = false, bobT = 0, voice = null;
  return {
    group,
    setLook(n, c) { curName = n || curName; curColor = c || curColor; bodyMat.color.set(curColor); drawTag(); },
    setVoice(v) { if (voice) { voice.disconnect?.(); head.remove(voice); } voice = v; head.add(v); },
    target(x, y, z, yw, t) {
      to.set(x, y, z); toYaw = yw;
      if (!started) { cur.copy(to); yaw = yw; started = true; group.visible = true; }
      if (t !== talk) { talk = t; drawTag(); }
    },
    update(dt) {
      if (!started) return;
      const k = 1 - Math.exp(-12 * dt);
      const moving = cur.distanceToSquared(to) > 0.0004;
      cur.lerp(to, k);
      let d = toYaw - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * k;
      if (moving) bobT += dt * 9;
      group.position.set(cur.x, cur.y + (moving ? Math.abs(Math.sin(bobT)) * 0.04 : 0), cur.z);
      group.rotation.y = yaw;
    },
    dispose() {
      if (voice) { try { voice.disconnect(); } catch {} }
      group.removeFromParent();
      group.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
    },
  };
}
