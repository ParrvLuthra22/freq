import rawSeed from '@/seed/users.json';

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

export function getMe(): Me {
  return seed.me;
}

export function getUsers(): DiscoverUser[] {
  return seed.users;
}

export function getUserById(id: string): DiscoverUser | undefined {
  return seed.users.find((u) => u.id === id);
}

export function getMatchedUsers(): DiscoverUser[] {
  return seed.users.filter((u) => u.matched);
}

/** The user shown on the Sync tab and used as the default demo match. */
export function getDemoMatch(): DiscoverUser {
  return getMatchedUsers()[0] ?? seed.users[0];
}
