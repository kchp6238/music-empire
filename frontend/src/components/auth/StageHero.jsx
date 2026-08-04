import { useState } from 'react';

// The entry-screen backdrop: a real concert photo (free-license, bundled), a
// different one picked at random each session, under a slow Ken-Burns drift, a
// legibility gradient, and a light sparkle so it feels alive rather than static.
// AuthScreen wraps this in the zoom-out / brighten reveal.
const MODS = import.meta.glob('../../assets/intro/*.jpg', { eager: true, query: '?url', import: 'default' });
const PHOTOS = Object.keys(MODS).sort().map((k) => MODS[k]);
const SPARKS = Array.from({ length: 22 }, (_, i) => i);

export function StageHero() {
  const [photo] = useState(() => PHOTOS[Math.floor(Math.random() * PHOTOS.length)] || PHOTOS[0]);
  return (
    <div className="me-photostage" aria-hidden>
      <div className="me-photostage-img" style={{ backgroundImage: `url(${photo})` }} />
      <div className="me-photostage-grad" />
      <div className="me-photostage-sparks">
        {SPARKS.map((i) => (
          <span
            key={i}
            style={{
              left: `${(i * 4.3 + 3) % 98}%`,
              top: `${(i * 7.7) % 68}%`,
              animationDelay: `${(i * 0.5) % 6}s`,
              animationDuration: `${4 + (i % 4)}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
