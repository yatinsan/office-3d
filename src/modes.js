/**
 * Game modes: the Esc / start menu lists them as big buttons (Free Walk + any registered game). The picked mode is remembered.
 * A mode is { id, name, desc, start(), stop(), update(dt, active) }. Free Walk is built in and does nothing.
 * Clicking a mode button selects it and lets the click bubble to the overlay, which starts the game.
 */
const KEY = 'pixbit-gamemode';

const ICONS = {
  free: '<path d="M8 21l3-6 3 3v3"/><path d="M11 15l1-5-3 2-1 3"/><path d="M12 10l3 2h3"/><circle cx="13.5" cy="5" r="2"/>',
  hunt: '<circle cx="6.5" cy="15.5" r="3.5"/><circle cx="17.5" cy="15.5" r="3.5"/><path d="M10 15h4M5 12l2-7h3v10M19 12l-2-7h-3v10"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
};

export function initModes({ list }) {
  const modes = [{ id: 'free', name: 'Free Walk', desc: 'Just explore the office', start() {}, stop() {}, update() {} }];
  let current = modes[0];

  function render() {
    list.innerHTML = '';
    for (const m of modes) {
      const on = m === current;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mode-btn' + (on ? ' on' : '');
      b.innerHTML = `<svg viewBox="0 0 24 24">${on ? ICONS.play : (ICONS[m.id] || ICONS.play)}</svg>
        <span class="name">${on ? 'Play · ' : ''}${m.name}<span class="desc">${m.desc || ''}</span></span><span class="arrow">&rsaquo;</span>`;
      b.addEventListener('click', () => select(m.id)); // bubbles to the overlay → starts the game
      list.appendChild(b);
    }
  }

  function select(id) {
    const m = modes.find((x) => x.id === id) || modes[0];
    if (m !== current) { current.stop(); current = m; m.start(); }
    try { localStorage.setItem(KEY, m.id); } catch {}
    render();
  }

  function register(mode) {
    modes.push(mode);
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch {}
    render();
    if (saved === mode.id) select(mode.id);
  }

  render();
  return { register, select, update: (dt, active) => current.update(dt, active), get current() { return current; } };
}
