/**
 * Game modes: the Esc / start menu lists them (Free Walk + any registered game). The picked mode is remembered.
 * A mode is { id, name, desc, start(), stop(), update(dt, active) }. Free Walk is built in and does nothing.
 */
const KEY = 'pixbit-gamemode';

export function initModes({ card, anchor }) {
  const modes = [{ id: 'free', name: 'Free Walk', desc: 'Just explore the office', start() {}, stop() {}, update() {} }];
  let current = modes[0];

  const wrap = document.createElement('div');
  wrap.className = 'modes';
  wrap.innerHTML = '<div class="modes-h">Game mode</div><div class="modes-list"></div><div class="modes-d"></div>';
  card.insertBefore(wrap, anchor);
  const list = wrap.querySelector('.modes-list');
  const desc = wrap.querySelector('.modes-d');
  // Clicking the picker must not start the game (the overlay itself starts on click).
  wrap.addEventListener('click', (e) => e.stopPropagation());

  function render() {
    list.innerHTML = '';
    for (const m of modes) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = m.name;
      b.className = m === current ? 'on' : '';
      b.addEventListener('click', () => select(m.id));
      list.appendChild(b);
    }
    desc.textContent = current.desc;
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
