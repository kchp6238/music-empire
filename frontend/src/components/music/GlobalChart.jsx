import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import * as communityApi from '../../lib/api/community';

// Billboard-style world ranking: the player's songs vs world rivals and a
// rotating field of fictional international stars. Refreshes weekly (server-
// seeded per world+week). Self-contained fetch.
export function GlobalChart() {
  const [data, setData] = useState(null);

  useEffect(() => {
    communityApi.getGlobalChart().then(setData).catch(() => {});
  }, []);

  return (
    <div className="me-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div className="me-display" style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Globe size={17} style={{ color: 'var(--sk-accent2, #4FD1C5)' }} /> 글로벌 차트 <span style={{ fontSize: 11, color: 'var(--color-faint)' }}>HOT 50</span>
        </div>
        {data?.your_best_rank && (
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: 'var(--sk-accent)' }}>내 최고 세계 {data.your_best_rank}위</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 12 }}>전 세계 아티스트와 겨루는 실시간 순위 (매주 갱신).</div>

      {!data ? (
        <div style={{ fontSize: 12, color: 'var(--color-faint)' }}>불러오는 중…</div>
      ) : data.your_best_rank == null ? (
        <div style={{ fontSize: 12, color: 'var(--color-faint)', marginBottom: 10 }}>아직 차트 진입 전이에요. 곡을 발매하고 명성을 키워 진입해보세요!</div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflowY: 'auto' }} className="me-scroll">
        {(data?.entries || []).map((e) => (
          <div key={`${e.rank}`} style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 8, fontSize: 13,
            background: e.is_you ? 'rgba(232,163,61,0.12)' : 'transparent',
            border: `1px solid ${e.is_you ? 'var(--sk-accent)' : 'transparent'}`,
          }}>
            <span className="me-mono" style={{ width: 26, textAlign: 'right', color: e.rank <= 3 ? '#F5C46B' : 'var(--color-muted)', fontWeight: e.rank <= 3 ? 800 : 400 }}>{e.rank}</span>
            <span style={{ fontSize: 14 }}>{e.flag}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: e.is_you ? 800 : 600, color: e.is_you ? 'var(--sk-accent)' : 'var(--color-text)' }}>{e.name}</span>
              <span style={{ color: 'var(--color-muted)' }}> — {e.title}</span>
              {e.is_you && <span style={{ color: 'var(--sk-accent)', fontWeight: 800 }}> · 나</span>}
            </span>
            <span className="me-mono" style={{ fontSize: 11, color: 'var(--color-faint)' }}>{e.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
