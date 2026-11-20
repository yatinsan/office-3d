/**
 * GTA-style text menu: a stack of pages, each a list of plain text lines.
 * Up / Down (or W / S) move the highlight, Enter / Space picks, Esc goes back, hovering with the mouse highlights too.
 *
 * page = { title, items: [{ label: string | () => string, hint?: string, action() }], extra?: Node, back?() }
 * A page may also be a function returning a page (rebuilt every time it is shown).
 */
export function initMenu({ root, active, foot = () => '' }) {
  let stack = [], index = 0, shownAt = 0;
  const resolve = (p) => (typeof p === 'function' ? p() : p);
  const page = () => stack[stack.length - 1];
  const txt = (v) => (typeof v === 'function' ? v() : v);

  function render() {
    const pg = page();
    root.innerHTML = '';
    if (!pg) return;
    const add = (cls, html) => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; root.appendChild(d); return d; };
    add('mi-title', pg.title || '');
    if (pg.extra) root.appendChild(pg.extra);
    pg.items.forEach((it, i) => {
      const d = add('mi' + (i === index ? ' sel' : ''), txt(it.label));
      d.addEventListener('mouseenter', () => { if (index !== i) { index = i; render(); } });
      d.addEventListener('click', (e) => { e.stopPropagation(); index = i; pick(); });
    });
    add('mi-hint', pg.items[index]?.hint || '');
    add('mi-foot', foot() || '');
    add('mi-keys', '&uarr; &darr; select &nbsp;&middot;&nbsp; Enter confirm &nbsp;&middot;&nbsp; Esc back');
  }
  function pick() { const it = page()?.items[index]; if (it) it.action(); }

  /** Show a root page (clears the stack). */
  function open(rootPage) { stack = [resolve(rootPage)]; index = 0; shownAt = performance.now(); render(); }
  function push(pg) { stack.push(resolve(pg)); index = 0; render(); }
  function back() {
    const pg = page();
    if (stack.length > 1) { stack.pop(); index = 0; render(); }
    else if (pg && pg.back) pg.back();
  }
  const refresh = render;

  addEventListener('keydown', (e) => {
    if (!active() || !page()) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const n = page().items.length;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { index = (index + 1) % n; render(); e.preventDefault(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { index = (index - 1 + n) % n; render(); e.preventDefault(); }
    else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { e.preventDefault(); pick(); }
    else if (e.code === 'Escape') {
      if (performance.now() - shownAt < 200) return; // the same Esc that opened the menu
      back();
    }
  });
  return { open, push, back, refresh, get depth() { return stack.length; } };
}
