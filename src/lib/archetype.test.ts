import { deriveArchetype, isEmptyArchetype } from '@/lib/archetype';
import type { Energy } from '@/lib/seed';

const NO_ENERGY: Energy = { night: 0, emotional: 0, highEnergy: 0, exploratory: 0 };

const nightHours = Array.from({ length: 24 }, (_, h) => (h <= 3 ? 90 : 5));
const dayHours = Array.from({ length: 24 }, (_, h) => (h >= 9 && h <= 17 ? 90 : 5));

describe('deriveArchetype', () => {
  test('leads with the dominant energy axis', () => {
    const base = { topArtists: ['Duster'], tags: ['slowcore'], listeningHours: dayHours };

    expect(
      deriveArchetype({ ...base, energy: { ...NO_ENERGY, night: 90, emotional: 10 } }).name
    ).toBe('The Nocturnist');
    expect(
      deriveArchetype({ ...base, energy: { ...NO_ENERGY, emotional: 90, night: 10 } }).name
    ).toBe('The Slow Burn');
    expect(
      deriveArchetype({ ...base, energy: { ...NO_ENERGY, highEnergy: 90, night: 10 } }).name
    ).toBe('The Live Wire');
    expect(
      deriveArchetype({ ...base, energy: { ...NO_ENERGY, exploratory: 90, night: 10 } }).name
    ).toBe('The Crate Digger');
  });

  test('names the actual genres, not a generic mood', () => {
    const result = deriveArchetype({
      topArtists: ['Karan Aujla'],
      tags: ['punjabi', 'hip hop', 'late-night'],
      energy: { ...NO_ENERGY, highEnergy: 80 },
      listeningHours: dayHours,
    });

    expect(result.description).toContain('punjabi');
    expect(result.description).toContain('hip hop');
    // Hyphenated mood tags are the app's own synthetic labels, not genres —
    // they'd read as noise in a sentence about what someone listens to.
    expect(result.description).not.toContain('late-night');
  });

  test('falls back to the top artist when no plain genre tags exist', () => {
    const result = deriveArchetype({
      topArtists: ['Pritam'],
      tags: ['late-night'],
      energy: { ...NO_ENERGY, night: 70 },
      listeningHours: nightHours,
    });

    expect(result.description).toContain('Pritam');
  });

  test('mentions late hours only when that is not already the headline', () => {
    // Night is the dominant axis, so the name already says it — repeating it
    // in the description would be redundant.
    const nightLed = deriveArchetype({
      topArtists: ['Grouper'],
      tags: ['ambient'],
      energy: { ...NO_ENERGY, night: 90 },
      listeningHours: nightHours,
    });
    expect(nightLed.description).not.toContain('past midnight');

    // Here the axis is something else, so the late peak is genuinely new
    // information worth adding.
    const loudButLate = deriveArchetype({
      topArtists: ['Seedhe Maut'],
      tags: ['rap'],
      energy: { ...NO_ENERGY, highEnergy: 90 },
      listeningHours: nightHours,
    });
    expect(loudButLate.description).toContain('past midnight');
  });

  test('refuses to characterise someone with no data', () => {
    const result = deriveArchetype({
      topArtists: [],
      tags: [],
      energy: NO_ENERGY,
      listeningHours: [],
    });

    expect(result.name).toBe('The Unread');
    // The failure mode this guards: an all-zero energy profile ties on every
    // axis, and picking the first key would assert something unearned.
    expect(result.name).not.toBe('The Nocturnist');
  });

  test('always produces a non-empty, sentence-terminated description', () => {
    const cases = [
      { topArtists: ['A'], tags: ['rock'], energy: { ...NO_ENERGY, night: 5 }, listeningHours: [] },
      { topArtists: [], tags: ['jazz'], energy: { ...NO_ENERGY, emotional: 50 }, listeningHours: dayHours },
      { topArtists: ['B'], tags: [], energy: { ...NO_ENERGY, exploratory: 1 }, listeningHours: nightHours },
    ];

    for (const input of cases) {
      const { name, description } = deriveArchetype(input);
      expect(name.length).toBeGreaterThan(0);
      expect(description.length).toBeGreaterThan(0);
      expect(description.endsWith('.')).toBe(true);
    }
  });
});

describe('isEmptyArchetype', () => {
  test('treats null, undefined, {} and blank names as empty', () => {
    expect(isEmptyArchetype(null)).toBe(true);
    expect(isEmptyArchetype(undefined)).toBe(true);
    // The server clears the column to `{}` rather than null — it is not-null.
    expect(isEmptyArchetype({})).toBe(true);
    expect(isEmptyArchetype({ name: '   ', description: 'x' })).toBe(true);
  });

  test('treats a real archetype as present', () => {
    expect(isEmptyArchetype({ name: 'The Nocturnist', description: 'x' })).toBe(false);
  });
});
