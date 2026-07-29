import { ArtistAvatar } from '../shared/ArtistAvatar';
import { useGameStore } from '../../state/useGameStore';
import { usePhoneStore } from '../../state/usePhoneStore';
import { PHONE_APPS } from './Phone';

// The phone's home screen: a little "lock screen" identity card up top, then a
// grid of app icons. Each app icon routes the phone to that app.
export function PhoneHome() {
  const character = useGameStore((s) => s.character);
  const openApp = usePhoneStore((s) => s.openApp);

  return (
    <div className="px-5 pt-6 pb-4">
      {/* identity header */}
      <div className="flex flex-col items-center text-center mb-8">
        <ArtistAvatar name={character.artistName} color="#E893A6" size={64} />
        <div className="me-display font-extrabold text-lg mt-3">{character.artistName}</div>
        <div className="text-[11px] text-muted mt-0.5">
          팬 {Number(character.fansCount).toLocaleString('ko-KR')} · 명성 {Math.round(character.fame)}
        </div>
      </div>

      {/* app grid */}
      <div className="grid grid-cols-4 gap-x-3 gap-y-5">
        {PHONE_APPS.map((a) => (
          <button
            key={a.key}
            onClick={() => openApp(a.key)}
            className="flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-0"
          >
            <div
              className="flex items-center justify-center text-2xl transition-transform active:scale-90"
              style={{
                width: 56, height: 56, borderRadius: 16,
                background: `linear-gradient(150deg, ${a.color}33, ${a.color}14)`,
                border: `1px solid ${a.color}55`,
              }}
            >
              {a.icon}
            </div>
            <span className="text-[10px] text-text/85">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
