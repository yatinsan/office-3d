import * as THREE from 'three';
import hideseek from './games/hideseek.js';
import prophunt from './games/prophunt.js';
import * as sfx from './sfx.js';
import { achievements } from './achievements.js';
import { blocked } from './colliders.js';

/**
 * In-world games. Press G: a list of every game in the room (OPEN / IN PROGRESS), Create game, Join, Start.
 * No server: every client keeps the same list from {t:'game'} messages on the event channel (src/online.js).
 * Once the host starts a game it is locked; everybody else keeps walking around and watching (a ring on the
 * players' name tags + a small scoreboard) until it ends. The host is only the referee (decides when it is over).
 *
 * A game type (src/games/*.js) = { id, name, min, max, blurb, init, tick, onHit, hostTick, badge, hud, summary, ... }.
 */
const TYPES = [hideseek, prophunt];
const MAX_CLONES = 3;
const typeOf = (g) => TYPES.find((t) => t.id === g.type) || TYPES[0];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
  #g-panel { position: fixed; z-index: 12; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(460px, 92vw); display: none;
    padding: 16px 18px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,.16); background: rgba(14,14,18,.86); color: #fff;
    font: 500 14px system-ui, sans-serif; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
  #g-panel.show { display: block; }
  #g-panel .g-t { font: 700 13px system-ui, sans-serif; letter-spacing: 4px; text-transform: uppercase; color: #ecc828; margin: 0 0 10px; }
  #g-panel .g-info { color: rgba(255,255,255,.7); margin: 0 0 8px; font-size: 13px; }
  #g-panel .g-i { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 12px; margin: 0 0 6px; border-radius: 8px;
    border: 1px solid rgba(255,255,255,.14); cursor: pointer; }
  #g-panel .g-i small { display: block; color: rgba(255,255,255,.55); font-size: 12px; margin-top: 1px; }
  #g-panel .g-i.sel { border-color: #ecc828; color: #ecc828; background: rgba(236,200,40,.08); }
  #g-panel .g-i.off { opacity: .55; }
  #g-panel .g-tag { font: 700 11px system-ui, sans-serif; letter-spacing: 1px; padding: 3px 7px; border-radius: 5px; background: rgba(126,224,143,.18); color: #7ee08f; white-space: nowrap; }
  #g-panel .g-tag.run { background: rgba(255,92,92,.18); color: #ff9a9a; }
  #g-panel .g-keys { margin: 8px 0 0; font-size: 12px; color: rgba(255,255,255,.4); letter-spacing: .5px; }
  #g-toast { position: fixed; z-index: 10; left: 50%; top: 14%; transform: translateX(-50%); padding: 9px 18px; border-radius: 22px; max-width: 90vw; text-align: center;
    background: rgba(14,14,18,.78); border: 1px solid rgba(236,200,40,.6); color: #fff; font: 700 15px system-ui, sans-serif; letter-spacing: .5px;
    pointer-events: none; opacity: 0; transition: opacity .25s; }
  #g-toast.show { opacity: 1; }
  #g-invite { position: fixed; z-index: 9; left: 50%; top: 18%; transform: translateX(-50%); display: none; min-width: min(340px, 86vw); box-sizing: border-box;
    padding: 18px 22px; text-align: center; color: #fff; font: 600 15px system-ui, sans-serif; background: rgba(20,20,22,.94);
    border: 1px solid #ecc828; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
  #g-invite.show { display: block; }
  #g-invite .gi-t { font-size: 12px; letter-spacing: 1px; color: #ecc828; text-transform: uppercase; margin-bottom: 6px; }
  #g-invite .gi-n { font-size: 20px; margin-bottom: 4px; }
  #g-invite .gi-d { font-weight: 400; font-size: 13px; color: #bbb; margin-bottom: 14px; }
  #g-invite .gi-b { display: flex; gap: 10px; justify-content: center; }
  #g-invite button { border: 0; border-radius: 9px; padding: 9px 22px; font: 700 14px system-ui, sans-serif; cursor: pointer; }
  #g-invite .gi-join { background: #ecc828; color: #1a1a1a; }
  #g-invite .gi-close { background: rgba(255,255,255,.14); color: #fff; }
  #g-invite .gi-k { margin-top: 10px; font-weight: 400; font-size: 12px; color: #999; }
  #g-hud { position: fixed; z-index: 6; right: max(14px, env(safe-area-inset-right)); top: 12px; display: none; padding: 6px 12px; border-radius: 12px;
    background: rgba(14,14,18,.62); border: 1px solid rgba(255,255,255,.14); color: rgba(255,255,255,.85); font: 600 12px system-ui, sans-serif; pointer-events: none; }
  #g-hud { top: 58px; } /* clear of the people-online chip */
  body.ow-touch #g-hud { top: 58px; right: max(18px, env(safe-area-inset-right)); } /* clear of the full-screen button */
  body.ow-touch #g-invite { top: 12%; }
  #g-hud b { color: #ecc828; font-weight: 700; }
  #g-blind { position: fixed; inset: 0; z-index: 7; background: #000; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
    color: #fff; font: 700 22px system-ui, sans-serif; letter-spacing: 3px; text-transform: uppercase; pointer-events: none; }
  #g-blind small { font-size: 40px; color: #ecc828; }
  #g-result { position: fixed; inset: 0; z-index: 11; pointer-events: none; opacity: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 16px; box-sizing: border-box;
    font: 900 clamp(38px, 9vw, 104px) Impact, "Arial Narrow", "Arial Black", sans-serif; text-transform: uppercase; letter-spacing: 3px; color: #ecc828;
    text-shadow: 4px 4px 0 #000, -2px -2px 0 #000, 0 0 28px rgba(236,200,40,.5); background: rgba(0,0,0,.45); transition: opacity .4s; }
  #g-result.show { opacity: 1; }
`;

export function initGames({ online, player, scene, camera }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const panel = Object.assign(document.createElement('div'), { id: 'g-panel' });
  const toastEl = Object.assign(document.createElement('div'), { id: 'g-toast' });
  const hudEl = Object.assign(document.createElement('div'), { id: 'g-hud' });
  const blindEl = Object.assign(document.createElement('div'), { id: 'g-blind' });
  const resultEl = Object.assign(document.createElement('div'), { id: 'g-result' });
  const inviteEl = Object.assign(document.createElement('div'), { id: 'g-invite' });
  document.body.append(panel, toastEl, hudEl, blindEl, resultEl, inviteEl);
  panel.addEventListener('click', (e) => e.stopPropagation());
  for (const ev of ['click', 'mousedown', 'pointerdown', 'touchstart']) inviteEl.addEventListener(ev, (e) => e.stopPropagation());

  // ---------- invite dialog: when someone creates a game everyone else gets Join / Close ----------
  const overlayEl = document.getElementById('overlay');
  let inviteId = null, inviteT = 0;
  const menuOpen = () => !!overlayEl && !overlayEl.classList.contains('hidden');
  function hideInvite() { inviteId = null; clearTimeout(inviteT); inviteEl.classList.remove('show'); }
  function showInvite(g) {
    const t = typeOf(g);
    inviteId = g.id;
    inviteEl.innerHTML = `<div class="gi-t">Game invite</div><div class="gi-n">${esc(g.hostName)} created ${esc(t.name)}</div><div class="gi-d">${esc(t.blurb)}</div>
      <div class="gi-b"><button type="button" class="gi-join">Join</button><button type="button" class="gi-close">Close</button></div>
      <div class="gi-k">Enter = Join &nbsp;&middot;&nbsp; N = Close</div>`;
    inviteEl.querySelector('.gi-join').addEventListener('click', joinInvite);
    inviteEl.querySelector('.gi-close').addEventListener('click', hideInvite);
    inviteEl.classList.add('show');
    clearTimeout(inviteT); inviteT = setTimeout(hideInvite, 30000);
  }
  function joinInvite() {
    const g = games.get(inviteId);
    hideInvite();
    if (g && g.phase === 'open' && !myGame() && Object.keys(g.players).length < typeOf(g).max) { act({ op: 'join', id: g.id, uid: me(), name: online.name || 'Guest' }); toast(`Joined ${typeOf(g).name}. Press G for the lobby`, 2800); }
    else toast('That game is no longer open');
  }

  const games = new Map();      // id -> { id, type, host, hostName, players{uid:name}, phase 'open'|'playing', seed, order[], seekers[], run{}, startMs }
  const me = () => online.uid();
  const now = () => performance.now();
  let open = false, view = 'list', idx = 0, cur = { info: [], items: [] }, frozen = false, hudT = 0, toastT = 0, resultT = 0;
  let stunT = 0, stunApplied = false, keyQ = []; // stunT: seconds of "can't move / punch" left; keyQ: key presses for the game types (1-5, R, ...)
  const TPP_D = 2.6, SHOT_CD = 0.55, SHOT_RANGE = 40;
  const dirV = new THREE.Vector3(), orgV = new THREE.Vector3();
  let yawSet = null; // my own facing while the prop is turned by hand (Prop Hunt), null = the camera decides
  const heldKeys = new Set();
  let camSaved = null, shotT = 0, recoil = 0, flashT = 0;
  const cloneObjs = new Map(); // clone id -> { obj, dying }: the decoy props standing in the world
  const propCache = new WeakMap(); // avatar -> disguise index currently shown (so changed() does not rebuild the prop every time)

  const myGame = () => { const m = me(); for (const g of games.values()) if (m && g.players[m]) return g; return null; };
  const playingOf = (uid) => { for (const g of games.values()) if (g.phase === 'playing' && g.players[uid]) return g; return null; };

  // ---------- helpers the game types use ----------
  function toast(text, ms = 2400) {
    toastEl.textContent = text; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms);
  }
  function showResult(text) {
    resultEl.textContent = text; resultEl.classList.add('show');
    clearTimeout(resultT); resultT = setTimeout(() => resultEl.classList.remove('show'), 3600);
    sfx.thud();
  }
  const ctx = {
    get me() { return me(); },
    el: (g) => (now() - g.startMs) / 1000,
    /** where I stand and which way I face (for dropping a clone) */
    pose() { camera.getWorldDirection(dirV); return { x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2), ry: +(yawSet ?? Math.atan2(-dirV.x, -dirV.z)).toFixed(2) }; },
    /** keys held right now (event.code) */
    held: (k) => heldKeys.has(k),
    /** face this angle (radians) instead of where the camera looks; null = follow the camera again */
    setYaw(a) { const v = a == null ? null : a; if (v !== yawSet) { yawSet = v; online.setYawOverride?.(v); } },
    toast,
    send: (op) => act(op),
    freeze(v) { frozen = !!v; syncStun(); },
    /** can't move or punch for `s` seconds */
    stun(s) { stunT = Math.max(stunT, s); syncStun(); },
    /** key presses since the last call (event.code strings); ignored while the games panel is open */
    keys() { const k = keyQ; keyQ = []; return k; },
    blind(text, sub = '') {
      if (!text) { if (blindEl.style.display !== 'none') blindEl.style.display = 'none'; return; }
      const html = `${esc(text)}<small>${esc(sub)}</small>`;
      if (blindEl.style.display !== 'flex') blindEl.style.display = 'flex';
      if (blindEl.innerHTML !== html) blindEl.innerHTML = html;
    },
  };
  /** player.state.stunned follows freeze / stun, and is only written when that changes (a knockout in combat.js sets it too) */
  function syncStun() {
    const want = frozen || stunT > 0;
    if (want !== stunApplied) { stunApplied = want; player.state.stunned = want; }
  }
  const stopEffects = () => { ctx.setYaw(null); frozen = false; stunT = 0; syncStun(); ctx.blind(null); keyQ = []; };

  // ---------- shared state: every client applies the same messages ----------
  const hydrate = (r) => ({ id: r.id, type: r.type, host: r.host, hostName: r.hostName, players: { ...r.players }, phase: r.phase, seed: r.seed || 0,
    order: r.order || [], seekers: r.seekers || [], disguise: r.disguise || {}, clones: Array.isArray(r.clones) ? r.clones : [], run: {}, startMs: r.el != null ? now() - r.el * 1000 : 0 });
  const plain = (g) => ({ id: g.id, type: g.type, host: g.host, hostName: g.hostName, players: g.players, phase: g.phase, seed: g.seed, order: g.order, seekers: g.seekers,
    disguise: g.disguise, clones: g.clones, el: g.phase === 'playing' ? ctx.el(g) : null });

  function removePlayer(g, uid) {
    if (!g.players[uid]) return;
    delete g.players[uid];
    const ids = Object.keys(g.players).sort();
    if (!ids.length) { games.delete(g.id); return; }
    if (g.host === uid) { g.host = ids[0]; g.hostName = g.players[g.host]; } // the lowest id takes over as referee
    if (g.phase === 'playing') { g.seekers = g.seekers.filter((s) => s !== uid); delete g.disguise?.[uid]; if (g.clones) g.clones = g.clones.filter((c) => c.o !== uid); typeOf(g).onLeave?.(g); }
  }
  function finish(g, result) {
    if (!games.delete(g.id)) return;
    const t = typeOf(g), mine = !!(me() && g.players[me()]);
    if (mine) { stopEffects(); showResult(t.summary(result, g)); achievements.unlock('game'); if (Object.keys(g.players).length > 1) achievements.unlock('friends'); } else toast(`${t.name}: ${t.summary(result, g)}`, 3200);
  }

  /** apply one message (mine or someone's); `from` = who sent it */
  function apply(m, from) {
    if (!m || typeof m !== 'object') return;
    const g = games.get(m.id), t = g && typeOf(g);
    switch (m.op) {
      case 'create':
        if (m.g && m.g.host === from && !games.has(m.g.id) && TYPES.some((x) => x.id === m.g.type) && m.g.players && m.g.players[from]) {
          games.set(m.g.id, hydrate({ ...m.g, phase: 'open', seed: 0, order: [], seekers: [], disguise: {}, clones: [], el: null }));
          if (from !== me()) { if (myGame() || open) toast(`${m.g.hostName} created ${typeOf(m.g).name}. Press G to see it`, 3200); else showInvite(games.get(m.g.id)); }
        }
        break;
      case 'join':
        if (g && g.phase === 'open' && m.uid === from && !g.players[from] && Object.keys(g.players).length < t.max) g.players[from] = String(m.name || 'Guest').slice(0, 18);
        break;
      case 'leave':
        if (g && m.uid === from) { if (from === me()) stopEffects(); removePlayer(g, from); }
        break;
      case 'start':
        if (g && g.phase === 'open' && from === g.host) {
          g.players = { ...g.players, ...m.players }; g.order = Array.isArray(m.order) ? m.order : Object.keys(g.players).sort();
          g.seed = m.seed | 0; g.phase = 'playing'; g.startMs = now(); g.run = {};
          t.init(g);
          if (me() && g.players[me()]) { if (open) close(); } else toast(`${t.name} started with ${g.order.length} players. Watch from outside`, 3000);
        }
        break;
      case 'caught':
        if (g && g.phase === 'playing' && m.uid === from) { t.caught?.(g, from); if (t.caughtText && from !== me()) toast(t.caughtText(g.players[from] || 'Someone'), 2200); }
        break;
      case 'disguise': // Prop Hunt: a hider picked a prop (p) and may be frozen in place (f)
        if (g && g.phase === 'playing' && m.uid === from && g.players[from] && t.props && Number.isInteger(m.p) && m.p >= 0 && m.p < t.props.length) g.disguise[from] = { p: m.p, f: m.f ? 1 : 0 };
        break;
      case 'clone': // Prop Hunt: a hider drops a copy of their prop (max 3 each, the oldest vanishes)
        if (g && g.phase === 'playing' && t.props && m.uid === from && g.players[from] && !g.seekers.includes(from) && Number.isInteger(m.p) && m.p >= 0 && m.p < t.props.length
          && typeof m.cid === 'string' && m.cid.length < 32 && [m.x, m.z, m.ry].every((n) => Number.isFinite(n) && Math.abs(n) < 500) && !g.clones.some((c) => c.id === m.cid)) {
          g.clones.push({ id: m.cid, o: from, p: m.p, x: m.x, z: m.z, ry: m.ry });
          const mine = g.clones.filter((c) => c.o === from);
          if (mine.length > MAX_CLONES) g.clones = g.clones.filter((c) => c !== mine[0]);
        }
        break;
      case 'break': // a seeker shot a clone
        if (g && g.phase === 'playing' && g.seekers.includes(from) && typeof m.cid === 'string') g.clones = g.clones.filter((c) => c.id !== m.cid);
        break;
      case 'shot': // a seeker shot at me: the game decides what that means (Prop Hunt: same as a tag)
        if (g && g.phase === 'playing' && m.to === me() && g.players[me()] && g.seekers.includes(from)) t.onHit?.(g, ctx, from);
        break;
      case 'fire': // a seeker fired their gun: everybody sees the flash
        if (g && g.phase === 'playing' && g.seekers.includes(from) && from !== me()) { for (const p of online.peers()) if (p.id === from) p.avatar.fireGun?.(); sfx.whoosh(); }
        break;
      case 'end':
        if (g && g.phase === 'playing' && from === g.host) finish(g, m.result);
        break;
      case 'snap':
        if (Array.isArray(m.games)) for (const r of m.games) if (r && r.id && !games.has(r.id) && TYPES.some((x) => x.id === r.type)) games.set(r.id, hydrate(r));
        break;
    }
    changed();
  }
  /** send to everybody and apply here too */
  function act(op) { online.broadcast({ t: 'game', ...op }); apply(op, me()); }

  online.hookGames({
    msg: (from, m) => apply(m, from),
    gone: (uid) => { for (const g of [...games.values()]) removePlayer(g, uid); changed(); }, // a player who dropped is out of every game
    reset: () => { games.clear(); stopEffects(); close(); hideInvite(); changed(); },
    snap: () => [...games.values()].map(plain),
  });

  /** punch hooks for src/combat.js */
  function canHit(uid) { // fists only land between people in the same running game, or between people in none
    const a = playingOf(me()), b = playingOf(uid);
    return !a && !b ? true : a === b;
  }
  function onHit(from) { // true = a game swallowed this punch (no damage)
    const a = playingOf(me());
    if (!a) return !!playingOf(from);
    return typeOf(a).onHit(a, ctx, from) || true;
  }

  /** a swing that hit nobody: the game I am in may punish it (Prop Hunt) */
  function onMiss() {
    const a = playingOf(me());
    if (a) typeOf(a).onMiss?.(a, ctx);
  }

  // ---------- badges, disguises + scoreboard ----------
  /** show / clear the prop on one avatar. mine = my own body: it only gets hidden (the camera sits inside the prop) */
  function dress(avatar, g, uid, mine) {
    const t = g && typeOf(g), idx = t && t.props ? t.disguiseOf(g, uid) : null; // null = no disguise
    if ((propCache.get(avatar) ?? -1) === (idx ?? -1)) return; // unchanged (and never touch an avatar that was never disguised)
    propCache.set(avatar, idx ?? -1);
    if (idx === null) avatar.setDisguise?.(null);
    else avatar.setDisguise?.(t.makeProp(idx), t.props[idx].hit); // my own too: I see it from behind (camBegin)
  }
  function changed() {
    if (inviteId) { const ig = games.get(inviteId); if (!ig || ig.phase !== 'open' || myGame()) hideInvite(); } // started, cancelled, or I joined another way
    for (const p of online.peers()) { const g = playingOf(p.id); p.avatar.setBadge?.(g ? typeOf(g).badge(g, p.id) : null); p.avatar.setGun?.(!!g && !!typeOf(g).gun && g.seekers.includes(p.id)); dress(p.avatar, g, p.id, false); }
    if (online.me) dress(online.me, playingOf(me()), me(), true);
    syncClones();
    drawHud();
    if (open) render();
  }
  /** make the decoy props in the world match g.clones of every running game; a vanished one shrinks away */
  function syncClones() {
    const live = new Map();
    for (const g of games.values()) if (g.phase === 'playing' && g.clones) for (const c of g.clones) live.set(c.id, { c, g });
    for (const [id, { c, g }] of live) {
      if (cloneObjs.has(id)) continue;
      const obj = new THREE.Group();
      obj.add(typeOf(g).makeProp(c.p)); obj.position.set(c.x, 0, c.z); obj.rotation.y = c.ry;
      scene.add(obj); cloneObjs.set(id, { obj, dying: 0 });
    }
    for (const [id, e] of cloneObjs) if (!live.has(id) && !e.dying) { e.dying = 0.001; sfx.impact(); }
  }

  // ---------- Prop Hunt: the seeker's gun + the hider's third-person camera ----------
  const mat = (c) => new THREE.MeshBasicMaterial({ color: c, depthTest: false });
  const gun = new THREE.Group();
  for (const [w, h, d, y, z, c] of [[0.07, 0.1, 0.34, 0, 0, '#2b2d33'], [0.04, 0.04, 0.22, 0.03, -0.26, '#1a1b1f'], [0.06, 0.13, 0.07, -0.1, 0.1, '#3a3d45']]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); b.position.set(0, y, z); b.renderOrder = 999; gun.add(b);
  }
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat('#ffd34a')); flash.position.set(0, 0.03, -0.42); flash.renderOrder = 1000; flash.visible = false; gun.add(flash);
  gun.position.set(0.24, -0.22, -0.5); gun.visible = false;
  camera.add(gun); if (!camera.parent) scene.add(camera);

  const gunGame = () => { const g = playingOf(me()); return g && typeOf(g).gun && g.seekers.includes(me()) ? g : null; };
  /** left click for a seeker with a gun: hitscan. A clone breaks, a real hider is tagged, anything else does nothing. true = the click was the gun's */
  function shoot() {
    const g = gunGame();
    if (!g) return false;
    if (!typeOf(g).canShoot(g, ctx) || shotT > 0) return true;
    shotT = SHOT_CD; recoil = 1; flashT = 0.06; sfx.whoosh(); sfx.impact();
    online.broadcast({ t: 'game', op: 'fire', id: g.id });
    camera.getWorldDirection(dirV); orgV.copy(camera.position);
    let best = null, bestT = SHOT_RANGE;
    const test = (cx, cy, cz, r, what) => { // ray against a sphere
      const ox = cx - orgV.x, oy = cy - orgV.y, oz = cz - orgV.z, tc = ox * dirV.x + oy * dirV.y + oz * dirV.z;
      if (tc < 0 || tc > bestT) return;
      const d2 = ox * ox + oy * oy + oz * oz - tc * tc;
      if (d2 <= r * r) { bestT = tc; best = what; }
    };
    for (const c of g.clones) if (!cloneObjs.get(c.id)?.dying) test(c.x, 0.5, c.z, 0.55, { clone: c.id });
    for (const p of online.peers()) {
      if (!g.players[p.id] || g.seekers.includes(p.id) || p.avatar.knocked) continue;
      const pos = p.avatar.group.position;
      test(pos.x, pos.y + (p.avatar.hitY || 1), pos.z, p.avatar.disguised ? 0.55 : 0.5, { uid: p.id });
    }
    if (best && best.clone) { act({ op: 'break', id: g.id, cid: best.clone }); toast('Clone destroyed', 1200); }
    else if (best && best.uid) { online.broadcast({ t: 'game', op: 'shot', id: g.id, to: best.uid }); toast(`Hit ${g.players[best.uid] || 'a hider'}!`, 1400); }
    return true;
  }
  const tppIdx = () => { const g = playingOf(me()); return g && typeOf(g).props ? typeOf(g).disguiseOf(g, me()) : null; };
  /** call right before rendering: a hider who is a prop sees themselves from behind, so they can see how they look */
  function camBegin() {
    if (camSaved || tppIdx() === null) return false;
    camSaved = camera.position.clone(); camera.getWorldDirection(dirV);
    let d = 0.15;
    for (; d <= TPP_D; d += 0.15) if (blocked(camSaved.x - dirV.x * d, camSaved.z - dirV.z * d, 0.12)) break;
    d = Math.max(0, Math.min(TPP_D, d - 0.15));
    camera.position.set(camSaved.x - dirV.x * d, Math.max(0.3, camSaved.y - dirV.y * d + 0.35), camSaved.z - dirV.z * d);
    return true;
  }
  function camEnd() { if (camSaved) { camera.position.copy(camSaved); camSaved = null; } }
  function drawHud() {
    const m = me();
    let g = null;
    for (const x of games.values()) if (x.phase === 'playing' && (!g || x.players[m])) g = x;
    if (!g || !m) { hudEl.style.display = 'none'; return; }
    hudEl.style.display = 'block';
    hudEl.innerHTML = `<b>${esc(typeOf(g).name)}</b> &middot; ${esc(typeOf(g).hud(g, ctx))}${g.players[m] ? '' : ' &middot; watching'}`;
  }

  // ---------- the panel (G): keyboard first (W/S, Enter), rows are clickable when the cursor is free ----------
  function build() {
    const g = myGame(), info = [], items = [];
    if (g) {
      const t = typeOf(g), n = Object.keys(g.players).length, mine = g.host === me();
      view = 'lobby';
      info.push(`<b>${esc(t.name)}</b> &middot; ${g.phase === 'open' ? `lobby ${n}/${t.max}` : 'in progress'}`);
      for (const [u, nm] of Object.entries(g.players)) info.push(`${esc(nm)}${u === g.host ? ' <span style="color:#ecc828">(host)</span>' : ''}${u === me() ? ' (you)' : ''}`);
      if (g.phase === 'open') {
        if (mine) items.push({ html: `Start (${n}/${t.max})<small>${n < t.min ? `needs at least ${t.min} players` : esc(t.blurb)}</small>`, off: n < t.min,
          act: () => (n < t.min ? toast(`Needs at least ${t.min} players`) : act({ op: 'start', id: g.id, seed: Math.floor(Math.random() * 1e6), order: Object.keys(g.players).sort(), players: g.players })) });
        else info.push('<span style="color:rgba(255,255,255,.5)">Waiting for the host to start…</span>');
      }
      items.push({ html: 'Leave game', act: () => { act({ op: 'leave', id: g.id, uid: me() }); view = 'list'; idx = 0; } });
    } else if (view === 'create') {
      info.push('Pick a game. You become the host.');
      for (const t of TYPES) items.push({ html: `${esc(t.name)}<small>${t.min}-${t.max} players &middot; ${esc(t.blurb)}</small>`, act: () => {
        act({ op: 'create', g: { id: `${me()}-${Date.now().toString(36)}`, type: t.id, host: me(), hostName: online.name || 'Host', players: { [me()]: online.name || 'Host' } } });
      } });
      items.push({ html: 'Back', act: () => { view = 'list'; idx = 0; render(); } });
    } else {
      view = 'list';
      if (!games.size) info.push('No games yet. Create one!');
      for (const x of games.values()) {
        const t = typeOf(x), n = Object.keys(x.players).length, isOpen = x.phase === 'open' && n < t.max;
        items.push({ html: `${esc(t.name)}<small>host ${esc(x.hostName)} &middot; ${n}/${t.max}</small>`, off: !isOpen,
          tag: x.phase === 'open' ? (n < t.max ? 'OPEN' : 'FULL') : 'IN PROGRESS', run: x.phase !== 'open' || n >= t.max,
          act: () => (isOpen ? act({ op: 'join', id: x.id, uid: me(), name: online.name || 'Guest' }) : toast(x.phase === 'open' ? 'That game is full' : 'Already started. Watch from outside')) });
      }
      items.push({ html: '+ Create game', act: () => { view = 'create'; idx = 0; render(); } });
    }
    items.push({ html: 'Close', act: () => close() });
    return { info, items };
  }
  function render() {
    cur = build();
    idx = Math.max(0, Math.min(idx, cur.items.length - 1));
    const title = view === 'create' ? 'Create game' : view === 'lobby' ? 'Your game' : 'Games';
    panel.innerHTML = `<p class="g-t">${title}</p>${cur.info.map((i) => `<p class="g-info">${i}</p>`).join('')}`;
    cur.items.forEach((it, i) => {
      const d = document.createElement('div');
      d.className = `g-i${i === idx ? ' sel' : ''}${it.off ? ' off' : ''}`;
      d.innerHTML = `<span>${it.html}</span>${it.tag ? `<span class="g-tag${it.run ? ' run' : ''}">${it.tag}</span>` : ''}`;
      d.addEventListener('mouseenter', () => { if (idx !== i) { idx = i; render(); } });
      d.addEventListener('click', (e) => { e.stopPropagation(); idx = i; it.act(); });
      panel.appendChild(d);
    });
    const k = document.createElement('p'); k.className = 'g-keys'; k.innerHTML = '&uarr; &darr; select &nbsp;&middot;&nbsp; Enter confirm &nbsp;&middot;&nbsp; G close';
    panel.appendChild(k);
  }
  function openPanel() {
    if (open || !online.running() || player.state.paused || player.state.stunned) return;
    open = true; view = myGame() ? 'lobby' : 'list'; idx = 0;
    player.state.paused = true; panel.classList.add('show'); render();
  }
  function close() {
    if (!open) return;
    open = false; panel.classList.remove('show'); player.state.paused = false;
  }

  addEventListener('keydown', (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (inviteId && !open && !menuOpen() && !player.state.paused && !e.repeat && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyN')) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code === 'KeyN') hideInvite(); else joinInvite();
      return;
    }
    if (!open) { if (e.code === 'KeyG' && !e.repeat) openPanel(); else if (!e.repeat && !player.state.paused && keyQ.length < 8) keyQ.push(e.code); return; }
    const n = cur.items.length;
    if (e.code === 'KeyG' || e.code === 'Escape') close();
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { idx = (idx + 1) % n; render(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { idx = (idx - 1 + n) % n; render(); }
    else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) cur.items[idx]?.act();
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  addEventListener('keydown', (e) => { if (!open) heldKeys.add(e.code); });
  addEventListener('keyup', (e) => heldKeys.delete(e.code));
  addEventListener('blur', () => heldKeys.clear());
  player.controls.addEventListener('unlock', () => close()); // Esc released the mouse: the pause menu takes over

  function update(dt) {
    const m = me();
    if (!m) { if (frozen || stunT > 0) stopEffects(); return; }
    if (stunT > 0) { stunT -= dt; syncStun(); }
    if (shotT > 0) shotT -= dt;
    const gg = gunGame(); gun.visible = !!gg && gg.phase === 'playing';
    recoil = Math.max(0, recoil - dt * 7); gun.position.z = -0.5 + recoil * 0.07; gun.rotation.x = recoil * 0.12;
    flashT = Math.max(0, flashT - dt); flash.visible = flashT > 0;
    for (const [id, e] of cloneObjs) if (e.dying) { // a broken clone shrinks and spins away
      e.dying += dt; const k = Math.max(0, 1 - e.dying / 0.3); e.obj.scale.setScalar(Math.max(k, 0.001)); e.obj.rotation.y += dt * 9;
      if (k <= 0) { scene.remove(e.obj); cloneObjs.delete(id); }
    }
    for (const g of games.values()) {
      if (g.phase !== 'playing') continue;
      const t = typeOf(g);
      if (g.players[m]) t.tick(g, ctx, dt);
      if (g.host === m) { const r = t.hostTick(g, ctx); if (r) act({ op: 'end', id: g.id, result: r }); }
    }
    if ((hudT += dt) > 0.25) { hudT = 0; drawHud(); }
  }

  return { update, open: openPanel, close, canHit, onHit, onMiss, shoot, camBegin, camEnd, isProp: () => tppIdx() !== null, get isOpen() { return open; } };
}
