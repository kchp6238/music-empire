import { useEffect, useState } from 'react';
import { Disc3, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { getAuthConfig } from '../../lib/api/auth';
import { useAuthStore } from '../../state/useAuthStore';

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
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
      <Disc3 size={44} className="text-accent mb-3.5" />
      <div className="font-display text-3xl font-extrabold">Music Empire</div>
      <div className="text-muted mt-1.5 text-sm">{mode === 'login' ? '로그인' : '회원가입'}</div>

      <form
        className="flex flex-col gap-2.5 mt-6 w-70"
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

      <Button className="mt-3.5" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
        {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
      </Button>

      {mode === 'register' && inviteRequired && (
        <div className="text-faint text-[11px] mt-3 max-w-xs">
          이 서버는 초대 코드가 있어야 가입할 수 있습니다.
        </div>
      )}
    </div>
  );
}
