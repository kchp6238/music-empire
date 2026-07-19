import { useState } from 'react';
import { Dumbbell, Bed } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { useGameStore } from '../../state/useGameStore';
import { won } from '../../lib/utils';

const STAT_LABELS = {
  composing: '작곡', lyrics: '작사', arrangement: '편곡', vocal: '보컬',
  production: '프로듀싱', mixing: '믹싱', business: '비즈니스', marketing: '마케팅',
};
const TRAIN_COST = 200000;
const CEILING = 95;

export function TrainingPanel() {
  const character = useGameStore((s) => s.character);
  const trainStat = useGameStore((s) => s.trainStat);
  const restWeek = useGameStore((s) => s.restWeek);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!character) return null;

  async function run(fn) {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e.message || '실패했습니다'); } finally { setBusy(false); }
  }

  const broke = Number(character.money) < TRAIN_COST;

  return (
    <Panel className="mb-4">
      <div className="text-sm font-bold mb-1 flex items-center gap-2">
        <Dumbbell size={15} className="text-accent2" /> 훈련
      </div>
      <div className="text-[11px] text-muted mb-3">
        한 번에 3일이 지나고 {won(TRAIN_COST)}이 듭니다. 능력치가 높을수록 오르는 폭이 줄어듭니다.
      </div>
      {error && <div className="text-danger text-xs mb-2">{error}</div>}

      <div className="grid grid-cols-2 gap-1.5">
        {Object.entries(STAT_LABELS).map(([key, label]) => {
          const value = character.stats[key] ?? 0;
          const maxed = value >= CEILING;
          return (
            <Button
              key={key} size="sm" disabled={busy || maxed || broke}
              onClick={() => run(() => trainStat(key))}
              className="justify-between"
              title={maxed ? '이미 최고 수준입니다' : broke ? '자금이 부족합니다' : `${label} 훈련`}
            >
              <span>{label}</span>
              <span className="font-mono text-muted">{value}</span>
            </Button>
          );
        })}
      </div>

      <div className="border-t border-border mt-3 pt-3 flex items-center gap-2">
        <span className="text-[11px] text-muted flex-1">
          아무것도 하지 않고 한 주를 보냅니다. 팬이 쌓이거나 유행이 바뀌길 기다릴 때.
        </span>
        <Button size="sm" disabled={busy} onClick={() => run(restWeek)}>
          <Bed size={13} /> 한 주 쉬기
        </Button>
      </div>
    </Panel>
  );
}
