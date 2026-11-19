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
  rotate: svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
  tv: svg('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M10 9l4 2-4 2z"/>'),
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
    <div class="t-rotate">${ICONS.rotate}<div>Rotate your phone to landscape</div></div>`;
  const css = document.createElement('style');
  css.textContent = `
    #touch { position: fixed; inset: 0; z-index: 6; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    #touch.off { display: none; }
    .tj-base { position: absolute; width: 130px; height: 130px; margin: -65px 0 0 -65px; border-radius: 50%;
      background: rgba(255,255,255,.10); border: 2px solid rgba(255,255,255,.35); opacity: .45; pointer-events: none; }
    .tj-knob { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%;
      background: rgba(236,200,40,.75); border: 2px solid rgba(255,255,255,.7); }
    .tb { position: absolute; border-radius: 50%; border: 2px solid rgba(255,255,255,.55); background: rgba(20,20,20,.5);
      color: #fff; padding: 0; display: flex; align-items: center; justify-content: center; touch-action: none; }
    .tb svg { width: 55%; height: 55%; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
    .tb:active, .tb.on { background: rgba(236,200,40,.7); color: #111; }
    .tb.off { display: none; }
    .tb-jump { right: max(18px, env(safe-area-inset-right)); bottom: max(26px, env(safe-area-inset-bottom)); width: 54px; height: 54px; }
    .tb-act { right: max(18px, env(safe-area-inset-right)); bottom: max(92px, calc(env(safe-area-inset-bottom) + 66px)); width: 48px; height: 48px;
      background: rgba(236,200,40,.55); border-color: rgba(255,255,255,.8); }
    .t-rotate { display: none; position: fixed; inset: 0; z-index: 20; background: #111; color: #fff; font: 600 16px system-ui, sans-serif;
      flex-direction: column; align-items: center; justify-content: center; gap: 18px; text-align: center; }
    .t-rotate svg { width: 72px; height: 72px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round;
      animation: t-rot 1.8s ease-in-out infinite; }
    @keyframes t-rot { 0%, 25% { transform: rotate(0deg); } 60%, 100% { transform: rotate(-90deg); } }
    @media (orientation: portrait) { #touch:not(.off) .t-rotate { display: flex; } }
    #byline { display: none; }
    #hud { left: 50%; transform: translateX(-50%); bottom: 14px; font-size: 13px; }
  `;
  document.head.appendChild(css);
  document.body.appendChild(root);

  const base = root.querySelector('.tj-base'), knob = root.querySelector('.tj-knob');
  const R = 55;                       // joystick radius in px
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
  press('.tb-jump', () => player.jump());
  const act = root.querySelector('.tb-act');
  let actKey = null, actIcon = '';
  press('.tb-act', () => {
    if (actKey) dispatchEvent(new KeyboardEvent('keydown', { code: actKey, bubbles: true }));
  });

  return {
    show(on) { root.classList.toggle('off', !on); if (on) goLandscape(); },
    /** Show the context button for the current prompt ('' hides it). Door prompts start with "F", TV ones with "E" / TV state. */
    setAction(prompt) {
      let icon = '', key = null;
      if (/^F (open|close)/.test(prompt)) { key = 'KeyF'; icon = prompt.startsWith('F open') ? 'doorOpen' : 'doorClose'; }
      else if (prompt) { key = 'KeyE'; icon = 'tv'; }
      actKey = key;
      act.classList.toggle('off', !key);
      if (icon !== actIcon) { act.innerHTML = icon ? ICONS[icon] : ''; act.setAttribute('aria-label', prompt); actIcon = icon; }
    },
  };
}
