import type { Archetype, Energy } from '@/lib/seed';
import { formatList } from '@/lib/utils';

/**
 * The archetype, derived from listening data alone.
 *
 * This exists because the AI proxy is optional. `getPersonality` used to fall
 * back to a single hardcoded archetype, which meant every user without a
 * reachable proxy read as "The Midnight Romantic" — and a new account's row
 * was seeded from the mock profile, so the description named slowcore and
 * ambient at people whose top artist was nothing of the kind. Deriving it
 * makes the copy true of the person it describes whether or not any model is
 * in the loop, and keeps the AI strictly an upgrade rather than a dependency.
 *
 * Pure and dependency-free, same as `score.ts`, so it can be unit-tested.
 */

export type ArchetypeInput = {
  topArtists: string[];
  tags: string[];
  energy: Energy;
  /** 24-bin histogram, one entry per hour of day. */
  listeningHours: number[];
};

/**
 * The axis a person leads with, and the line that opens their description.
 * Deliberately distinct from the six seeded mock archetypes — a real user
 * should never be handed a name the deck already gave someone else.
 */
const AXIS_COPY: Record<keyof Energy, { name: string; opener: string }> = {
  night: {
    name: 'The Nocturnist',
    opener: 'Your best listening happens after everyone else has logged off',
  },
  emotional: {
    name: 'The Slow Burn',
    opener: 'You reach for the records that take their time',
  },
  highEnergy: {
    name: 'The Live Wire',
    opener: 'You listen loud, and you listen fast',
  },
  exploratory: {
    name: 'The Crate Digger',
    opener: "You'd rather find it yourself than be told about it",
  },
};

/** Hours that read as genuinely late — matches the rhythm reasons in `score.ts`. */
const NIGHT_HOURS = [0, 1, 2, 3, 4];

/** Not enough signal to say anything true — say that, rather than inventing. */
const UNREAD: Archetype = {
  name: 'The Unread',
  description: 'Not enough plays yet to call it — give it a week of listening.',
};

function dominantAxis(energy: Energy): keyof Energy {
  return (Object.keys(AXIS_COPY) as (keyof Energy)[]).reduce((best, key) =>
    energy[key] > energy[best] ? key : best
  );
}

/** The hour someone actually peaks at, or null when the histogram is empty. */
function peakHour(listeningHours: number[]): number | null {
  if (listeningHours.length === 0) return null;
  let peak = 0;
  for (let i = 1; i < listeningHours.length; i += 1) {
    if (listeningHours[i] > listeningHours[peak]) peak = i;
  }
  return listeningHours[peak] === 0 ? null : peak;
}

export function deriveArchetype({
  topArtists,
  tags,
  energy,
  listeningHours,
}: ArchetypeInput): Archetype {
  // An all-zero energy profile means nothing has been read yet — every axis
  // ties, so `dominantAxis` would silently return whichever key came first
  // and assert something unearned about the person.
  const hasSignal =
    topArtists.length > 0 || tags.length > 0 || Object.values(energy).some((v) => v > 0);
  if (!hasSignal) return UNREAD;

  const axis = dominantAxis(energy);
  const { name, opener } = AXIS_COPY[axis];

  // Genres first, since they say more than a single name does; the top artist
  // is the fallback so the sentence is still specific about something.
  const genres = tags.filter((tag) => !tag.includes('-')).slice(0, 2);
  const detail =
    genres.length > 0
      ? formatList(genres)
      : topArtists.length > 0
        ? topArtists[0]
        : null;

  const peak = peakHour(listeningHours);
  const lateClause =
    peak !== null && NIGHT_HOURS.includes(peak) && axis !== 'night'
      ? ', mostly past midnight'
      : '';

  const description = detail
    ? `${opener} — ${detail}${lateClause}.`
    : `${opener}${lateClause}.`;

  return { name, description };
}

/**
 * True when a stored archetype carries nothing worth showing.
 *
 * Tolerates `{}` as well as null: the column is `not null default '{}'`, so
 * "cleared" on the server side arrives as an empty object, not a null.
 */
export function isEmptyArchetype(archetype: Partial<Archetype> | null | undefined): boolean {
  return !archetype?.name?.trim();
}
