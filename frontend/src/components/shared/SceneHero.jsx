// Per-screen "scene" banners — each screen opens on an illustrated backdrop of
// the place it represents (a studio, a stage, a newsroom, an office), in the
// app's dark neon-silhouette style. Pure SVG so it's crisp, themeable and needs
// no external images (the CSP blocks those anyway).

const C = { amber: '#E8A33D', teal: '#4FD1C5', pink: '#E893A6', purple: '#8B7FD1', ink: '#0B0912' };

function Studio() {
  return (
    <svg viewBox="0 0 400 140" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="st-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#221B33" /><stop offset="1" stopColor="#100C18" /></linearGradient>
      </defs>
      <rect width="400" height="140" fill="url(#st-bg)" />
      {/* acoustic foam wall */}
      {Array.from({ length: 20 }, (_, i) => (
        <path key={i} d={`M${i * 22} 0 l11 11 l-11 11`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" transform={`translate(0,${(i % 2) * 4})`} />
      ))}
      {/* studio monitors */}
      <g opacity="0.9">
        <path d="M30 108 l40 -8 v34 l-40 8z" fill="#1A1626" stroke="rgba(255,255,255,0.1)" />
        <circle cx="50" cy="118" r="8" fill="#0D0A14" stroke={C.teal} strokeWidth="1" />
        <path d="M370 108 l-40 -8 v34 l40 8z" fill="#1A1626" stroke="rgba(255,255,255,0.1)" />
        <circle cx="350" cy="118" r="8" fill="#0D0A14" stroke={C.teal} strokeWidth="1" />
      </g>
      {/* soundwave */}
      <polyline points={Array.from({ length: 60 }, (_, i) => `${60 + i * 4.6},${70 + Math.sin(i * 0.6) * (8 + (i % 7) * 3)}`).join(' ')} fill="none" stroke={C.teal} strokeWidth="1.5" opacity="0.7" />
      {/* mixing console */}
      <path d="M120 132 l30 -30 h100 l30 30z" fill="#181322" stroke="rgba(255,255,255,0.12)" />
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i}>
          <line x1={150 + i * 12} y1="108" x2={150 + i * 12} y2="126" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <rect x={147 + i * 12} y={110 + (i % 4) * 3} width="6" height="4" rx="1" fill={C.amber} />
        </g>
      ))}
    </svg>
  );
}

function Stage() {
  return (
    <svg viewBox="0 0 400 140" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="sg-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1B1230" /><stop offset="1" stopColor="#0A0710" /></linearGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.amber} stopOpacity="0.5" /><stop offset="1" stopColor={C.amber} stopOpacity="0" /></linearGradient>
        <linearGradient id="beam2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.pink} stopOpacity="0.45" /><stop offset="1" stopColor={C.pink} stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="400" height="140" fill="url(#sg-bg)" />
      {/* light beams */}
      <path d="M90 4 L40 130 L120 130z" fill="url(#beam)" />
      <path d="M310 4 L280 130 L360 130z" fill="url(#beam2)" />
      <path d="M200 4 L150 130 L250 130z" fill="url(#beam)" opacity="0.7" />
      {/* truss + fixtures */}
      <rect x="0" y="6" width="400" height="6" fill="#0D0A14" />
      {[70, 130, 200, 270, 330].map((x, i) => <circle key={i} cx={x} cy="12" r="4" fill={i % 2 ? C.pink : C.amber} />)}
      {/* performer silhouette + mic */}
      <g fill="rgba(6,4,10,0.85)">
        <circle cx="200" cy="70" r="10" />
        <path d="M184 128 q16 -40 32 0z" />
      </g>
      <line x1="182" y1="66" x2="182" y2="128" stroke="rgba(6,4,10,0.85)" strokeWidth="2" />
      <circle cx="182" cy="64" r="3" fill={C.teal} />
      {/* crowd */}
      <path d={`M0 140 ${Array.from({ length: 40 }, (_, i) => `L${i * 10} ${132 - (i % 3) * 4} L${i * 10 + 5} 140`).join(' ')} L400 140z`} fill="rgba(4,3,7,0.9)" />
    </svg>
  );
}

function Newsroom() {
  return (
    <svg viewBox="0 0 400 140" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="nr-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#241C22" /><stop offset="1" stopColor="#110C10" /></linearGradient>
      </defs>
      <rect width="400" height="140" fill="url(#nr-bg)" />
      {/* backdrop panels */}
      {Array.from({ length: 8 }, (_, i) => <rect key={i} x={20 + i * 48} y="14" width="40" height="80" rx="3" fill="rgba(232,163,61,0.05)" stroke="rgba(232,163,61,0.12)" />)}
      {/* softbox lights */}
      <circle cx="55" cy="34" r="16" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" />
      <circle cx="345" cy="34" r="16" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" />
      {/* two interview stools + figures */}
      <g fill="rgba(6,4,10,0.8)">
        <circle cx="150" cy="72" r="9" /><path d="M136 120 q14 -34 28 0z" /><rect x="142" y="120" width="16" height="16" />
        <circle cx="250" cy="72" r="9" /><path d="M236 120 q14 -34 28 0z" /><rect x="242" y="120" width="16" height="16" />
      </g>
      {/* studio camera */}
      <g fill="#15111C" stroke="rgba(255,255,255,0.14)">
        <rect x="20" y="96" width="34" height="20" rx="3" />
        <circle cx="20" cy="106" r="6" fill="#0D0A14" stroke={C.teal} />
        <line x1="37" y1="116" x2="37" y2="136" strokeWidth="2" />
      </g>
      {/* ON AIR */}
      <rect x="300" y="100" width="70" height="18" rx="9" fill="rgba(196,87,107,0.15)" stroke="#C4576B" />
      <circle cx="312" cy="109" r="3" fill="#C4576B" />
      <text x="322" y="113" fill="#E893A6" fontSize="9" fontFamily="monospace" fontWeight="700">ON AIR</text>
    </svg>
  );
}

function Office() {
  return (
    <svg viewBox="0 0 400 140" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="of-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#141A26" /><stop offset="1" stopColor="#0A0D14" /></linearGradient>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1E2A44" /><stop offset="1" stopColor="#0E1524" /></linearGradient>
      </defs>
      <rect width="400" height="140" fill="url(#of-bg)" />
      {/* window with skyline */}
      <rect x="150" y="12" width="235" height="94" rx="2" fill="url(#sky)" stroke="rgba(255,255,255,0.1)" />
      {Array.from({ length: 12 }, (_, i) => {
        const h = 20 + (i * 37 % 55);
        return (
          <g key={i}>
            <rect x={158 + i * 19} y={106 - h} width="15" height={h} fill="#0C1120" />
            {Array.from({ length: Math.floor(h / 10) }, (_, r) => <rect key={r} x={161 + i * 19} y={100 - r * 10} width="3" height="3" fill={r % 2 ? C.amber : C.teal} opacity="0.7" />)}
          </g>
        );
      })}
      <line x1="267" y1="12" x2="267" y2="106" stroke="rgba(255,255,255,0.1)" />
      {/* desk + monitor + plant */}
      <rect x="0" y="118" width="400" height="22" fill="#171310" />
      <rect x="30" y="96" width="46" height="26" rx="2" fill="#0D0A14" stroke="rgba(255,255,255,0.14)" />
      <rect x="36" y="101" width="34" height="15" fill="rgba(79,209,197,0.15)" />
      <line x1="53" y1="122" x2="53" y2="118" stroke="rgba(255,255,255,0.14)" strokeWidth="3" />
      <g fill="#2A5F4A"><path d="M100 118 q-8 -22 0 -26 q8 4 0 26" /><path d="M100 118 q-14 -14 -20 -12 q6 10 20 12" /><path d="M100 118 q14 -14 20 -12 q-6 10 -20 12" /></g>
      <rect x="94" y="118" width="12" height="6" fill="#6B4A2E" />
      {/* wall clock */}
      <circle cx="110" cy="34" r="14" fill="#0D0A14" stroke="rgba(255,255,255,0.16)" />
      <line x1="110" y1="34" x2="110" y2="26" stroke={C.amber} strokeWidth="1.5" /><line x1="110" y1="34" x2="116" y2="34" stroke={C.amber} strokeWidth="1.5" />
    </svg>
  );
}

const SCENES = { studio: Studio, stage: Stage, newsroom: Newsroom, office: Office };

/** A screen's scene banner: the illustrated backdrop with the title/subtitle
 *  overlaid on a legibility gradient. */
export function SceneHero({ scene = 'studio', title, subtitle, right = null, height = 128 }) {
  const Scene = SCENES[scene] || Studio;
  return (
    <div className="me-panel" style={{ position: 'relative', padding: 0, height, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ position: 'absolute', inset: 0 }}><Scene /></div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(11,9,18,0.85) 0%, rgba(11,9,18,0.45) 45%, rgba(11,9,18,0.15) 100%)' }} />
      <div style={{ position: 'absolute', left: 20, bottom: 16, right: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="me-display" style={{ fontSize: 22, fontWeight: 800, textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#B8B2C4', marginTop: 2, textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>{subtitle}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}
