import { Moon, X } from 'lucide-react';
import { won } from '../../lib/utils';
import { useGameStore } from '../../state/useGameStore';

export function OfflineSummaryToast() {
  const summary = useGameStore((s) => s.offlineSummary);
  const dismiss = useGameStore((s) => s.dismissOfflineSummary);
  if (!summary) return null;
  return (
    <div className="me-panel" style={{ padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, borderColor: '#8B7FD1' }}>
      <Moon size={16} style={{ color: '#8B7FD1' }} />
      <span style={{ fontSize: 12, color: '#B8B2C4' }}>
        자리를 비운 {summary.elapsed_days}일 동안 팬{' '}
        <b className="me-mono" style={{ color: summary.fans_delta >= 0 ? '#4FD1C5' : '#C4576B' }}>
          {summary.fans_delta >= 0 ? '+' : ''}{summary.fans_delta}
        </b>
        , 스트리밍 수익 <b className="me-mono" style={{ color: '#4FD1C5' }}>+{won(summary.streaming_income)}</b>
      </span>
      <button className="me-btn-ghost" style={{ padding: '4px 8px', marginLeft: 'auto' }} onClick={dismiss} aria-label="닫기"><X size={13} /></button>
    </div>
  );
}
