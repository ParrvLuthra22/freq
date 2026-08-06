import rawSeed from '@/seed/users.json';

import { buildCorpus, scorePair, type Corpus, type PairScore } from '@/lib/score';

export type Artist = { name: string; rank: number };
export type Track = { title: string; artist: string };
export type Archetype = { name: string; description: string };
export type Energy = { night: number; emotional: number; highEnergy: number; exploratory: number };

/** The artist someone is meeting people through this week — the face of their card. */
export type WeekPick = { artist: string; plays: number; stat: string };

export type BaseProfile = {
  id: string;
  name: string;
  age: number;
  campus: string;
  archetype: Archetype;
  week: WeekPick;
  topArtists: Artist[];
  topTracks: Track[];
  /** 24-bin histogram, one entry per hour of day, 0–100. */
  listeningHours: number[];
  tags: string[];
  energy: Energy;
};

export type Me = BaseProfile & {
  currentFrequency: string;
  /** Tracks you can offer in a Blind Swap. */
  swapPicks: string[];
};

export type Match = {
  score: number;
  reasons: string[];
  sharedArtists: string[];
  sharedSong: Track | null;
};

export type ChatMessage = { id: string; sender: 'me' | 'them'; text: string; sentAt: string };

/** A chip on the overlap face of a card — an artist or a genre, flagged when rare. */
export type Chip = { label: string; rare: boolean };

export type DiscoverUser = BaseProfile & {
  match: Match;
  /** They already swiped right on you, so liking back matches instantly. */
  likedYou: boolean;
  /** A scripted candidate, not a real signed-in person — the only kind that gets an AI-voiced reply. */
  isMock: boolean;
  /** Editorial copy authored per person — the algorithm supplies the numbers, not the voice. */
  reason: string;
  reasonSoft: string;
  chips: Chip[];
  line: string;
  flirt: string;
  song: Track | null;
  hoursNote: string;
  rarityNote: string;
  quiz: { options: string[]; answer: string };
  swap: { track: string; verdict: string };
  takeAnswer: number;
  thread: { sender: 'me' | 'them'; text: string }[];
};

type SeedData = { me: Me; users: DiscoverUser[] };

const seed = rawSeed as unknown as SeedData;
// The bundled JSON has no is_mock column — everything in it is the mock pool by
// construction, unlike the DB corpus where mock/real profiles sit side by side.
seed.users = seed.users.map((user) => ({ ...user, isMock: true }));

/**
 * Rarity is only meaningful against a population, so the corpus is built once
 * over every profile and reused for all pairwise scoring.
 */
let corpus: Corpus = buildCorpus([seed.me, ...seed.users]);
const scoreCache = new Map<string, PairScore>();

/** Scoring depends on `me`, so any edit to my profile invalidates it. */
function invalidateScores(): void {
  corpus = buildCorpus([seed.me, ...seed.users]);
  scoreCache.clear();
}

/**
 * The full §5 breakdown for me against one user — every component, reason,
 * bridge and shared hour. This is what the "why this score" screen reads.
 */
export function getPairScore(userId: string): PairScore | undefined {
  const cached = scoreCache.get(userId);
  if (cached) return cached;

  const user = seed.users.find((u) => u.id === userId);
  if (!user) return undefined;

  const result = scorePair(seed.me, user, corpus);
  scoreCache.set(userId, result);
  return result;
}

/** Project the computed score onto the narrower shape the cards already consume. */
function withLiveMatch(user: DiscoverUser): DiscoverUser {
  const scored = getPairScore(user.id);
  if (!scored) return user;

  return {
    ...user,
    match: {
      score: scored.score,
      reasons: scored.reasons,
      sharedArtists: scored.sharedArtists,
      sharedSong: scored.sharedSong,
    },
  };
}

export function getMe(): Me {
  return seed.me;
}

/** Overwrites the cached/mock archetype once the AI personality call resolves. */
export function setMeArchetype(archetype: Archetype): void {
  seed.me = { ...seed.me, archetype };
}

/** Overwrites the cached/mock profile fields collected during onboarding. */
export function updateMe(patch: Partial<Me>): void {
  seed.me = { ...seed.me, ...patch };
  invalidateScores();
}

/**
 * Swap the whole corpus for one loaded from Postgres — mock and real profiles
 * together, whatever RLS lets this signed-in user see (own row + every mock +
 * anyone matched). Score.ts is unchanged: it already takes `BaseProfile[]` and
 * has never known where its input came from.
 */
export function setRemoteProfiles(me: Me, users: DiscoverUser[]): void {
  seed.me = me;
  seed.users = users;
  invalidateScores();
}

/** Every user, best frequency first — scores computed live, never read from the seed. */
export function getUsers(): DiscoverUser[] {
  return seed.users.map(withLiveMatch).sort((a, b) => b.match.score - a.match.score);
}

/**
 * The deck, strongest frequency first, minus anyone already decided on.
 *
 * Whether someone has been liked or passed is runtime state, so the caller
 * supplies it — the seed knows who exists, not what you have done about them.
 */
export function getDeck(decidedIds: string[]): DiscoverUser[] {
  return getUsers().filter((user) => !decidedIds.includes(user.id));
}

export function getUserById(id: string): DiscoverUser | undefined {
  const user = seed.users.find((u) => u.id === id);
  return user ? withLiveMatch(user) : undefined;
}

/** The people who swiped right on you before you ever saw them. */
export function getAdmirers(): DiscoverUser[] {
  return getUsers().filter((user) => user.likedYou);
}
