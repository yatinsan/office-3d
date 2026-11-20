/**
 * Game modes: Free Walk + any registered game (Open World). The menu's Play page lists them.
 * A mode is { id, name, desc, start(), stop(), update(dt, active) }. Free Walk is built in and does nothing.
 *   choose(id)  pick a mode (remembered), without starting it
 *   play()      start the chosen mode
 *   quit()      stop the running mode (back to the start menu)
 */
const KEY = 'pixbit-gamemode';

export function initModes({ defaultId = 'free' } = {}) {
  const modes = [{ id: 'free', name: 'Free Walk', desc: 'Just explore the office', start() {}, stop() {}, update() {} }];
  let current = modes[0], running = false;

  function choose(id) {
    const m = modes.find((x) => x.id === id) || modes[0];
    if (running && m !== current) { current.stop(); running = false; }
    current = m;
    try { localStorage.setItem(KEY, m.id); } catch {}
  }
  function play() { if (!running) { running = true; current.start(); } }
  function quit() { if (running) { current.stop(); running = false; } }

  function register(mode) {
    modes.push(mode);
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch {}
    if (saved === mode.id || mode.id === defaultId) current = mode; // Free Walk is hidden for now, so the default always wins
  }

  return {
    register, choose, play, quit,
    update: (dt, active) => { if (running) current.update(dt, active); },
    get current() { return current; },
    get running() { return running; },
    /** Modes listed in the Play menu. Free Walk is hidden for now: remove the filter to bring it back. */
    get list() { return modes.filter((x) => x.id !== 'free'); },
  };
}
