/**
 * FM-style artist avatar: a "shadow figure" silhouette on a colored spotlight
 * gradient derived from the artist. No real photos exist (rivals are generated)
 * so this stands in for a face — deterministic per name so an artist always
 * looks the same, and each artist reads distinctly by color + gradient angle.
 */
export function ArtistAvatar({ name = '', color = '#8B8496', size = 44, rounded }) {
  const c = color || '#8B8496';
  let h = 137;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  const r = rounded ?? Math.round(size * 0.28);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: r, position: 'relative', overflow: 'hidden',
        flexShrink: 0, background: `linear-gradient(${h}deg, ${c} 0%, #12101A 135%)`, border: `1px solid ${c}55`,
      }}
      aria-hidden
    >
      {/* stage spotlight */}
      <div style={{ position: 'absolute', top: '-25%', left: '18%', width: '64%', height: '64%', borderRadius: '50%', background: 'rgba(255,255,255,0.14)', filter: 'blur(7px)' }} />
      {/* shadow figure (head + shoulders), like FM's silhouette portraits */}
      <svg viewBox="0 0 40 40" width={size} height={size} style={{ position: 'absolute', left: 0, bottom: 0 }}>
        <circle cx="20" cy="15" r="7" fill="rgba(7,5,10,0.5)" />
        <path d="M5 40c0-8.3 6.7-13 15-13s15 4.7 15 13z" fill="rgba(7,5,10,0.5)" />
      </svg>
    </div>
  );
}
