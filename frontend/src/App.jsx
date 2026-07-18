import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { IntroScreen } from './components/intro/IntroScreen';
import { CharacterCreation } from './components/character/CharacterCreation';
import { StudioScreen } from './components/studio/StudioScreen';
import { BeatmakerScreen } from './components/beatmaker/BeatmakerScreen';
import { CommunityScreen } from './components/community/CommunityScreen';
import { ResultsScreen } from './components/results/ResultsScreen';
import { useGameStore } from './state/useGameStore';
import { disposeEngine } from './lib/audio/engine';

function RequireCharacter({ children }) {
  const character = useGameStore((s) => s.character);
  if (!character) return <Navigate to="/" replace />;
  return children;
}

function App() {
  useEffect(() => () => disposeEngine(), []);

  return (
    <div className="me-root">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<IntroScreen />} />
          <Route path="/create" element={<CharacterCreation />} />
          <Route path="/studio" element={<RequireCharacter><StudioScreen /></RequireCharacter>} />
          <Route path="/beatmaker" element={<RequireCharacter><BeatmakerScreen /></RequireCharacter>} />
          <Route path="/community" element={<RequireCharacter><CommunityScreen /></RequireCharacter>} />
          <Route path="/results" element={<RequireCharacter><ResultsScreen /></RequireCharacter>} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
