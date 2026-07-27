import { useState } from 'react';
import { DrumRow } from '../shared/DrumRow';
import { DRUM_INSTRUMENTS, DRUM_BY_KEY } from '../../lib/gameData/constants';
import { auditionDrum } from '../../lib/audio/engine';

// Drum sequencer grid + a per-cell inspector. Right-clicking a step selects it
// and reveals its velocity (세기) and ratchet/roll (롤) controls, so the extra
// expression lives in one tidy panel instead of cluttering every cell.
export function DrumGrid({ section, onToggle, onClearLane, onSetVelocity, onSetRatchet, currentStep }) {
  const [sel, setSel] = useState(null); // { drumKey, idx }

  // Keep selection valid: if the selected cell was toggled off, drop it.
  const selActive = sel && section.drums[sel.drumKey]?.[sel.idx];
  const selDrum = selActive ? DRUM_BY_KEY[sel.drumKey] : null;
  const selVel = selActive ? (section.drumVel?.[sel.drumKey]?.[sel.idx] ?? 100) : 100;
  const selRat = selActive ? (section.drumRatchet?.[sel.drumKey]?.[sel.idx] ?? 1) : 1;

  function selectCell(drumKey, idx) {
    // Right-click selects; if the cell is off, turn it on first so there's
    // something to shape (and audition it like a normal placement).
    if (!section.drums[drumKey][idx]) { auditionDrum(drumKey); onToggle(drumKey, idx); }
    setSel({ drumKey, idx });
  }

  return (
    <>
      {DRUM_INSTRUMENTS.map((di) => (
        <DrumRow
          key={di.key} instKey={di.key} label={di.label} icon={di.icon}
          steps={section.drums[di.key]}
          velArr={section.drumVel?.[di.key]} ratArr={section.drumRatchet?.[di.key]}
          onToggle={(i) => onToggle(di.key, i)}
          onClear={onClearLane}
          onSelectCell={selectCell}
          selectedIdx={sel?.drumKey === di.key ? sel.idx : -1}
          currentStep={currentStep} color={di.color}
        />
      ))}

      {selActive ? (
        <div className="me-daw-groove p-2.5 mt-1" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span className="text-[11px] font-semibold" style={{ color: selDrum?.color }}>
            {selDrum?.icon} {selDrum?.label} · {Math.floor(sel.idx / 4) + 1}.{(sel.idx % 4) + 1}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="text-[10px] text-muted">세기</span>
            <input
              type="range" min={1} max={127} value={selVel} className="me-slider"
              style={{ width: 110 }}
              onChange={(e) => onSetVelocity(sel.drumKey, sel.idx, Number(e.target.value))}
            />
            <span className="font-mono text-[10px] text-faint" style={{ width: 24 }}>{selVel}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="text-[10px] text-muted">롤</span>
            {[1, 2, 3, 4].map((r) => (
              <button
                key={r}
                onClick={() => onSetRatchet(sel.drumKey, sel.idx, r)}
                className="text-[10px] font-mono rounded cursor-pointer"
                style={{
                  width: 22, height: 20, border: '1px solid',
                  borderColor: selRat === r ? '#F0C24D' : 'var(--color-border)',
                  color: selRat === r ? '#F0C24D' : 'var(--color-muted)',
                  background: 'transparent',
                }}
                title={r === 1 ? '한 번' : `${r}연타 (드럼 롤)`}
              >{r}×</button>
            ))}
          </div>

          <button
            className="text-[10px] text-faint hover:text-text cursor-pointer ml-auto"
            style={{ background: 'transparent', border: 'none' }}
            onClick={() => setSel(null)}
          >닫기</button>
        </div>
      ) : (
        <div className="text-[10px] text-faint mt-1 px-1">
          칸을 <span className="text-muted">우클릭</span>하면 세기·드럼 롤을 조절할 수 있어요.
        </div>
      )}
    </>
  );
}
