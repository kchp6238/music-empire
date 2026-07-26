import { TopBar } from '../shared/TopBar';
import { Feed } from './Feed';
import { Chart } from './Chart';
import { CommunitySearch } from './CommunitySearch';
import { useGameStore } from '../../state/useGameStore';

export function CommunityScreen() {
  const character = useGameStore((s) => s.character);
  const communityTab = useGameStore((s) => s.communityTab);
  const setCommunityTab = useGameStore((s) => s.setCommunityTab);

  if (!character) return null;

  return (
    <div>
      <TopBar character={character} />
      <div className="max-w-[900px] mx-auto px-4 md:px-6 pt-7 pb-16">
        <CommunitySearch />
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          <div className={`me-pill ${communityTab === 'feed' ? 'active' : ''}`} onClick={() => setCommunityTab('feed')}>피드</div>
          <div className={`me-pill ${communityTab === 'chart' ? 'active' : ''}`} onClick={() => setCommunityTab('chart')}>차트</div>
        </div>
        {communityTab === 'feed' ? <Feed /> : <Chart />}
      </div>
    </div>
  );
}
