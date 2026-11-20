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
const NAME_KEY = 'pixbit-online-name', COLOR_KEY = 'pixbit-online-color', MIC_KEY = 'pixbit-online-mic';
const EYE = 1.65;

const CSS = `
  .ow { width: 100%; margin-top: 14px; display: none; flex-direction: column; gap: 8px; cursor: default; }
  .ow.show { display: flex; }
  .ow-row { display: flex; align-items: center; gap: 10px; }
  .ow label { width: 66px; flex: none; font: 700 12px system-ui, sans-serif; text-transform: uppercase; letter-spacing: 1px; color: #ecc828; }
  .ow input { flex: 1; min-width: 0; padding: 8px 12px; border-radius: 10px; border: 1.5px solid rgba(255,255,255,.25); background: rgba(20,20,24,.7);
    color: #fff; font: 600 15px system-ui, sans-serif; outline: none; }
  .ow input:focus { border-color: #ecc828; }
  .ow input::placeholder { color: rgba(255,255,255,.45); font-weight: 500; }
  .ow input.need { border-color: #ff6b6b; box-shadow: 0 0 0 3px rgba(255,107,107,.25); animation: ow-shake .35s; }
  @keyframes ow-shake { 20%, 60% { transform: translateX(-5px); } 40%, 80% { transform: translateX(5px); } }
  .ow-dot { width: 22px; height: 22px; flex: none; border-radius: 50%; border: 2px solid rgba(255,255,255,.7); cursor: pointer; }
  .ow-seg { display: flex; gap: 6px; flex: 1; }
  .ow-seg button { flex: 1; padding: 7px 8px; border-radius: 10px; cursor: pointer; background: rgba(30,30,34,.6); border: 1.5px solid rgba(255,255,255,.2);
    color: #fff; font: 700 13px system-ui, sans-serif; white-space: nowrap; }
  .ow-seg button:hover { border-color: rgba(255,255,255,.5); }
  .ow-seg button.on { background: linear-gradient(180deg, #ffd52e, #e9b800); border-color: #ffe36b; color: #111; }
  .ow-edit { flex: 1; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 10px; cursor: pointer; text-align: left;
    background: rgba(30,30,34,.6); border: 1.5px solid rgba(255,255,255,.25); color: #fff; font: 700 14px system-ui, sans-serif; }
  .ow-gear.on { border-color: #ecc828; }
  .ow-edit:hover { border-color: #ecc828; }
  .ow-edit .ow-who { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ow-edit .go { color: #ecc828; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
  #ow-char { position: fixed; z-index: 12; right: 4vw; top: 50%; transform: translateY(-50%); width: 310px; box-sizing: border-box; padding: 22px; display: none;
    flex-direction: column; gap: 10px; border-radius: 18px; color: #fff; background: rgba(20,20,24,.72); border: 1px solid rgba(255,255,255,.14);
    box-shadow: -4px -4px 0 -1px #ecc828, 0 20px 50px rgba(0,0,0,.5); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); font-family: system-ui, sans-serif; }
  #ow-char.show { display: flex; }
  #ow-char h3 { margin: 0; font-size: 20px; color: #ecc828; }
  #ow-char p { margin: 0 0 4px; font-size: 13px; color: rgba(255,255,255,.65); }
  #ow-char label { font: 700 12px system-ui, sans-serif; text-transform: uppercase; letter-spacing: 1px; color: #ecc828; margin-top: 4px; }
  #ow-char input[type=text] { padding: 10px 12px; border-radius: 10px; border: 1.5px solid rgba(255,255,255,.25); background: rgba(10,10,14,.7);
    color: #fff; font: 600 16px system-ui, sans-serif; outline: none; }
  #ow-char input[type=text]:focus { border-color: #ecc828; }
  #ow-char input.need { border-color: #ff6b6b; box-shadow: 0 0 0 3px rgba(255,107,107,.25); animation: ow-shake .35s; }
  #ow-char .sw { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  #ow-char .sw button { width: 30px; height: 30px; border-radius: 50%; padding: 0; cursor: pointer; border: 2px solid rgba(255,255,255,.35); }
  #ow-char .sw button.on { border-color: #fff; box-shadow: 0 0 0 2px #ecc828; }
  #ow-char .sw input[type=color] { width: 34px; height: 34px; padding: 0; border: 0; background: none; cursor: pointer; }
  #ow-char .acts { display: flex; gap: 8px; margin-top: 10px; }
  #ow-char .acts button { flex: 1; padding: 11px; border-radius: 12px; cursor: pointer; font: 800 15px system-ui, sans-serif; color: #fff;
    background: rgba(40,40,46,.8); border: 1.5px solid rgba(255,255,255,.25); }
  #ow-char .acts .done { flex: 2; background: linear-gradient(180deg, #ffd52e, #e9b800); border-color: #ffe36b; color: #111; }
  @media (max-width: 700px) { #ow-char { right: 50%; transform: translateX(50%); top: auto; bottom: 12px; width: min(340px, 94vw); padding: 14px; } }
  .ow-status { font: 500 13px system-ui, sans-serif; color: rgba(255,255,255,.75); }
  .ow-status b { color: #7ee08f; }
  .ow-status.err b { color: #ff8a80; }
  #ow-hud { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 8; display: none; align-items: center; gap: 10px;
    padding: 6px 14px; border-radius: 20px; background: rgba(0,0,0,.5); color: #fff; font: 600 13px system-ui, sans-serif; pointer-events: none; }
  #ow-hud.show { display: flex; }
  #ow-hud .mic { width: 10px; height: 10px; border-radius: 50%; background: #777; }
  #ow-hud.live .mic { background: #7ee08f; }
  #ow-hud.talk .mic { background: #ff4d4d; box-shadow: 0 0 10px #ff4d4d; }
  #ow-hud .ow-mode { pointer-events: auto; cursor: pointer; padding: 3px 9px; border-radius: 12px; border: 1px solid rgba(236,200,40,.7);
    background: rgba(236,200,40,.15); color: #ecc828; font: 700 12px system-ui, sans-serif; white-space: nowrap; }
  #ow-hud .ow-mode:hover { background: rgba(236,200,40,.3); }
  #ow-hud kbd { background: #333; border: 1px solid #666; border-radius: 4px; padding: 0 5px; font: 700 11px system-ui; }
  #ow-ptt { position: fixed; z-index: 7; right: max(84px, calc(env(safe-area-inset-right) + 66px)); bottom: max(26px, env(safe-area-inset-bottom));
    width: 54px; height: 54px; border-radius: 50%; border: 2px solid rgba(255,255,255,.55); background: rgba(20,20,20,.5); color: #fff;
    display: none; align-items: center; justify-content: center; touch-action: none; user-select: none; -webkit-user-select: none; }
  #ow-ptt.show { display: flex; }
  #ow-ptt.on { background: rgba(255,77,77,.8); }
  #ow-ptt.muted::after { content: ''; position: absolute; width: 34px; height: 2.5px; background: #fff; transform: rotate(-45deg); border-radius: 2px; }
  #ow-ptt svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; pointer-events: none; }
`;

export function initOnline({ scene, camera, player, panel, touch = false }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);

  // ---------- Menu panel (shown while Open World is the selected mode) ----------
  let myName = '', myColor = '';
  try { myName = localStorage.getItem(NAME_KEY) || ''; myColor = localStorage.getItem(COLOR_KEY) || ''; } catch {}
  if (!/^#[0-9a-f]{6}$/i.test(myColor)) myColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  const box = document.createElement('div');
  box.className = 'ow';
  box.innerHTML = `
    <div class="ow-row"><label>Menu</label><button type="button" class="ow-edit"><span class="ow-dot"></span><span class="ow-who"></span><span class="go">Character</span></button>
      <button type="button" class="ow-edit ow-gear" style="flex:none"><span class="go">Settings</span></button></div>
    <div class="ow-set" style="display:none"><div class="ow-row"><label>Mic</label><div class="ow-seg"><button type="button" data-m="ptt">Push to talk</button><button type="button" data-m="open">Always on</button></div></div></div>
    <div class="ow-row"><label>Online</label><span class="ow-status"></span></div>`;
  panel.insertBefore(box, panel.querySelector('.m-hint'));
  const statusEl = box.querySelector('.ow-status'), editBtn = box.querySelector('.ow-edit'), dot = box.querySelector('.ow-dot'), whoEl = box.querySelector('.ow-who');
  const setEl = box.querySelector('.ow-set'), gearBtn = box.querySelector('.ow-gear');
  gearBtn.addEventListener('click', () => { const open = setEl.style.display === 'none'; setEl.style.display = open ? 'block' : 'none'; gearBtn.classList.toggle('on', open); });
  box.addEventListener('click', (e) => e.stopPropagation()); // don't start the game while using the menu rows
  const overlayEl = () => panel.closest('#overlay');
  function drawWho() { dot.style.background = myColor; whoEl.textContent = myName || 'New'; }
  drawWho();
  editBtn.addEventListener('click', () => openCreator());

  // ---------- Character screen: third-person front view + name + dress colour (first visit, and Esc menu -> Edit character) ----------
  const charEl = document.createElement('div');
  charEl.id = 'ow-char';
  charEl.innerHTML = `
    <h3>Your character</h3><p>Pick a name and a dress colour</p>
    <label for="ow-name">Name</label><input type="text" id="ow-name" maxlength="18" autocomplete="off" spellcheck="false" placeholder="Type your name">
    <label>Dress colour</label><div class="sw"></div>
    <div class="acts"><button type="button" class="back">Back</button><button type="button" class="done">Done</button></div>`;
  document.body.appendChild(charEl);
  const nameIn = charEl.querySelector('input[type=text]'), swEl = charEl.querySelector('.sw');
  let draftColor = myColor;
  const swBtns = COLORS.map((c) => {
    const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.dataset.c = c; b.title = c; swEl.appendChild(b);
    b.addEventListener('click', () => setDraft(c)); return b;
  });
  const pick = document.createElement('input'); pick.type = 'color'; pick.title = 'Custom colour'; swEl.appendChild(pick);
  pick.addEventListener('input', () => setDraft(pick.value));
  function setDraft(c) {
    draftColor = c; pick.value = c;
    for (const b of swBtns) b.classList.toggle('on', b.dataset.c === c);
    if (preview) preview.setLook(null, c);
  }
  charEl.addEventListener('click', (e) => e.stopPropagation());
  nameIn.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') e.stopPropagation();
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); finishCreator(); }
  });
  nameIn.addEventListener('keyup', (e) => e.stopPropagation());
  nameIn.addEventListener('input', () => { nameIn.classList.remove('need'); if (preview) preview.setLook(nameIn.value.trim() || 'Your name', null); });
  charEl.querySelector('.done').addEventListener('click', finishCreator);
  charEl.querySelector('.back').addEventListener('click', () => closeCreator(true));
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && creating) closeCreator(true); });

  let creating = false, preview = null, camYaw = 0;
  const savedPos = new THREE.Vector3(), savedQuat = new THREE.Quaternion();
  function openCreator() {
    if (creating) return;
    creating = true;
    camera.getWorldDirection(meDir); camYaw = Math.atan2(-meDir.x, -meDir.z);
    savedPos.copy(camera.position); savedQuat.copy(camera.quaternion);
    nameIn.value = myName; nameIn.classList.remove('need');
    preview = makeAvatar(myName || 'Your name', myColor);
    scene.add(preview.group);
    me.group.visible = false;
    setDraft(myColor);
    const ov = overlayEl(); if (ov) ov.classList.add('hidden');
    charEl.classList.add('show');
    setTimeout(() => nameIn.focus(), 0);
  }
  /** back = true: discard changes and return to the menu. */
  function closeCreator(back) {
    if (!creating) return;
    creating = false;
    charEl.classList.remove('show'); nameIn.blur();
    scene.remove(preview.group); preview.dispose(); preview = null;
    camera.position.copy(savedPos); camera.quaternion.copy(savedQuat);
    me.group.visible = true;
    const ov = overlayEl(); if (back && ov) ov.classList.remove('hidden');
  }
  function finishCreator() {
    if (!nameIn.value.trim()) { needName(); return; }
    myColor = draftColor;
    try { localStorage.setItem(COLOR_KEY, myColor); } catch {}
    me.setLook(null, myColor);
    saveName();
    drawWho();
    closeCreator(false);
    const ov = overlayEl(); if (ov) ov.click(); // start playing in first person
  }
  /** Take the typed name; join the world the first time a name is set. Returns false while it's empty. */
  function saveName() {
    const n = nameIn.value.trim().replace(/\s+/g, ' ').slice(0, 18);
    nameIn.value = n;
    if (!n) return false;
    const first = !myName || !uid;
    myName = n;
    try { localStorage.setItem(NAME_KEY, myName); } catch {}
    if (on && first && !uid && !connecting) connect(); else publishMe();
    return true;
  }
  function needName() {
    if (!creating) { openCreator(); return; }
    nameIn.classList.remove('need'); void nameIn.offsetWidth; nameIn.classList.add('need');
    setTimeout(() => nameIn.focus(), 0);
  }
  function setStatus(html, err = false) { statusEl.innerHTML = html; statusEl.classList.toggle('err', err); }

  // ---------- In-game HUD pill + touch talk button ----------
  const hud = document.createElement('div'); hud.id = 'ow-hud';
  hud.innerHTML = '<span class="mic"></span><span class="txt"></span><button type="button" class="ow-mode"></button>';
  const modeChip = hud.querySelector('.ow-mode');
  document.body.appendChild(hud);
  const pttBtn = document.createElement('button'); pttBtn.id = 'ow-ptt'; pttBtn.type = 'button'; pttBtn.setAttribute('aria-label', 'Hold to talk');
  pttBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  document.body.appendChild(pttBtn);
  // push to talk: hold the button; always on: tap it to mute / unmute
  pttBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (micMode === 'ptt') setHeld(true); else setMuted(!muted); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) pttBtn.addEventListener(ev, () => setHeld(false));

  // ---------- Your own body, seen when you look down (every mode, in your colour) ----------
  const me = makeAvatar('', myColor, { self: true });
  scene.add(me.group);
  const meDir = new THREE.Vector3();
  function updateSelf(dt, reach = null) {
    if (creating) { // third-person front view of your character while you pick a name + colour
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      preview.target(player.pos.x, 0, player.pos.z, camYaw, false);
      preview.update(dt);
      camera.position.set(player.pos.x + fx * 2.4, 1.35, player.pos.z + fz * 2.4);
      camera.lookAt(player.pos.x, 1.0, player.pos.z);
      return;
    }
    camera.getWorldDirection(meDir);
    me.target(player.pos.x, Math.max(0, camera.position.y - EYE), player.pos.z, Math.atan2(-meDir.x, -meDir.z), false);
    me.setReach(reach?.aim, reach?.k || 0);
    me.update(dt);
  }

  // ---------- State ----------
  let on = false, fb = null, db = null, uid = null, unsubs = [], connecting = false;
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
    if (!myName) return;
    connecting = true;
    try { await doConnect(); } finally { connecting = false; }
  }
  async function doConnect() {
    if (!isConfigured() && !window.__owFake) { setStatus('<b>Not set up yet</b> · add your Firebase config (see MULTIPLAYER.md)', true); return; }
    setStatus('Connecting…');
    try {
      await loadFirebase();
      db = fb.getDatabase(fb.auth.app);
      const cred = await fb.signIn(fb.auth);
      if (!on) return;
      uid = cred.user.uid;
      if (micMode === 'open') getMic().then(() => refreshMic()); // always on: ask for the mic as you join, not mid-walk
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
      mic.enabled = false;
      for (const p of peers.values()) for (const t of p.pc.getTransceivers()) if (t.receiver.track.kind === 'audio' && t.currentDirection !== 'stopped') t.sender.replaceTrack(mic);
      // level meter, so "always on" only shows the talking dot while you actually speak
      const ctx = ensureListener().context;
      micSrc = ctx.createMediaStreamSource(new MediaStream([mic]));
      meter = ctx.createAnalyser(); meter.fftSize = 512;
      micSrc.connect(meter);
    } catch (e) {
      console.warn('[online] mic', e);
      hudNote = 'Microphone blocked: allow it in the browser to talk';
    }
    return mic;
  }
  let hudNote = '';

  // Mic mode: 'ptt' = hold V (or the mic button) to talk; 'open' = mic is live while you're in the game, V / mic button mutes.
  let micMode = 'open', held = false, muted = false, inGame = false, speaking = false, quietT = 0, micSrc = null, meter = null;
  try { if (localStorage.getItem(MIC_KEY) === 'ptt') micMode = 'ptt'; } catch {} // default: always on
  const segBtns = box.querySelectorAll('.ow-seg button');
  function drawSeg() { for (const b of segBtns) b.classList.toggle('on', b.dataset.m === micMode); }
  /** Switch mic mode (menu buttons, the T key and the chip on the in-game bar all land here). */
  function setMode(m) {
    if (m === micMode) return;
    micMode = m; muted = false; held = false;
    try { localStorage.setItem(MIC_KEY, micMode); } catch {}
    if (micMode === 'open' && on) getMic().then(refreshMic);
    drawSeg(); refreshMic(); refreshStatus();
  }
  for (const b of segBtns) b.addEventListener('click', () => setMode(b.dataset.m));
  drawSeg();
  modeChip.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); setMode(micMode === 'ptt' ? 'open' : 'ptt'); });
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyT' && !e.repeat && on && !typing(e)) setMode(micMode === 'ptt' ? 'open' : 'ptt');
  });
  const live = () => on && (micMode === 'ptt' ? held : inGame && !muted);
  /** Turn the mic track on/off from the current mode + keys, and tell the others whether I'm talking. */
  function refreshMic() {
    const want = live();
    ensureListener();
    if (want && !mic) getMic().then(() => { if (mic) refreshMic(); });
    if (mic) mic.enabled = want;
    const t = micMode === 'ptt' ? want : want && speaking;
    pttBtn.classList.toggle('on', micMode === 'ptt' ? held : want);
    pttBtn.classList.toggle('muted', micMode === 'open' && muted);
    pttBtn.setAttribute('aria-label', micMode === 'ptt' ? 'Hold to talk' : muted ? 'Unmute' : 'Mute');
    if (t !== talking) { talking = t; sendPos(true); }
    drawHud();
  }
  function setHeld(v) { if (micMode === 'ptt' && v !== held) { held = v; refreshMic(); } }
  function setMuted(v) { if (micMode === 'open' && v !== muted) { muted = v; refreshMic(); } }
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || player.state.paused;
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyV' || e.repeat || typing(e) || !on) return;
    if (micMode === 'ptt') setHeld(true); else setMuted(!muted);
  });
  addEventListener('keyup', (e) => { if (e.code === 'KeyV') setHeld(false); });
  addEventListener('blur', () => setHeld(false));
  const buf = new Float32Array(512);
  function meterTick(dt) { // "always on": talking dot follows your voice level, with a short hang so it doesn't flicker
    if (micMode !== 'open' || !meter || !live()) { if (speaking) { speaking = false; refreshMic(); } return; }
    meter.getFloatTimeDomainData(buf);
    let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const loud = Math.sqrt(sum / buf.length) > 0.02;
    if (loud) quietT = 0; else quietT += dt;
    const sp = loud || quietT < 0.4;
    if (sp !== speaking) { speaking = sp; refreshMic(); }
  }
  addEventListener('pointerdown', () => { if (on && listener) ensureListener(); });

  // ---------- Sending my position ----------
  const dir = new THREE.Vector3();
  let sendT = 0, lastSent = '', heartbeat = 0;
  function sendPos(force = false) {
    if (creating) return;
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
    setStatus(`<b>Connected</b> · ${n + 1} in the world${lost ? ` · ${lost} joining…` : ''} · ${micMode === 'ptt' ? 'hold <b>V</b> to talk' : 'mic on in game, <b>V</b> mutes'}`);
    drawHud();
  }
  function drawHud() {
    modeChip.innerHTML = `${micMode === 'ptt' ? 'Push to talk' : 'Always on'}${touch ? '' : ' <kbd>T</kbd>'}`;
    modeChip.title = 'Switch between push to talk and always-on mic';
    hud.classList.toggle('talk', talking);
    hud.classList.toggle('live', !talking && micMode === 'open' && live() && !!mic);
    const n = connectedCount() + 1;
    const idle = micMode === 'ptt' ? `${n} online · hold <kbd>V</kbd> to talk`
      : muted ? `${n} online · mic muted · <kbd>V</kbd> to unmute` : `${n} online · mic on · <kbd>V</kbd> to mute`;
    const blocked = micAsked && !mic; // the browser refused the microphone
    hud.querySelector('.txt').innerHTML = hudNote || (blocked ? `${n} online · microphone blocked: allow it in the browser to talk` : talking ? 'Talking…' : idle);
  }

  return {
    id: 'online', name: 'Open World',
    desc: 'Explore with other people online and talk: push to talk or always-on mic.',
    start() {
      on = true; box.classList.add('show'); hud.classList.add('show'); if (touch) pttBtn.classList.add('show');
      drawHud();
      if (myName) connect(); else setStatus('Click <b>Play</b> to create your character and join');
    },
    /** The menu asks before starting the game: Open World needs a name first. */
    canStart() { if (myName) return true; openCreator(); return false; },
    stop() {
      on = false; held = false; refreshMic(); box.classList.remove('show'); hud.classList.remove('show'); pttBtn.classList.remove('show');
      closeCreator(false);
      disconnect();
    },
    update(dt, active) {
      if (!on) return;
      const ig = !!active && !creating;
      if (ig !== inGame) { inGame = ig; if (!inGame) held = false; refreshMic(); } // menu open = mic off
      meterTick(dt);
      for (const p of peers.values()) p.avatar.update(dt);
      sendT += dt; heartbeat += dt;
      if (sendT >= 1 / SEND_HZ) { sendT = 0; sendPos(); }
      if (hudNote && (hudT += dt) > 5) { hudNote = ''; hudT = 0; drawHud(); }
    },
    prompt() { return ''; },
    updateSelf,
  };
}
let hudT = 0;

// ---------- Avatar: a rounded figure (capsule body, round head with a visor, capsule arms + legs) that swings as it walks ----------
const SKIN = '#f1d3b8', PANTS = '#2b3550', SHOES = '#1c1c20';
/** self: your own body in first person: no head, chest or name tag, pinned to you with no smoothing. */
export function makeAvatar(name, color, { self = false } = {}) {
  const group = new THREE.Group();
  const mat = (c, r = 0.65, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const shirtMat = mat(color, 0.6), skinMat = mat(SKIN, 0.7), pantsMat = mat(PANTS, 0.8), shoeMat = mat(SHOES, 0.5);
  const add = (parent, geo, m, x, y, z) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o;
  };
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);
  // limbs hang from a pivot (hip / shoulder) so they can swing; the figure faces -z (the way the player looks)
  const pivot = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); group.add(p); return p; };
  const HIP = 0.8, SHOULDER = 1.47;
  const legL = pivot(-0.1, HIP), legR = pivot(0.1, HIP);
  for (const leg of [legL, legR]) {
    add(leg, capsule(0.085, 0.6), pantsMat, 0, -0.385, 0);
    add(leg, new THREE.SphereGeometry(0.1, 16, 10), shoeMat, 0, -0.77, -0.04).scale.set(1, 0.55, 1.45);
  }
  const torso = add(group, capsule(0.22, 0.4), shirtMat, 0, 1.17, 0);
  const armL = pivot(-0.29, SHOULDER), armR = pivot(0.29, SHOULDER);
  for (const arm of [armL, armR]) {
    add(arm, capsule(0.065, 0.48), shirtMat, 0, -0.27, 0);
    add(arm, new THREE.SphereGeometry(0.07, 16, 12), skinMat, 0, -0.6, 0);   // hand
  }
  const head = new THREE.Group(); head.position.y = 1.62; group.add(head);
  add(head, new THREE.SphereGeometry(0.17, 24, 16), skinMat, 0, 0.13, 0);
  add(head, new THREE.BoxGeometry(0.22, 0.07, 0.08), mat('#15171c', 0.2, 0.4), 0, 0.16, -0.14); // visor: shows which way they face
  if (self) {
    // first person: no head, and no chest (it would fill the screen when you look down). A round seat of hips joins
    // the legs, and everything sits slightly forward so your feet show and your arms swing at the edges of the view.
    head.visible = false; torso.visible = false;
    add(group, new THREE.SphereGeometry(0.2, 18, 12), pantsMat, 0, HIP + 0.02, 0).scale.set(1.05, 0.55, 0.75);
    for (const c of group.children) { c.position.z -= 0.08; c.position.y -= 0.08; }
  }
  const ARM = 0.6; // shoulder to hand centre

  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  tag.scale.set(1.1, 0.275, 1);
  tag.position.y = 2.2;
  tag.renderOrder = 10;
  tag.visible = !self;
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

  const to = new THREE.Vector3(), cur = new THREE.Vector3(), prev = new THREE.Vector3();
  let toYaw = 0, yaw = 0, started = false, voice = null, phase = 0, speed = 0, swing = 0, talkT = 0;
  // reaching: the right arm points its hand at a world point (fingerprint reader), blended in by reachK 0..1
  let reachK = 0;
  const reachAim = new THREE.Vector3(), sh = new THREE.Vector3(), dir = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
  const qPoint = new THREE.Quaternion(), qInv = new THREE.Quaternion();
  return {
    group,
    setLook(n, c) { curName = n || curName; curColor = c || curColor; shirtMat.color.set(curColor); drawTag(); },
    /** Point the right hand at `aim` (world space); k 0 = arm down, 1 = hand on the target. */
    setReach(aim, k) { reachK = k; if (aim) reachAim.copy(aim); },
    setVoice(v) { if (voice) { voice.disconnect?.(); head.remove(voice); } voice = v; head.add(v); },
    target(x, y, z, yw, t) {
      to.set(x, y, z); toYaw = yw;
      if (!started) { cur.copy(to); prev.copy(to); yaw = yw; started = true; group.visible = true; }
      if (t !== talk) { talk = t; drawTag(); }
    },
    update(dt) {
      if (!started || dt <= 0) return;
      const k = self ? 1 : 1 - Math.exp(-12 * dt);
      prev.copy(cur);
      cur.lerp(to, k);
      let d = toYaw - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * k;
      // walking speed on the ground, smoothed; drives the arm / leg swing
      const v = Math.hypot(cur.x - prev.x, cur.z - prev.z) / dt;
      speed += (v - speed) * (1 - Math.exp(-8 * dt));
      const air = cur.y > 0.05;
      phase += dt * (3 + speed * 2.2);
      const amp = air ? 0 : Math.min(1, speed / 3) * 0.75;   // walk ~0.45 rad, run up to 0.75
      swing += (Math.sin(phase) * amp - swing) * (1 - Math.exp(-14 * dt));
      legL.rotation.x = swing; legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.9; armR.rotation.x = swing * 0.9;
      const lift = air ? -0.5 : 0;                              // arms out a little while jumping
      armL.rotation.z = air ? -0.35 : 0; armR.rotation.z = air ? 0.35 : 0;
      armL.rotation.x += lift; armR.rotation.x += lift;
      talkT += dt;
      head.rotation.z = talk ? Math.sin(talkT * 7) * 0.03 : 0;  // a little nod while talking
      armR.scale.y = 1;
      if (reachK > 0) {
        group.position.set(cur.x, cur.y, cur.z); group.rotation.y = yaw; group.updateMatrixWorld(true);
        armR.getWorldPosition(sh);
        dir.subVectors(reachAim, sh);
        const dist = dir.length();
        dir.applyQuaternion(qInv.copy(group.quaternion).invert()).normalize(); // into the figure's own space
        qPoint.setFromUnitVectors(down, dir);
        armR.quaternion.slerp(qPoint, reachK);
        armR.scale.y = 1 + (Math.min(1.9, Math.max(1, dist / ARM)) - 1) * reachK; // stretch the last bit if the reader is out of reach
      }
      const bob = air ? 0 : Math.abs(Math.sin(phase)) * Math.min(1, speed / 3) * 0.05;
      group.position.set(cur.x, cur.y + bob, cur.z);
      group.rotation.y = yaw;
    },
    dispose() {
      if (voice) { try { voice.disconnect(); } catch {} }
      group.removeFromParent();
      group.traverse((o) => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
    },
  };
}
