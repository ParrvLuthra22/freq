import type { Session } from '@supabase/supabase-js';

import { setRemoteProfiles, type DiscoverUser, type Me } from '@/lib/seed';
import { supabase } from '@/lib/supabase';

/**
 * The bridge between the DB's uuid primary keys and the app's slug ids.
 *
 * Every screen in the app addresses a person by their seed slug ("odessa") —
 * that's baked into the deck, the routes (`/chat/[id]`), the store. The DB
 * naturally keys on `profiles.id` (uuid), since likes/matches/messages all
 * reference it as a foreign key. Rather than thread uuids through the whole UI,
 * this module is the only place that knows both, built once when profiles load.
 */

let slugToUuid = new Map<string, string>();
let uuidToSlug = new Map<string, string>();
let myProfileId: string | null = null;

export function getProfileUuid(slug: string): string | undefined {
  return slugToUuid.get(slug);
}

export function getSlugForUuid(uuid: string): string | undefined {
  return uuidToSlug.get(uuid);
}

export function getMyProfileId(): string | null {
  return myProfileId;
}

type ProfileRow = {
  id: string;
  auth_id: string | null;
  slug: string;
  name: string;
  age: number | null;
  campus: string | null;
  archetype: { name: string; description: string } | null;
  week: { artist: string; plays: number; stat: string } | null;
  top_artists: { name: string; rank: number }[] | null;
  top_tracks: { title: string; artist: string }[] | null;
  listening_hours: number[] | null;
  tags: string[] | null;
  energy: { night: number; emotional: number; highEnergy: number; exploratory: number } | null;
  reason: string | null;
  reason_soft: string | null;
  chips: { label: string; rare: boolean }[] | null;
  line: string | null;
  flirt: string | null;
  song: { title: string; artist: string } | null;
  notes: { hours?: string; rarity?: string } | null;
  quiz: { options: string[]; answer: string } | null;
  swap: { track: string; verdict: string } | null;
  take_answer: number | null;
  opening_thread: { sender: 'me' | 'them'; text: string }[] | null;
  current_frequency: string | null;
  swap_picks: string[] | null;
  card_artist: string | null;
  is_mock: boolean;
  liked_you: boolean;
};

const PROFILE_COLUMNS =
  'id, auth_id, slug, name, age, campus, archetype, week, top_artists, top_tracks, ' +
  'listening_hours, tags, energy, reason, reason_soft, chips, line, flirt, song, notes, ' +
  'quiz, swap, take_answer, opening_thread, current_frequency, swap_picks, card_artist, ' +
  'is_mock, liked_you';

/** A row shaped for someone else's card — the fields `me` does not carry. */
function mapCandidate(row: ProfileRow): DiscoverUser {
  return {
    id: row.slug,
    name: row.name,
    age: row.age ?? 0,
    campus: row.campus ?? '',
    archetype: row.archetype ?? { name: '', description: '' },
    week: row.week ?? { artist: '', plays: 0, stat: '' },
    topArtists: row.top_artists ?? [],
    topTracks: row.top_tracks ?? [],
    listeningHours: row.listening_hours ?? [],
    tags: row.tags ?? [],
    energy: row.energy ?? { night: 0, emotional: 0, highEnergy: 0, exploratory: 0 },
    // Overwritten by scorePair on every read — placeholder until then.
    match: { score: 0, reasons: [], sharedArtists: [], sharedSong: null },
    likedYou: row.liked_you,
    isMock: row.is_mock,
    reason: row.reason ?? '',
    reasonSoft: row.reason_soft ?? '',
    chips: row.chips ?? [],
    line: row.line ?? '',
    flirt: row.flirt ?? '',
    song: row.song,
    hoursNote: row.notes?.hours ?? '',
    rarityNote: row.notes?.rarity ?? '',
    quiz: row.quiz ?? { options: [], answer: '' },
    swap: row.swap ?? { track: '', verdict: '' },
    takeAnswer: row.take_answer ?? 0,
    thread: row.opening_thread ?? [],
  };
}

function mapMe(row: ProfileRow): Me {
  return {
    id: row.slug,
    name: row.name,
    age: row.age ?? 0,
    campus: row.campus ?? '',
    archetype: row.archetype ?? { name: '', description: '' },
    week: row.week ?? { artist: '', plays: 0, stat: '' },
    topArtists: row.top_artists ?? [],
    topTracks: row.top_tracks ?? [],
    listeningHours: row.listening_hours ?? [],
    tags: row.tags ?? [],
    energy: row.energy ?? { night: 0, emotional: 0, highEnergy: 0, exploratory: 0 },
    currentFrequency: row.current_frequency ?? '',
    swapPicks: row.swap_picks ?? [],
  };
}

/**
 * Load the corpus from Postgres and swap it in for the bundled JSON.
 *
 * RLS is what actually defines "all profiles" here: a signed-in user reads
 * their own row, every mock candidate, and anyone they've matched with — which
 * is every profile relevant to scoring *for them*, not a global table scan.
 * Silently keeps the JSON corpus on any failure — this is an enhancement layer,
 * never a hard dependency the rest of the app can break on.
 */
export async function loadRemoteCorpus(session: Session): Promise<boolean> {
  if (!supabase) return false;

  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS);
  if (error || !data) return false;

  const rows = data as unknown as ProfileRow[];
  const meRow = rows.find((row) => row.auth_id === session.user.id);
  if (!meRow) return false;

  const nextSlugToUuid = new Map<string, string>();
  const nextUuidToSlug = new Map<string, string>();
  for (const row of rows) {
    nextSlugToUuid.set(row.slug, row.id);
    nextUuidToSlug.set(row.id, row.slug);
  }

  const others = rows.filter((row) => row.id !== meRow.id).map(mapCandidate);

  slugToUuid = nextSlugToUuid;
  uuidToSlug = nextUuidToSlug;
  myProfileId = meRow.id;

  setRemoteProfiles(mapMe(meRow), others);
  return true;
}
