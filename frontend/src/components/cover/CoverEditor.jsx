import { useEffect, useRef, useState } from 'react';
import { Brush, Circle, Square, Triangle, Type, Undo2, Trash2, Save, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useGameStore } from '../../state/useGameStore';
import * as coversApi from '../../lib/api/covers';

/**
 * Album cover painter. Everything is drawn into one 640×640 canvas and saved
 * as a PNG — no layer model, because the whole point is that it feels like a
 * sketchpad rather than a design tool.
 *
 * Undo works by snapshotting the canvas to an ImageData stack before each
 * stroke or stamp; at this size a handful of frames is cheap and it means
 * undo works identically for brush, shapes and text without any of them
 * needing to know about each other.
 */

const SIZE = 640;
const UNDO_LIMIT = 20;

const BACKDROPS = [
  { id: 'dusk', label: '노을', stops: ['#2B1B4A', '#E8A33D'] },
  { id: 'neon', label: '네온', stops: ['#0E0C14', '#4FD1C5'] },
  { id: 'rose', label: '로즈', stops: ['#3A1526', '#E893A6'] },
  { id: 'mint', label: '민트', stops: ['#0B2A22', '#5FBF8F'] },
  { id: 'mono', label: '모노', stops: ['#101014', '#8B8496'] },
  { id: 'flame', label: '화염', stops: ['#2A0A0A', '#C4576B'] },
];

const PALETTE = ['#EDE9F0', '#12101A', '#E8A33D', '#4FD1C5', '#E893A6', '#8B7FD1', '#5FBF8F', '#E8C34D', '#C4576B'];
const TOOLS = [
  { id: 'brush', label: '붓', Icon: Brush },
  { id: 'rect', label: '사각형', Icon: Square },
  { id: 'circle', label: '원', Icon: Circle },
  { id: 'triangle', label: '삼각형', Icon: Triangle },
  { id: 'text', label: '글자', Icon: Type },
];

export function CoverEditor({ songId, songTitle, onClose, onSaved }) {
  const canvasRef = useRef(null);
  const undoStack = useRef([]);
  const drawing = useRef(null); // { startX, startY, snapshot }
  const character = useGameStore((s) => s.character);

  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('#EDE9F0');
  const [brushSize, setBrushSize] = useState(14);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [canUndo, setCanUndo] = useState(false);

  const ctx = () => canvasRef.current?.getContext('2d');

  function paintBackdrop(stops) {
    const c = ctx();
    if (!c) return;
    const g = c.createLinearGradient(0, 0, SIZE, SIZE);
    g.addColorStop(0, stops[0]);
    g.addColorStop(1, stops[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, SIZE, SIZE);
  }

  // Start on a backdrop rather than a blank white square, so the very first
  // thing you see already looks like a cover.
  useEffect(() => {
    paintBackdrop(BACKDROPS[0].stops);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushUndo() {
    const c = ctx();
    if (!c) return;
    undoStack.current.push(c.getImageData(0, 0, SIZE, SIZE));
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
    setCanUndo(true);
  }

  function undo() {
    const c = ctx();
    const prev = undoStack.current.pop();
    if (!c || !prev) return;
    c.putImageData(prev, 0, 0);
    setCanUndo(undoStack.current.length > 0);
  }

  function applyBackdrop(b) {
    pushUndo();
    paintBackdrop(b.stops);
  }

  /** Canvas coords from a pointer event — the element is displayed smaller
   *  than its 640px backing store, so events need scaling. */
  function pos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * SIZE,
      y: ((e.clientY - r.top) / r.height) * SIZE,
    };
  }

  function drawShape(c, from, to) {
    c.fillStyle = color;
    c.strokeStyle = color;
    c.lineWidth = brushSize;
    const w = to.x - from.x;
    const h = to.y - from.y;
    if (tool === 'rect') {
      c.fillRect(from.x, from.y, w, h);
    } else if (tool === 'circle') {
      c.beginPath();
      c.ellipse(from.x + w / 2, from.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      c.fill();
    } else if (tool === 'triangle') {
      c.beginPath();
      c.moveTo(from.x + w / 2, from.y);
      c.lineTo(from.x, from.y + h);
      c.lineTo(from.x + w, from.y + h);
      c.closePath();
      c.fill();
    }
  }

  function onPointerDown(e) {
    e.preventDefault();
    const c = ctx();
    if (!c) return;
    const p = pos(e);
    pushUndo();

    if (tool === 'text') {
      if (!text.trim()) { setError('먼저 아래에 넣을 글자를 입력하세요'); undo(); return; }
      setError('');
      c.fillStyle = color;
      c.font = `800 ${brushSize * 4}px 'Bricolage Grotesque', sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, p.x, p.y);
      return;
    }

    if (tool === 'brush') {
      c.strokeStyle = color;
      c.lineWidth = brushSize;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(p.x, p.y);
      drawing.current = { last: p };
      const move = (ev) => {
        const q = pos(ev);
        c.lineTo(q.x, q.y);
        c.stroke();
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        drawing.current = null;
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }

    // shapes: rubber-band from the press point, previewing over a snapshot
    const snapshot = c.getImageData(0, 0, SIZE, SIZE);
    const move = (ev) => {
      c.putImageData(snapshot, 0, 0);
      drawShape(c, p, pos(ev));
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      c.putImageData(snapshot, 0, 0);
      drawShape(c, p, pos(ev));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function stampTitle() {
    const c = ctx();
    if (!c) return;
    pushUndo();
    c.textAlign = 'center';
    c.fillStyle = color;
    c.font = "800 64px 'Bricolage Grotesque', sans-serif";
    c.textBaseline = 'alphabetic';
    c.fillText(songTitle || '무제', SIZE / 2, SIZE - 96);
    c.font = "500 30px Inter, sans-serif";
    c.globalAlpha = 0.75;
    c.fillText(character?.artistName || '', SIZE / 2, SIZE - 50);
    c.globalAlpha = 1;
  }

  async function save() {
    setBusy(true); setError('');
    try {
      const blob = await new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('이미지를 만들지 못했습니다');
      await coversApi.uploadCover(songId, blob);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || '커버 저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="me-plugin max-w-3xl w-full max-h-[92vh] overflow-y-auto me-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="me-plugin-bar flex items-center gap-2 px-4 py-2.5" style={{ cursor: 'default' }}>
          <span className="text-sm" aria-hidden>🎨</span>
          <span className="font-display text-sm font-bold flex-1 text-text">앨범 커버 만들기</span>
          <button className="bg-transparent border-0 p-0 cursor-pointer text-faint hover:text-text" onClick={onClose} aria-label="닫기">
            <X size={15} />
          </button>
        </div>

        <div className="p-4 flex gap-4 flex-wrap md:flex-nowrap">
          <div className="shrink-0 mx-auto">
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              onPointerDown={onPointerDown}
              className="rounded-lg border border-border touch-none"
              style={{ width: 320, height: 320, cursor: 'crosshair', display: 'block' }}
            />
            <div className="text-[10px] text-faint mt-1.5 text-center">캔버스를 드래그해서 그리세요</div>
          </div>

          <div className="flex-1 min-w-[240px] flex flex-col gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-faint mb-1.5">배경</div>
              <div className="flex flex-wrap gap-1.5">
                {BACKDROPS.map((b) => (
                  <button
                    key={b.id} onClick={() => applyBackdrop(b)} title={`${b.label} 배경으로 채우기`}
                    className="w-9 h-9 rounded border border-border cursor-pointer"
                    style={{ background: `linear-gradient(135deg, ${b.stops[0]}, ${b.stops[1]})` }}
                    aria-label={`${b.label} 배경`}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-faint mb-1.5">도구</div>
              <div className="flex flex-wrap gap-1.5">
                {TOOLS.map(({ id, label, Icon }) => (
                  <button
                    key={id} onClick={() => setTool(id)} title={label}
                    className="px-2 py-1.5 rounded border cursor-pointer inline-flex items-center gap-1 text-[10px]"
                    style={{
                      borderColor: tool === id ? 'var(--color-accent2)' : 'var(--color-border)',
                      color: tool === id ? 'var(--color-accent2)' : 'var(--color-muted)',
                      background: 'transparent',
                    }}
                  ><Icon size={12} /> {label}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-faint mb-1.5">색</div>
              <div className="flex flex-wrap gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c} onClick={() => setColor(c)} aria-label={`색 ${c}`}
                    className="w-7 h-7 rounded-full cursor-pointer"
                    style={{ background: c, border: color === c ? '2px solid var(--color-accent2)' : '1px solid rgba(255,255,255,0.2)' }}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] text-muted mb-1">
                굵기 <span className="font-mono text-text">{brushSize}</span>
                {tool === 'text' && <span className="text-faint ml-1">(글자 크기 {brushSize * 4}px)</span>}
              </div>
              <input type="range" className="me-slider w-full" min={2} max={40} value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))} />
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-faint mb-1.5">글자</div>
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="넣을 글자를 쓰고 캔버스를 클릭" />
              <Button size="sm" className="mt-1.5 w-full" onClick={stampTitle}>
                곡 제목 + 아티스트명 넣기
              </Button>
            </div>

            {error && <div className="text-danger text-xs">{error}</div>}

            <div className="flex gap-2 mt-auto pt-1">
              <Button size="sm" onClick={undo} disabled={!canUndo}><Undo2 size={13} /> 되돌리기</Button>
              <Button size="sm" onClick={() => applyBackdrop(BACKDROPS[0])}><Trash2 size={13} /> 지우기</Button>
              <Button variant="primary" size="sm" className="ml-auto" onClick={save} disabled={busy}>
                <Save size={13} /> {busy ? '저장 중…' : '커버 저장'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
