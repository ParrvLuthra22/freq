import type { RealtimeChannel } from '@supabase/supabase-js';

import { getMyProfileId, getProfileUuid, getSlugForUuid } from '@/lib/remote-profiles';
import { supabase } from '@/lib/supabase';

/**
 * Messages: resolving a match id, reading/writing rows, and the realtime
 * subscription that makes a reply appear without a refresh.
 *
 * Everything here operates on `matches.id` (a uuid), which the chat screen and
 * the Chats list resolve once from the other person's slug via
 * `getMatchId` — the rest of the app never needs to know a match id exists.
 */

/** Kept in sync with the `messages.type` check constraint in the migrations. */
export type MessageType = 'text' | 'song' | 'quiz' | 'flirt' | 'swap' | 'take' | 'system';

export type TextBody = { text: string };
export type SongBody = { title: string; artist: string };

export type StoredMessage = {
  id: string;
  matchId: string;
  /** Slug, not uuid — resolved once here so every caller can compare against `getMe().id`. */
  senderSlug: string;
  type: MessageType;
  body: Record<string, unknown>;
  createdAt: string;
};

type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  type: MessageType;
  body: Record<string, unknown>;
  created_at: string;
};

function mapRow(row: MessageRow): StoredMessage | null {
  const senderSlug = getSlugForUuid(row.sender_id);
  if (!senderSlug) return null; // A sender we have no profile mapping for — drop rather than misattribute.
  return {
    id: row.id,
    matchId: row.match_id,
    senderSlug,
    type: row.type,
    body: row.body,
    createdAt: row.created_at,
  };
}

const matchIdCache = new Map<string, string>();

/**
 * The match id for a conversation with `targetSlug`, or null if there is none
 * yet (no session, no project, or the two of you have not actually matched).
 *
 * `matches` stores one canonical ordered pair per §"schema" migration
 * (`check (a < b)`), so the query orders the two ids itself rather than trying
 * both directions.
 */
export async function getMatchId(targetSlug: string): Promise<string | null> {
  const cached = matchIdCache.get(targetSlug);
  if (cached) return cached;

  const me = getMyProfileId();
  const target = getProfileUuid(targetSlug);
  if (!supabase || !me || !target) return null;

  const lo = me < target ? me : target;
  const hi = me < target ? target : me;

  const { data, error } = await supabase
    .from('matches')
    .select('id')
    .eq('a', lo)
    .eq('b', hi)
    .maybeSingle();

  if (error || !data) return null;

  matchIdCache.set(targetSlug, data.id as string);
  return data.id as string;
}

export async function fetchMessages(matchId: string): Promise<StoredMessage[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('id, match_id, sender_id, type, body, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return (data as MessageRow[]).map(mapRow).filter((m): m is StoredMessage => m !== null);
}

/**
 * Ask the `mock-reply` Edge Function to write the next line as this mock
 * candidate — fire-and-forget from the client's point of view. It calls the
 * LLM and inserts the reply itself; the reply shows up here over the same
 * realtime subscription as anyone else's message, never as an HTTP response
 * body the caller has to do something with.
 */
export async function triggerMockReply(matchId: string): Promise<void> {
  if (!supabase) return;
  await supabase.functions.invoke('mock-reply', { body: { match_id: matchId } });
}

/** Insert and return the authoritative row — used to replace the optimistic local echo. */
export async function sendMessage(
  matchId: string,
  type: MessageType,
  body: Record<string, unknown>
): Promise<StoredMessage | null> {
  const me = getMyProfileId();
  if (!supabase || !me) return null;

  const { data, error } = await supabase
    .from('messages')
    .insert({ match_id: matchId, sender_id: me, type, body })
    .select('id, match_id, sender_id, type, body, created_at')
    .single();

  if (error || !data) return null;
  return mapRow(data as MessageRow);
}

/**
 * Live inserts for one thread.
 *
 * Requires `public.messages` to be part of the `supabase_realtime` publication
 * (see the migrations) — without that, Postgres Changes never fires and this
 * subscription simply never calls back, which is silent rather than an error.
 */
export function subscribeToThread(
  matchId: string,
  onInsert: (message: StoredMessage) => void
): () => void {
  const client = supabase;
  if (!client) return () => {};

  const channel: RealtimeChannel = client
    .channel(`messages:${matchId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
      (payload) => {
        const mapped = mapRow(payload.new as MessageRow);
        if (mapped) onInsert(mapped);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

/**
 * The most recent message per match, for the Chats list preview. One query
 * ordered newest-first, reduced client-side to the first row per match — this
 * table is small at this app's scale, and `.in()` plus a manual reduce avoids
 * needing a `DISTINCT ON` the query builder cannot express.
 */
export async function fetchLastMessages(matchIds: string[]): Promise<Map<string, StoredMessage>> {
  const result = new Map<string, StoredMessage>();
  if (!supabase || matchIds.length === 0) return result;

  const { data, error } = await supabase
    .from('messages')
    .select('id, match_id, sender_id, type, body, created_at')
    .in('match_id', matchIds)
    .order('created_at', { ascending: false });

  if (error || !data) return result;

  for (const row of data as MessageRow[]) {
    if (result.has(row.match_id)) continue;
    const mapped = mapRow(row);
    if (mapped) result.set(row.match_id, mapped);
  }
  return result;
}

/** Live inserts across every match at once, for the Chats list to reorder/update on. */
export function subscribeToAnyMessage(
  matchIds: string[],
  onInsert: (message: StoredMessage) => void
): () => void {
  const client = supabase;
  if (!client || matchIds.length === 0) return () => {};

  const channel: RealtimeChannel = client
    .channel(`messages:inbox:${matchIds.slice().sort().join(',')}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=in.(${matchIds.join(',')})`,
      },
      (payload) => {
        const mapped = mapRow(payload.new as MessageRow);
        if (mapped) onInsert(mapped);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
