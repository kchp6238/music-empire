import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../shared/TopBar';
import { useGameStore } from '../../state/useGameStore';
import { won } from '../../lib/utils';
import * as musicApi from '../../lib/api/music';
import * as eventsApi from '../../lib/api/events';

// A pixel top-down town that replaces menu-hopping with a walkable hub. Each
// building routes to a real screen; 집 rests (recovers condition), 카페 triggers
// a random life event. Pure Canvas — movement with WASD/arrows or the on-screen
// pad; enter a door with E / A.
const W = 384, H = 256, T = 16;

const BUILDINGS = [
  { id: 'studio', name: '스튜디오', tx: 2, ty: 2, tw: 4, th: 3, wall: '#4a3b6b', roof: '#8b5cf6', door: { tx: 3, ty: 4 }, route: '/studio' },
  { id: 'academy', name: '음악학원', tx: 8, ty: 2, tw: 4, th: 3, wall: '#2f4a5a', roof: '#4fd1c5', door: { tx: 9, ty: 4 }, route: '/music' },
  { id: 'agency', name: '기획사', tx: 17, ty: 2, tw: 5, th: 3, wall: '#3a3350', roof: '#b794f4', door: { tx: 18, ty: 4 }, route: '/company' },
  { id: 'venue', name: '공연장', tx: 2, ty: 8, tw: 4, th: 3, wall: '#5a2f45', roof: '#e8637a', door: { tx: 3, ty: 10 }, route: '/music' },
  { id: 'community', name: '커뮤니티', tx: 8, ty: 8, tw: 4, th: 3, wall: '#2f5a45', roof: '#5fbf8f', door: { tx: 9, ty: 10 }, route: '/community' },
  { id: 'news', name: '방송국(소식)', tx: 17, ty: 8, tw: 5, th: 3, wall: '#5a3b2f', roof: '#e8a33d', door: { tx: 18, ty: 10 }, route: '/news' },
  { id: 'online', name: '온라인/공연', tx: 2, ty: 13, tw: 4, th: 2, wall: '#2a3550', roof: '#7fa8d1', door: { tx: 3, ty: 14 }, route: '/online' },
  { id: 'home', name: '집(휴식)', tx: 9, ty: 13, tw: 4, th: 2, wall: '#4a4030', roof: '#e8c34d', door: { tx: 10, ty: 14 }, action: 'rest' },
  { id: 'cafe', name: '카페(이벤트)', tx: 17, ty: 13, tw: 5, th: 2, wall: '#4a2f45', roof: '#e893a6', door: { tx: 18, ty: 14 }, action: 'event' },
];

function npc(x, y, col) { return { x, y, col, dir: 'down', dx: 0, dy: 0, timer: 0, af: 0, moving: false }; }

export function TownScreen() {
  const navigate = useNavigate();
  const character = useGameStore((s) => s.character);
  const loadCharacter = useGameStore((s) => s.loadCharacter);
  const canvasRef = useRef(null);
  const signsRef = useRef(null);
  const stateRef = useRef({ actioning: false });
  const [toast, setToast] = useState(null);

  if (!character) return null;

  return (
    <div>
      <TopBar character={character} />
      <div className="max-w-[720px] mx-auto px-3 md:px-4 pt-4 pb-24">
        <div className="text-[12px] text-muted mb-2">🏘️ 우리 동네 — 걸어서 건물에 들어가세요. (이동: 방향키/WASD · 입장: E 또는 A)</div>
        <TownCanvas
          canvasRef={canvasRef} signsRef={signsRef} stateRef={stateRef}
          navigate={navigate} setToast={setToast} loadCharacter={loadCharacter}
        />
        {toast && (
          <div className="mt-3 me-panel" style={{ padding: '12px 14px', fontSize: 13 }} dangerouslySetInnerHTML={{ __html: toast }} />
        )}
      </div>
    </div>
  );
}

function TownCanvas({ canvasRef, signsRef, stateRef, navigate, setToast, loadCharacter }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const player = { x: 180, y: 150, w: 9, h: 12, dir: 'down', moving: false, af: 0 };
    const npcs = [npc(70, 110, '#e8637a'), npc(250, 120, '#4fd1c5'), npc(150, 60, '#e8c34d'), npc(300, 190, '#8b5cf6')];
    const keys = {};
    let raf = 0, disposed = false;

    // ---- readable HTML signs over buildings ----
    const signEls = BUILDINGS.map((b) => {
      const d = document.createElement('div');
      d.textContent = b.name;
      d.style.cssText = 'position:absolute;font-family:monospace;font-size:11px;font-weight:700;color:#12101a;background:#e8dcc0;border:1px solid #a89170;border-radius:3px;padding:1px 5px;white-space:nowrap;pointer-events:none;transform:translate(-50%,-100%)';
      d.dataset.cx = (b.tx + b.tw / 2) * T;
      d.dataset.cy = b.ty * T - 3;
      signsRef.current.appendChild(d);
      return d;
    });
    function positionSigns() {
      const r = canvas.getBoundingClientRect(), sx = r.width / W, sy = r.height / H;
      signEls.forEach((d) => { d.style.left = (d.dataset.cx * sx) + 'px'; d.style.top = (d.dataset.cy * sy) + 'px'; });
    }

    function solid(px, py) {
      for (const b of BUILDINGS) {
        if (px >= b.tx * T && px < (b.tx + b.tw) * T && py >= b.ty * T && py < (b.ty + b.th) * T) return true;
      }
      return false;
    }
    function nearDoor() {
      for (const b of BUILDINGS) {
        const dx = b.door.tx * T + T / 2, dy = b.door.ty * T + T;
        if (Math.abs((player.x + player.w / 2) - dx) < 16 && Math.abs((player.y + player.h) - dy) < 20) return b;
      }
      return null;
    }

    async function enter(b) {
      if (stateRef.current.actioning) return;
      if (b.route) { navigate(b.route); return; }
      stateRef.current.actioning = true;
      try {
        if (b.action === 'rest') {
          const r = await musicApi.rest();
          setToast(`😴 <b>집에서 휴식</b> — 컨디션 <b>+${r.restored}</b> (지금 ${r.condition})`);
          await loadCharacter();
        } else if (b.action === 'event') {
          const ev = await eventsApi.rollEvent();
          const i = Math.floor(Math.random() * ev.choices.length);
          const res = await eventsApi.resolveEvent(ev.id, i);
          const d = (v, u = (x) => x) => v ? `${v > 0 ? '+' : ''}${u(v)}` : '±0';
          setToast(`${res.emoji} <b>${res.title}</b> — ${res.choice_label}<br>${res.note}<br><span style="color:#8b8496">명성 ${d(res.fame_delta)} · 팬 ${d(res.fans_delta)} · 수익 ${d(res.money_delta, won)}</span>`);
          await loadCharacter();
        }
      } catch (e) {
        setToast(`<span style="color:#C4576B">${e.message || '실패했어요'}</span>`);
      } finally { stateRef.current.actioning = false; }
    }
    function action() { const b = nearDoor(); if (b) enter(b); }

    function onKey(e) {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(k)) e.preventDefault();
      if (k === 'arrowup' || k === 'w') keys.up = 1; if (k === 'arrowdown' || k === 's') keys.down = 1;
      if (k === 'arrowleft' || k === 'a') keys.left = 1; if (k === 'arrowright' || k === 'd') keys.right = 1;
      if (k === 'e' || k === ' ') action();
    }
    function onKeyUp(e) {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') keys.up = 0; if (k === 'arrowdown' || k === 's') keys.down = 0;
      if (k === 'arrowleft' || k === 'a') keys.left = 0; if (k === 'arrowright' || k === 'd') keys.right = 0;
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    stateRef.current.keys = keys;
    stateRef.current.action = action;

    function rnd(i) { const x = Math.sin(i * 127.1) * 43758.5; return x - Math.floor(x); }
    function drawB(b) {
      const x = b.tx * T, y = b.ty * T, w = b.tw * T, h = b.th * T;
      ctx.fillStyle = b.wall; ctx.fillRect(x, y + 6, w, h - 6);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y + h - 4, w, 4);
      ctx.fillStyle = b.roof; ctx.fillRect(x - 1, y, w + 2, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x - 1, y, w + 2, 2);
      ctx.fillStyle = '#0d1420';
      for (let i = 0; i < b.tw; i++) { if (i === (b.door.tx - b.tx)) continue; ctx.fillRect(x + 4 + i * T, y + 11, 7, 7); }
      const dx = b.door.tx * T, dy = (b.door.ty + 1) * T;
      ctx.fillStyle = '#120c14'; ctx.fillRect(dx + 3, dy - 14, 10, 14);
      ctx.fillStyle = '#e8c34d'; ctx.fillRect(dx + 11, dy - 8, 1, 2);
    }
    function drawChar(p) {
      const { x, y, dir } = p; const bob = p.moving ? ((p.af % 16 < 8) ? 0 : 1) : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 5, y + 13, 6, 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a2436'; ctx.fillRect(x + 2, y + 9 - bob, 2, 3); ctx.fillRect(x + 6, y + 9 + bob, 2, 3);
      ctx.fillStyle = p.col || '#4fd1c5'; ctx.fillRect(x + 1, y + 5, 8, 5);
      ctx.fillStyle = '#f0c8a0'; ctx.fillRect(x + 2, y, 6, 6);
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 1, y - 1, 8, 3);
      ctx.fillStyle = '#1a1018';
      if (dir === 'down') { ctx.fillRect(x + 3, y + 3, 1, 1); ctx.fillRect(x + 6, y + 3, 1, 1); }
      else if (dir === 'left') ctx.fillRect(x + 2, y + 3, 1, 1); else if (dir === 'right') ctx.fillRect(x + 7, y + 3, 1, 1);
    }

    function frame() {
      if (disposed) return;
      const k = keys; let vx = 0, vy = 0, sp = 1.3;
      if (k.left) vx -= sp; if (k.right) vx += sp; if (k.up) vy -= sp; if (k.down) vy += sp;
      player.moving = !!(vx || vy);
      if (vx < 0) player.dir = 'left'; else if (vx > 0) player.dir = 'right'; else if (vy < 0) player.dir = 'up'; else if (vy > 0) player.dir = 'down';
      if (!solid(player.x + vx + 1, player.y + 6) && !solid(player.x + vx + player.w - 1, player.y + player.h - 1)) player.x = Math.max(2, Math.min(W - player.w - 2, player.x + vx));
      if (!solid(player.x + 1, player.y + vy + 6) && !solid(player.x + player.w - 1, player.y + vy + player.h - 1)) player.y = Math.max(6, Math.min(H - player.h - 2, player.y + vy));
      player.af++;

      // grass
      for (let ty = 0; ty < H / T; ty++) for (let tx = 0; tx < W / T; tx++) {
        ctx.fillStyle = ((tx + ty) & 1) ? '#25381f' : '#223519'; ctx.fillRect(tx * T, ty * T, T, T);
        const r = rnd(tx * 13 + ty * 7);
        if (r > 0.9) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(tx * T + ((r * 10) | 0), ty * T + ((r * 13) | 0) % 14, 2, 2); }
        else if (r < 0.05) { ctx.fillStyle = '#e8637a'; ctx.fillRect(tx * T + 6, ty * T + 7, 2, 2); }
      }
      ctx.fillStyle = '#6b5a44'; ctx.fillRect(0, 6 * T, W, 2 * T); ctx.fillRect(0, 12 * T - 4, W, 10);
      for (let x = 8; x < 10; x++) ctx.fillRect(x * T, 0, T, H);
      BUILDINGS.forEach(drawB);
      // npc wander
      npcs.forEach((n) => {
        if (n.timer-- <= 0) { n.timer = 40 + ((Math.random() * 60) | 0); const d = (Math.random() * 5) | 0; n.dx = [0, 0.5, -0.5, 0, 0][d]; n.dy = [0, 0, 0, 0.5, -0.5][d]; n.dir = n.dx < 0 ? 'left' : n.dx > 0 ? 'right' : n.dy < 0 ? 'up' : 'down'; }
        const nx = n.x + n.dx, ny = n.y + n.dy; if (!solid(nx, n.y + 10)) n.x = Math.max(4, Math.min(W - 14, nx)); if (!solid(n.x, ny + 10)) n.y = Math.max(4, Math.min(H - 16, ny)); n.moving = !!(n.dx || n.dy); n.af++;
        drawChar(n);
      });
      drawChar(player);
      const b = nearDoor();
      if (b) { const dx = b.door.tx * T + T / 2; ctx.fillStyle = '#f5c46b'; ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillText('▼E', dx, b.door.ty * T - 6 + (Math.sin(Date.now() / 200) | 0)); }
      positionSigns();
      raf = requestAnimationFrame(frame);
    }
    positionSigns();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', positionSigns);

    return () => {
      disposed = true; cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', positionSigns);
      signEls.forEach((d) => d.remove());
    };
  }, [canvasRef, signsRef, stateRef, navigate, setToast, loadCharacter]);

  function padDown(dir) { const k = stateRef.current.keys; if (!k) return; if (dir === 'action') stateRef.current.action?.(); else k[dir] = 1; }
  function padUp(dir) { const k = stateRef.current.keys; if (k && dir !== 'action') k[dir] = 0; }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ width: '100%', display: 'block', imageRendering: 'pixelated', borderRadius: 10, border: '2px solid #2a2436', touchAction: 'none' }} />
        <div ref={signsRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      </div>
      {/* touch pad */}
      <div className="md:hidden" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,46px)', gridTemplateRows: 'repeat(3,46px)', gap: 4, justifyContent: 'center', marginTop: 12 }}>
        {[['up', 2, 1], ['left', 1, 2], ['down', 2, 2], ['right', 3, 1]].map(([d, c, r]) => (
          <button key={d} onPointerDown={(e) => { e.preventDefault(); padDown(d); }} onPointerUp={(e) => { e.preventDefault(); padUp(d); }} onPointerLeave={() => padUp(d)}
            style={{ gridColumn: c, gridRow: r, border: 'none', borderRadius: 8, background: '#211d2c', color: '#cbb', fontSize: 18, fontFamily: 'monospace' }}>
            {{ up: '▲', down: '▼', left: '◀', right: '▶' }[d]}
          </button>
        ))}
        <button onPointerDown={(e) => { e.preventDefault(); padDown('action'); }} style={{ gridColumn: 3, gridRow: 2, border: 'none', borderRadius: 8, background: 'linear-gradient(180deg,#F0B24E,#E39A2E)', color: '#12101a', fontWeight: 800 }}>A</button>
      </div>
    </div>
  );
}
