import { TopBar } from '../shared/TopBar';
import { Feed } from './Feed';
import { Chart } from './Chart';
import { useGameStore } from '../../state/useGameStore';

export function CommunityScreen() {
  const character = useGameStore((s) => s.character);
  const communityTab = useGameStore((s) => s.communityTab);
  const setCommunityTab = useGameStore((s) => s.setCommunityTab);

  if (!character) return null;

  return (
    <div>
      <TopBar character={character} />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 60px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          <div className={`me-pill ${communityTab === 'feed' ? 'active' : ''}`} onClick={() => setCommunityTab('feed')}>피드</div>
          <div className={`me-pill ${communityTab === 'chart' ? 'active' : ''}`} onClick={() => setCommunityTab('chart')}>차트</div>
        </div>
        {communityTab === 'feed' ? <Feed /> : <Chart />}
      </div>
    </div>
  );
}
