import { X1, GENTS_Z } from './world/hall.js';

/**
 * Gents toilet (east wall of the hall, door at GENTS_Z): stand at the door and press F to go in - but the bathroom is
 * being cleaned, so a big GTA-style card says so for a couple of seconds and the door stays shut.
 */
const CSS = `
#gentsq { position: fixed; inset: 0; z-index: 9; display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none; opacity: 0; transition: opacity .25s; }
#gentsq.show { opacity: 1; }
#gentsq .band { position: absolute; left: 0; right: 0; top: 50%; height: 200px; transform: translateY(-58%);
  background: linear-gradient(transparent, rgba(0,0,0,.72) 22%, rgba(0,0,0,.72) 78%, transparent); }
#gentsq .big { position: relative; font: italic 900 clamp(34px, 6.5vw, 84px)/1 Impact, 'Arial Black', system-ui, sans-serif;
  letter-spacing: 2px; text-transform: uppercase; color: #f2c21b; -webkit-text-stroke: 3px #000; text-align: center;
  text-shadow: 4px 4px 0 #000, 0 0 24px rgba(0,0,0,.6); transform: scale(1.5); transition: transform .35s cubic-bezier(.2,1.6,.4,1); }
#gentsq.show .big { transform: scale(1); }
#gentsq .sub { position: relative; margin-top: 12px; font: 800 20px/1 system-ui, sans-serif; color: #fff; text-transform: uppercase;
  letter-spacing: 1px; text-shadow: 2px 2px 0 #000; }
`;

export function initGents({ player }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = document.createElement('div');
  el.id = 'gentsq';
  el.innerHTML = '<div class="band"></div><div class="big">Bathroom is being cleaned</div><div class="sub">Please come back later</div>';
  document.body.appendChild(el);

  let hideAt = 0;
  const near = () => Math.hypot(player.pos.x - X1, player.pos.z - GENTS_Z) < 1.8 && player.pos.x < X1;
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName);

  const show = () => {
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    hideAt = performance.now() + 2600;
  };
  addEventListener('keydown', (e) => {
    if (e.repeat || player.state.paused || typing(e)) return;
    if (e.code === 'KeyF' && near()) show();
  });

  return {
    update() { if (hideAt && performance.now() > hideAt) { el.classList.remove('show'); hideAt = 0; } },
    prompt: () => (near() ? 'F enter bathroom' : ''),
  };
}
