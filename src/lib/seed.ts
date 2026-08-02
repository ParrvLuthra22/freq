import rawSeed from '@/seed/users.json';

import { buildCorpus, scorePair, type Corpus, type PairScore } from '@/lib/score';

export type Artist = { name: string; rank: number };
export type Track = { title: string; artist: string };
export type Archetype = { name: string; description: string };
export type Energy = { night: number; emotional: number; highEnergy: number; exploratory: number };

export type BaseProfile = {
  id: string;
  name: string;
  age: number;
  campus: string;
  avatarGradient: [string, string];
  archetype: Archetype;
  topArtists: Artist[];
  topTracks: Track[];
  /** 24-bin histogram, one entry per hour of day, 0–100. */
  listeningHours: number[];
  tags: string[];
  energy: Energy;
};

export type Me = BaseProfile & { currentFrequency: string };

export type Match = {
  score: number;
  reasons: string[];
  sharedArtists: string[];
  sharedSong: Track | null;
};

export type ChatMessage = { id: string; sender: 'me' | 'them'; text: string; sentAt: string };

export type DiscoverUser = BaseProfile & {
  match: Match;
  matched?: boolean;
  opener?: string;
  chatThread?: ChatMessage[];
};

type SeedData = { me: Me; users: DiscoverUser[] };

const seed = rawSeed as unknown as SeedData;

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

/** Every user, best frequency first — scores computed live, never read from the seed. */
export function getUsers(): DiscoverUser[] {
  return seed.users.map(withLiveMatch).sort((a, b) => b.match.score - a.match.score);
}

export function getUserById(id: string): DiscoverUser | undefined {
  const user = seed.users.find((u) => u.id === id);
  return user ? withLiveMatch(user) : undefined;
}

export function getMatchedUsers(): DiscoverUser[] {
  return seed.users.filter((u) => u.matched).map(withLiveMatch);
}

/** The user shown on the Sync tab and used as the default demo match. */
export function getDemoMatch(): DiscoverUser {
  return getMatchedUsers()[0] ?? seed.users[0];
}
