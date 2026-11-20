// Balcony lookout: at the terrace rail, facing outward, a big "PRESS SPACE TO JUMP" prompt appears.
// Space locks the player, tilts the head and plays a video full screen; when it ends everything is restored.
const VIDEO_SRC = 'media/balcony.mp4';
// Lookout zone in front of the glass rail (rail collider stops the player at about x = -3.03).
// Whole length of the terrace (z 0..25.2), next to the rail.
const ZONE = { x1: -3.2, x2: -2.2, z1: 0.3, z2: 24.9 };
const TURN_YAW = -0.95;   // head turns to the RIGHT by this much (radians), toward the person standing on your right
const TILT_PITCH = -0.06; // tiny downward tilt
const TILT_ROLL = 0.1;    // head tilt
const TILT_TIME = 1.2;    // seconds to ease into the tilt
const FADE_IN_AT = 0.9;   // video starts fading in after this many seconds
const COOLDOWN = 2;

const CSS = `
#jumpPrompt { position: fixed; left: 50%; top: 58%; transform: translate(-50%, 8px); z-index: 6; pointer-events: none; text-align: center;
  color: #fff; font: 800 clamp(28px, 5vw, 64px)/1.1 system-ui, -apple-system, sans-serif; letter-spacing: 2px; text-transform: uppercase;
  text-shadow: 0 2px 14px rgba(0,0,0,.85), 0 0 2px #000; opacity: 0; transition: opacity .35s, transform .35s; }
#jumpPrompt.show { opacity: 1; transform: translate(-50%, 0); }
#jumpPrompt kbd { display: inline-block; padding: 0 .35em; margin: 0 .1em; border-radius: .2em; border: 3px solid #ecc828; color: #ecc828; background: rgba(14,14,18,.55); }
#jumpPrompt small { display: block; margin-top: .5em; font-size: .3em; font-weight: 600; letter-spacing: 3px; color: rgba(255,255,255,.8); }
#jumpVideoWrap { position: fixed; inset: 0; z-index: 30; background: #000; opacity: 0; pointer-events: none; transition: opacity .8s; display: none; }
#jumpVideoWrap.show { opacity: 1; }
#jumpVideoWrap video { width: 100%; height: 100%; object-fit: cover; display: block; }
#jumpVideoWrap .skip { display: none; position: absolute; right: 16px; top: 14px; z-index: 2; padding: 5px 12px; border-radius: 10px; background: rgba(14,14,18,.6); color: #ecc828; font: 600 13px system-ui, sans-serif; }
body.dev #jumpVideoWrap .skip { display: block; }
#jumpVideoWrap::after { content: ''; position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 160px 40px rgba(0,0,0,.65); }
body.cutscene #prompt, body.cutscene #hud, body.cutscene #crosshair, body.cutscene #zone, body.cutscene #byline { display: none !important; }
`;

export function initBalconyJump({ camera, player, touch = false }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const promptEl = document.createElement('div');
  promptEl.id = 'jumpPrompt';
  promptEl.innerHTML = touch
    ? 'Tap <kbd>JUMP</kbd> to jump<small>walk away to stay</small>'
    : 'Press <kbd>Space</kbd> to jump<small>or quit the job &middot; walk away to stay</small>';
  document.body.appendChild(promptEl);

  const wrap = document.createElement('div');
  wrap.id = 'jumpVideoWrap';
  const video = document.createElement('video');
  video.src = VIDEO_SRC;
  video.preload = 'auto';
  video.playsInline = true;
  wrap.appendChild(video);
  const skip = document.createElement('div');
  skip.className = 'skip';
  skip.textContent = 'DEV · Esc to exit video';
  wrap.appendChild(skip);
  document.body.appendChild(wrap);

  let playing = false, t = 0, cooldown = 0, videoShown = false, shown = false;
  let startPitch = 0, startYaw = 0, startRoll = 0;
  const dir = { x: 0, z: 0 };

  function inZone() {
    const p = player.pos;
    if (p.x < ZONE.x1 || p.x > ZONE.x2 || p.z < ZONE.z1 || p.z > ZONE.z2) return false;
    // looking roughly outward (-x), within ~75 degrees, so it works anywhere along the rail
    dir.x = -Math.sin(camera.rotation.y) * Math.cos(camera.rotation.x);
    dir.z = -Math.cos(camera.rotation.y) * Math.cos(camera.rotation.x);
    const len = Math.hypot(dir.x, dir.z) || 1;
    return dir.x / len < -0.25;
  }
  const ready = () => !playing && cooldown <= 0 && !player.state.paused && (player.controls.isLocked || player.state.dragMode);

  function start() {
    playing = true; t = 0; videoShown = false;
    startPitch = camera.rotation.x; startYaw = camera.rotation.y; startRoll = camera.rotation.z;
    player.state.paused = true;
    document.body.classList.add('cutscene');
    promptEl.classList.remove('show'); shown = false;
    wrap.style.display = 'block';
    video.currentTime = 0;
    video.muted = false;
    const pl = video.play();
    if (pl && pl.catch) pl.catch(() => { video.muted = true; video.play().catch(finish); });
  }
  function finish() {
    if (!playing) return;
    wrap.classList.remove('show');
    video.pause();
    setTimeout(() => { wrap.style.display = 'none'; }, 800);
    // restore view and controls
    camera.rotation.set(startPitch, startYaw, startRoll, 'YXZ');
    player.state.paused = false;
    document.body.classList.remove('cutscene');
    playing = false; cooldown = COOLDOWN;
  }
  video.addEventListener('ended', finish);
  video.addEventListener('error', finish);

  // Capture phase so the normal Space-jump in controls.js never sees it.
  addEventListener('keydown', (e) => {
    if (playing) {
      // Esc skips the video only in dev mode (body.dev, toggled with P); otherwise the video always plays through.
      if (e.code === 'Escape' && document.body.classList.contains('dev')) finish();
      e.stopImmediatePropagation(); e.preventDefault();
      return;
    }
    if (e.code === 'Space' && ready() && inZone()) {
      e.stopImmediatePropagation(); e.preventDefault();
      start();
    }
  }, true);

  const ease = (x) => x * x * (3 - 2 * x);
  function update(dt) {
    dt = Math.min(dt, 0.05);
    if (cooldown > 0) cooldown -= dt;
    if (playing) {
      t += dt;
      const k = ease(Math.min(1, t / TILT_TIME));
      camera.rotation.set(startPitch + (TILT_PITCH - startPitch) * k, startYaw + TURN_YAW * k, startRoll + (TILT_ROLL - startRoll) * k, 'YXZ');
      if (!videoShown && t >= FADE_IN_AT) { videoShown = true; wrap.classList.add('show'); }
      return;
    }
    const want = ready() && inZone();
    if (want !== shown) { shown = want; promptEl.classList.toggle('show', want); }
  }
  return { update, prompt: () => '', get active() { return playing; } };
}
