import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Disc3, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { getAuthConfig } from '../../lib/api/auth';
import { useAuthStore } from '../../state/useAuthStore';
import { AuthBackdrop } from './AuthBackdrop';

// A short cinematic opener — the arc of a music life, one line at a time —
// before the login card resolves in. Plays once per browser session (skippable);
// returning to this screen (e.g. after a failed login) goes straight to the form.
const INTRO_LINES = [
  '누구나 밑바닥에서 시작한다',
  '작은 방, 마이크 하나',
  '첫 곡이 세상에 닿는 순간',
  '무대는, 점점 커진다',
];

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

  const [showForm, setShowForm] = useState(() => {
    try { return sessionStorage.getItem('me_intro_seen') === '1'; } catch { return false; }
  });
  const [line, setLine] = useState(0);

  function finishIntro() {
    setShowForm(true);
    try { sessionStorage.setItem('me_intro_seen', '1'); } catch { /* ignore */ }
  }

  // Advance the intro one line at a time, then reveal the form.
  useEffect(() => {
    if (showForm) return undefined;
    if (line >= INTRO_LINES.length) { finishIntro(); return undefined; }
    const t = setTimeout(() => setLine((l) => l + 1), line === 0 ? 800 : 1150);
    return () => clearTimeout(t);
  }, [line, showForm]);

  // The deployed instance is invite-gated; local dev usually isn't. Ask the
  // server rather than hardcoding, so the same build works in both.
  useEffect(() => {
    getAuthConfig().then((c) => setInviteRequired(!!c.invite_required)).catch(() => {});
  }, []);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') {
        await register(email, password, inviteCode);
      }
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
      <AuthBackdrop />

      <AnimatePresence mode="wait">
        {!showForm ? (
          <motion.div
            key="intro"
            className="relative z-10 flex flex-col items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.45 }}
          >
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}>
              <Disc3 size={54} className="text-accent" style={{ filter: 'drop-shadow(0 0 18px rgba(232,163,61,0.55))' }} />
            </motion.div>

            <div className="h-16 mt-9 flex items-center px-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={line}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.5 }}
                  className="font-display text-2xl sm:text-3xl font-bold text-text"
                  style={{ textShadow: '0 2px 22px rgba(0,0,0,0.75)' }}
                >
                  {INTRO_LINES[Math.min(line, INTRO_LINES.length - 1)]}
                </motion.div>
              </AnimatePresence>
            </div>

            <button
              onClick={finishIntro}
              className="mt-10 text-faint text-xs hover:text-muted transition-colors cursor-pointer tracking-wide"
            >
              건너뛰기 ›
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="auth"
            className="relative z-10 w-full flex flex-col items-center"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.05, duration: 0.5 }}>
              <Disc3 size={46} className="text-accent mb-3" style={{ filter: 'drop-shadow(0 0 16px rgba(232,163,61,0.5))' }} />
            </motion.div>
            <div className="font-display text-4xl font-extrabold tracking-tight" style={{ textShadow: '0 2px 26px rgba(0,0,0,0.65)' }}>
              Music Empire
            </div>
            <div className="text-muted mt-2 text-sm">당신의 음악 인생이 여기서 시작됩니다</div>

            <div className="me-auth-card mt-7 w-full max-w-[19rem] text-left">
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
