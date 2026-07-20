import { useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Floating, draggable plugin window chrome — shared by the drum machine and
 * the effect windows. Drag handling follows the same convention as
 * Timeline.jsx's clip resize: native window listeners, with state updates
 * deferred through queueMicrotask because they fire outside React's handlers.
 */
export function PluginWindow({ title, accent = 'var(--color-accent2)', initial = { x: 120, y: 120 }, onClose, children }) {
  const [pos, setPos] = useState(initial);
  const [z, setZ] = useState(0);
  const posRef = useRef(pos);
  posRef.current = pos;

  function startDrag(e) {
    if (e.target.closest('button')) return; // let the close button through
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = posRef.current;
    function apply(ev) {
      setPos({
        x: Math.max(0, origin.x + (ev.clientX - startX)),
        y: Math.max(0, origin.y + (ev.clientY - startY)),
      });
    }
    function onMove(ev) { queueMicrotask(() => apply(ev)); }
    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  return (
    <div
      className="me-plugin fixed"
      style={{ left: pos.x, top: pos.y, zIndex: 60 + z }}
      onMouseDown={() => setZ(1)}
    >
      <div className="me-plugin-bar flex items-center gap-2 px-3 py-2" onMouseDown={startDrag}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
        <span className="font-display text-xs font-bold flex-1 text-text">{title}</span>
        <button
          className="bg-transparent border-0 p-0 cursor-pointer text-faint hover:text-text"
          onClick={onClose}
          aria-label="창 닫기"
        ><X size={13} /></button>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
