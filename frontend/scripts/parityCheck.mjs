// Runs computeRelease.js against the shared fixture with Math.random pinned
// to 0.5 (deterministic ties/midpoints), prints the result as JSON.
// See docs/implementation-order.md §1-5 — compared against
// backend/scripts/parity_check.py's output by scripts/run-parity-check.sh.
//
// computeRelease.js uses extensionless relative imports (fine for Vite, not
// for plain Node ESM resolution), so we bundle it with Vite's build API
// into a single self-contained file first, then import that.
import { readFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';

Math.random = () => 0.5;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = mkdtempSync(path.join(tmpdir(), 'me-parity-'));

await build({
  root: path.join(__dirname, '..'),
  logLevel: 'silent',
  build: {
    outDir,
    emptyOutDir: true,
    lib: {
      entry: path.join(__dirname, '../src/lib/scoring/computeRelease.js'),
      formats: ['es'],
      fileName: () => 'computeRelease.bundle.js',
    },
    minify: false,
  },
});

const { computeRelease } = await import(pathToFileURL(path.join(outDir, 'computeRelease.bundle.js')));

const fixture = JSON.parse(readFileSync(path.join(__dirname, '../../scripts/parity-fixture.json'), 'utf-8'));

const character = {
  stats: fixture.character.stats,
  talent: fixture.character.talent,
  fame: fixture.character.fame,
  personaLoyalty: fixture.character.personaLoyalty,
};

const draft = {
  genres: fixture.draft.genres,
  moods: fixture.draft.moods,
  bpm: fixture.draft.bpm,
  chordPresetId: fixture.draft.chordPresetId,
  productionMode: fixture.draft.productionMode,
  vocalSource: fixture.draft.vocalSource,
  arrangement: fixture.draft.arrangement,
  sections: Object.fromEntries(
    fixture.draft.arrangement.map((key) => [key, { lyrics: fixture.draft.lyricsBySection[key] || '' }])
  ),
};

const result = computeRelease(character, draft, fixture.combined);

console.log(JSON.stringify({
  craft: result.attributes.craft,
  originality: result.attributes.originality,
  accessibility: result.attributes.accessibility,
  experimental: result.attributes.experimental,
  overallScore: result.overallScore,
  tier: result.tier,
  geniusEvent: result.geniusEvent,
  sleeperHit: result.sleeperHit,
  fansDelta: result.fansDelta,
  moneyDelta: result.moneyDelta,
  fameDelta: result.fameDelta,
  reached: result.personaResults.map((r) => r.reached),
}));
