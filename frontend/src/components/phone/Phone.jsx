import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, X, ChevronLeft, Wifi, BatteryFull, Signal } from 'lucide-react';
import { useGameStore } from '../../state/useGameStore';
import { usePhoneStore } from '../../state/usePhoneStore';
import * as dmApi from '../../lib/api/dm';
import { PhoneHome } from './PhoneHome';
import { NewsApp } from './NewsApp';
import { ChartApp } from './ChartApp';
import { SnsApp } from './SnsApp';
import { DmApp } from './DmApp';

// The app registry — the home grid and the in-phone router both read this, so
// adding an app is one entry. `title` shows in the app's top bar.
export const PHONE_APPS = [
  { key: 'sns', label: '뮤즈그램', title: '뮤즈그램', icon: '📸', color: '#E893A6', Component: SnsApp },
  { key: 'dm', label: '메시지', title: '메시지', icon: '💬', color: '#4FD1C5', Component: DmApp },
  { key: 'news', label: '뉴스', title: '뉴스', icon: '📰', color: '#E8A33D', Component: NewsApp },
  { key: 'chart', label: '차트', title: '차트', icon: '📈', color: '#8B7FD1', Component: ChartApp },
];

/** The floating launcher button — bottom-right, above the phone bottom-nav on
 *  mobile. Only rendered while a save is active (see App.jsx gate). */
export function Phone() {
  const character = useGameStore((s) => s.character);
  const open = usePhoneStore((s) => s.open);
  const activeApp = usePhoneStore((s) => s.activeApp);
  const openPhone = usePhoneStore((s) => s.openPhone);
  const closePhone = usePhoneStore((s) => s.closePhone);
  const goHome = usePhoneStore((s) => s.goHome);
  const [unread, setUnread] = useState(0);

  // Refresh the message badge when a save loads and whenever the phone closes
  // (reading a thread on the backend clears its unread).
  const characterId = character?.id;
  useEffect(() => {
    if (!characterId || open) return;
    let cancelled = false;
    dmApi.getUnread().then((r) => { if (!cancelled) setUnread(r?.unread || 0); }).catch(() => {});
    return () => { cancelled = true; };
  }, [characterId, open]);

  if (!character) return null;

  const app = PHONE_APPS.find((a) => a.key === activeApp);
  const AppView = app?.Component;

  return (
    <>
      {!open && (
        <button
          onClick={() => openPhone()}
          aria-label="휴대폰 열기"
          title="휴대폰"
          className="fixed right-4 z-[150] rounded-full flex items-center justify-center shadow-lg cursor-pointer border"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
            width: 52, height: 52, background: 'linear-gradient(150deg,#2A2436,#16131F)',
            borderColor: 'rgba(232,163,166,0.5)', color: '#E893A6',
          }}
        >
          <Smartphone size={22} />
          {unread > 0 && (
            <span
              className="absolute rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ top: -2, right: -2, minWidth: 18, height: 18, padding: '0 5px', background: '#E893A6', color: '#12101A' }}
            >{unread}</span>
          )}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            key="phone-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[190] flex items-end sm:items-center justify-center sm:p-4"
            style={{ background: 'rgba(8,6,12,0.6)', backdropFilter: 'blur(2px)' }}
            onClick={closePhone}
          >
            <motion.div
              initial={{ y: 40, opacity: 0.6, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="relative flex flex-col overflow-hidden"
              style={{
                width: 'min(380px, 100vw)', height: 'min(760px, 92vh)',
                background: '#0E0C15',
                borderRadius: 'clamp(16px, 4vw, 34px)',
                border: '1px solid rgba(255,255,255,0.14)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 0 0 5px #050409',
              }}
            >
              {/* status bar */}
              <div className="flex items-center justify-between px-5 pt-2.5 pb-1.5 shrink-0 select-none">
                <span className="me-mono text-[11px] text-text/90">{character.gameDate || ''}</span>
                <div className="flex items-center gap-1.5 text-text/70">
                  <Signal size={12} /> <Wifi size={12} /> <BatteryFull size={13} />
                </div>
              </div>

              {/* app header (hidden on home) */}
              {app && (
                <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-white/8">
                  <button
                    onClick={goHome} aria-label="홈으로"
                    className="w-7 h-7 flex items-center justify-center rounded-full text-text/80 hover:bg-white/8 cursor-pointer bg-transparent border-0"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-[13px]">{app.icon}</span>
                  <span className="font-semibold text-sm text-text">{app.title}</span>
                  <button
                    onClick={closePhone} aria-label="휴대폰 닫기"
                    className="ml-auto w-7 h-7 flex items-center justify-center rounded-full text-text/60 hover:bg-white/8 cursor-pointer bg-transparent border-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* screen */}
              <div className="flex-1 min-h-0 overflow-y-auto me-scroll">
                {AppView ? <AppView /> : <PhoneHome onClose={closePhone} />}
              </div>

              {/* home indicator */}
              <button
                onClick={goHome} aria-label="홈"
                className="shrink-0 flex items-center justify-center py-2 cursor-pointer bg-transparent border-0"
              >
                <span className="rounded-full" style={{ width: 116, height: 5, background: 'rgba(255,255,255,0.28)' }} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
