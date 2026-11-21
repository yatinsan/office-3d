import * as THREE from 'three';

/**
 * On-screen touch controls (phones / tablets only), PUBG / Free Fire style:
 *   left thumb  - floating joystick (appears where you touch on the left half) to walk, push far to run
 *   right thumb - drag anywhere on the right half to look around
 *   buttons     - Jump (icon), plus a context icon button that only appears near a door / the TV
 */
export const isTouchDevice = () =>
  matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const svg = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
const ICONS = {
  jump: svg('<path d="M12 19V6"/><path d="M6 11l6-6 6 6"/><path d="M5 21h14"/>'),
  doorOpen: svg('<path d="M4 21h16"/><path d="M6 21V3h9v2"/><path d="M15 21V5l-5 1.5V21"/><path d="M11.8 13h.01"/><path d="M18 9l2 2-2 2"/>'),
  doorClose: svg('<path d="M4 21h16"/><path d="M6 21V3h12v18"/><path d="M15 12h.01"/>'),
  finger: svg('<path d="M12 11v3a6 6 0 0 1-1.5 4"/><path d="M8 13v-2a4 4 0 0 1 8 0v1"/><path d="M5 12v-1a7 7 0 0 1 14 0v2"/><path d="M16 14.5c0 2-.5 3.8-1.5 5.5"/><path d="M12 14c0 2.5-.6 4.5-2 6"/>'),
  fist: svg('<path d="M7 11V7a1.5 1.5 0 0 1 3 0v3m0-1V6a1.5 1.5 0 0 1 3 0v3m0-.5V7a1.5 1.5 0 0 1 3 0v4m0-1a1.5 1.5 0 0 1 3 0v4a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-4a1.6 1.6 0 0 1 2.6-1.8L7 14"/>'),
  rotate: svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
  chair: svg('<path d="M7 3v9"/><path d="M7 12h10v3H7z"/><path d="M12 15v4"/><path d="M8 21h8"/>'),
  tv: svg('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M10 9l4 2-4 2z"/>'),
  fullscreen: svg('<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>'),
  menu: svg('<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>'),
};

/** Fullscreen + landscape lock (Android Chrome). iOS Safari can't lock, so the portrait overlay asks to rotate instead. Call from a tap. */
async function goLandscape() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement) await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
  } catch {}
  try { await screen.orientation?.lock?.('landscape'); } catch {}
}

export function initTouch({ player, camera }) {
  const { touch } = player;
  const root = document.createElement('div');
  root.id = 'touch';
  root.innerHTML = `
    <div class="tj-base"><div class="tj-knob"></div></div>
    <button class="tb tb-jump" type="button" aria-label="Jump">${ICONS.jump}</button>
    <button class="tb tb-act off" type="button" aria-label="Use"></button>
    <button class="tb tb-hit" type="button" aria-label="Punch">${ICONS.fist}</button>
    <button class="tb tb-fs off" type="button" aria-label="Full screen">${ICONS.fullscreen}</button>
    <button class="tb tb-menu" type="button" aria-label="Menu">${ICONS.menu}</button>`;
  // portrait guard: lives on the body (not in #touch) so it also covers the start menu; the game is landscape only
  const rot = document.createElement('div');
  rot.className = 't-rotate';
  rot.innerHTML = `${ICONS.rotate}<div>Rotate your phone to landscape</div><small>Tap to go full screen</small>`;
  const css = document.createElement('style');
  css.textContent = `
    #touch { position: fixed; inset: 0; z-index: 6; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    #touch.off { display: none; }
    .tj-base { position: absolute; width: 112px; height: 112px; margin: -56px 0 0 -56px; border-radius: 50%;
      background: rgba(255,255,255,.10); border: 2px solid rgba(255,255,255,.35); opacity: .4; pointer-events: none; }
    .tj-knob { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
      background: rgba(236,200,40,.55); border: 2px solid rgba(255,255,255,.7); }
    .tb { position: absolute; border-radius: 50%; border: 1.5px solid rgba(255,255,255,.4); background: rgba(20,20,20,.28); opacity: .5; transition: opacity .12s;
      color: #fff; padding: 0; display: flex; align-items: center; justify-content: center; touch-action: none; }
    .tb svg { width: 46%; height: 46%; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
    .tb:active, .tb.on { opacity: .9; background: rgba(236,200,40,.7); color: #111; }
    .tb.off { display: none; }
    .tb-fs { top: max(12px, env(safe-area-inset-top)); right: max(18px, env(safe-area-inset-right)); width: 40px; height: 40px; opacity: .75; }
    .tb-menu { top: max(12px, env(safe-area-inset-top)); left: max(18px, env(safe-area-inset-left)); width: 44px; height: 44px; opacity: .9; background: rgba(20,20,20,.5); }
    .tb-jump { right: max(18px, env(safe-area-inset-right)); bottom: max(26px, env(safe-area-inset-bottom)); width: 44px; height: 44px; }
    .tb-hit { right: max(72px, calc(env(safe-area-inset-right) + 54px)); bottom: max(26px, env(safe-area-inset-bottom)); width: 44px; height: 44px; }
    .tb-act { right: max(18px, env(safe-area-inset-right)); bottom: max(82px, calc(env(safe-area-inset-bottom) + 58px)); width: 40px; height: 40px;
      background: rgba(236,200,40,.3); border-color: rgba(255,255,255,.55); opacity: .65; }
    .t-rotate { display: none; position: fixed; inset: 0; z-index: 60; background: #111; color: #fff; font: 600 16px system-ui, sans-serif;
      flex-direction: column; align-items: center; justify-content: center; gap: 18px; text-align: center; }
    .t-rotate svg { width: 72px; height: 72px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round;
      animation: t-rot 1.8s ease-in-out infinite; }
    @keyframes t-rot { 0%, 25% { transform: rotate(0deg); } 60%, 100% { transform: rotate(-90deg); } }
    @media (orientation: portrait) { .t-rotate { display: flex; } }
    .t-rotate small { font-weight: 400; font-size: 12px; opacity: .55; }
    #byline { display: none; }
    #hud { left: 50%; transform: translateX(-50%); bottom: 14px; font-size: 13px; }
  `;
  document.head.appendChild(css);
  document.body.appendChild(root);
  document.body.appendChild(rot);
  // any tap (menu, rotate screen, game) asks for fullscreen + landscape lock if we're not fullscreen; needs a user gesture.
  // Not one-shot: the mic permission prompt (and other browser dialogs) can drop fullscreen mid-game, and it must come back on the next tap.
  addEventListener('touchend', () => { if (!document.fullscreenElement) goLandscape(); }, { passive: true });
  rot.addEventListener('touchend', () => goLandscape());
  // fullscreen button: shown only while the page is NOT fullscreen; tap it to go full screen
  const fsBtn = root.querySelector('.tb-fs');
  const syncFs = () => fsBtn.classList.toggle('off', !!document.fullscreenElement);
  document.addEventListener('fullscreenchange', syncFs);
  document.addEventListener('webkitfullscreenchange', syncFs);
  syncFs();

  const base = root.querySelector('.tj-base'), knob = root.querySelector('.tj-knob');
  const R = 48;                       // joystick radius in px
  let moveId = null, ox = 0, oy = 0;
  let lookId = null, lx = 0, ly = 0;
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  base.style.display = 'none';

  const onButton = (el) => !!(el.closest && el.closest('.tb'));

  root.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (onButton(t.target)) continue;
      if (t.clientX < innerWidth / 2 && moveId === null) {
        moveId = t.identifier; ox = t.clientX; oy = t.clientY;
        base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.style.display = 'block';
        knob.style.transform = 'translate(0,0)';
      } else if (t.clientX >= innerWidth / 2 && lookId === null) {
        lookId = t.identifier; lx = t.clientX; ly = t.clientY;
      }
    }
    if (!onButton(e.target)) e.preventDefault();
  }, { passive: false });

  root.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === moveId) {
        let dx = t.clientX - ox, dy = t.clientY - oy;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx *= R / len; dy *= R / len; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        touch.x = dx / R; touch.y = -dy / R;      // y: up = forward
        touch.run = len > R * 1.15;               // push past the rim to run
      } else if (t.identifier === lookId && !player.state.paused) {
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= (t.clientX - lx) * 0.006;
        euler.x = Math.max(-1.45, Math.min(1.45, euler.x - (t.clientY - ly) * 0.006));
        camera.quaternion.setFromEuler(euler);
        lx = t.clientX; ly = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });

  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === moveId) { moveId = null; touch.x = touch.y = 0; touch.run = false; base.style.display = 'none'; }
      if (t.identifier === lookId) lookId = null;
    }
  };
  root.addEventListener('touchend', end);
  root.addEventListener('touchcancel', end);

  const press = (sel, fn) => {
    const b = root.querySelector(sel);
    b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false });
    b.addEventListener('click', (e) => e.preventDefault());
  };
  // JUMP sends the same Space key a keyboard would, so the balcony lookout (and normal jump in controls.js) both see it.
  press('.tb-jump', () => {
    dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
  });
  press('.tb-hit', () => api.onHit?.());
  press('.tb-fs', () => goLandscape());
  // MENU button: sends the same Esc a keyboard would, so the pause menu opens (and seat / pool / games close the same way)
  press('.tb-menu', () => dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })));
  const act = root.querySelector('.tb-act');
  let actKey = null, actIcon = '';
  let heldKey = null;
  press('.tb-act', () => {
    if (actKey) { heldKey = actKey; dispatchEvent(new KeyboardEvent('keydown', { code: actKey, bubbles: true })); }
  });
  for (const ev of ['touchend', 'touchcancel']) act.addEventListener(ev, () => { // release for press-and-hold actions (door unlock)
    if (heldKey) { dispatchEvent(new KeyboardEvent('keyup', { code: heldKey, bubbles: true })); heldKey = null; }
  });

  const api = {
    onHit: null,
    show(on) { root.classList.toggle('off', !on); if (on) goLandscape(); },
    /** Show the context button for the current prompt ('' hides it). Door prompts start with "F", TV ones with "E" / TV state. */
    setAction(prompt) {
      let icon = '', key = null;
      if (/unlock/.test(prompt)) { key = 'KeyE'; icon = 'finger'; }
      else if (/^F (open|close|collect|hold)/.test(prompt)) { key = 'KeyF'; icon = /unlock/.test(prompt) ? 'finger' : prompt.startsWith('F close') ? 'doorClose' : 'doorOpen'; }
      else if (prompt) { key = 'KeyE'; icon = /^E (sit|stand)/.test(prompt) ? 'chair' : 'tv'; }
      actKey = key;
      act.classList.toggle('off', !key);
      if (icon !== actIcon) { act.innerHTML = icon ? ICONS[icon] : ''; act.setAttribute('aria-label', prompt); actIcon = icon; }
    },
  };
  return api;
}
