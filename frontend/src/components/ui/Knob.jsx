import { useEffect, useRef, useState } from 'react';

/**
 * Rotary knob — the control the plugin windows (drum machine, effects) are
 * built from. Vertical drag to turn, shift-drag for fine control, wheel to
 * nudge, double-click to reset to the default.
 *
 * Gesture follows the convention already established by VelocityLane.jsx and
 * Timeline.jsx: native window mousemove/mouseup listeners, with the store
 * setter deferred through queueMicrotask because it fires from inside a
 * native listener rather than a React handler.
 */

// -135°..+135° measured from 12 o'clock — the standard ~270° knob throw.
const MAX_ANGLE = 135;
// A full min->max sweep takes this many pixels of vertical drag.
const DRAG_RANGE_PX = 150;

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

function arcPath(cx, cy, r, fromDeg, toDeg) {
  const [x0, y0] = polar(cx, cy, r, fromDeg);
  const [x1, y1] = polar(cx, cy, r, toDeg);
  const largeArc = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1}`;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function Knob({
  value,
  min = 0,
  max = 100,
  step = 1,
  defaultValue,
  label,
  unit = '',
  size = 42,
  color = 'var(--color-accent2)',
  bipolar = false,     // fill grows out from 12 o'clock instead of from the left stop
  format,
  disabled = false,
  onChange,
}) {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);

  const quantize = (v) => {
    const q = Math.round(v / step) * step;
    return Math.round(q * 1000) / 1000;
  };

  const ratio = (clamp(value, min, max) - min) / (max - min || 1);
  const angle = -MAX_ANGLE + ratio * MAX_ANGLE * 2;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = Math.max(3, size * 0.1);
  const r = size / 2 - stroke / 2 - 1;
  const fillFrom = bipolar ? 0 : -MAX_ANGLE;

  const readout = format ? format(value) : `${value}${unit}`;

  // Native + non-passive so preventDefault actually stops the page scrolling
  // under the cursor — React's synthetic onWheel is passive and cannot.
  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return undefined;
    function onWheel(e) {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      onChange(quantize(clamp(value + dir * step * (e.shiftKey ? 1 : 2), min, max)));
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [value, min, max, step, disabled, onChange]);

  function startDrag(e) {
    if (disabled) return;
    e.preventDefault();
    const startY = e.clientY;
    const startValue = clamp(value, min, max);
    const span = max - min;
    setDragging(true);

    function apply(clientY, fine) {
      const px = (startY - clientY) / (fine ? DRAG_RANGE_PX * 4 : DRAG_RANGE_PX);
      onChange(quantize(clamp(startValue + px * span, min, max)));
    }
    // queueMicrotask: these run inside a native mousemove listener — see
    // Timeline.jsx's onResizeStart for why this avoids a React warning.
    function onMove(ev) { queueMicrotask(() => apply(ev.clientY, ev.shiftKey)); }
    function onUp() {
      queueMicrotask(() => setDragging(false));
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onDoubleClick() {
    if (disabled || defaultValue === undefined) return;
    onChange(defaultValue);
  }

  const [ix, iy] = polar(cx, cy, r * 0.55, angle);
  const [ox, oy] = polar(cx, cy, r * 0.95, angle);

  return (
    <div
      className="flex flex-col items-center gap-1 select-none"
      style={{ opacity: disabled ? 0.4 : 1 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onMouseDown={startDrag}
        onDoubleClick={onDoubleClick}
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        style={{ cursor: disabled ? 'not-allowed' : 'ns-resize', touchAction: 'none' }}
      >
        <circle cx={cx} cy={cy} r={r - stroke * 0.6} fill="var(--color-panel-2)" />
        <path d={arcPath(cx, cy, r, -MAX_ANGLE, MAX_ANGLE)} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} strokeLinecap="round" />
        {Math.abs(angle - fillFrom) > 0.5 && (
          <path
            d={angle >= fillFrom ? arcPath(cx, cy, r, fillFrom, angle) : arcPath(cx, cy, r, angle, fillFrom)}
            fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          />
        )}
        <line x1={ix} y1={iy} x2={ox} y2={oy} stroke="var(--color-text)" strokeWidth={Math.max(1.5, size * 0.045)} strokeLinecap="round" />
      </svg>
      {label && (
        <div
          className="font-mono leading-none text-center whitespace-nowrap"
          style={{ fontSize: 9, color: (dragging || hover) ? 'var(--color-text)' : 'var(--color-faint)' }}
        >
          {(dragging || hover) ? readout : label}
        </div>
      )}
    </div>
  );
}
