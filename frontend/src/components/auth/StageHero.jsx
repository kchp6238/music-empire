// The entry-screen concert: a lone star in a warm spotlight against a cold,
// full lighting rig — LED wall, a truss of moving heads throwing colored
// beams, lasers, line-array speakers, a lipped stage, and a roaring crowd lit
// by a sea of phones, with confetti in the air. Pure SVG so it stays crisp at
// any size and needs no external assets. The warm/cold split is deliberate:
// the crowd and rig are cold, the star is the only warm thing on stage.
// Ambient motion (phones, confetti, lasers, LED bars, dust) is CSS in
// index.css (.me-stage*) and is disabled under prefers-reduced-motion.

const INK = '#050308';
const MAG = '#E8407A';
const PUR = '#9B6BFF';
const BLU = '#4C7DFF';
const CYN = '#22D3EE';
const GOLD = '#F5C46B';
const WHITE = '#FDF6E8';

// deterministic pseudo-random so the scene is stable across renders
const rnd = (i, a = 1) => {
  const x = Math.sin(i * 12.9898 + a * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const GMAP = { mag: 'gMag', pur: 'gPur', blu: 'gBlu', cyn: 'gCyn', pnk: 'gPnk' };
const BEAMS = [
  { ax: 140, bx: 232, w: 64, g: 'mag' },
  { ax: 250, bx: 322, w: 54, g: 'pur' },
  { ax: 355, bx: 408, w: 46, g: 'blu' },
  { ax: 448, bx: 476, w: 42, g: 'cyn' },
  { ax: 560, bx: 528, w: 42, g: 'pnk' },
  { ax: 652, bx: 600, w: 46, g: 'blu' },
  { ax: 752, bx: 686, w: 54, g: 'pur' },
  { ax: 866, bx: 774, w: 64, g: 'mag' },
  { ax: 322, bx: 292, w: 30, g: 'cyn' },
  { ax: 690, bx: 716, w: 30, g: 'cyn' },
];

function Rig() {
  const fixtures = [];
  for (let i = 0; i < 15; i++) {
    const x = 120 + i * 54;
    const c = [MAG, PUR, BLU, CYN][i % 4];
    fixtures.push(<rect key={`h${i}`} x={x - 8} y="40" width="16" height="14" rx="2" fill="#15111F" stroke="rgba(255,255,255,0.12)" />);
    fixtures.push(<circle key={`l${i}`} cx={x} cy="52" r="4" fill={c} style={{ filter: `drop-shadow(0 0 6px ${c})` }} />);
  }
  return (
    <g>
      {/* truss */}
      <rect x="60" y="30" width="880" height="10" rx="2" fill="#0C0916" stroke="rgba(255,255,255,0.08)" />
      {Array.from({ length: 30 }, (_, i) => <line key={i} x1={70 + i * 29} y1="30" x2={84 + i * 29} y2="40" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />)}
      {fixtures}
    </g>
  );
}

function LedWall() {
  const bars = [];
  const n = 34;
  for (let i = 0; i < n; i++) {
    const x = 282 + i * 13;
    const h = 30 + rnd(i, 2) * 150;
    bars.push(
      <rect
        key={i} x={x} y={272 - h} width="8" height={h} rx="1"
        fill={`url(#ledBar)`} className="me-stage-led"
        style={{ animationDelay: `${rnd(i, 5) * 2}s`, animationDuration: `${0.8 + rnd(i, 7) * 0.9}s`, transformOrigin: `${x + 4}px 272px` }}
      />,
    );
  }
  return (
    <g>
      <rect x="266" y="60" width="468" height="228" rx="6" fill="#0A0714" stroke="rgba(255,255,255,0.1)" />
      <rect x="272" y="66" width="456" height="216" rx="4" fill="url(#ledGlow)" opacity="0.5" />
      <g opacity="0.85">{bars}</g>
    </g>
  );
}

function Speakers() {
  const stack = (x) => Array.from({ length: 5 }, (_, i) => (
    <g key={i}>
      <path d={`M${x - 20} ${70 + i * 32} L${x + 20} ${70 + i * 32} L${x + 16} ${98 + i * 32} L${x - 16} ${98 + i * 32} Z`} fill="#12101A" stroke="rgba(255,255,255,0.1)" />
      <circle cx={x} cy={84 + i * 32} r="7" fill="#080610" stroke="rgba(255,255,255,0.14)" />
    </g>
  ));
  return <g>{stack(74)}{stack(926)}</g>;
}

function Lasers() {
  const fan = (ox, dir) => Array.from({ length: 6 }, (_, i) => (
    <line
      key={i} x1={ox} y1="26" x2={ox + dir * (120 + i * 120)} y2="470"
      stroke={i % 2 ? CYN : '#7CF6C0'} strokeWidth="1.2" opacity="0.32"
      className="me-stage-laser" style={{ animationDelay: `${i * 0.3}s`, mixBlendMode: 'screen' }}
    />
  ));
  return <g>{fan(70, 1)}{fan(930, -1)}</g>;
}

// The star: a small, refined singer silhouette — mic in one hand, the other
// arm thrown up — backlit so the rim catches the warm spotlight.
function Star() {
  return (
    <g transform="translate(500,452) scale(1.15)">
      <ellipse cx="0" cy="-150" rx="34" ry="46" fill="url(#heroGlow)" transform="scale(1.6)" opacity="0.9" />
      <g fill={INK}>
        {/* legs + feet */}
        <path d="M-11 -79 L-13 -42 L-9 -2 L-2 -2 L-4 -42 L-1 -79 Z" />
        <path d="M1 -79 L2 -42 L8 -2 L15 -2 L12 -42 L11 -79 Z" />
        <ellipse cx="-6" cy="-1" rx="7" ry="3" />
        <ellipse cx="12" cy="-1" rx="7" ry="3" />
        {/* hips + torso */}
        <path d="M-9 -93 L9 -93 L11 -78 L-11 -78 Z" />
        <path d="M-15 -133 Q-17 -110 -8 -92 L8 -92 Q17 -110 15 -133 Q0 -142 -15 -133 Z" />
        {/* raised arm (figure's right) */}
        <path d="M-14 -131 L-24 -112 L-19 -108 L-9 -127 Z" />
        <path d="M-24 -112 L-20 -150 L-14 -150 L-19 -108 Z" />
        <circle cx="-17" cy="-152" r="4.5" />
        {/* mic arm bringing the mic up to the mouth */}
        <path d="M14 -131 L23 -116 L18 -112 L9 -127 Z" />
        <path d="M23 -116 L9 -146 L4 -142 L18 -112 Z" />
        {/* neck + head + hair */}
        <rect x="-3" y="-141" width="6" height="9" />
        <path d="M-9 -150 Q-11 -168 0 -168 Q11 -168 9 -150 Q4 -160 0 -159 Q-4 -160 -9 -150 Z" />
        <ellipse cx="0" cy="-151" rx="8.5" ry="10.5" />
      </g>
      {/* mic */}
      <line x1="6" y1="-147" x2="3" y2="-151" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="2.5" cy="-154" rx="3" ry="5" fill="#1A1622" stroke={GOLD} strokeWidth="0.8" transform="rotate(-20 2.5 -154)" />
      {/* warm rim light on the spotlight side */}
      <g fill="none" stroke="url(#rim)" strokeLinecap="round" opacity="0.9">
        <path d="M-24 -112 L-20 -150" strokeWidth="2.4" />
        <path d="M-15 -133 Q-16 -140 -9 -150" strokeWidth="2" opacity="0.7" />
        <path d="M-8.5 -151 Q-9 -160 0 -166" strokeWidth="1.6" opacity="0.6" />
      </g>
    </g>
  );
}

function Stage() {
  const foot = Array.from({ length: 24 }, (_, i) => (
    <circle key={i} cx={110 + i * 34} cy="486" r="2.4" fill={GOLD} opacity="0.9" style={{ filter: `drop-shadow(0 0 4px ${GOLD})` }} />
  ));
  return (
    <g>
      <path d="M140 452 L860 452 L922 488 L78 488 Z" fill="#0B0912" />
      <path d="M140 452 L860 452 L862 456 L138 456 Z" fill="rgba(245,196,107,0.25)" />
      {foot}
    </g>
  );
}

function Crowd() {
  const rows = [];
  // three depth rows, larger + darker toward the front
  const cfg = [
    { y: 500, r: 8, step: 26, arm: 20, fill: 'rgba(10,7,18,0.85)', n: 39 },
    { y: 536, r: 11, step: 34, arm: 28, fill: 'rgba(7,5,14,0.92)', n: 30 },
    { y: 582, r: 15, step: 44, arm: 40, fill: INK, n: 24 },
  ];
  cfg.forEach((c, ri) => {
    const parts = [];
    for (let i = 0; i < c.n; i++) {
      const x = i * c.step - 6 + (ri * 8);
      const y = c.y + rnd(i + ri * 10, 3) * 8;
      parts.push(<circle key={`h${i}`} cx={x} cy={y} r={c.r} />);
      parts.push(<path key={`b${i}`} d={`M${x - c.r * 1.5} ${y + c.r * 6} q${c.r * 1.5} -${c.r * 4} ${c.r * 3} 0z`} />);
      if (i % 2 === (ri % 2)) {
        parts.push(<line key={`la${i}`} x1={x - c.r * 0.5} y1={y + 4} x2={x - c.r} y2={y - c.arm} strokeWidth={c.r * 0.5} strokeLinecap="round" />);
        parts.push(<line key={`ra${i}`} x1={x + c.r * 0.5} y1={y + 4} x2={x + c.r * 1.1} y2={y - c.arm * 1.1} strokeWidth={c.r * 0.5} strokeLinecap="round" />);
      }
    }
    rows.push(<g key={ri} fill={c.fill} stroke={c.fill}>{parts}</g>);
  });
  return <g>{rows}</g>;
}

function Phones() {
  const cols = [GOLD, CYN, WHITE, MAG, '#B794F4'];
  const dots = [];
  for (let i = 0; i < 70; i++) {
    const x = rnd(i, 1) * 1000;
    const y = 496 + rnd(i, 4) * 96;
    const c = cols[i % cols.length];
    dots.push(
      <circle
        key={i} cx={x} cy={y} r={1.4 + rnd(i, 8) * 1.6} fill={c}
        className="me-stage-phone"
        style={{ animationDelay: `${rnd(i, 6) * 4}s`, animationDuration: `${2.4 + rnd(i, 9) * 2}s`, filter: `drop-shadow(0 0 4px ${c})` }}
      />,
    );
  }
  return <g>{dots}</g>;
}

function Confetti() {
  const cols = [MAG, CYN, GOLD, PUR, WHITE, '#7CF6C0'];
  const bits = [];
  for (let i = 0; i < 22; i++) {
    const x = rnd(i, 1) * 1000;
    const c = cols[i % cols.length];
    bits.push(
      <rect
        key={i} x={x} y={-10} width="4" height="9" rx="1" fill={c}
        className="me-stage-confetti"
        style={{ animationDelay: `${rnd(i, 3) * 6}s`, animationDuration: `${5 + rnd(i, 5) * 4}s`, transformOrigin: `${x}px 0px` }}
      />,
    );
  }
  return <g>{bits}</g>;
}

function BeamDust() {
  const motes = [];
  for (let i = 0; i < 16; i++) {
    motes.push(
      <circle key={i} cx={420 + rnd(i, 1) * 160} cy={160 + rnd(i, 2) * 280} r={1 + rnd(i, 3) * 1.2}
        fill={WHITE} className="me-stage-dust"
        style={{ animationDelay: `${rnd(i, 4) * 7}s`, animationDuration: `${6 + rnd(i, 6) * 4}s`, opacity: 0.5 }} />,
    );
  }
  return <g>{motes}</g>;
}

export function StageHero() {
  return (
    <svg className="me-stage-svg" viewBox="0 0 1000 640" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <radialGradient id="stageBg" cx="50%" cy="20%" r="90%">
          <stop offset="0%" stopColor="#1B1030" />
          <stop offset="52%" stopColor="#0D0820" />
          <stop offset="100%" stopColor="#050308" />
        </radialGradient>
        <linearGradient id="ledGlow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B2A6B" /><stop offset="100%" stopColor="#101030" />
        </linearGradient>
        <linearGradient id="ledBar" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={CYN} /><stop offset="55%" stopColor={PUR} /><stop offset="100%" stopColor={MAG} />
        </linearGradient>
        {[['gMag', MAG], ['gPur', PUR], ['gBlu', BLU], ['gCyn', CYN], ['gPnk', '#F26DAE']].map(([id, c]) => (
          <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity="0.6" />
            <stop offset="70%" stopColor={c} stopOpacity="0.05" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </linearGradient>
        ))}
        <linearGradient id="spot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={WHITE} stopOpacity="0.6" />
          <stop offset="40%" stopColor={GOLD} stopOpacity="0.24" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </linearGradient>
        <radialGradient id="pool" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={WHITE} stopOpacity="0.45" />
          <stop offset="60%" stopColor={GOLD} stopOpacity="0.12" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heroGlow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FFF4DD" stopOpacity="0.85" />
          <stop offset="45%" stopColor={GOLD} stopOpacity="0.5" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFF4DD" /><stop offset="100%" stopColor="#E8A33D" />
        </linearGradient>
      </defs>

      <rect width="1000" height="640" fill="url(#stageBg)" />

      <LedWall />
      <Rig />
      <Speakers />

      {/* colored beams from the rig — cold, many, blurred + screen-blended */}
      <g style={{ filter: 'blur(3px)', mixBlendMode: 'screen' }} opacity="0.5">
        {BEAMS.map((b, i) => (
          <polygon key={i} points={`${b.ax - 4},48 ${b.ax + 4},48 ${b.bx + b.w},452 ${b.bx - b.w},452`} fill={`url(#${GMAP[b.g]})`} />
        ))}
      </g>
      <Lasers />
      <BeamDust />

      {/* the warm key spotlight on the star */}
      <g className="me-stage-spot">
        <polygon points="500,42 596,452 404,452" fill="url(#spot)" style={{ mixBlendMode: 'screen' }} />
        <ellipse cx="500" cy="452" rx="150" ry="34" fill="url(#pool)" style={{ mixBlendMode: 'screen' }} />
      </g>

      <Stage />
      <Star />

      <Confetti />
      <Crowd />
      <Phones />

      {/* atmospheric haze */}
      <ellipse cx="500" cy="300" rx="360" ry="150" fill={WHITE} opacity="0.04" style={{ mixBlendMode: 'screen' }} />
    </svg>
  );
}
