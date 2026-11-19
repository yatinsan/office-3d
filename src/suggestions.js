import * as THREE from 'three';
import LAYOUT from '../floorplan/layout.json';
import { labelAt } from './merge.js';

/**
 * Suggestions in the walkthrough.
 *   C  aim at something → suggestion pinned on that spot (aim at a pin → open it)
 *   X  aim at one floor corner, X again at the opposite corner → suggestion for that whole area
 *   L  list of all suggestions
 * With the dev server each one is saved as suggestions/<NNN>-<slug>/suggestion.md plus its attached files
 * (see vite.config.js), so Claude can read it and make the change ("do suggestion 3").
 * Without the dev server they fall back to this browser's storage.
 */
const API = '/api/suggestions';
const LOCAL = 'pixbit-suggestions-v2';
const NAMES = { W: 'Window table', L: 'Long table', E: 'East-wall desk', LOCK: 'Lockers' };
const SIZE = { W: [1.4, 1.2], L: [2.8, 1.2], E: [1.3, 0.8], LOCK: [0.55, 1.25] };
const SECTIONS = ['Corner cabin', 'Cabin 1', 'Cabin 2', 'Lounge', 'Corridor', 'Reception', 'Open workspace', 'Back wall', 'East wall', 'Windows',
  ...LAYOUT.map(it => it.id === 'LOCK' ? 'Lockers' : `${NAMES[it.id[0]]} ${it.id}`)];
const YELLOW = '#ecc828', GREEN = '#3fbf6f';
const MAX_BYTES = 35e6;

export function initSuggestions({ scene, camera, player, world, zoneAt, renderer }) {
  let list = [];
  let useLocal = false;
  let editing = null;          // record being edited (or a draft for a new one)
  let files = [];              // [{ name, type, src|path, data? (new upload) }]
  let removed = [];            // names of saved files to delete on save
  let resumeLock = false;
  let enabled = false;
  let corner = null;           // first corner while marking an area

  // ---------- storage ----------
  async function load() {
    try {
      const r = await fetch(API);
      if (!r.ok) throw new Error(r.status);
      list = await r.json();
    } catch {
      useLocal = true;
      try { list = JSON.parse(localStorage.getItem(LOCAL)) || []; } catch { list = []; }
    }
    refresh();
  }
  async function upsert(rec, newFiles, removeFiles) {
    if (useLocal) {
      rec.n = rec.n ?? list.reduce((m, s) => Math.max(m, s.n || 0), 0) + 1;
      rec.created = rec.created ?? Date.now();
      rec.files = [...(rec.files || []).filter(f => !removeFiles.includes(f.name)),
        ...newFiles.map(f => ({ name: f.name, type: f.type, path: f.data }))];
      const i = list.findIndex(s => s.id === rec.id);
      if (i >= 0) list[i] = rec; else list.push(rec);
      try { localStorage.setItem(LOCAL, JSON.stringify(list)); }
      catch { throw new Error('browser storage is full (start the dev server to save files to the project)'); }
      return rec;
    }
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...rec, newFiles, removeFiles }) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || `server said ${r.status}`);
    const i = list.findIndex(s => s.id === body.id);
    if (i >= 0) list[i] = body; else list.push(body);
    return body;
  }
  async function remove(id) {
    if (!useLocal) await fetch(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    list = list.filter(s => s.id !== id);
    if (useLocal) try { localStorage.setItem(LOCAL, JSON.stringify(list)); } catch {}
  }

  // ---------- where is this? ----------
  function nearItem(x, z) {
    let best = null, bestD = 0.9;
    const zone = zoneAt(x, z);
    for (const it of LAYOUT) {
      if (zoneAt(it.x, it.z) !== zone) continue; // don't name the lockers from the reception side of their wall
      const key = it.id === 'LOCK' ? 'LOCK' : it.id[0];
      let [w, d] = SIZE[key] || [1, 1];
      if ((it.rot || 0) % 180) [w, d] = [d, w];
      const dist = Math.hypot(Math.max(0, Math.abs(x - it.x) - w / 2), Math.max(0, Math.abs(z - it.z) - d / 2));
      if (dist < bestD) { bestD = dist; best = it.id === 'LOCK' ? 'Lockers' : `${NAMES[key]} ${it.id}`; }
    }
    return best;
  }
  const r2 = v => Math.round(v * 100) / 100;
  const isImg = f => /^image\/(jpeg|png|gif|webp|avif|svg\+xml|bmp)$/.test(f.type);
  const fileSrc = f => f.src || f.path;

  // ---------- 3D markers ----------
  const marks = new THREE.Group();
  marks.name = 'suggestion-marks';
  scene.add(marks);
  const headGeo = new THREE.SphereGeometry(0.07, 16, 12);
  const stickGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 6);
  const matStick = new THREE.MeshBasicMaterial({ color: '#222' });
  const up = new THREE.Vector3(0, 1, 0);
  const mats = {};
  const mat = (c, o = 1) => mats[c + o] || (mats[c + o] = new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o === 1, side: THREE.DoubleSide }));

  function tag(n, color) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#111'; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
    g.strokeStyle = color; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 28px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), 32, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(0.22, 0.22, 1);
    sp.renderOrder = 10;
    return sp;
  }
  function areaMesh({ x0, z0, x1, z1 }, color, parent) {
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color, 0.18));
    fill.rotation.x = -Math.PI / 2;
    fill.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2);
    fill.renderOrder = 3;
    const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => new THREE.Vector3(x, 0.025, z));
    const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color }));
    parent.add(fill, edge);
  }
  function pin(parent, base, n, len, color, num) {
    const stick = new THREE.Mesh(stickGeo, matStick);
    stick.scale.y = len;
    stick.quaternion.setFromUnitVectors(up, n);
    stick.position.copy(base).addScaledVector(n, len / 2);
    const head = new THREE.Mesh(headGeo, mat(color));
    head.position.copy(base).addScaledVector(n, len);
    const t = tag(num, color);
    t.position.copy(head.position).add(new THREE.Vector3(0, 0.18, 0));
    parent.add(stick, head, t);
  }
  function renderMarks() {
    for (const c of [...marks.children]) {
      marks.remove(c);
      c.traverse(o => { o.material?.map?.dispose(); if (o.isLine || o.geometry?.type === 'PlaneGeometry') o.geometry.dispose(); });
    }
    for (const s of list) {
      if (s.status === 'done') continue;   // closed suggestions: no pin in 3D, still in the L list
      const g = new THREE.Group();
      g.userData.sid = s.id;
      const color = YELLOW;
      if (s.area) {
        areaMesh(s.area, color, g);
        pin(g, new THREE.Vector3((s.area.x0 + s.area.x1) / 2, 0, (s.area.z0 + s.area.z1) / 2), up, 1.1, color, s.n);
      } else {
        pin(g, new THREE.Vector3(...s.point), new THREE.Vector3(...(s.normal || [0, 1, 0])).normalize(), 0.28, color, s.n);
      }
      marks.add(g);
    }
  }
  const draft = new THREE.Group();   // area being marked
  scene.add(draft);
  function clearDraft() { for (const c of [...draft.children]) draft.remove(c); }

  // ---------- UI ----------
  const css = document.createElement('style');
  css.textContent = `
  .sg-modal { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.5); z-index:20; padding:16px; }
  .sg-hidden { display:none !important; }
  .sg-card { width:min(520px,100%); max-height:100%; overflow:auto; background:#1b1b1b; color:#eee; border:1px solid ${YELLOW}; border-radius:12px; padding:18px 20px; font-size:14px; box-sizing:border-box; }
  .sg-card h2 { margin:0 0 6px; font-size:18px; color:#fff; }
  .sg-card label.f { display:block; font-size:12px; color:#aaa; margin:10px 0 4px; }
  .sg-card input[type=text], .sg-card textarea { width:100%; box-sizing:border-box; background:#111; color:#fff; border:1px solid #444; border-radius:8px; padding:8px 10px; font:inherit; }
  .sg-card textarea { min-height:110px; resize:vertical; }
  .sg-card input:focus, .sg-card textarea:focus { outline:none; border-color:${YELLOW}; }
  .sg-meta { color:#999; font-size:12px; margin-top:4px; }
  .sg-drop { margin-top:4px; border:1.5px dashed #555; border-radius:8px; padding:12px; text-align:center; color:#aaa; cursor:pointer; }
  .sg-drop.over, .sg-drop:focus { border-color:${YELLOW}; color:${YELLOW}; outline:none; }
  .sg-files { display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:8px; margin-top:8px; }
  .sg-file { position:relative; background:#111; border:1px solid #333; border-radius:8px; overflow:hidden; font-size:12px; }
  .sg-file img { width:100%; height:80px; object-fit:cover; display:block; }
  .sg-file .doc { height:80px; display:flex; align-items:center; justify-content:center; color:${YELLOW}; font-weight:700; font-size:16px; }
  .sg-file span { display:block; padding:4px 6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sg-file button { position:absolute; top:4px; right:4px; padding:1px 7px !important; }
  .sg-check { display:flex; align-items:center; gap:8px; margin-top:12px; }
  .sg-reply { margin-top:10px; background:#11261a; border:1px solid #2c5a3c; border-radius:8px; padding:8px 10px; white-space:pre-wrap; font-size:13px; }
  .sg-row { display:flex; gap:8px; margin-top:14px; align-items:center; flex-wrap:wrap; }
  .sg-row .sp { flex:1; }
  .sg-card button, .sg-list button { font:inherit; font-size:13px; padding:7px 12px; border-radius:7px; border:1px solid #555; background:#2a2a2a; color:#eee; cursor:pointer; }
  .sg-card button:hover, .sg-list button:hover { border-color:#999; }
  .sg-card button.pri { background:${YELLOW}; color:#111; border-color:${YELLOW}; font-weight:700; }
  .sg-card button.del { color:#ff8a7a; }
  .sg-err { color:#ff8a7a; font-size:13px; margin-top:8px; min-height:1em; }
  .sg-list { position:fixed; top:0; right:0; bottom:0; width:min(380px,100%); background:#161616; color:#eee; border-left:1px solid #333; z-index:15; display:flex; flex-direction:column; font-size:14px; }
  .sg-list header { display:flex; align-items:center; padding:14px 16px; border-bottom:1px solid #333; gap:8px; }
  .sg-list header b { flex:1; font-size:16px; }
  .sg-items { overflow:auto; padding:8px 12px 16px; }
  .sg-item { display:flex; gap:10px; padding:12px 4px; border-bottom:1px solid #2a2a2a; }
  .sg-num { flex:none; width:26px; height:26px; border-radius:50%; background:#111; border:2px solid ${YELLOW}; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; }
  .sg-num.done { border-color:${GREEN}; }
  .sg-body { flex:1; min-width:0; }
  .sg-body p { margin:0 0 6px; white-space:pre-wrap; word-break:break-word; }
  .sg-body small { color:#999; display:block; margin-bottom:6px; }
  .sg-badge { display:inline-block; font-size:11px; padding:1px 7px; border-radius:10px; background:#3a3315; color:${YELLOW}; margin-right:6px; }
  .sg-badge.done { background:#16301f; color:${GREEN}; }
  .sg-thumbs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px; }
  .sg-thumbs img { width:72px; height:54px; object-fit:cover; border-radius:5px; }
  .sg-thumbs a { font-size:12px; color:${YELLOW}; }
  .sg-reply-l { font-size:12px; color:#9fd8b0; background:#11261a; border-radius:6px; padding:6px 8px; margin-bottom:6px; white-space:pre-wrap; }
  .sg-empty { color:#999; padding:16px 4px; line-height:1.6; }
  .sg-toast { position:fixed; left:50%; bottom:40px; transform:translateX(-50%); background:rgba(0,0,0,.85); color:#fff; padding:8px 16px; border-radius:6px; z-index:30; font-size:14px; pointer-events:none; opacity:0; transition:opacity .3s; max-width:90vw; text-align:center; }
  .sg-toast.show { opacity:1; }`;
  document.head.appendChild(css);

  const modal = document.createElement('div');
  modal.className = 'sg-modal sg-hidden';
  modal.innerHTML = `<div class="sg-card" role="dialog" aria-modal="true" aria-labelledby="sg-title">
    <h2 id="sg-title">New suggestion</h2>
    <label class="f" for="sg-section">Section</label>
    <input type="text" id="sg-section" list="sg-sections" placeholder="e.g. Long table L2, Reception, Cabin 1">
    <datalist id="sg-sections">${SECTIONS.map(s => `<option value="${s}">`).join('')}</datalist>
    <div class="sg-meta"></div>
    <label class="f" for="sg-text">What needs to change</label>
    <textarea id="sg-text" placeholder="Describe what Claude should change here, e.g. make this table 3 m long and add a plant at the end"></textarea>
    <label class="f">Images and files</label>
    <div class="sg-drop" tabindex="0">Click to add, drop files here, or paste (⌘V). Any file type.</div>
    <input type="file" multiple hidden>
    <div class="sg-files"></div>
    <label class="sg-check"><input type="checkbox" id="sg-done"> Done</label>
    <div class="sg-reply sg-hidden"></div>
    <div class="sg-err" role="alert"></div>
    <div class="sg-row"><button type="button" class="del">Delete</button><span class="sp"></span><button type="button" class="cancel">Cancel</button><button type="button" class="pri">Save</button></div>
  </div>`;
  document.body.appendChild(modal);
  const $ = sel => modal.querySelector(sel);
  const ta = $('#sg-text'), sec = $('#sg-section'), drop = $('.sg-drop'), picker = $('input[type=file]'), filesEl = $('.sg-files'),
    err = $('.sg-err'), meta = $('.sg-meta'), doneBox = $('#sg-done'), replyEl = $('.sg-reply');

  const panel = document.createElement('div');
  panel.className = 'sg-list sg-hidden';
  panel.innerHTML = `<header><b>Suggestions</b><button type="button" class="close">Close (L)</button></header><div class="sg-items"></div>`;
  document.body.appendChild(panel);
  const items = panel.querySelector('.sg-items');

  const toastEl = document.createElement('div');
  toastEl.className = 'sg-toast';
  document.body.appendChild(toastEl);
  let toastT;
  function toast(t, ms = 2600) { toastEl.textContent = t; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms); }

  const whereText = s => s.area
    ? `Area x ${r2(s.area.x0)}–${r2(s.area.x1)} m, z ${r2(s.area.z0)}–${r2(s.area.z1)} m`
    : `Point x ${s.point[0]}, z ${s.point[2]}`;

  function renderList() {
    items.innerHTML = '';
    if (!list.length) {
      items.innerHTML = '<div class="sg-empty">No suggestions yet.<br>Aim the dot at something and press <b>C</b>, or press <b>X</b> on two floor corners to mark an area.</div>';
      return;
    }
    for (const s of [...list].sort((a, b) => a.n - b.n)) {
      const row = document.createElement('div');
      row.className = 'sg-item';
      row.innerHTML = `<div class="sg-num ${s.status === 'done' ? 'done' : ''}">${s.n}</div><div class="sg-body"><small></small><p></p><div class="sg-thumbs"></div></div>`;
      const small = row.querySelector('small');
      small.innerHTML = `<span class="sg-badge ${s.status === 'done' ? 'done' : ''}">${s.status === 'done' ? 'done' : 'open'}</span>`;
      small.append(s.section || s.zone || '');
      row.querySelector('p').textContent = s.text;
      if (s.reply) row.querySelector('p').after(Object.assign(document.createElement('div'), { className: 'sg-reply-l', textContent: `Claude: ${s.reply}` }));
      const th = row.querySelector('.sg-thumbs');
      for (const f of s.files || []) {
        if (isImg(f)) th.append(Object.assign(document.createElement('img'), { src: fileSrc(f), alt: f.name, title: f.name }));
        else th.append(Object.assign(document.createElement('a'), { href: fileSrc(f), textContent: f.name, target: '_blank', download: f.name }));
      }
      const body = row.querySelector('.sg-body');
      const btns = document.createElement('div');
      btns.className = 'sg-row';
      btns.style.marginTop = '2px';
      const go = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Go there' });
      go.onclick = () => goTo(s);
      const ed = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Open' });
      ed.onclick = () => { panel.classList.add('sg-hidden'); openForm(s); };
      const del = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Delete' });
      del.style.color = '#ff8a7a';
      armDelete(del, () => deleteSuggestion(s));
      btns.append(go, ed, del);
      body.appendChild(btns);
      items.appendChild(row);
    }
  }
  function refresh() { renderMarks(); renderList(); }

  // ---------- attachments ----------
  function renderFiles() {
    filesEl.innerHTML = '';
    files.forEach((f, i) => {
      const card = document.createElement('div');
      card.className = 'sg-file';
      if (isImg(f)) card.append(Object.assign(document.createElement('img'), { src: fileSrc(f), alt: f.name }));
      else card.append(Object.assign(document.createElement('div'), { className: 'doc', textContent: (f.name.split('.').pop() || 'file').slice(0, 5).toUpperCase() }));
      card.append(Object.assign(document.createElement('span'), { textContent: f.name, title: f.name }));
      const x = Object.assign(document.createElement('button'), { type: 'button', textContent: '×' });
      x.setAttribute('aria-label', `Remove ${f.name}`);
      x.onclick = () => { if (!f.data) removed.push(f.name); files.splice(i, 1); renderFiles(); };
      card.append(x);
      filesEl.append(card);
    });
  }
  const asDataURL = blob => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = bad; r.readAsDataURL(blob); });
  async function addFiles(incoming) {
    err.textContent = '';
    for (const f of incoming) {
      let name = f.name || `pasted-${Date.now()}.png`, type = f.type || 'application/octet-stream', data;
      if (/^image\/(jpeg|png|webp)$/.test(type) && f.size > 1.5e6) {
        // shrink big photos so the project doesn't fill up; anything else is kept as-is
        try {
          const bmp = await createImageBitmap(f);
          const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
          const c = document.createElement('canvas');
          c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
          c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
          data = c.toDataURL('image/jpeg', 0.85); type = 'image/jpeg'; name = name.replace(/\.\w+$/, '') + '.jpg';
        } catch { /* keep the original */ }
      }
      data = data || await asDataURL(f);
      const total = files.reduce((t, x) => t + (x.data?.length || 0), 0) + data.length;
      if (total > MAX_BYTES) { err.textContent = `${name} is too big to add (keep new files under ~25 MB per save).`; continue; }
      files.push({ name, type, data, src: data });
    }
    renderFiles();
  }
  drop.onclick = () => picker.click();
  drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); } };
  picker.onchange = () => { addFiles([...picker.files]); picker.value = ''; };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); };
  modal.addEventListener('paste', e => { const fs = [...e.clipboardData.files]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
  ta.oninput = () => { err.textContent = ''; };

  // ---------- form ----------
  const isOpen = () => !modal.classList.contains('sg-hidden');
  let onResumeFailed = () => {};
  function openForm(s) {
    editing = s;
    files = (s.files || []).map(f => ({ ...f }));
    removed = [];
    $('#sg-title').textContent = s.id ? `Suggestion ${s.n}` : (s.area ? 'New suggestion for this area' : 'New suggestion');
    sec.value = s.section || [s.near, s.zone].filter(Boolean).join(' · ');
    meta.textContent = whereText(s) + (s.folder ? ` · saved in suggestions/${s.folder}/` : '');
    ta.value = s.text || '';
    doneBox.checked = s.status === 'done';
    $('.sg-check').classList.toggle('sg-hidden', !s.id);
    replyEl.textContent = s.reply ? `Claude: ${s.reply}` : '';
    replyEl.classList.toggle('sg-hidden', !s.reply);
    $('.del').classList.toggle('sg-hidden', !s.id);
    err.textContent = '';
    renderFiles();
    resumeLock = !!document.pointerLockElement;
    modal.classList.remove('sg-hidden');
    player.state.paused = true;
    if (document.pointerLockElement) document.exitPointerLock();
    setTimeout(() => ta.focus(), 30);
  }
  function closeForm() {
    modal.classList.add('sg-hidden');
    editing = null; files = []; removed = [];
    clearDraft();
    player.state.paused = false;
    if (resumeLock) {
      try { const p = renderer.domElement.requestPointerLock(); if (p?.catch) p.catch(() => onResumeFailed()); }
      catch { onResumeFailed(); }
    }
  }
  $('.cancel').onclick = closeForm;
  $('.pri').onclick = async () => {
    const text = ta.value.trim();
    if (!text) { err.textContent = 'Write what needs to change first.'; ta.focus(); return; }
    const rec = { ...editing, text, section: sec.value.trim(), status: doneBox.checked ? 'done' : 'open', updated: Date.now() };
    delete rec.near;
    if (!rec.id) rec.id = `s${Date.now().toString(36)}`;
    const newFiles = files.filter(f => f.data).map(({ name, type, data }) => ({ name, type, data }));
    $('.pri').disabled = true; $('.pri').textContent = 'Saving…';
    try {
      const saved = await upsert(rec, newFiles, removed);
      refresh();
      toast(useLocal ? `Suggestion ${saved.n} saved in this browser` : `Suggestion ${saved.n} saved to suggestions/${saved.folder}/`);
      closeForm();
    } catch (e) {
      err.textContent = `Could not save: ${e.message}`;
    } finally { $('.pri').disabled = false; $('.pri').textContent = 'Save'; }
  };
  /** Button that needs a second click within 4 s: "Delete" → "Click again to delete". */
  function armDelete(btn, run) {
    let armed = 0;
    btn.onclick = async () => {
      if (!armed) {
        btn.textContent = 'Click again to delete';
        btn.style.borderColor = '#ff8a7a';
        armed = setTimeout(() => { armed = 0; btn.textContent = 'Delete'; btn.style.borderColor = ''; }, 4000);
        return;
      }
      clearTimeout(armed); armed = 0;
      btn.disabled = true;
      try { await run(); } finally { btn.disabled = false; btn.textContent = 'Delete'; btn.style.borderColor = ''; }
    };
  }
  async function deleteSuggestion(s) {
    await remove(s.id);
    refresh();
    toast(`Suggestion ${s.n} deleted`);
  }
  armDelete($('.del'), async () => { if (editing?.id) { const s = editing; closeForm(); await deleteSuggestion(s); } });
  panel.querySelector('.close').onclick = () => togglePanel(false);
  function togglePanel(show = panel.classList.contains('sg-hidden')) {
    panel.classList.toggle('sg-hidden', !show);
    if (show) { renderList(); if (document.pointerLockElement) document.exitPointerLock(); }
  }
  function goTo(s) {
    if (s.view) {
      player.pos.set(s.view.x, 0, s.view.z);
      camera.position.set(s.view.x, camera.position.y, s.view.z);
      camera.quaternion.setFromEuler(new THREE.Euler(s.view.pitch, s.view.yaw, 0, 'YXZ'));
    }
    togglePanel(false);
    toast(`${s.n}: ${s.text.slice(0, 70)}${s.text.length > 70 ? '…' : ''}`);
  }

  // ---------- aiming ----------
  const ray = new THREE.Raycaster();
  ray.far = 40;
  const centre = new THREE.Vector2(0, 0);
  function aim() {
    ray.setFromCamera(centre, camera);
    const hit = ray.intersectObjects([marks, world], true).find(h => h.object.visible && !h.object.isLine);
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.sid && o !== scene) o = o.parent;
    if (o?.userData.sid) return { mark: list.find(s => s.id === o.userData.sid), point: hit.point };
    const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : up.clone();
    if (n.dot(ray.ray.direction) > 0) n.negate();
    return { point: hit.point, normal: n, target: targetName(labelAt(hit), hit.point, n) };
  }
  /** Readable name for what the dot is on, e.g. "East wall", "Chair · Long table L2", "Floor". */
  function targetName(label, p, n) {
    if (label === 'Wall' || label === 'Glass wall') {
      if (p.x < 0.35) return `Window ${label.toLowerCase()}`;
      if (p.x > 9.8 && p.z > 9.5) return 'East wall';
      if (p.z > 18.4) return 'Back wall';
      return `${label} (${zoneAt(p.x, p.z)})`;
    }
    if (label) return label;
    if (n.y > 0.7 && p.y < 0.1) return 'Floor';
    if (n.y < -0.7) return 'Ceiling';
    return '';
  }
  function view() {
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    return { x: r2(player.pos.x), z: r2(player.pos.z), yaw: r2(e.y), pitch: r2(e.x) };
  }
  function suggestHere() {
    const a = aim();
    if (!a) { toast('Aim the dot at something first'); return; }
    if (a.mark) { openForm(a.mark); return; }
    const p = a.point;
    openForm({
      point: [r2(p.x), r2(p.y), r2(p.z)],
      normal: [r2(a.normal.x), r2(a.normal.y), r2(a.normal.z)],
      zone: zoneAt(p.x, p.z), near: a.target || nearItem(p.x, p.z), target: a.target, view: view(),
    });
  }
  function markCorner() {
    const a = aim();
    if (!a) { toast('Aim the dot at the floor first'); return; }
    const { x, z } = a.point;
    if (!corner) {
      corner = { x, z };
      clearDraft();
      pin(draft, new THREE.Vector3(x, 0, z), up, 0.5, YELLOW, '1');
      toast('Corner 1 set. Aim at the opposite corner and press X (Esc cancels).', 4000);
      return;
    }
    const area = { x0: r2(Math.min(corner.x, x)), z0: r2(Math.min(corner.z, z)), x1: r2(Math.max(corner.x, x)), z1: r2(Math.max(corner.z, z)) };
    corner = null;
    clearDraft();
    if (area.x1 - area.x0 < 0.2 || area.z1 - area.z0 < 0.2) { toast('That area is too small: pick two corners further apart'); return; }
    areaMesh(area, YELLOW, draft);
    const cx = (area.x0 + area.x1) / 2, cz = (area.z0 + area.z1) / 2;
    openForm({ area, point: [r2(cx), 0, r2(cz)], normal: [0, 1, 0], zone: zoneAt(cx, cz), near: nearItem(cx, cz), view: view() });
  }

  addEventListener('keydown', e => {
    if (isOpen()) {
      if (!enabled) return;
      if (e.code === 'Escape') { e.preventDefault(); closeForm(); }
      if (e.code === 'Enter' && (e.metaKey || e.ctrlKey)) $('.pri').click();
      return;
    }
    if (!enabled) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.code === 'Escape' && corner) { corner = null; clearDraft(); toast('Area cancelled'); }
    if (e.code === 'KeyC') suggestHere();
    if (e.code === 'KeyX') markCorner();
    if (e.code === 'KeyL') togglePanel();
  });

  load();
  return {
    isOpen: () => isOpen() || !panel.classList.contains('sg-hidden'),
    setEnabled(on) {
      enabled = on;
      marks.visible = on;
      if (!on) { if (isOpen()) closeForm(); togglePanel(false); corner = null; clearDraft(); }
    },
    onResumeFailed(fn) { onResumeFailed = fn; },
  };
}
