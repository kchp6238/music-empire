import { Disc3, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../state/useGameStore';

export function IntroScreen() {
  const navigate = useNavigate();
  const artistNameInput = useGameStore((s) => s.artistNameInput);
  const setArtistNameInput = useGameStore((s) => s.setArtistNameInput);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      <Disc3 size={52} style={{ color: '#E8A33D', marginBottom: 16 }} />
      <div className="me-display" style={{ fontSize: 40, fontWeight: 800 }}>Music Empire</div>
      <div className="me-mono" style={{ color: '#8B8496', marginTop: 6, fontSize: 13, letterSpacing: 2 }}>THE MUSIC LIFE</div>
      <p style={{ maxWidth: 460, color: '#B8B2C4', marginTop: 22, lineHeight: 1.7, fontSize: 14 }}>
        능력치는 성공을 보장하지 않는다. 팬은 모두 다른 귀를 가지고 있다.<br />
        곡을 만들고, 가사를 쓰고, 세상에 내놓고 다른 아티스트들과 경쟁해보자.
      </p>
      <input
        placeholder="아티스트명을 입력하세요" value={artistNameInput} onChange={(e) => setArtistNameInput(e.target.value)}
        className="me-mono" style={{ marginTop: 28, padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: '#1C1926', color: '#EDE9F0', width: 280, textAlign: 'center', outline: 'none' }}
      />
      <button className="me-btn-primary" style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/create')} disabled={!artistNameInput.trim()}>
        인생 시작하기 <ChevronRight size={17} />
      </button>
    </div>
  );
}
