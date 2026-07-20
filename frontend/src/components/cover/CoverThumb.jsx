import { useEffect, useState } from 'react';
import { Disc3 } from 'lucide-react';
import * as coversApi from '../../lib/api/covers';

/**
 * Album art thumbnail. Cover images are behind auth so they can't be an
 * ordinary <img src> — each one is fetched as a blob and handed an object URL,
 * which is revoked on unmount.
 *
 * Object URLs are cached per song id at module scope: the same cover shows up
 * in the feed, the chart and the release history, and re-fetching the bytes
 * for each would be wasteful. Cleared on logout via clearCoverCache().
 */
const cache = new Map(); // songId -> object URL

export function clearCoverCache() {
  cache.forEach((url) => URL.revokeObjectURL(url));
  cache.clear();
}

export function CoverThumb({ songId, hasCover = true, size = 34, rounded = 8, title }) {
  const [url, setUrl] = useState(() => cache.get(songId) || null);

  useEffect(() => {
    if (!songId || !hasCover) return undefined;
    if (cache.has(songId)) { setUrl(cache.get(songId)); return undefined; }

    let cancelled = false;
    coversApi.fetchCoverUrl(songId)
      .then((u) => {
        if (cancelled) { URL.revokeObjectURL(u); return; }
        cache.set(songId, u);
        setUrl(u);
      })
      // a missing cover is normal, not an error worth surfacing
      .catch(() => {});
    return () => { cancelled = true; };
  }, [songId, hasCover]);

  const style = { width: size, height: size, borderRadius: rounded, flexShrink: 0 };

  if (!url) {
    return (
      <div
        style={{ ...style, background: 'var(--color-groove)', border: '1px solid var(--color-border)' }}
        className="flex items-center justify-center text-faint"
        title={title}
        aria-hidden
      >
        <Disc3 size={Math.round(size * 0.5)} />
      </div>
    );
  }
  return <img src={url} alt={title ? `${title} 커버` : '앨범 커버'} style={{ ...style, objectFit: 'cover' }} />;
}
