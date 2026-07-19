import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthScreen } from './components/auth/AuthScreen';
import { IntroScreen } from './components/intro/IntroScreen';
import { CharacterCreation } from './components/character/CharacterCreation';
import { StudioScreen } from './components/studio/StudioScreen';
import { BeatmakerScreen } from './components/beatmaker/BeatmakerScreen';
import { CommunityScreen } from './components/community/CommunityScreen';
import { ResultsScreen } from './components/results/ResultsScreen';
import { RecordingStudio } from './components/recording/RecordingStudio';
import { CollabScreen } from './components/collab/CollabScreen';
import { CollabSongScreen } from './components/collab/CollabSongScreen';
import { CompanyScreen } from './components/company/CompanyScreen';
import { OnlineScreen } from './components/online/OnlineScreen';
import { PageTransition } from './components/ui/PageTransition';
import { useGameStore } from './state/useGameStore';
import { useAuthStore } from './state/useAuthStore';
import { setUnauthorizedHandler } from './lib/api/client';
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

function RequireAuth({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/" replace />;
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

// Mount-only fade/slide transition per route (see components/ui/PageTransition.jsx).
// Deliberately NOT using AnimatePresence+keyed<Routes> for an exit animation —
// that combination unmounts the old route synchronously on navigate() (React
// Router swaps the match immediately) while AnimatePresence waits for an exit
// animation that never gets to run, which left the SPA showing stale content
// after client-side navigation (confirmed via the in-app browser: URL changes,
// DOM doesn't). A plain per-route mount animation has no such coordination
// problem and still delivers real transition polish.
function AnimatedRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PageTransition><RootRoute /></PageTransition>} />
      <Route path="/create" element={<PageTransition><RequireAuth><CharacterCreation /></RequireAuth></PageTransition>} />
      <Route path="/studio" element={<PageTransition><RequireCharacter><StudioScreen /></RequireCharacter></PageTransition>} />
      <Route path="/beatmaker" element={<PageTransition><RequireCharacter><BeatmakerScreen /></RequireCharacter></PageTransition>} />
      <Route path="/recording" element={<PageTransition><RequireCharacter><RecordingStudio /></RequireCharacter></PageTransition>} />
      <Route path="/community" element={<PageTransition><RequireCharacter><CommunityScreen /></RequireCharacter></PageTransition>} />
      <Route path="/collab" element={<PageTransition><RequireCharacter><CollabScreen /></RequireCharacter></PageTransition>} />
      <Route path="/collab/songs/:songId" element={<PageTransition><RequireCharacter><CollabSongScreen /></RequireCharacter></PageTransition>} />
      <Route path="/company" element={<PageTransition><RequireCharacter><CompanyScreen /></RequireCharacter></PageTransition>} />
      <Route path="/online" element={<PageTransition><RequireCharacter><OnlineScreen /></RequireCharacter></PageTransition>} />
      <Route path="/results" element={<PageTransition><RequireCharacter><ResultsScreen /></RequireCharacter></PageTransition>} />
    </Routes>
  );
}

function App() {
  const token = useAuthStore((s) => s.token);
  const loadCharacter = useGameStore((s) => s.loadCharacter);
  const resetCharacterLoaded = useGameStore((s) => s.resetCharacterLoaded);

  useEffect(() => () => disposeEngine(), []);

  // Any 401 clears the session, which flips RootRoute back to the login screen
  // instead of leaving the player on a page where every action silently fails.
  useEffect(() => {
    setUnauthorizedHandler(() => useAuthStore.getState().logout());
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (token) loadCharacter();
    else resetCharacterLoaded();
  }, [token]);

  return (
    <div className="me-root">
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </div>
  );
}

export default App;
