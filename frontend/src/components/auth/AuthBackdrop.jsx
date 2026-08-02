// Animated "music life" backdrop for the entry screen — a night stage seen
// from the crowd: sweeping light cones, notes drifting up, a cheering crowd
// silhouette and a pulsing equalizer glow along the floor. Pure SVG/CSS so it
// needs no external assets (the CSP blocks those); every animation is disabled
// under prefers-reduced-motion (see index.css). Styling lives in .me-authbg*.

const NOTES = ['♪', '♫', '♩', '♬']; // ♪ ♫ ♩ ♬

// A dim skyline + a crowd of head/shoulders silhouettes, some with raised arms.
function CrowdScene() {
  const people = [];
  for (let i = 0; i < 27; i++) {
    const x = i * 15 + 5;
    const y = 34 + ((i * 37) % 12);
    people.push(<circle key={`h${i}`} cx={x} cy={y} r="6.5" />);
    people.push(<path key={`b${i}`} d={`M${x - 9} 100 q9 -40 18 0z`} />);
    if (i % 3 === 0) {
      people.push(<line key={`la${i}`} x1={x - 4} y1={y + 5} x2={x - 11} y2={y - 15} strokeWidth="2.6" strokeLinecap="round" />);
      people.push(<line key={`ra${i}`} x1={x + 4} y1={y + 5} x2={x + 11} y2={y - 18} strokeWidth="2.6" strokeLinecap="round" />);
    }
  }
  return (
    <svg className="me-authbg-scene" viewBox="0 0 400 100" preserveAspectRatio="xMidYMax slice" aria-hidden>
      {/* distant skyline, very dim, behind the crowd */}
      <g fill="rgba(24,19,40,0.85)">
        {Array.from({ length: 16 }, (_, i) => {
          const h = 24 + ((i * 53) % 40);
          return <rect key={i} x={i * 26} y={100 - h} width="22" height={h} rx="1.5" />;
        })}
      </g>
      {/* crowd silhouette */}
      <g fill="rgba(6,4,12,0.94)" stroke="rgba(6,4,12,0.94)">{people}</g>
    </svg>
  );
}

export function AuthBackdrop() {
  return (
    <div className="me-authbg" aria-hidden>
      <div className="me-authbg-beams">
        <span className="me-beam me-beam-a" />
        <span className="me-beam me-beam-b" />
        <span className="me-beam me-beam-c" />
      </div>

      <div className="me-authbg-eq">
        {Array.from({ length: 56 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${(i % 13) * 0.07}s`, animationDuration: `${0.62 + (i % 5) * 0.13}s` }} />
        ))}
      </div>

      <CrowdScene />

      <div className="me-authbg-notes">
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            className="me-note"
            style={{
              left: `${(i * 7.1 + 4) % 96}%`,
              fontSize: `${14 + (i % 3) * 7}px`,
              animationDelay: `${(i * 0.83) % 8}s`,
              animationDuration: `${7 + (i % 4) * 1.3}s`,
            }}
          >
            {NOTES[i % NOTES.length]}
          </span>
        ))}
      </div>
    </div>
  );
}
