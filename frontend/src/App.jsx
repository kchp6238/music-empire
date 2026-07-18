import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthScreen } from './components/auth/AuthScreen';
import { IntroScreen } from './components/intro/IntroScreen';
import { CharacterCreation } from './components/character/CharacterCreation';
import { StudioScreen } from './components/studio/StudioScreen';
import { BeatmakerScreen } from './components/beatmaker/BeatmakerScreen';
import { CommunityScreen } from './components/community/CommunityScreen';
import { ResultsScreen } from './components/results/ResultsScreen';
import { CollabScreen } from './components/collab/CollabScreen';
import { CompanyScreen } from './components/company/CompanyScreen';
import { OnlineScreen } from './components/online/OnlineScreen';
import { useGameStore } from './state/useGameStore';
import { useAuthStore } from './state/useAuthStore';
import { disposeEngine } from './lib/audio/engine';

function RequireCharacter({ children }) {
  const character = useGameStore((s) => s.character);
  const characterLoaded = useGameStore((s) => s.characterLoaded);
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/" replace />;
  if (!characterLoaded) return null; // wait for loadCharacter before deciding
  if (!character) return <Navigate to="/" replace />;
  return children;
}

function RootRoute() {
  const token = useAuthStore((s) => s.token);
  const character = useGameStore((s) => s.character);
  const characterLoaded = useGameStore((s) => s.characterLoaded);

  if (!token) return <AuthScreen />;
  if (!characterLoaded) return null;
  if (character) return <Navigate to="/studio" replace />;
  return <IntroScreen />;
}

function App() {
  const token = useAuthStore((s) => s.token);
  const loadCharacter = useGameStore((s) => s.loadCharacter);
  const resetCharacterLoaded = useGameStore((s) => s.resetCharacterLoaded);

  useEffect(() => () => disposeEngine(), []);

  useEffect(() => {
    if (token) loadCharacter();
    else resetCharacterLoaded();
  }, [token]);

  return (
    <div className="me-root">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/create" element={token ? <CharacterCreation /> : <Navigate to="/" replace />} />
          <Route path="/studio" element={<RequireCharacter><StudioScreen /></RequireCharacter>} />
          <Route path="/beatmaker" element={<RequireCharacter><BeatmakerScreen /></RequireCharacter>} />
          <Route path="/community" element={<RequireCharacter><CommunityScreen /></RequireCharacter>} />
          <Route path="/collab" element={<RequireCharacter><CollabScreen /></RequireCharacter>} />
          <Route path="/company" element={<RequireCharacter><CompanyScreen /></RequireCharacter>} />
          <Route path="/online" element={<RequireCharacter><OnlineScreen /></RequireCharacter>} />
          <Route path="/results" element={<RequireCharacter><ResultsScreen /></RequireCharacter>} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
