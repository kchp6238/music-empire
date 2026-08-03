// The entry-screen stage: a lone star caught in a single spotlight, arm thrown
// to the sky, over a roaring crowd lit by a sea of phones. Pure SVG so it stays
// crisp at any size and needs no external assets (the CSP blocks those). The
// zoom-out / brighten choreography lives in AuthScreen; the ambient flicker
// (phones, embers, dust in the beam) is CSS in index.css (.me-stage*).

const INK = '#050308';
const GOLD = '#F3C267';
const AMBER = '#E8A33D';
const PINK = '#E893A6';
const CYAN = '#4FD1C5';

// A confident star: raised arm with a pointing finger, coat tail in motion,
// wide stance. Built from filled body masses + round-capped limbs so the
// silhouette reads clean rather than crude, then rim-lit on the light side.
function Hero() {
  return (
    <g>
      {/* backlight halo so the figure reads as a crisp cutout against the light */}
      <ellipse cx="498" cy="238" rx="150" ry="210" fill="url(#heroGlow)" />

      <g fill={INK} stroke={INK} strokeLinejoin="round">
        {/* coat tail flowing to the side */}
        <path d="M536 296 C 590 320 606 392 584 436 C 574 452 560 446 556 424 C 548 384 528 340 520 306 Z" />
        {/* legs — wide stance */}
        <path d="M492 322 L474 398 L466 468" fill="none" strokeWidth="34" strokeLinecap="round" />
        <path d="M512 322 L544 398 L558 466" fill="none" strokeWidth="34" strokeLinecap="round" />
        {/* feet */}
        <path d="M452 466 q14 -12 30 -4 l2 12 -34 2 z" />
        <path d="M544 462 q16 -10 32 0 l0 12 -34 2 z" />
        {/* torso */}
        <path d="M456 208 Q498 196 544 208 Q556 262 528 322 L476 322 Q448 260 456 208 Z" />
        {/* relaxed arm down the far side */}
        <path d="M540 214 L558 272 L548 322" fill="none" strokeWidth="25" strokeLinecap="round" />
        {/* raised arm — shoulder, elbow, wrist */}
        <path d="M462 212 L436 152 L452 92" fill="none" strokeWidth="26" strokeLinecap="round" />
        {/* pointing finger */}
        <path d="M452 96 L464 50" fill="none" strokeWidth="11" strokeLinecap="round" />
        {/* neck + head, tilted up toward the light */}
        <path d="M492 200 L500 176" stroke={INK} strokeWidth="20" strokeLinecap="round" />
        <ellipse cx="500" cy="164" rx="21" ry="26" transform="rotate(-8 500 164)" />
      </g>

      {/* rim light on the side facing the spotlight */}
      <g fill="none" stroke="url(#rim)" strokeLinecap="round" opacity="0.9">
        <path d="M462 212 L436 152 L452 92" strokeWidth="4" />
        <path d="M452 96 L464 50" strokeWidth="2.5" />
        <path d="M482 150 q-6 -30 6 -58" strokeWidth="2.5" opacity="0.7" />
      </g>
      <ellipse cx="486" cy="150" rx="20" ry="24" transform="rotate(-8 486 150)" fill="none" stroke={GOLD} strokeWidth="1.6" opacity="0.5" />
    </g>
  );
}

function Crowd() {
  const back = [];
  const front = [];
  for (let i = 0; i < 34; i++) {
    const x = i * 30 + 8;
    const yb = 512 + ((i * 17) % 8);
    back.push(<circle key={`b${i}`} cx={x} cy={yb} r="9" />);
    back.push(<path key={`bb${i}`} d={`M${x - 13} 560 q13 -34 26 0z`} />);
    if (i % 3 === 1) {
      back.push(<line key={`bl${i}`} x1={x - 5} y1={yb + 4} x2={x - 12} y2={yb - 22} strokeWidth="4" strokeLinecap="round" />);
      back.push(<line key={`br${i}`} x1={x + 5} y1={yb + 4} x2={x + 13} y2={yb - 26} strokeWidth="4" strokeLinecap="round" />);
    }
  }
  for (let i = 0; i < 26; i++) {
    const x = i * 40 - 4;
    const yf = 566 + ((i * 23) % 10);
    front.push(<circle key={`f${i}`} cx={x} cy={yf} r="13" />);
    front.push(<path key={`fb${i}`} d={`M${x - 20} 640 q20 -52 40 0z`} />);
    if (i % 2 === 0) {
      front.push(<line key={`fl${i}`} x1={x - 7} y1={yf + 6} x2={x - 16} y2={yf - 34} strokeWidth="6" strokeLinecap="round" />);
      front.push(<line key={`fr${i}`} x1={x + 7} y1={yf + 6} x2={x + 17} y2={yf - 40} strokeWidth="6" strokeLinecap="round" />);
    }
  }
  return (
    <>
      <g fill="rgba(8,6,16,0.9)" stroke="rgba(8,6,16,0.9)">{back}</g>
      <g fill={INK} stroke={INK}>{front}</g>
    </>
  );
}

// A sea of phone lights held up in the crowd — the "excited" signal.
function PhoneLights() {
  const dots = [];
  const cols = [GOLD, CYAN, '#FDF6E8', PINK, AMBER];
  for (let i = 0; i < 30; i++) {
    const x = ((i * 137) % 990) + 5;
    const y = 500 + ((i * 53) % 90);
    const c = cols[i % cols.length];
    dots.push(
      <circle
        key={i} cx={x} cy={y} r={1.8 + (i % 3) * 0.7} fill={c}
        className="me-stage-phone"
        style={{ animationDelay: `${(i * 0.37) % 4}s`, filter: `drop-shadow(0 0 4px ${c})` }}
      />,
    );
  }
  return <g>{dots}</g>;
}

// Dust motes drifting up through the light beam — volumetric depth.
function BeamDust() {
  const motes = [];
  for (let i = 0; i < 14; i++) {
    motes.push(
      <circle
        key={i} cx={430 + ((i * 47) % 150)} cy={200 + ((i * 71) % 260)} r={1 + (i % 3) * 0.6}
        fill="#FBEFD6" className="me-stage-dust"
        style={{ animationDelay: `${(i * 0.6) % 7}s`, animationDuration: `${6 + (i % 4)}s`, opacity: 0.5 }}
      />,
    );
  }
  return <g>{motes}</g>;
}

export function StageHero() {
  return (
    <svg className="me-stage-svg" viewBox="0 0 1000 640" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <radialGradient id="stageBg" cx="50%" cy="26%" r="80%">
          <stop offset="0%" stopColor="#241436" />
          <stop offset="55%" stopColor="#140C24" />
          <stop offset="100%" stopColor="#070510" />
        </radialGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDF6E8" stopOpacity="0.55" />
          <stop offset="35%" stopColor={GOLD} stopOpacity="0.28" />
          <stop offset="100%" stopColor={AMBER} stopOpacity="0" />
        </linearGradient>
        <radialGradient id="pool" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FDF6E8" stopOpacity="0.5" />
          <stop offset="60%" stopColor={GOLD} stopOpacity="0.14" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heroGlow" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#FFF4DD" stopOpacity="0.9" />
          <stop offset="45%" stopColor={GOLD} stopOpacity="0.55" />
          <stop offset="100%" stopColor={AMBER} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFF4DD" />
          <stop offset="100%" stopColor={AMBER} />
        </linearGradient>
      </defs>

      <rect width="1000" height="640" fill="url(#stageBg)" />

      {/* truss + a couple of fixtures up top */}
      <rect x="0" y="0" width="1000" height="10" fill="#0B0814" />
      {[380, 500, 620].map((x, i) => <circle key={i} cx={x} cy="10" r="5" fill={i === 1 ? GOLD : (i ? PINK : CYAN)} opacity="0.85" />)}

      {/* the spotlight cone + floor pool */}
      <path d="M500 6 L360 470 L640 470 Z" fill="url(#beam)" />
      <ellipse cx="500" cy="472" rx="200" ry="46" fill="url(#pool)" />

      <BeamDust />
      <Hero />
      <Crowd />
      <PhoneLights />
    </svg>
  );
}
