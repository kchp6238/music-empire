import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthScreen } from './components/auth/AuthScreen';
import { WorldSelect } from './components/world/WorldSelect';
import { CharacterCreation } from './components/character/CharacterCreation';
import { StudioScreen } from './components/studio/StudioScreen';
import { BeatmakerScreen } from './components/beatmaker/BeatmakerScreen';
import { ArrangeScreen } from './components/arrange/ArrangeScreen';
import { CommunityScreen } from './components/community/CommunityScreen';
import { ResultsScreen } from './components/results/ResultsScreen';
import { RecordingStudio } from './components/recording/RecordingStudio';
import { CollabScreen } from './components/collab/CollabScreen';
import { CollabSongScreen } from './components/collab/CollabSongScreen';
import { CompanyScreen } from './components/company/CompanyScreen';
import { OnlineScreen } from './components/online/OnlineScreen';
import { NewsScreen } from './components/news/NewsScreen';
import { PageTransition } from './components/ui/PageTransition';
import { NowPlayingBar } from './components/shared/NowPlayingBar';
import { ArtistProfile } from './components/community/ArtistProfile';
import { GuideOverlay } from './components/shared/GuideOverlay';
import { SettingsModal } from './components/shared/SettingsModal';
import { Phone } from './components/phone/Phone';
import { useGameStore } from './state/useGameStore';
import { useAuthStore } from './state/useAuthStore';
import { useSettingsStore } from './state/useSettingsStore';
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
  // With an active save loaded, go straight into the game; otherwise the
  // save-select screen is home — where saves are picked, created and joined.
  if (character) return <Navigate to="/studio" replace />;
  return <WorldSelect />;
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
      <Route path="/arrange" element={<PageTransition><RequireCharacter><ArrangeScreen /></RequireCharacter></PageTransition>} />
      <Route path="/recording" element={<PageTransition><RequireCharacter><RecordingStudio /></RequireCharacter></PageTransition>} />
      <Route path="/community" element={<PageTransition><RequireCharacter><CommunityScreen /></RequireCharacter></PageTransition>} />
      <Route path="/collab" element={<PageTransition><RequireCharacter><CollabScreen /></RequireCharacter></PageTransition>} />
      <Route path="/collab/songs/:songId" element={<PageTransition><RequireCharacter><CollabSongScreen /></RequireCharacter></PageTransition>} />
      <Route path="/company" element={<PageTransition><RequireCharacter><CompanyScreen /></RequireCharacter></PageTransition>} />
      <Route path="/online" element={<PageTransition><RequireCharacter><OnlineScreen /></RequireCharacter></PageTransition>} />
      <Route path="/news" element={<PageTransition><RequireCharacter><NewsScreen /></RequireCharacter></PageTransition>} />
      <Route path="/results" element={<PageTransition><RequireCharacter><ResultsScreen /></RequireCharacter></PageTransition>} />
    </Routes>
  );
}

function App() {
  const token = useAuthStore((s) => s.token);
  const loadCharacter = useGameStore((s) => s.loadCharacter);
  const resetCharacterLoaded = useGameStore((s) => s.resetCharacterLoaded);
  const hasCharacter = useGameStore((s) => Boolean(s.character));
  const maybeAutoOpenGuide = useSettingsStore((s) => s.maybeAutoOpenGuide);

  useEffect(() => () => disposeEngine(), []);

  // First time a save is active, pop the intro guide (once per browser).
  useEffect(() => { if (hasCharacter) maybeAutoOpenGuide(); }, [hasCharacter]);

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
        <NowPlayingBar />
        <ArtistProfile />
        <GuideOverlay />
        <SettingsModal />
        <Phone />
      </BrowserRouter>
    </div>
  );
}

export default App;
