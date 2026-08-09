import { buildCorpus, calibrate, scorePair } from '@/lib/score';
import { getMe, getPairScore } from '@/lib/seed';
import type { BaseProfile } from '@/lib/seed';

/**
 * The crown jewel (freq.md's own words). These numbers end up quoted in the
 * README, so they need to stay true as the algorithm evolves, not just at
 * the moment someone eyeballed them in the breakdown screen.
 */

function mkProfile(
  id: string,
  artists: string[],
  tracks: string[],
  tags: string[],
  hours: number[]
): BaseProfile {
  return {
    id,
    name: id,
    age: 25,
    campus: 'Test U',
    archetype: { name: 'x', description: 'x' },
    week: { artist: artists[0], plays: 10, stat: 'x' },
    topArtists: artists.map((name) => ({ name, rank: 50 })),
    topTracks: tracks.map((title) => ({ title, artist: artists[0] })),
    listeningHours: hours,
    tags,
    energy: { night: 0, emotional: 0, highEnergy: 0, exploratory: 0 },
  };
}

const dayHours = Array.from({ length: 24 }, (_, h) => (h >= 8 && h <= 17 ? 80 : 10));
const nightHours = Array.from({ length: 24 }, (_, h) => (h >= 0 && h <= 4 ? 80 : 10));

describe('scorePair', () => {
  test('self-match is 100', () => {
    const me = mkProfile('me', ['A1', 'A2', 'A3'], ['T1'], ['tagA'], dayHours);
    const corpus = buildCorpus([me]);
    expect(scorePair(me, me, corpus).score).toBe(100);
  });

  test('fully-disjoint profiles land around 11, not 0', () => {
    // No shared artists, tracks, or tags, and opposite-phase listening
    // hours — the only signal left is a faint rhythm correlation, which is
    // exactly why the calibrated floor isn't zero. freq.md documents this
    // exact number from the real algorithm, so it's pinned here too.
    const a = mkProfile('a', ['Artist A1', 'Artist A2', 'Artist A3'], ['Track A1'], ['tagA1', 'tagA2'], dayHours);
    const b = mkProfile('b', ['Artist B1', 'Artist B2', 'Artist B3'], ['Track B1'], ['tagB1', 'tagB2'], nightHours);
    const corpus = buildCorpus([a, b]);

    const score = scorePair(a, b, corpus).score;
    expect(score).toBeGreaterThanOrEqual(9);
    expect(score).toBeLessThanOrEqual(13);
  });

  test('documented ordering against the real seed corpus', () => {
    // Pulled straight from getPairScore, which is what /breakdown/[id] and
    // every card actually render — not a synthetic reimplementation.
    void getMe(); // ensures the corpus is built before reading scores below
    const order = ['odessa', 'rune', 'marlowe', 'thea', 'juno', 'vesper'];
    const scores = order.map((id) => {
      const result = getPairScore(id);
      if (!result) throw new Error(`Missing seed user: ${id}`);
      return result.score;
    });

    for (let i = 0; i < scores.length - 1; i += 1) {
      expect(scores[i]).toBeGreaterThan(scores[i + 1]);
    }
  });

  test('adjacent taste alone can never outscore genuine direct overlap on the depth-bridge axis', () => {
    // The bug this guards: an earlier version scored "adjacent taste" in
    // isolation, so a pair that shared everything had no leftover taste to
    // bridge and scored ZERO here — losing to a pair with only near-miss
    // adjacency. `connection` fixes this by crediting direct overlap first.
    const shared = ['Same Artist 1', 'Same Artist 2', 'Same Artist 3'];
    const meProfile = mkProfile('me', shared, ['T1'], ['tag1'], dayHours);
    const fullOverlap = mkProfile('full', shared, ['T2'], ['tag2'], dayHours);

    // A second candidate who shares nothing directly with `me`, but whose
    // artists sit next to `me`'s in the corpus (same listener base) —
    // adjacency-only, the case that used to win by default.
    const bridgeArtists = ['Bridge Artist 1', 'Bridge Artist 2', 'Bridge Artist 3'];
    const bridgeOnly = mkProfile('bridge', bridgeArtists, ['T3'], ['tag3'], dayHours);
    const listenerOverlap = mkProfile(
      'listener',
      [...shared, ...bridgeArtists],
      ['T4'],
      [],
      dayHours
    );

    const corpus = buildCorpus([meProfile, fullOverlap, bridgeOnly, listenerOverlap]);

    const fullOverlapScore = scorePair(meProfile, fullOverlap, corpus);
    const bridgeOnlyScore = scorePair(meProfile, bridgeOnly, corpus);

    const depthOf = (s: typeof fullOverlapScore) =>
      s.components.find((c) => c.key === 'depthBridge')!.value;

    expect(depthOf(fullOverlapScore)).toBeCloseTo(1, 5);
    expect(depthOf(fullOverlapScore)).toBeGreaterThanOrEqual(depthOf(bridgeOnlyScore));
  });
});

describe('calibrate (the x^0.62 display transform)', () => {
  test('is monotonically non-decreasing across the full [0, 1] range', () => {
    let previous = calibrate(0);
    for (let x = 0.01; x <= 1.0001; x += 0.01) {
      const current = calibrate(Math.min(x, 1));
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  test('preserves the ordering of raw composite scores', () => {
    const composites = [0, 0.05, 0.11, 0.2, 0.35, 0.5, 0.62, 0.8, 1];
    const calibrated = composites.map(calibrate);
    for (let i = 0; i < calibrated.length - 1; i += 1) {
      expect(calibrated[i + 1]).toBeGreaterThan(calibrated[i]);
    }
  });

  test('anchors: 0 stays 0, 1 stays 1', () => {
    expect(calibrate(0)).toBe(0);
    expect(calibrate(1)).toBe(1);
  });
});
