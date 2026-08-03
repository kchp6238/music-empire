import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Disc3, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { getAuthConfig } from '../../lib/api/auth';
import { useAuthStore } from '../../state/useAuthStore';
import { StageHero } from './StageHero';
import { playIntroCue } from '../../lib/audio/introCue';

// Entry cinematic: a dark house → tap → the spotlight snaps on with a swell,
// the camera pulls back off the star, and the crowd roars → the login card
// rises. Plays once per browser session (a tap is also what lets the sound
// play under autoplay rules); returning here later goes straight to the form.
function seenIntro() {
  try { return sessionStorage.getItem('me_intro_seen') === '1'; } catch { return false; }
}

export function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteRequired, setInviteRequired] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(() => (seenIntro() ? 'form' : 'gate')); // gate → reveal → form

  function finishIntro() {
    setPhase('form');
    try { sessionStorage.setItem('me_intro_seen', '1'); } catch { /* ignore */ }
  }
  function begin() {
    playIntroCue();
    setPhase('reveal');
  }

  // Hold on the reveal, then bring up the form.
  useEffect(() => {
    if (phase !== 'reveal') return undefined;
    const t = setTimeout(finishIntro, reduce ? 1100 : 2900);
    return () => clearTimeout(t);
  }, [phase, reduce]);

  // The deployed instance is invite-gated; local dev usually isn't. Ask the
  // server rather than hardcoding, so the same build works in both.
  useEffect(() => {
    getAuthConfig().then((c) => setInviteRequired(!!c.invite_required)).catch(() => {});
  }, []);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') await register(email, password, inviteCode);
      await login(email, password);
    } catch (e) {
      setError(e.message || '오류가 발생했습니다');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = email.trim() && password.trim()
    && (mode === 'login' || !inviteRequired || inviteCode.trim());

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center text-center p-6 overflow-hidden">
      {/* the stage, behind everything — mounts for the reveal and stays for the form */}
      {phase !== 'gate' && (
        <motion.div
          className="me-stage"
          initial={reduce ? { opacity: 0 } : { scale: 1.55 }}
          animate={reduce ? { opacity: 1 } : { scale: 1 }}
          transition={{ duration: 2.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <StageHero />
        </motion.div>
      )}

      {/* the "lights up" brighten: a black veil fading off over the reveal */}
      {phase === 'reveal' && !reduce && (
        <motion.div
          className="fixed inset-0 z-[1] pointer-events-none"
          style={{ background: '#050308' }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2.3, ease: 'easeOut' }}
        />
      )}
      {phase === 'form' && <div className="me-stage-veil" />}

      <AnimatePresence mode="wait">
        {/* ---- dark house: tap to start ---- */}
        {phase === 'gate' && (
          <motion.div
            key="gate"
            className="fixed inset-0 z-10 flex flex-col items-center justify-center cursor-pointer select-none"
            style={{ background: '#050308' }}
            onClick={begin}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="me-stage-cue" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 44%, rgba(232,163,61,0.12), transparent 55%)' }} />
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}>
              <Disc3 size={46} className="text-accent" style={{ filter: 'drop-shadow(0 0 16px rgba(232,163,61,0.5))' }} />
            </motion.div>
            <div className="font-display text-3xl font-extrabold mt-6 relative">Music Empire</div>
            <div className="me-stage-cue text-muted text-sm mt-4 relative tracking-wide">화면을 탭하면 시작합니다</div>
          </motion.div>
        )}

        {/* ---- reveal: skip affordance only ---- */}
        {phase === 'reveal' && (
          <motion.button
            key="skip"
            onClick={finishIntro}
            className="fixed z-10 text-faint text-xs hover:text-muted transition-colors cursor-pointer tracking-wide"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 22px)', right: 22 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
          >
            건너뛰기 ›
          </motion.button>
        )}

        {/* ---- the login card ---- */}
        {phase === 'form' && (
          <motion.div
            key="form"
            className="relative z-10 w-full flex flex-col items-center"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="font-display text-4xl font-extrabold tracking-tight" style={{ textShadow: '0 2px 30px rgba(0,0,0,0.8)' }}>
              Music Empire
            </div>
            <div className="text-muted mt-2 text-sm" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.8)' }}>
              당신의 음악 인생이 여기서 시작됩니다
            </div>

            <div className="me-auth-card mt-6 w-full max-w-[19rem] text-left">
              <div className="text-[11px] text-faint mb-3 tracking-[0.15em] font-mono">
                {mode === 'login' ? 'LOG IN' : 'SIGN UP'}
              </div>

              <form
                className="flex flex-col gap-2.5"
                onSubmit={(e) => { e.preventDefault(); if (canSubmit && !busy) submit(); }}
              >
                <Input type="email" placeholder="이메일" autoComplete="email" className="font-mono"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input type="password" placeholder="비밀번호 (8자 이상)" className="font-mono"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                {mode === 'register' && inviteRequired && (
                  <Input placeholder="초대 코드" className="font-mono"
                    value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
                )}

                {error && <div className="text-danger text-xs mt-1">{error}</div>}

                <Button type="submit" variant="primary" size="lg" className="mt-2 justify-center" disabled={busy || !canSubmit}>
                  {mode === 'login' ? '로그인' : '회원가입 후 시작'} <ChevronRight size={17} />
                </Button>
              </form>

              <button
                className="mt-4 w-full text-center text-xs text-muted hover:text-text transition-colors cursor-pointer"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              >
                {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
              </button>

              {mode === 'register' && inviteRequired && (
                <div className="text-faint text-[11px] mt-3">
                  이 서버는 초대 코드가 있어야 가입할 수 있습니다.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
