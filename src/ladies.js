import * as THREE from 'three';

/**
 * Ladies toilet door (hall east wall, built in src/world/hall.js → ladiesToilet). It is locked until you answer the
 * question: press F at the door and a GTA "mission passed"-style big-text card asks "ARE U GAY?".
 * Y (or tap YES) → "RESPECT +" and the door swings open; N → red "ACCESS DENIED". Once the door has been closed
 * again it locks and asks next time too.
 */
const CSS = `
#ladiesq { position: fixed; inset: 0; z-index: 9; display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none; opacity: 0; transition: opacity .25s; }
#ladiesq.show { opacity: 1; }
#ladiesq .band { position: absolute; left: 0; right: 0; top: 50%; height: 220px; transform: translateY(-58%);
  background: linear-gradient(transparent, rgba(0,0,0,.72) 22%, rgba(0,0,0,.72) 78%, transparent); }
#ladiesq .big { position: relative; font: italic 900 clamp(48px, 9vw, 112px)/1 Impact, 'Arial Black', system-ui, sans-serif;
  letter-spacing: 2px; text-transform: uppercase; color: #f2c21b; -webkit-text-stroke: 3px #000;
  text-shadow: 4px 4px 0 #000, 0 0 24px rgba(0,0,0,.6); transform: scale(1.6); transition: transform .35s cubic-bezier(.2,1.6,.4,1); }
#ladiesq.show .big { transform: scale(1); }
#ladiesq .big.red { color: #d8261c; }
#ladiesq .sub { position: relative; margin-top: 14px; display: flex; gap: 28px; font: 800 22px/1 system-ui, sans-serif; color: #fff;
  text-transform: uppercase; letter-spacing: 1px; text-shadow: 2px 2px 0 #000; }
#ladiesq button { pointer-events: auto; cursor: pointer; background: none; border: 0; color: inherit; font: inherit; text-shadow: inherit;
  display: flex; align-items: center; gap: 10px; padding: 6px 10px; }
#ladiesq kbd { display: inline-block; min-width: 30px; padding: 3px 6px; border: 2px solid #fff; border-radius: 5px; font: 800 18px/1.2 system-ui, sans-serif;
  background: rgba(0,0,0,.5); text-shadow: none; }
`;

/** Tiny GTA-ish "mission passed" jingle / denied buzz with WebAudio. */
let ac = null;
function jingle(ok) {
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ac.currentTime;
    const notes = ok ? [[392, 0], [523, 0.12], [659, 0.24], [784, 0.36], [1047, 0.5]] : [[160, 0], [120, 0.22]];
    for (const [f, at] of notes) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = ok ? 'triangle' : 'sawtooth'; o.frequency.value = f;
      const len = ok ? (at === 0.5 ? 0.7 : 0.16) : 0.3;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(ok ? 0.18 : 0.12, t0 + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      o.connect(g).connect(ac.destination);
      o.start(t0 + at); o.stop(t0 + at + len + 0.05);
    }
  } catch { /* no audio */ }
}

export function initLadies({ scene, player, doors }) {
  const door = doors.byName('ladies toilet');
  if (!door) return { update() {}, prompt: () => '' };

  // soft light inside the room (kept out of the static merge)
  const lamp = new THREE.PointLight('#fff4ea', 6, 4.5, 1.6);
  lamp.position.set(door.x + 1.2, 2.7, door.z + 0.5);
  scene.add(lamp);

  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = document.createElement('div');
  el.id = 'ladiesq';
  el.innerHTML = `<div class="band"></div><div class="big"></div><div class="sub"></div>`;
  document.body.appendChild(el);
  const big = el.querySelector('.big'), sub = el.querySelector('.sub');

  let granted = false, asking = false, hideAt = 0, wasOpen = false;
  door.locked = () => !granted;
  door.askToOpen = true; // keep the F marker on the handle while it is locked (src/doors.js)

  const near = () => Math.hypot(player.pos.x - door.x, player.pos.z - door.z) < 1.8 && player.pos.x < door.x;

  const show = (text, red, html, ms) => {
    big.textContent = text; big.classList.toggle('red', red);
    sub.innerHTML = html;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    hideAt = ms ? performance.now() + ms : 0;
  };
  const hide = () => { el.classList.remove('show'); asking = false; hideAt = 0; };

  const ask = () => {
    asking = true;
    show('Are u gay?', false, '<button data-a="y"><kbd>Y</kbd> Yes</button><button data-a="n"><kbd>N</kbd> No</button>', 0);
  };
  const answer = (yes) => {
    if (!asking) return;
    asking = false;
    if (yes) {
      granted = true;
      if (!door.target) doors.toggle(door);
      show('Respect +', false, '<span>Welcome in</span>', 2200);
    } else {
      show('Access denied', true, '<span>Ladies only</span>', 2000);
    }
    jingle(yes);
  };
  sub.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) answer(b.dataset.a === 'y'); });

  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName);
  addEventListener('keydown', (e) => {
    if (e.repeat || player.state.paused || typing(e)) return;
    if (asking) {
      if (e.code === 'KeyY') answer(true);
      else if (e.code === 'KeyN' || e.code === 'Escape') answer(false);
      return;
    }
    if (e.code === 'KeyF' && !granted && near()) ask();
  });

  function update() {
    if (asking && !near()) hide();
    if (hideAt && performance.now() > hideAt) hide();
    // lock again once the door has been opened and swung shut
    if (door.t > 0) wasOpen = true;
    if (granted && wasOpen && door.t === 0 && !door.target) { granted = false; wasOpen = false; }
  }

  /** HUD / touch-button hint. */
  function prompt() {
    return !granted && !asking && near() ? 'F open ladies toilet' : '';
  }

  return { update, prompt };
}
