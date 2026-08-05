import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

// A 4-lane rhythm game that actually plays: a drum backbeat is scheduled on the
// Web Audio clock and the falling notes are pinned to the same clock, so the
// beat and the notes line up. Each lane is a different instrument (bass / synth
// / guitar / bell) — hitting notes performs a little riff over the beat. The
// final performance (0..1) scales the music-show result.
const LANES = 4;
const KEYS = ['d', 'f', 'j', 'k'];
const LANE = [
  { color: '#5FBF8F', name: '베이스', pitches: ['C2', 'G2', 'A2', 'E2'] },
  { color: '#8B7FD1', name: '신스', pitches: ['C4', 'E4', 'G4', 'A4'] },
  { color: '#E8A33D', name: '기타', pitches: ['E3', 'G3', 'A3', 'C4'] },
  { color: '#4FD1C5', name: '벨', pitches: ['C5', 'E5', 'G5', 'A5'] },
];
const FALL = 1.55;        // seconds a note takes to reach the hit line
const PERFECT = 0.065;
const GOOD = 0.14;
const LEAD = 2.0;         // beats of count-in before the first note

export function RhythmGame({ bpm = 110, onFinish, onCancel }) {
  const canvasRef = useRef(null);
  const [judge, setJudge] = useState('');
  const [combo, setCombo] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx2d = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const laneW = W / LANES;
    const hitY = H - 78;
    const gbpm = Math.max(88, Math.min(132, bpm || 110));
    const beat = 60 / gbpm;
    const eighth = beat / 2;

    let raf = 0, disposed = false;
    const nodes = [];

    // ---- audio ----
    const master = new Tone.Volume(-6).toDestination();
    const limiter = new Tone.Limiter(-1).connect(master);
    const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, envelope: { attack: 0.001, decay: 0.4, sustain: 0 } }).connect(limiter);
    const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0 } }).connect(limiter);
    const hat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.05, release: 0.01 }, harmonicity: 5.1, resonance: 4000, octaves: 1.2 }).connect(limiter);
    hat.volume.value = -20; snare.volume.value = -10;
    const laneInstr = [
      new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, filter: { type: 'lowpass', Q: 1 }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.2 } }).connect(limiter),
      new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.3 } }).connect(limiter),
      new Tone.PluckSynth({ attackNoise: 1, dampening: 3000, resonance: 0.9 }).connect(limiter),
      new Tone.FMSynth({ harmonicity: 3, modulationIndex: 6, envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.4 } }).connect(limiter),
    ];
    nodes.push(master, limiter, kick, snare, hat, ...laneInstr);

    // ---- timeline: drum backbeat + player notes, all in seconds from start ----
    const bars = 5;
    const drumEvents = [];
    for (let b = 0; b < bars; b++) {
      const bar = LEAD * beat + b * 4 * beat;
      for (let q = 0; q < 4; q++) {
        const tq = bar + q * beat;
        if (q === 0 || q === 2) drumEvents.push({ t: tq, type: 'kick' });
        if (q === 1 || q === 3) drumEvents.push({ t: tq, type: 'snare' });
        drumEvents.push({ t: tq, type: 'hat' });
        drumEvents.push({ t: tq + eighth, type: 'hat' });
      }
    }
    drumEvents.sort((a, b) => a.t - b.t);

    const notes = [];
    let idx = 0;
    const firstT = LEAD * beat;
    const lastT = firstT + bars * 4 * beat - beat;
    let lastLane = -1;
    for (let t = firstT; t <= lastT; t += eighth) {
      if (Math.random() < 0.32) continue;            // groove gaps
      let lane = Math.floor(Math.random() * LANES);
      if (lane === lastLane && Math.random() < 0.6) lane = (lane + 1) % LANES;
      lastLane = lane;
      const pitch = LANE[lane].pitches[idx % LANE[lane].pitches.length];
      notes.push({ t, lane, pitch, hit: false, judge: null });
      idx++;
    }
    const endT = lastT + 1.0;

    const startTime = Tone.getContext().currentTime + 0.35;
    const bursts = [];
    let schedPtr = 0;
    let cmb = 0, score = 0;
    const maxScore = notes.length * 2;

    async function begin() {
      try { await Tone.start(); } catch { /* already running */ }
      raf = requestAnimationFrame(frame);
    }

    function playDrum(type, when) {
      if (type === 'kick') kick.triggerAttackRelease('C1', '8n', when);
      else if (type === 'snare') snare.triggerAttackRelease('16n', when);
      else hat.triggerAttackRelease('32n', when);
    }

    function hitLane(lane) {
      const t = Tone.getContext().currentTime - startTime;
      let best = null, bd = Infinity;
      for (const n of notes) {
        if (n.hit || n.lane !== lane) continue;
        const dt = Math.abs(n.t - t);
        if (dt < bd) { bd = dt; best = n; }
      }
      // instrument sound on every tap (so it feels responsive)
      const inst = laneInstr[lane];
      const pitch = best ? best.pitch : LANE[lane].pitches[0];
      try { inst.triggerAttackRelease(pitch, '8n', Tone.now()); } catch { /* ignore */ }
      if (best && bd <= GOOD) {
        best.hit = true;
        if (bd <= PERFECT) { best.judge = 'PERFECT'; score += 2; } else { best.judge = 'GOOD'; score += 1; }
        cmb += 1; setJudge(best.judge); setCombo(cmb);
        bursts.push({ lane, t, good: true });
      } else {
        bursts.push({ lane, t, good: false });
      }
    }

    function onKey(e) { const i = KEYS.indexOf(e.key.toLowerCase()); if (i >= 0) { e.preventDefault(); hitLane(i); } }
    function onPointer(e) {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * W;
      hitLane(Math.max(0, Math.min(LANES - 1, Math.floor(x / laneW))));
    }
    window.addEventListener('keydown', onKey);
    canvas.addEventListener('pointerdown', onPointer);

    function roundRect(x, y, w, h, r) { ctx2d.beginPath(); ctx2d.roundRect(x, y, w, h, r); }

    function frame() {
      if (disposed) return;
      const t = Tone.getContext().currentTime - startTime;
      // lookahead-schedule drum hits ~0.2s ahead
      while (schedPtr < drumEvents.length && drumEvents[schedPtr].t < t + 0.2) {
        const ev = drumEvents[schedPtr]; playDrum(ev.type, startTime + ev.t); schedPtr++;
      }
      // auto-miss
      for (const n of notes) {
        if (!n.hit && n.judge == null && n.t + GOOD < t) { n.judge = 'MISS'; n.hit = true; cmb = 0; setJudge("MISS"); setCombo(0); }
      }

      // ---- draw ----
      const bg = ctx2d.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#161226'); bg.addColorStop(1, '#08060E');
      ctx2d.fillStyle = bg; ctx2d.fillRect(0, 0, W, H);
      for (let l = 0; l < LANES; l++) {
        ctx2d.fillStyle = l % 2 ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.04)';
        ctx2d.fillRect(l * laneW, 0, laneW, H);
        ctx2d.strokeStyle = 'rgba(255,255,255,0.05)'; ctx2d.beginPath();
        ctx2d.moveTo(l * laneW, 0); ctx2d.lineTo(l * laneW, H); ctx2d.stroke();
      }
      // hit zone
      for (let l = 0; l < LANES; l++) {
        const recent = bursts.some((b) => b.lane === l && t - b.t < 0.12);
        ctx2d.globalAlpha = recent ? 0.9 : 0.4;
        ctx2d.strokeStyle = LANE[l].color; ctx2d.lineWidth = recent ? 3 : 2;
        roundRect(l * laneW + 7, hitY - 24, laneW - 14, 48, 10); ctx2d.stroke();
        if (recent) { ctx2d.globalAlpha = 0.16; ctx2d.fillStyle = LANE[l].color; ctx2d.fill(); }
        ctx2d.globalAlpha = 1;
      }
      // notes
      for (const n of notes) {
        if (n.hit && n.judge !== 'MISS') continue;
        const prog = 1 - (n.t - t) / FALL;
        if (prog < -0.05 || prog > 1.25) continue;
        const y = prog * hitY;
        const x = n.lane * laneW + 9, w = laneW - 18, h = 24;
        const g = ctx2d.createLinearGradient(0, y - h / 2, 0, y + h / 2);
        const c = n.judge === 'MISS' ? 'rgba(196,87,107,0.4)' : LANE[n.lane].color;
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, c); g.addColorStop(1, c);
        ctx2d.fillStyle = n.judge === 'MISS' ? c : g;
        ctx2d.shadowColor = c; ctx2d.shadowBlur = n.judge === 'MISS' ? 0 : 10;
        roundRect(x, y - h / 2, w, h, 7); ctx2d.fill();
        ctx2d.shadowBlur = 0;
      }
      // hit bursts (expanding ring)
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]; const age = t - b.t;
        if (age > 0.28) { bursts.splice(i, 1); continue; }
        ctx2d.globalAlpha = (1 - age / 0.28) * 0.8;
        ctx2d.strokeStyle = b.good ? LANE[b.lane].color : '#C4576B'; ctx2d.lineWidth = 3;
        ctx2d.beginPath(); ctx2d.arc(b.lane * laneW + laneW / 2, hitY, 12 + age * 90, 0, 7); ctx2d.stroke();
        ctx2d.globalAlpha = 1;
      }
      // progress bar
      const prog = Math.max(0, Math.min(1, t / endT));
      ctx2d.fillStyle = 'rgba(255,255,255,0.1)'; ctx2d.fillRect(0, 0, W, 4);
      ctx2d.fillStyle = '#E8A33D'; ctx2d.fillRect(0, 0, W * prog, 4);
      // key hints
      ctx2d.fillStyle = 'rgba(255,255,255,0.25)'; ctx2d.font = '600 13px monospace'; ctx2d.textAlign = 'center';
      for (let l = 0; l < LANES; l++) ctx2d.fillText(KEYS[l].toUpperCase(), l * laneW + laneW / 2, hitY + 40);

      if (t >= endT) {
        disposed = true;
        setDone(true);
        window.removeEventListener('keydown', onKey);
        canvas.removeEventListener('pointerdown', onPointer);
        setTimeout(() => nodes.forEach((n) => { try { n.dispose(); } catch { /* ignore */ } }), 300);
        onFinish(maxScore ? score / maxScore : 0);
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    begin();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      canvas.removeEventListener('pointerdown', onPointer);
      setTimeout(() => nodes.forEach((n) => { try { n.dispose(); } catch { /* ignore */ } }), 50);
    };
  }, [bpm, onFinish]);

  const jc = judge === 'PERFECT' ? '#4FD1C5' : judge === 'GOOD' ? '#E8A33D' : judge === 'MISS' ? '#C4576B' : '#8B8496';

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>🎵 무대 리듬</span>
        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>D F J K · 레인 탭 · 박자에 맞춰!</span>
      </div>
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        <canvas ref={canvasRef} width={340} height={460} style={{ width: '100%', display: 'block', touchAction: 'none' }} />
        <div style={{ position: 'absolute', top: 16, left: 0, right: 0, pointerEvents: 'none' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: jc, textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>{judge}</div>
          {combo > 1 && <div style={{ fontSize: 15, color: '#EDE9F0', marginTop: 2, fontWeight: 700 }}>{combo} COMBO</div>}
        </div>
        <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', pointerEvents: 'none' }}>
          {LANE.map((l, i) => (
            <div key={i} style={{ flex: 1, fontSize: 10, color: l.color, fontWeight: 700 }}>{l.name}</div>
          ))}
        </div>
      </div>
      {!done && <button className="me-btn-ghost" style={{ marginTop: 10, fontSize: 12 }} onClick={onCancel}>그만두기 (기본 보상)</button>}
    </div>
  );
}
