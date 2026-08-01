import { useEffect, useState } from 'react';
import { WifiOff, Download, X } from 'lucide-react';

function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

/** A thin banner when the device drops offline — the game needs the backend, so
 *  this explains why actions suddenly fail instead of leaving cryptic errors. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return (
    <div className="fixed left-0 right-0 z-[300] flex items-center justify-center gap-2 text-[12px] font-medium"
      style={{ top: 0, color: '#fff', background: '#C4576B', padding: '6px 10px', paddingTop: 'max(6px, env(safe-area-inset-top))' }}>
      <WifiOff size={13} /> 오프라인 상태예요 — 인터넷에 연결하면 다시 이용할 수 있어요
    </div>
  );
}

/** "Install app" chip. Chromium fires beforeinstallprompt; we capture it and
 *  offer a one-tap install. Hidden once installed or dismissed. (iOS Safari has
 *  no such event — users add via Share → 홈 화면에 추가.) */
export function InstallPrompt() {
  const [evt, setEvt] = useState(null);
  const [dismissed, setDismissed] = useState(() => { try { return !!localStorage.getItem('me_install_dismissed'); } catch { return false; } });

  useEffect(() => {
    if (isInstalled()) return undefined;
    const handler = (e) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    const onInstalled = () => setEvt(null);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', handler); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (!evt || dismissed || isInstalled()) return null;

  async function install() {
    evt.prompt();
    try { await evt.userChoice; } catch { /* ignore */ }
    setEvt(null);
  }
  function close() { setDismissed(true); try { localStorage.setItem('me_install_dismissed', '1'); } catch { /* ignore */ } }

  return (
    <div className="fixed z-[250] flex items-center gap-1.5"
      style={{ left: 16, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 78px)' }}>
      <button onClick={install} className="me-btn-primary inline-flex items-center gap-1.5 !py-2 !px-3 !text-[12px] shadow-lg">
        <Download size={14} /> 앱으로 설치
      </button>
      <button onClick={close} aria-label="설치 안내 닫기"
        className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer border"
        style={{ background: 'rgba(20,18,28,0.9)', borderColor: 'rgba(255,255,255,0.15)', color: '#8B8496' }}>
        <X size={13} />
      </button>
    </div>
  );
}
