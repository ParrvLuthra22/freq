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
  /** Who has liked this account — from real `likes` rows, via the controlled RPC. */
  admirerSlugs: string[];
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

  const [likes, passes, matches, notifications, admirers, profile] = await Promise.all([
    supabase.from('likes').select('to_id').eq('from_id', me),
    supabase.from('passes').select('to_id').eq('from_id', me),
    supabase.from('matches').select('a, b'),
    supabase
      .from('notifications')
      .select('payload')
      .eq('user_id', me)
      .eq('type', 'match')
      .eq('read', false),
    // likes_select_own only lets a client see rows it sent — this is the one
    // controlled exception, a SECURITY DEFINER RPC rather than a table read.
    supabase.rpc('get_admirer_ids'),
    supabase.from('profiles').select('name, age, campus, looking_for, card_artist').eq('id', me).single(),
  ]);

  if (likes.error || passes.error || matches.error || notifications.error || admirers.error || profile.error) {
    return null;
  }

  return {
    likedSlugs: toSlugs(likes.data.map((row) => row.to_id)),
    passedSlugs: toSlugs(passes.data.map((row) => row.to_id)),
    matchedSlugs: toSlugs(matches.data.flatMap((row) => [row.a, row.b]).filter((id) => id !== me)),
    unreadSlugs: toSlugs(
      notifications.data.map((row) => (row.payload as { other_id?: string }).other_id)
    ),
    admirerSlugs: toSlugs(
      (admirers.data as { from_id: string }[]).map((row) => row.from_id)
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

/**
 * Ask the mock to "like back" after a believable delay, server-side.
 *
 * Only meaningful when `attempt_match` just reported the pair as not-yet-mutual
 * for a mock candidate — calling this for anyone else is a harmless no-op the
 * function itself refuses (see `schedule-match`). Fire-and-forget: the actual
 * confirmation arrives later as a `notifications` row over realtime, which is
 * what `subscribeToDelayedMatches` below is for.
 */
export async function scheduleMatch(targetSlug: string): Promise<void> {
  const target = getProfileUuid(targetSlug);
  if (!supabase || !target) return;

  await supabase.functions.invoke('schedule-match', { body: { target_profile_id: target } });
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

/**
 * Live match confirmations, for whenever a delayed like-back actually lands.
 *
 * `attempt_match`'s instant path already inserts the same `match` notification
 * the client also learns about immediately via its own optimistic update — the
 * caller is expected to ignore rows for a slug it already has in `matchIds`,
 * which is exactly what a delayed confirmation is: a slug the caller does not
 * have yet.
 */
export function subscribeToDelayedMatches(onMatch: (targetSlug: string) => void): () => void {
  const client = supabase;
  const me = getMyProfileId();
  if (!client || !me) return () => {};

  const channel = client
    .channel(`notifications:${me}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` },
      (payload) => {
        const row = payload.new as { type: string; payload: { other_id?: string } };
        if (row.type !== 'match') return;
        const slug = row.payload.other_id ? getSlugForUuid(row.payload.other_id) : undefined;
        if (slug) onMatch(slug);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

/**
 * Ask a mock to send a fresh like sometime this session — maybe. The Edge
 * Function decides whether anything happens at all and to whom; this is a
 * fire-and-forget nudge, not a request for a specific outcome. The actual
 * like, if any, arrives later as a `notifications` row over realtime, same as
 * a delayed match.
 */
export async function scheduleAdmirerLike(): Promise<void> {
  if (!supabase) return;
  await supabase.functions.invoke('schedule-like', { body: {} });
}

/**
 * Live admirer arrivals — the Likes-tab counterpart to
 * `subscribeToDelayedMatches`. A separate channel rather than folding into
 * that one: the two notification types drive different UI (a toast that opens
 * a still-sealed inbound card here, one that unseals a face there), so each
 * subscription's callback stays doing one thing.
 */
export function subscribeToAdmirerLikes(onLike: (fromSlug: string) => void): () => void {
  const client = supabase;
  const me = getMyProfileId();
  if (!client || !me) return () => {};

  const channel = client
    .channel(`notifications:likes:${me}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` },
      (payload) => {
        const row = payload.new as { type: string; payload: { from_id?: string } };
        if (row.type !== 'like') return;
        const slug = row.payload.from_id ? getSlugForUuid(row.payload.from_id) : undefined;
        if (slug) onLike(slug);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

/** Re-exported so callers that already have a session don't need a second import. */
export type { Session };
