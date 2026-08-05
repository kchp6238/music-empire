import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useGameStore } from '../../state/useGameStore';
import { won, compactNum } from '../../lib/utils';
import * as eventsApi from '../../lib/api/events';

// A "celebrity event" the player triggers: roll a random situation (열애설,
// 논란, 섭외…), pick how to respond, and live with the fame/fans/money outcome.
// Resolving advances a day. Self-contained button + modals.
export function LifeEvent() {
  const loadCharacter = useGameStore((s) => s.loadCharacter);
  const [event, setEvent] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function roll() {
    setError(''); setBusy(true);
    try { setEvent(await eventsApi.rollEvent()); }
    catch (e) { setError(e.message || '이벤트 발생에 실패했어요'); }
    finally { setBusy(false); }
  }
  async function choose(i) {
    setBusy(true); setError('');
    try {
      const res = await eventsApi.resolveEvent(event.id, i);
      setResult(res); setEvent(null);
      await loadCharacter();
    } catch (e) { setError(e.message || '처리에 실패했어요'); }
    finally { setBusy(false); }
  }

  function delta(v, fmt = (x) => x) {
    if (!v) return <span style={{ color: '#6B6577' }}>-</span>;
    const up = v > 0;
    return <span style={{ color: up ? '#5FBF8F' : '#C4576B' }}>{up ? '+' : ''}{fmt(v)}</span>;
  }

  return (
    <>
      <button
        className="me-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        onClick={roll} disabled={busy}
      >
        <Sparkles size={14} style={{ color: 'var(--sk-accent)' }} /> 연예계 이벤트
      </button>

      {event && (
        <div className="me-modal-backdrop" onClick={() => setEvent(null)}>
          <div className="me-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, position: 'relative' }}>
            <button onClick={() => setEvent(null)} aria-label="닫기" className="me-btn-ghost" style={{ position: 'absolute', top: 10, right: 10, padding: 4 }}><X size={15} /></button>
            <div style={{ fontSize: 34, textAlign: 'center' }}>{event.emoji}</div>
            <div className="me-display" style={{ fontSize: 18, fontWeight: 800, textAlign: 'center' }}>{event.title}</div>
            <div style={{ fontSize: 13, color: '#B8B2C4', textAlign: 'center', margin: '6px 0 16px' }}>{event.desc}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {event.choices.map((c, i) => (
                <button key={i} className="me-card" style={{ textAlign: 'center', fontWeight: 700, fontSize: 13 }} disabled={busy} onClick={() => choose(i)}>
                  {c.label}
                </button>
              ))}
            </div>
            {error && <div style={{ color: '#C4576B', fontSize: 12, marginTop: 10, textAlign: 'center' }}>{error}</div>}
          </div>
        </div>
      )}

      {result && (
        <div className="me-modal-backdrop" onClick={() => setResult(null)}>
          <div className="me-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 30 }}>{result.emoji}</div>
            <div className="me-display" style={{ fontSize: 16, fontWeight: 800 }}>{result.title} · {result.choice_label}</div>
            <div style={{ fontSize: 13, color: '#B8B2C4', margin: '8px 0 16px' }}>{result.note}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16, fontSize: 14 }}>
              <div style={{ background: 'var(--sk-panel-b)', borderRadius: 8, padding: '9px 4px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 10, color: '#6B6577' }}>명성</div><div className="me-mono" style={{ marginTop: 2 }}>{delta(result.fame_delta)}</div>
              </div>
              <div style={{ background: 'var(--sk-panel-b)', borderRadius: 8, padding: '9px 4px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 10, color: '#6B6577' }}>팬</div><div className="me-mono" style={{ marginTop: 2 }}>{delta(result.fans_delta, compactNum)}</div>
              </div>
              <div style={{ background: 'var(--sk-panel-b)', borderRadius: 8, padding: '9px 4px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 10, color: '#6B6577' }}>수익</div><div className="me-mono" style={{ marginTop: 2 }}>{delta(result.money_delta, won)}</div>
              </div>
            </div>
            <button className="me-btn-primary w-full justify-center" onClick={() => setResult(null)}>확인</button>
          </div>
        </div>
      )}
    </>
  );
}
