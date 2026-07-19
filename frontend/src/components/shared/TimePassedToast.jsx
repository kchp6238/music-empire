import { CalendarClock, X } from 'lucide-react';
import { won } from '../../lib/utils';
import { useGameStore } from '../../state/useGameStore';

/** Shows what happened while the in-game calendar moved during the last action. */
export function TimePassedToast() {
  const summary = useGameStore((s) => s.lastTimeSummary);
  const dismiss = useGameStore((s) => s.dismissTimeSummary);
  if (!summary) return null;

  const seasons = summary.seasons_settled || [];

  return (
    <div className="bg-panel border border-accent2/40 rounded-2xl px-4 py-3 mb-4 flex items-start gap-3">
      <CalendarClock size={16} className="text-accent2 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 text-xs">
        <div className="text-text">
          {summary.message && <span className="font-semibold">{summary.message} </span>}
          <span className="text-muted">
            {summary.from_date} → {summary.to_date} ({summary.days}일)
          </span>
        </div>
        <div className="text-muted mt-1">
          팬{' '}
          <b className={`font-mono ${summary.fans_delta >= 0 ? 'text-accent2' : 'text-danger'}`}>
            {summary.fans_delta >= 0 ? '+' : ''}{summary.fans_delta}
          </b>
          {' · '}스트리밍 수익 <b className="font-mono text-accent2">+{won(summary.streaming_income)}</b>
          {summary.weeks_settled > 0 && <> · {summary.weeks_settled}주 경과</>}
        </div>
        {seasons.length > 0 && (
          <div className="text-accent mt-1">
            시즌 종료: {seasons.map((s) => s.label).join(', ')} — 기록이 저장되었습니다
          </div>
        )}
      </div>
      <button className="me-btn-ghost shrink-0" style={{ padding: '4px 8px' }} onClick={dismiss} aria-label="닫기">
        <X size={13} />
      </button>
    </div>
  );
}
