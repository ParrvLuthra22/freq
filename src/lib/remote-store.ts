import type { Session } from '@supabase/supabase-js';

import { getMyProfileId, getProfileUuid, getSlugForUuid } from '@/lib/remote-profiles';
import { supabase } from '@/lib/supabase';

/**
 * Reads and writes for the per-user relational state — likes, passes, matches,
 * unread, and which artist your card shows. Everything here is a thin, direct
 * mapping onto the tables in `supabase/migrations/`; the merge/cache/optimism
 * policy lives in `store.ts`, not here.
 *
 * Every function requires `getMyProfileId()` to already be set, which means
 * `loadRemoteCorpus` must have run first — reads and writes both key off the
 * caller's own profile row, and there is no reasonable fallback if that row is
 * unknown.
 */

export type RemoteSnapshot = {
  likedSlugs: string[];
  passedSlugs: string[];
  matchedSlugs: string[];
  unreadSlugs: string[];
  cardArtist: string | null;
  profile: { name: string | null; age: number | null; campus: string | null; lookingFor: string | null };
};

function toSlugs(uuids: (string | null | undefined)[]): string[] {
  const slugs: string[] = [];
  for (const id of uuids) {
    if (!id) continue;
    const slug = getSlugForUuid(id);
    if (slug) slugs.push(slug);
  }
  return slugs;
}

/** Everything needed to reconcile the local cache, in one round trip's worth of queries. */
export async function fetchRemoteSnapshot(): Promise<RemoteSnapshot | null> {
  const me = getMyProfileId();
  if (!supabase || !me) return null;

  const [likes, passes, matches, notifications, profile] = await Promise.all([
    supabase.from('likes').select('to_id').eq('from_id', me),
    supabase.from('passes').select('to_id').eq('from_id', me),
    supabase.from('matches').select('a, b'),
    supabase
      .from('notifications')
      .select('payload')
      .eq('user_id', me)
      .eq('type', 'match')
      .eq('read', false),
    supabase.from('profiles').select('name, age, campus, looking_for, card_artist').eq('id', me).single(),
  ]);

  if (likes.error || passes.error || matches.error || notifications.error || profile.error) {
    return null;
  }

  return {
    likedSlugs: toSlugs(likes.data.map((row) => row.to_id)),
    passedSlugs: toSlugs(passes.data.map((row) => row.to_id)),
    matchedSlugs: toSlugs(matches.data.flatMap((row) => [row.a, row.b]).filter((id) => id !== me)),
    unreadSlugs: toSlugs(
      notifications.data.map((row) => (row.payload as { other_id?: string }).other_id)
    ),
    cardArtist: profile.data.card_artist,
    profile: {
      name: profile.data.name,
      age: profile.data.age,
      campus: profile.data.campus,
      lookingFor: (profile.data as { looking_for?: string | null }).looking_for ?? null,
    },
  };
}

/**
 * Swiped left. Simple insert — passing never needs the mutuality logic a like
 * does, since a pass can never produce a match.
 */
export async function remotePass(targetSlug: string): Promise<void> {
  const me = getMyProfileId();
  const target = getProfileUuid(targetSlug);
  if (!supabase || !me || !target) return;

  await supabase.from('passes').insert({ from_id: me, to_id: target }).select().maybeSingle();
}

/**
 * Swiped right. Routes through `attempt_match` rather than inserting into
 * `likes` directly — that RPC is also what is allowed to decide mutuality and
 * create the match row; a plain insert would record the like but silently skip
 * the match a mock's seeded `liked_you` should have produced.
 */
export async function remoteLike(targetSlug: string): Promise<boolean | null> {
  const target = getProfileUuid(targetSlug);
  if (!supabase || !target) return null;

  const { data, error } = await supabase.rpc('attempt_match', { target_profile_id: target });
  if (error || !data || data.length === 0) return null;
  return data[0].matched as boolean;
}

/** A pending like the deck already showed as liked, now confirmed mutual by the delay timer. */
export async function remoteConfirmMatch(targetSlug: string): Promise<void> {
  await remoteLike(targetSlug);
}

export async function remoteMarkRead(targetSlug: string): Promise<void> {
  const me = getMyProfileId();
  const target = getProfileUuid(targetSlug);
  if (!supabase || !me || !target) return;

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', me)
    .eq('type', 'match')
    .eq('payload->>other_id', target);
}

export async function remoteSetCardArtist(artist: string): Promise<void> {
  const me = getMyProfileId();
  if (!supabase || !me) return;

  await supabase.from('profiles').update({ card_artist: artist }).eq('id', me);
}

/** Re-exported so callers that already have a session don't need a second import. */
export type { Session };
