import * as THREE from 'three';
import { TV } from './world/game.js';

/**
 * Game room TV arcade (suggestion 18). Walk up to the TV and press E:
 *   game list on the screen → pick a game → play it on the TV; F = full screen, Backspace = back, E (in the list) = TV off.
 * While the TV is on it owns the keyboard (movement, doors and suggestion keys are paused).
 * Games: Snake (playable); more slots are listed as "coming soon".
 */
const REACH = 3.4;
const CW = 640, CH = 360;          // screen canvas (16:9)
const CELL = 20, COLS = CW / CELL, ROWS = (CH - 40) / CELL; // snake grid under a 40px header

const GAMES = [
  { name: 'Snake', ready: true },
  { name: 'Pong', ready: false },
  { name: 'Tetris', ready: false },
  { name: 'Car Race', ready: false },
];

export function initArcade({ scene, player }) {
  const canvas = document.createElement('canvas');
  canvas.width = CW; canvas.height = CH;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(TV.w, TV.h),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  screen.position.set(TV.x + 0.003, TV.y, TV.z);
  screen.rotation.y = Math.PI / 2; // faces +x, into the room
  screen.visible = false;
  scene.add(screen);

  // Full-screen view: the same canvas, shown big in the page.
  const full = document.createElement('div');
  Object.assign(full.style, {
    position: 'fixed', inset: '0', background: '#000', display: 'none', zIndex: '20',
    alignItems: 'center', justifyContent: 'center',
  });
  document.body.appendChild(full);

  let mode = 'off';      // off | menu | snake
  let sel = 0, fullscreen = false;
  let snake, dir, nextDir, food, score, best = 0, over, acc = 0, step = 0.11;

  const near = () => Math.hypot(player.pos.x - TV.x, player.pos.z - TV.z) < REACH && player.pos.x > 0 && player.pos.z > 22.8;

  function setFull(on) {
    fullscreen = on;
    if (on) {
      full.appendChild(canvas);
      Object.assign(canvas.style, { width: 'min(100vw, 177.78vh)', height: 'auto', imageRendering: 'pixelated' });
      full.style.display = 'flex';
    } else {
      full.style.display = 'none';
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  }

  function turnOn() { mode = 'menu'; sel = 0; screen.visible = true; player.state.paused = true; draw(); }
  function turnOff() { mode = 'off'; screen.visible = false; player.state.paused = false; setFull(false); }

  function newSnake() {
    snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
    dir = { x: 1, y: 0 }; nextDir = dir;
    score = 0; over = false; acc = 0; step = 0.11;
    placeFood();
    mode = 'snake';
  }
  function placeFood() {
    do food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    while (snake.some((s) => s.x === food.x && s.y === food.y));
  }
  function tick() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS || snake.some((s) => s.x === head.x && s.y === head.y)) {
      over = true; best = Math.max(best, score); return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) { score++; step = Math.max(0.06, step - 0.003); placeFood(); }
    else snake.pop();
  }

  // ---------- drawing ----------
  const font = (px, w = 600) => `${w} ${px}px "Avenir Next", "Helvetica Neue", Arial, sans-serif`;
  function hint(text) {
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = font(14, 500); g.textAlign = 'center';
    g.fillText(text, CW / 2, CH - 14);
  }
  function drawMenu() {
    const grd = g.createLinearGradient(0, 0, CW, CH);
    grd.addColorStop(0, '#1a1f3a'); grd.addColorStop(1, '#3a1d4f');
    g.fillStyle = grd; g.fillRect(0, 0, CW, CH);
    g.fillStyle = '#fff'; g.font = font(30, 700); g.textAlign = 'left';
    g.fillText('Pixbit Arcade', 40, 56);
    g.fillStyle = '#b46cff'; g.fillRect(40, 68, 120, 3);
    GAMES.forEach((gm, i) => {
      const y = 104 + i * 50, on = i === sel;
      g.fillStyle = on ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.04)';
      g.fillRect(40, y, CW - 80, 40);
      if (on) { g.fillStyle = '#5fe3ff'; g.fillRect(40, y, 5, 40); }
      g.fillStyle = gm.ready ? '#fff' : 'rgba(255,255,255,.35)';
      g.font = font(20, on ? 700 : 500); g.textAlign = 'left';
      g.fillText(gm.name, 62, y + 27);
      g.font = font(14, 500); g.textAlign = 'right';
      g.fillStyle = gm.ready ? '#7dff9a' : 'rgba(255,255,255,.35)';
      g.fillText(gm.ready ? 'PLAY' : 'coming soon', CW - 58, y + 26);
    });
    hint('↑ ↓ choose · Enter play · F full screen · E turn TV off');
  }
  function drawSnake() {
    g.fillStyle = '#0d1410'; g.fillRect(0, 0, CW, CH);
    g.fillStyle = '#15241a'; g.fillRect(0, 0, CW, 40);
    g.fillStyle = '#7dff9a'; g.font = font(18, 700); g.textAlign = 'left';
    g.fillText(`SNAKE   score ${score}`, 16, 27);
    g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,.5)'; g.font = font(13, 500);
    g.fillText(`best ${best} · arrows/WASD · F full screen · Backspace menu`, CW - 14, 26);
    const oy = 40;
    g.fillStyle = 'rgba(255,255,255,.03)';
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if ((x + y) % 2) g.fillRect(x * CELL, oy + y * CELL, CELL, CELL);
    g.fillStyle = '#ff4f6d';
    g.beginPath(); g.arc(food.x * CELL + CELL / 2, oy + food.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2); g.fill();
    snake.forEach((s, i) => {
      g.fillStyle = i === 0 ? '#c8ffd4' : `hsl(${135 - Math.min(i, 30)}, 80%, ${55 - Math.min(i, 20)}%)`;
      g.fillRect(s.x * CELL + 1, oy + s.y * CELL + 1, CELL - 2, CELL - 2);
    });
    if (over) {
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, CW, CH);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = font(40, 800);
      g.fillText('GAME OVER', CW / 2, CH / 2 - 14);
      g.font = font(18, 500); g.fillText(`score ${score} · best ${best}`, CW / 2, CH / 2 + 20);
      hint('Enter play again · Backspace menu');
    }
  }
  function draw() {
    if (mode === 'menu') drawMenu();
    else if (mode === 'snake') drawSnake();
    tex.needsUpdate = true;
  }

  // ---------- input (capture phase so nothing else reacts while the TV is on) ----------
  const DIRS = {
    ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  };
  addEventListener('keydown', (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (mode === 'off') {
      if (e.code === 'KeyE' && near() && !player.state.paused) { turnOn(); e.stopImmediatePropagation(); }
      return;
    }
    e.stopImmediatePropagation();
    if (e.code !== 'Escape') e.preventDefault();
    if (e.code === 'KeyF') { setFull(!fullscreen); return; }
    if (mode === 'menu') {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') sel = (sel + GAMES.length - 1) % GAMES.length;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') sel = (sel + 1) % GAMES.length;
      if ((e.code === 'Enter' || e.code === 'Space') && GAMES[sel].ready) newSnake();
      if (e.code === 'KeyE' || e.code === 'Backspace') { turnOff(); return; }
    } else if (mode === 'snake') {
      const d = DIRS[e.code];
      if (d && !over && !(d[0] === -dir.x && d[1] === -dir.y)) nextDir = { x: d[0], y: d[1] };
      if (over && (e.code === 'Enter' || e.code === 'Space')) newSnake();
      if (e.code === 'Backspace') mode = 'menu';
    }
    draw();
  }, true);

  function update(dt) {
    if (mode !== 'snake' || over) return;
    acc += Math.min(dt, step); // at most one move per frame, so a stalled tab doesn't crash the snake
    if (acc >= step) { acc -= step; tick(); draw(); }
  }

  function prompt() {
    if (mode !== 'off') return mode === 'menu' ? 'TV on' : 'playing snake';
    return near() ? 'E play TV games' : '';
  }

  return { update, prompt, isOn: () => mode !== 'off' };
}
