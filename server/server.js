// Minimal multiplayer relay for the Demo Event venue: clients send their own position, the server
// broadcasts everyone's position to everyone ~10 times a second. No game logic, no persistence.
import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const MAX_PLAYERS = Number(process.env.MAX_PLAYERS) || 150;
const TICK_MS = 100;
// Optional: comma-separated list of site origins allowed to connect, e.g. "https://event-liard-ten.vercel.app".
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const players = new Map(); // ws -> { id, state: [x, y, z, yaw, anim, name] | null, last: ms }
let nextId = 1, dirty = false;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`Demo Event multiplayer server: ${players.size} connected\n`);
});

const wss = new WebSocketServer({
  server,
  maxPayload: 512,
  verifyClient: ({ origin }) => ORIGINS.length === 0 || ORIGINS.includes(origin),
});

const num = (v, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const cleanName = (s) => String(s ?? '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 16);

wss.on('connection', (ws) => {
  if (players.size >= MAX_PLAYERS) { ws.close(1013, 'full'); return; }
  const p = { id: nextId++, state: null, last: 0 };
  players.set(ws, p);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.send(JSON.stringify({ t: 'hi', id: p.id }));
  dirty = true;

  ws.on('message', (data) => {
    const now = Date.now();
    if (now - p.last < 30) return; // ignore anything faster than ~33 msg/s
    p.last = now;
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || m.t !== 'u') return;
    const x = num(m.x, -300, 300), y = num(m.y, -30, 60), z = num(m.z, -300, 300), r = num(m.r, -10, 10);
    if (x === null || y === null || z === null || r === null) return;
    const a = m.a === 1 || m.a === 2 ? m.a : 0;
    p.state = [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2), +r.toFixed(2), a, cleanName(m.n) || `Guest ${p.id}`];
    dirty = true;
  });

  ws.on('close', () => { players.delete(ws); dirty = true; });
  ws.on('error', () => ws.terminate());
});

// One serialised snapshot for everyone; each client ignores its own id.
setInterval(() => {
  if (!dirty) return;
  dirty = false;
  const list = [];
  for (const p of players.values()) if (p.state) list.push([p.id, ...p.state]);
  const msg = JSON.stringify({ t: 's', n: players.size, p: list });
  for (const ws of players.keys()) if (ws.readyState === 1) ws.send(msg);
}, TICK_MS);

// Drop connections that stopped answering (closed laptop, lost signal).
setInterval(() => {
  for (const ws of players.keys()) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`Multiplayer server on :${PORT}`));
