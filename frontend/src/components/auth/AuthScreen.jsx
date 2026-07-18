import { useState } from 'react';
import { Disc3, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../state/useAuthStore';

export function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') {
        await register(email, password);
      }
      await login(email, password);
    } catch (e) {
      setError(e.message || '오류가 발생했습니다');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
      <Disc3 size={44} style={{ color: '#E8A33D', marginBottom: 14 }} />
      <div className="me-display" style={{ fontSize: 30, fontWeight: 800 }}>Music Empire</div>
      <div style={{ color: '#8B8496', marginTop: 6, fontSize: 13 }}>{mode === 'login' ? '로그인' : '회원가입'}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24, width: 280 }}>
        <input
          type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)}
          className="me-mono" style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: '#1C1926', color: '#EDE9F0', outline: 'none' }}
        />
        <input
          type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)}
          className="me-mono" style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: '#1C1926', color: '#EDE9F0', outline: 'none' }}
        />
      </div>

      {error && <div style={{ color: '#C4576B', fontSize: 12, marginTop: 12 }}>{error}</div>}

      <button className="me-btn-primary" style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={submit} disabled={busy || !email.trim() || !password.trim()}>
        {mode === 'login' ? '로그인' : '회원가입 후 시작'} <ChevronRight size={17} />
      </button>

      <button
        className="me-btn-ghost" style={{ marginTop: 14 }}
        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
      >
        {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
      </button>
    </div>
  );
}
