import type { Artist, BaseProfile, Track } from '@/lib/seed';

/**
 * The FREQ compatibility algorithm (plan §5).
 *
 * Five weighted components produce a 0–100 score plus a ranked, machine-readable
 * reason list. The reasons are what let the AI explanation feel specific instead
 * of generic — they name the artist, the hour, the rare overlap.
 *
 * Everything here is pure and dependency-free so it can be unit-tested in node.
 */

export const WEIGHTS = {
  artistOverlap: 0.3,
  trackOverlap: 0.25,
  tagSimilarity: 0.2,
  depthBridge: 0.15,
  rhythmMatch: 0.1,
} as const;

export type ComponentKey = keyof typeof WEIGHTS;

/** Human-facing labels for the score-breakdown UI. */
export const COMPONENT_LABELS: Record<ComponentKey, string> = {
  artistOverlap: 'Rare artist overlap',
  trackOverlap: 'Shared tracks',
  tagSimilarity: 'Taste worlds',
  depthBridge: 'Adjacent taste',
  rhythmMatch: 'Listening rhythm',
};

/** Hours counted as "late night" when phrasing rhythm reasons. */
const NIGHT_HOURS = [0, 1, 2, 3, 4];
/** `rank` below this reads as genuinely obscure — matches the "Rare" chip in the UI. */
const RARE_RANK = 35;

export type Corpus = {
  /** How many profiles list each artist. */
  artistDocFreq: Map<string, number>;
  trackDocFreq: Map<string, number>;
  /** Global popularity (0–100, low = obscure) per artist, from the seed `rank`. */
  artistPopularity: Map<string, number>;
  /** Which profiles listen to each artist — the basis for artist-to-artist similarity. */
  artistListeners: Map<string, Set<string>>;
  size: number;
};

export type ScoredComponent = {
  key: ComponentKey;
  label: string;
  /** Raw component value, 0–1. */
  value: number;
  weight: number;
  /** value × weight × 100 — this component's actual contribution to the score. */
  contribution: number;
};

export type PairScore = {
  score: number;
  components: ScoredComponent[];
  reasons: string[];
  sharedArtists: string[];
  sharedTracks: Track[];
  sharedSong: Track | null;
  sharedTags: string[];
  /** Near-misses: your artist sits next to their artist in the corpus. */
  bridges: { from: string; to: string }[];
  /** Hours where both profiles peak — powers the "both 2am listeners" line. */
  overlapHours: number[];
};

const trackKey = (t: Track) => `${t.artist}|||${t.title}`;

/**
 * Build the corpus stats every pairwise score depends on.
 *
 * Rarity is only meaningful relative to a population, so this must run over all
 * profiles once before scoring any pair.
 */
export function buildCorpus(profiles: BaseProfile[]): Corpus {
  const artistDocFreq = new Map<string, number>();
  const trackDocFreq = new Map<string, number>();
  const artistPopularity = new Map<string, number>();
  const artistListeners = new Map<string, Set<string>>();

  for (const profile of profiles) {
    for (const artist of profile.topArtists) {
      artistDocFreq.set(artist.name, (artistDocFreq.get(artist.name) ?? 0) + 1);
      artistPopularity.set(artist.name, artist.rank);
      const listeners = artistListeners.get(artist.name) ?? new Set<string>();
      listeners.add(profile.id);
      artistListeners.set(artist.name, listeners);
    }
    for (const track of profile.topTracks) {
      const key = trackKey(track);
      trackDocFreq.set(key, (trackDocFreq.get(key) ?? 0) + 1);
    }
  }

  return {
    artistDocFreq,
    trackDocFreq,
    artistPopularity,
    artistListeners,
    size: profiles.length,
  };
}

/**
 * How much a shared artist is worth, 0–1.
 *
 * Blends two independent signals: how obscure the artist is globally (`rank`),
 * and how rare they are inside this user base (inverse document frequency).
 * Sharing someone who is both is the strongest possible signal — the magic.
 */
function artistRarity(name: string, corpus: Corpus): number {
  const popularity = corpus.artistPopularity.get(name) ?? 50;
  const globalRarity = 1 - popularity / 100;

  const docFreq = corpus.artistDocFreq.get(name) ?? 1;
  // Normalised IDF: 0 when everyone listens, 1 when exactly one profile does.
  const idf = Math.log(corpus.size / docFreq) / Math.log(corpus.size);

  return 0.5 * globalRarity + 0.5 * clamp01(idf);
}

function trackRarity(track: Track, corpus: Corpus): number {
  const docFreq = corpus.trackDocFreq.get(trackKey(track)) ?? 1;
  const idf = Math.log(corpus.size / docFreq) / Math.log(corpus.size);
  // Tracks carry no popularity of their own, so they inherit their artist's.
  return 0.5 * clamp01(idf) + 0.5 * artistRarity(track.artist, corpus);
}

/**
 * Rarity-weighted overlap.
 *
 * Every shared item is weighted by how rare it is, so a megastar and a
 * 200-listener artist never count the same — the whole point of the score.
 *
 * Blends two set measures because each fails alone:
 * - Jaccard (shared / union) punishes people who simply listen to more artists
 *   than you, which is not incompatibility.
 * - Overlap coefficient (shared / smaller side) rewards a thin profile whose
 *   three artists you happen to share, which overstates the match.
 * Weighted toward overlap, since taste matching cares more about what you both
 * reach for than about the size of the libraries around it.
 */
function weightedOverlap<T>(a: T[], b: T[], key: (item: T) => string, weight: (item: T) => number) {
  const aKeys = new Map(a.map((item) => [key(item), item]));
  const bKeys = new Map(b.map((item) => [key(item), item]));

  let sharedWeight = 0;
  let unionWeight = 0;
  const shared: T[] = [];

  const allKeys = new Set([...aKeys.keys(), ...bKeys.keys()]);
  for (const k of allKeys) {
    const item = aKeys.get(k) ?? bKeys.get(k)!;
    const w = weight(item);
    unionWeight += w;
    if (aKeys.has(k) && bKeys.has(k)) {
      sharedWeight += w;
      shared.push(item);
    }
  }

  const weightOf = (items: T[]) => items.reduce((sum, item) => sum + weight(item), 0);
  const smallerSide = Math.min(weightOf(a), weightOf(b));

  const jaccard = unionWeight === 0 ? 0 : sharedWeight / unionWeight;
  const coefficient = smallerSide === 0 ? 0 : sharedWeight / smallerSide;

  return { value: 0.4 * jaccard + 0.6 * coefficient, shared };
}

/**
 * Artist-to-artist similarity, derived from the corpus itself.
 *
 * Spotify killed `related-artists`, so this rebuilds it with item-to-item
 * collaborative filtering: two artists are adjacent when the same people listen
 * to both. Jaccard over their listener sets.
 */
function artistSimilarity(a: string, b: string, corpus: Corpus): number {
  const listenersA = corpus.artistListeners.get(a);
  const listenersB = corpus.artistListeners.get(b);
  if (!listenersA || !listenersB) return 0;

  let intersection = 0;
  for (const id of listenersA) {
    if (listenersB.has(id)) intersection += 1;
  }
  const union = listenersA.size + listenersB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Cosine similarity over binary tag vectors — compatible *worlds*, not identical artists. */
function tagCosine(a: string[], b: string[]): { value: number; shared: string[] } {
  const setA = new Set(a);
  const setB = new Set(b);
  const shared = [...setA].filter((tag) => setB.has(tag));
  const denom = Math.sqrt(setA.size) * Math.sqrt(setB.size);
  return { value: denom === 0 ? 0 : shared.length / denom, shared };
}

/**
 * Listening-rhythm similarity over the 24-bin hour histogram.
 *
 * Mean-centred (Pearson) rather than raw cosine: raw cosine on all-positive
 * histograms scores ~0.9 for everyone, which would make the component useless.
 * Centring measures *shape* — do you both spike at 2am — and spreads the range.
 */
function rhythmSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;

  const meanA = a.slice(0, n).reduce((x, y) => x + y, 0) / n;
  const meanB = b.slice(0, n).reduce((x, y) => x + y, 0) / n;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    dot += da * db;
    normA += da * da;
    normB += db * db;
  }

  if (normA === 0 || normB === 0) return 0;
  const pearson = dot / Math.sqrt(normA * normB);
  // Map [-1, 1] onto [0, 1]; opposite rhythms should score low, not negative.
  return clamp01((pearson + 1) / 2);
}

/** The hours where both profiles are meaningfully above their own average. */
function findOverlapHours(a: number[], b: number[]): number[] {
  const n = Math.min(a.length, b.length);
  const meanA = a.slice(0, n).reduce((x, y) => x + y, 0) / n;
  const meanB = b.slice(0, n).reduce((x, y) => x + y, 0) / n;

  const hours: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (a[i] > meanA * 1.2 && b[i] > meanB * 1.2) hours.push(i);
  }
  return hours;
}

/** Score one pair. `corpus` must have been built over the full population. */
export function scorePair(a: BaseProfile, b: BaseProfile, corpus: Corpus): PairScore {
  const artists = weightedOverlap<Artist>(
    a.topArtists,
    b.topArtists,
    (artist) => artist.name,
    (artist) => artistRarity(artist.name, corpus)
  );

  const tracks = weightedOverlap<Track>(a.topTracks, b.topTracks, trackKey, (track) =>
    trackRarity(track, corpus)
  );

  const tags = tagCosine(a.tags, b.tags);
  const rhythm = rhythmSimilarity(a.listeningHours, b.listeningHours);
  const { bridges } = findBridges(a, b, corpus);

  // Bridges are near-misses, so they saturate quickly — three strong adjacencies
  // is already a meaningful signal, and shouldn't rival a direct shared artist.
  const adjacency = clamp01(bridges.reduce((sum, br) => sum + br.strength, 0) / 3);

  /**
   * Taste *connection*: what you share outright, plus how well the rest still
   * reaches across.
   *
   * Measuring adjacency on its own inverted the component — the more two people
   * genuinely shared, the less non-overlapping taste was left to bridge, so the
   * strongest matches scored zero here and lost to weaker ones with more gaps.
   * Framing it as connection means direct overlap can only ever help, and full
   * overlap resolves to 1 rather than needing the weights renormalised.
   */
  const directShare =
    a.topArtists.length === 0 ? 0 : artists.shared.length / a.topArtists.length;
  const connection = clamp01(directShare + (1 - directShare) * adjacency);

  const rawComponents: Record<ComponentKey, number> = {
    artistOverlap: artists.value,
    trackOverlap: tracks.value,
    tagSimilarity: tags.value,
    depthBridge: connection,
    rhythmMatch: rhythm,
  };

  const components: ScoredComponent[] = (Object.keys(WEIGHTS) as ComponentKey[]).map((key) => ({
    key,
    label: COMPONENT_LABELS[key],
    value: rawComponents[key],
    weight: WEIGHTS[key],
    contribution: rawComponents[key] * WEIGHTS[key] * 100,
  }));

  const composite = components.reduce((sum, c) => sum + c.contribution, 0) / 100;
  const score = Math.round(calibrate(composite) * 100);

  const sharedArtists = artists.shared
    .slice()
    .sort((x, y) => artistRarity(y.name, corpus) - artistRarity(x.name, corpus))
    .map((artist) => artist.name);

  const sharedTracks = tracks.shared;
  const overlapHours = findOverlapHours(a.listeningHours, b.listeningHours);

  return {
    score,
    components,
    reasons: buildReasons({
      sharedArtists,
      sharedTracks,
      sharedTags: tags.shared,
      bridges,
      overlapHours,
      rhythm,
      corpus,
    }),
    sharedArtists,
    sharedTracks,
    sharedSong: sharedTracks[0] ?? null,
    sharedTags: tags.shared,
    bridges: bridges.map(({ from, to }) => ({ from, to })),
    overlapHours,
  };
}

type Bridge = { from: string; to: string; strength: number };

/**
 * Near-misses worth crediting: an artist of A's that sits next to an artist of
 * B's in the corpus, where neither of them actually shares that artist.
 */
function findBridges(
  a: BaseProfile,
  b: BaseProfile,
  corpus: Corpus
): { bridges: Bridge[]; candidates: number } {
  const bNames = new Set(b.topArtists.map((artist) => artist.name));
  const aNames = new Set(a.topArtists.map((artist) => artist.name));

  const bridges: Bridge[] = [];
  let candidates = 0;

  for (const artistA of a.topArtists) {
    if (bNames.has(artistA.name)) continue; // already a direct hit
    for (const artistB of b.topArtists) {
      if (aNames.has(artistB.name)) continue;
      candidates += 1;
      const strength = artistSimilarity(artistA.name, artistB.name, corpus);
      if (strength > 0.25) {
        bridges.push({ from: artistA.name, to: artistB.name, strength });
      }
    }
  }

  return { bridges: bridges.sort((x, y) => y.strength - x.strength).slice(0, 3), candidates };
}

/**
 * Presentation scaling for the composite similarity.
 *
 * The raw composite is a genuine 0–1 similarity, but set-overlap measures over
 * real libraries cluster in the low band — even an excellent match lands near
 * 0.35, which would render as "35%" and read as a bad match. This curve is
 * strictly monotonic, so it changes no ordering and no relative gap; it only
 * spreads the range people actually occupy across the dial. The honest
 * per-component values stay untouched and are what the breakdown screen shows.
 */
function calibrate(composite: number): number {
  return clamp01(Math.pow(clamp01(composite), 0.62));
}

/**
 * Turn the computed overlap into a ranked reason list.
 *
 * Ordered by how much each fact would actually make someone lean in — a rare
 * shared artist beats a shared genre every time.
 */
function buildReasons({
  sharedArtists,
  sharedTracks,
  sharedTags,
  bridges,
  overlapHours,
  rhythm,
  corpus,
}: {
  sharedArtists: string[];
  sharedTracks: Track[];
  sharedTags: string[];
  bridges: Bridge[];
  overlapHours: number[];
  rhythm: number;
  corpus: Corpus;
}): string[] {
  const reasons: string[] = [];

  const rare = sharedArtists.filter(
    (name) => (corpus.artistPopularity.get(name) ?? 100) < RARE_RANK
  );
  if (rare.length > 0) {
    reasons.push(
      rare.length === 1
        ? `Both deep on ${rare[0]}`
        : `${rare.length} rare shared artists — ${rare.slice(0, 2).join(', ')}`
    );
  } else if (sharedArtists.length > 0) {
    reasons.push(`${sharedArtists.length} shared artists`);
  }

  if (sharedTracks.length > 0) {
    reasons.push(`Same song on repeat — ${sharedTracks[0].title}`);
  }

  const nightOverlap = overlapHours.filter((hour) => NIGHT_HOURS.includes(hour));
  if (nightOverlap.length > 0) {
    reasons.push('Both listening past 2am');
  } else if (rhythm > 0.7 && overlapHours.length > 0) {
    reasons.push('Your listening hours line up');
  } else if (rhythm < 0.35) {
    reasons.push('Opposite clocks — they close the day, you open it');
  }

  if (bridges.length > 0) {
    reasons.push(`${bridges[0].from} sits right next to their ${bridges[0].to}`);
  }

  if (sharedTags.length > 0) {
    reasons.push(`Both into ${sharedTags.slice(0, 2).join(' and ')}`);
  }

  return reasons;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
