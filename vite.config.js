import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Dev-server API for the in-walkthrough suggestions (src/suggestions.js).
 * Each suggestion gets its own folder:  suggestions/<NNN>-<slug>/suggestion.md  + its attached files.
 * suggestions/suggestions.json is the index the 3D view reads (pins, areas, status).
 *   GET    /api/suggestions        → list
 *   POST   /api/suggestions        → create/update one ({ ...record, newFiles: [{name,type,data}], removeFiles: [name] })
 *   DELETE /api/suggestions/:id    → remove one (and its folder)
 */
function suggestionsApi() {
  const root = path.resolve('suggestions');
  const index = path.join(root, 'suggestions.json');
  const load = () => { try { return JSON.parse(fs.readFileSync(index, 'utf8')); } catch { return []; } };
  // Older records (from the first version) have no number/folder: give them one and write their suggestion.md.
  const read = () => {
    const list = load();
    let changed = false;
    for (const rec of list) {
      if (rec.n && rec.folder) continue;
      rec.n = rec.n || list.reduce((m, s) => Math.max(m, s.n || 0), 0) + 1;
      rec.folder = rec.folder || `${String(rec.n).padStart(3, '0')}-${slug(rec.text || 'note')}`;
      rec.section = rec.section || [rec.near, rec.zone].filter(Boolean).join(' · ');
      rec.status = rec.status || 'open';
      rec.files = rec.files || [];
      const dir = path.join(root, rec.folder);
      fs.mkdirSync(dir, { recursive: true });
      if (rec.image) {
        const src = path.resolve(rec.image), name = safeName(path.basename(rec.image));
        if (fs.existsSync(src)) { fs.renameSync(src, path.join(dir, name)); rec.files.push({ name, type: 'image/jpeg', path: `suggestions/${rec.folder}/${name}` }); }
      }
      delete rec.image; delete rec.near;
      fs.writeFileSync(path.join(dir, 'suggestion.md'), markdown(rec));
      changed = true;
    }
    if (changed) write(list);
    return list;
  };
  const write = (list) => { fs.mkdirSync(root, { recursive: true }); fs.writeFileSync(index, JSON.stringify(list, null, 2) + '\n'); };
  const safeId = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 6).join('-') || 'note';
  const safeName = (n) => path.basename(String(n)).replace(/[^\w.\- ]+/g, '_').replace(/^\.+/, '').slice(-80) || 'file';
  const send = (res, code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
  const f2 = (v) => Number(v).toFixed(2);

  function markdown(rec) {
    const first = rec.text.split('\n')[0].slice(0, 80);
    const where = rec.area
      ? `Area on the floor: x ${f2(rec.area.x0)}–${f2(rec.area.x1)} m, z ${f2(rec.area.z0)}–${f2(rec.area.z1)} m`
      : `Point: x ${f2(rec.point[0])}, y ${f2(rec.point[1])}, z ${f2(rec.point[2])} m`;
    const files = (rec.files || []).map((f) => /^image\//.test(f.type) ? `- ![${f.name}](${encodeURI(f.name)})` : `- [${f.name}](${encodeURI(f.name)})`);
    return [
      `# Suggestion ${rec.n}: ${first}`, '',
      `- **Status:** ${rec.status || 'open'}`,
      `- **Section:** ${rec.section || rec.zone || '—'}`,
      `- **${where.split(':')[0]}:** ${where.split(': ')[1]} (x from the window wall, z from the corner-cabin end; see floorplan/floorplan_proposed.png)`,
      `- **Created:** ${new Date(rec.created).toISOString().slice(0, 16).replace('T', ' ')}` +
        (rec.updated && rec.updated !== rec.created ? ` · **Updated:** ${new Date(rec.updated).toISOString().slice(0, 16).replace('T', ' ')}` : ''),
      '', '## What needs to change', '', rec.text, '',
      '## Attachments', '', files.length ? files.join('\n') : '_None_', '',
      '## Claude\'s notes', '', rec.reply || '_Not done yet. Ask Claude: "do suggestion ' + rec.n + '"._', '',
    ].join('\n');
  }

  return {
    name: 'suggestions-api',
    configureServer(server) {
      server.middlewares.use('/api/suggestions', (req, res) => {
        try {
          if (req.method === 'GET') return send(res, 200, read());
          if (req.method === 'DELETE') {
            const id = safeId(req.url.slice(1));
            const list = read();
            const old = list.find((s) => s.id === id);
            if (old?.folder) fs.rmSync(path.join(root, safeName(old.folder)), { recursive: true, force: true });
            write(list.filter((s) => s.id !== id));
            return send(res, 200, { ok: true });
          }
          if (req.method !== 'POST') return send(res, 405, { error: 'method' });
          const chunks = [];
          let size = 0;
          req.on('data', (c) => { size += c.length; if (size < 60e6) chunks.push(c); });
          req.on('end', () => {
            try {
              if (size >= 60e6) return send(res, 413, { error: 'Attachments are too large (max ~40 MB per save)' });
              const { newFiles = [], removeFiles = [], ...rec } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              rec.id = safeId(rec.id);
              if (!rec.id || typeof rec.text !== 'string' || !rec.text.trim()) return send(res, 400, { error: 'id and text required' });
              const list = read();
              const old = list.find((s) => s.id === rec.id);
              rec.n = old?.n ?? list.reduce((m, s) => Math.max(m, s.n || 0), 0) + 1;
              rec.created = old?.created ?? Date.now();
              rec.folder = old?.folder ?? `${String(rec.n).padStart(3, '0')}-${slug(rec.text)}`;
              const dir = path.join(root, rec.folder);
              fs.mkdirSync(dir, { recursive: true });
              // attachments
              const drop = new Set(removeFiles.map(safeName));
              let files = (old?.files || []).filter((f) => !drop.has(f.name));
              for (const n of drop) if (n !== 'suggestion.md') fs.rmSync(path.join(dir, n), { force: true });
              for (const f of newFiles) {
                const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(f.data || '');
                if (!m) continue;
                let name = safeName(f.name);
                if (name === 'suggestion.md') name = 'attached-suggestion.md';
                const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
                for (let k = 2; files.some((x) => x.name === name); k++) name = `${base}-${k}${ext}`;
                fs.writeFileSync(path.join(dir, name), m[2] ? Buffer.from(m[3], 'base64') : decodeURIComponent(m[3]));
                files.push({ name, type: f.type || m[1] || 'application/octet-stream', path: `suggestions/${rec.folder}/${name}` });
                if (/\.hei[cf]$/i.test(name)) {
                  const jpg = name.replace(/\.\w+$/, '.jpg');
                  try {
                    execFileSync('sips', ['-s', 'format', 'jpeg', '-Z', '2000', path.join(dir, name), '--out', path.join(dir, jpg)], { stdio: 'ignore' });
                    files.push({ name: jpg, type: 'image/jpeg', path: `suggestions/${rec.folder}/${jpg}` });
                  } catch { /* not on macOS: keep the HEIC only */ }
                }
              }
              rec.files = files;
              fs.writeFileSync(path.join(dir, 'suggestion.md'), markdown(rec));
              const i = list.findIndex((s) => s.id === rec.id);
              if (i >= 0) list[i] = rec; else list.push(rec);
              write(list);
              send(res, 200, rec);
            } catch (e) { send(res, 400, { error: e.message }); }
          });
        } catch (e) { send(res, 500, { error: e.message }); }
      });
    },
  };
}

/**
 * Dev-server endpoint for src/exportUnreal.js: the browser POSTs the world (?file=office.glb), shared models
 * (?file=<name>.glb) and their placements (?file=instances.json) into unreal/ for unreal/import_office.py.
 */
function exportApi() {
  return {
    name: 'export-api',
    configureServer(server) {
      server.middlewares.use('/api/export-glb', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
        const name = new URL(req.url, 'http://x').searchParams.get('file') || 'office.glb';
        if (!/^[\w-]+\.(glb|json)$/.test(name)) { res.statusCode = 400; return res.end(); }
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          const dir = path.resolve('unreal');
          fs.mkdirSync(dir, { recursive: true });
          const buf = Buffer.concat(chunks);
          fs.writeFileSync(path.join(dir, name), buf);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, bytes: buf.length }));
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1000 },
  plugins: [suggestionsApi(), exportApi()],
  server: { watch: { ignored: ['**/suggestions/**'] } },
});
