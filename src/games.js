import * as THREE from 'three';
import hideseek from './games/hideseek.js';
import prophunt from './games/prophunt.js';
import * as sfx from './sfx.js';

/**
 * In-world games. Press G: a list of every game in the room (OPEN / IN PROGRESS), Create game, Join, Start.
 * No server: every client keeps the same list from {t:'game'} messages on the event channel (src/online.js).
 * Once the host starts a game it is locked; everybody else keeps walking around and watching (a ring on the
 * players' name tags + a small scoreboard) until it ends. The host is only the referee (decides when it is over).
 *
 * A game type (src/games/*.js) = { id, name, min, max, blurb, init, tick, onHit, hostTick, badge, hud, summary, ... }.
 */
const TYPES = [hideseek, prophunt];
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
  #g-hud { position: fixed; z-index: 6; right: max(14px, env(safe-area-inset-right)); top: 12px; display: none; padding: 6px 12px; border-radius: 12px;
    background: rgba(14,14,18,.62); border: 1px solid rgba(255,255,255,.14); color: rgba(255,255,255,.85); font: 600 12px system-ui, sans-serif; pointer-events: none; }
  #g-hud b { color: #ecc828; font-weight: 700; }
  #g-blind { position: fixed; inset: 0; z-index: 7; background: #000; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
    color: #fff; font: 700 22px system-ui, sans-serif; letter-spacing: 3px; text-transform: uppercase; pointer-events: none; }
  #g-blind small { font-size: 40px; color: #ecc828; }
  #g-result { position: fixed; inset: 0; z-index: 11; pointer-events: none; opacity: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 0 16px; box-sizing: border-box;
    font: 900 clamp(38px, 9vw, 104px) Impact, "Arial Narrow", "Arial Black", sans-serif; text-transform: uppercase; letter-spacing: 3px; color: #ecc828;
    text-shadow: 4px 4px 0 #000, -2px -2px 0 #000, 0 0 28px rgba(236,200,40,.5); background: rgba(0,0,0,.45); transition: opacity .4s; }
  #g-result.show { opacity: 1; }
`;

export function initGames({ online, player }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const panel = Object.assign(document.createElement('div'), { id: 'g-panel' });
  const toastEl = Object.assign(document.createElement('div'), { id: 'g-toast' });
  const hudEl = Object.assign(document.createElement('div'), { id: 'g-hud' });
  const blindEl = Object.assign(document.createElement('div'), { id: 'g-blind' });
  const resultEl = Object.assign(document.createElement('div'), { id: 'g-result' });
  document.body.append(panel, toastEl, hudEl, blindEl, resultEl);
  panel.addEventListener('click', (e) => e.stopPropagation());

  const games = new Map();      // id -> { id, type, host, hostName, players{uid:name}, phase 'open'|'playing', seed, order[], seekers[], run{}, startMs }
  const me = () => online.uid();
  const now = () => performance.now();
  let open = false, view = 'list', idx = 0, cur = { info: [], items: [] }, frozen = false, hudT = 0, toastT = 0, resultT = 0;
  let stunT = 0, stunApplied = false, keyQ = []; // stunT: seconds of "can't move / punch" left; keyQ: key presses for the game types (1-5, R, ...)
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
  const stopEffects = () => { frozen = false; stunT = 0; syncStun(); ctx.blind(null); keyQ = []; };

  // ---------- shared state: every client applies the same messages ----------
  const hydrate = (r) => ({ id: r.id, type: r.type, host: r.host, hostName: r.hostName, players: { ...r.players }, phase: r.phase, seed: r.seed || 0,
    order: r.order || [], seekers: r.seekers || [], disguise: r.disguise || {}, run: {}, startMs: r.el != null ? now() - r.el * 1000 : 0 });
  const plain = (g) => ({ id: g.id, type: g.type, host: g.host, hostName: g.hostName, players: g.players, phase: g.phase, seed: g.seed, order: g.order, seekers: g.seekers,
    disguise: g.disguise, el: g.phase === 'playing' ? ctx.el(g) : null });

  function removePlayer(g, uid) {
    if (!g.players[uid]) return;
    delete g.players[uid];
    const ids = Object.keys(g.players).sort();
    if (!ids.length) { games.delete(g.id); return; }
    if (g.host === uid) { g.host = ids[0]; g.hostName = g.players[g.host]; } // the lowest id takes over as referee
    if (g.phase === 'playing') { g.seekers = g.seekers.filter((s) => s !== uid); delete g.disguise?.[uid]; typeOf(g).onLeave?.(g); }
  }
  function finish(g, result) {
    if (!games.delete(g.id)) return;
    const t = typeOf(g), mine = !!(me() && g.players[me()]);
    if (mine) { stopEffects(); showResult(t.summary(result, g)); } else toast(`${t.name}: ${t.summary(result, g)}`, 3200);
  }

  /** apply one message (mine or someone's); `from` = who sent it */
  function apply(m, from) {
    if (!m || typeof m !== 'object') return;
    const g = games.get(m.id), t = g && typeOf(g);
    switch (m.op) {
      case 'create':
        if (m.g && m.g.host === from && !games.has(m.g.id) && TYPES.some((x) => x.id === m.g.type) && m.g.players && m.g.players[from]) {
          games.set(m.g.id, hydrate({ ...m.g, phase: 'open', seed: 0, order: [], seekers: [], disguise: {}, el: null }));
          if (from !== me()) toast(`${m.g.hostName} created ${typeOf(m.g).name}. Press G to join`, 3200);
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
    reset: () => { games.clear(); stopEffects(); close(); changed(); },
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
    else avatar.setDisguise?.(mine ? new THREE.Group() : t.makeProp(idx), t.props[idx].hit);
  }
  function changed() {
    for (const p of online.peers()) { const g = playingOf(p.id); p.avatar.setBadge?.(g ? typeOf(g).badge(g, p.id) : null); dress(p.avatar, g, p.id, false); }
    if (online.me) dress(online.me, playingOf(me()), me(), true);
    drawHud();
    if (open) render();
  }
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
    if (!open) { if (e.code === 'KeyG' && !e.repeat) openPanel(); else if (!e.repeat && !player.state.paused && keyQ.length < 8) keyQ.push(e.code); return; }
    const n = cur.items.length;
    if (e.code === 'KeyG' || e.code === 'Escape') close();
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { idx = (idx + 1) % n; render(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { idx = (idx - 1 + n) % n; render(); }
    else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat) cur.items[idx]?.act();
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  player.controls.addEventListener('unlock', () => close()); // Esc released the mouse: the pause menu takes over

  function update(dt) {
    const m = me();
    if (!m) { if (frozen || stunT > 0) stopEffects(); return; }
    if (stunT > 0) { stunT -= dt; syncStun(); }
    for (const g of games.values()) {
      if (g.phase !== 'playing') continue;
      const t = typeOf(g);
      if (g.players[m]) t.tick(g, ctx, dt);
      if (g.host === m) { const r = t.hostTick(g, ctx); if (r) act({ op: 'end', id: g.id, result: r }); }
    }
    if ((hudT += dt) > 0.25) { hudT = 0; drawHud(); }
  }

  return { update, open: openPanel, close, canHit, onHit, onMiss, get isOpen() { return open; } };
}
