import { useEffect, useRef, useState } from 'react';

// A 4-lane falling-note rhythm game for the stage. Notes are generated from the
// song's BPM; hit them on the line (keys D F J K, or tap a lane). The final
// performance (0..1) scales the music-show result. Pure Canvas — no assets.
const LANES = 4;
const KEYS = ['d', 'f', 'j', 'k'];
const LANE_COLORS = ['#E8637A', '#E8A33D', '#4FD1C5', '#8B7FD1'];
const FALL_MS = 1700;         // time a note takes to reach the hit line
const PERFECT_MS = 70;
const GOOD_MS = 150;
const LEAD_IN = 2200;         // countdown before the first note

function buildNotes(bpm) {
  const beat = 60000 / Math.max(60, Math.min(180, bpm || 110));
  const step = beat / 2;      // eighth-note grid
  const notes = [];
  let t = LEAD_IN;
  const total = 34;
  let lastLane = -1;
  for (let i = 0; i < total; i++) {
    // skip some slots for groove; guarantee movement
    if (i > 0 && Math.random() < 0.25) { t += step; }
    let lane = Math.floor(Math.random() * LANES);
    if (lane === lastLane && Math.random() < 0.5) lane = (lane + 1) % LANES;
    lastLane = lane;
    notes.push({ lane, time: Math.round(t), hit: false, judge: null });
    t += step;
    if (i % 8 === 7) t += step; // small breath every 8
  }
  return notes;
}

export function RhythmGame({ bpm = 110, onFinish, onCancel }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const [judge, setJudge] = useState('');       // last judgment text
  const [combo, setCombo] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const laneW = W / LANES;
    const hitY = H - 70;

    const notes = buildNotes(bpm);
    const endAt = notes[notes.length - 1].time + 900;
    const st = { start: performance.now(), notes, score: 0, max: notes.length * 2, combo: 0, flashes: [], raf: 0, ended: false };
    stateRef.current = st;

    function judgeHit(lane, now) {
      let best = null, bestDt = Infinity;
      for (const n of notes) {
        if (n.hit || n.lane !== lane) continue;
        const dt = Math.abs(n.time - now);
        if (dt < bestDt) { bestDt = dt; best = n; }
      }
      if (best && bestDt <= GOOD_MS) {
        best.hit = true;
        if (bestDt <= PERFECT_MS) { best.judge = 'PERFECT'; st.score += 2; }
        else { best.judge = 'GOOD'; st.score += 1; }
        st.combo += 1;
        setJudge(best.judge); setCombo(st.combo);
        st.flashes.push({ lane, t: now, good: true });
      } else {
        st.flashes.push({ lane, t: now, good: false });
      }
    }

    function press(lane) {
      if (st.ended) return;
      const now = performance.now() - st.start;
      judgeHit(lane, now);
    }

    function onKey(e) {
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0) { e.preventDefault(); press(i); }
    }
    function onPointer(e) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * W;
      press(Math.max(0, Math.min(LANES - 1, Math.floor(x / laneW))));
    }
    window.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onPointer);

    function frame() {
      const now = performance.now() - st.start;
      // auto-miss notes that passed the window
      for (const n of notes) {
        if (!n.hit && n.judge == null && n.time + GOOD_MS < now) {
          n.judge = 'MISS'; n.hit = true; st.combo = 0; setJudge('MISS'); setCombo(0);
        }
      }
      // draw
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0B0910'; ctx.fillRect(0, 0, W, H);
      for (let l = 0; l < LANES; l++) {
        ctx.fillStyle = l % 2 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(l * laneW, 0, laneW, H);
      }
      // hit line
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(W, hitY); ctx.stroke();
      for (let l = 0; l < LANES; l++) {
        ctx.strokeStyle = LANE_COLORS[l]; ctx.globalAlpha = 0.5;
        ctx.strokeRect(l * laneW + 6, hitY - 22, laneW - 12, 44);
        ctx.globalAlpha = 1;
      }
      // flashes
      st.flashes = st.flashes.filter((f) => now - f.t < 180);
      for (const f of st.flashes) {
        ctx.globalAlpha = 0.5 * (1 - (now - f.t) / 180);
        ctx.fillStyle = f.good ? LANE_COLORS[f.lane] : '#C4576B';
        ctx.fillRect(f.lane * laneW, hitY - 26, laneW, 52);
        ctx.globalAlpha = 1;
      }
      // notes
      for (const n of notes) {
        if (n.hit && n.judge !== 'MISS') continue;
        const prog = 1 - (n.time - now) / FALL_MS; // 0 at spawn, 1 at hit line
        if (prog < -0.1 || prog > 1.3) continue;
        const y = prog * hitY;
        const x = n.lane * laneW + 8;
        ctx.fillStyle = n.judge === 'MISS' ? 'rgba(196,87,107,0.4)' : LANE_COLORS[n.lane];
        ctx.beginPath();
        const r = 8; const w = laneW - 16; const h = 26;
        const yy = y - h / 2;
        ctx.roundRect(x, yy, w, h, r); ctx.fill();
      }
      if (now >= endAt && !st.ended) {
        st.ended = true; setDone(true);
        const perf = st.max ? st.score / st.max : 0;
        window.removeEventListener('keydown', onKey);
        canvas.removeEventListener('pointerdown', onPointer);
        onFinish(perf);
        return;
      }
      st.raf = requestAnimationFrame(frame);
    }
    st.raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(st.raf);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onPointer);
    };
  }, [bpm, onFinish]);

  const judgeColor = judge === 'PERFECT' ? '#4FD1C5' : judge === 'GOOD' ? '#E8A33D' : judge === 'MISS' ? '#C4576B' : '#8B8496';

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>🎵 무대 리듬</span>
        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>키 D F J K · 또는 레인 탭</span>
      </div>
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        <canvas ref={canvasRef} width={320} height={440} style={{ width: '100%', display: 'block', touchAction: 'none' }} />
        <div style={{ position: 'absolute', top: 12, left: 0, right: 0, pointerEvents: 'none' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: judgeColor, textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>{judge}</div>
          {combo > 1 && <div style={{ fontSize: 14, color: '#EDE9F0', marginTop: 2 }}>{combo} COMBO</div>}
        </div>
      </div>
      {!done && (
        <button className="me-btn-ghost" style={{ marginTop: 10, fontSize: 12 }} onClick={onCancel}>그만두기 (기본 보상)</button>
      )}
    </div>
  );
}
