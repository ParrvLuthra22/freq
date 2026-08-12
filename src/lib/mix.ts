import type { RealtimeChannel } from '@supabase/supabase-js';

import { getMyProfileId, getSlugForUuid } from '@/lib/remote-profiles';
import { supabase } from '@/lib/supabase';

/**
 * The FREQ Mix: a shared, growing playlist per match. `mix_tracks` is a flat
 * append-only log — nothing here ever updates or reorders a row, so the whole
 * feature is just "read everything for this match" plus "insert one more".
 */

export type Track = { title: string; artist: string };

export type MixTrack = {
  id: string;
  matchId: string;
  /** Slug, not uuid — resolved once here so the UI never has to think about ids. */
  addedBySlug: string;
  track: Track;
  createdAt: string;
};

type MixTrackRow = {
  id: string;
  match_id: string;
  added_by: string;
  track: Track;
  created_at: string;
};

function mapRow(row: MixTrackRow): MixTrack | null {
  const addedBySlug = getSlugForUuid(row.added_by);
  if (!addedBySlug) return null; // A contributor we have no profile mapping for — drop rather than misattribute.
  return {
    id: row.id,
    matchId: row.match_id,
    addedBySlug,
    track: row.track,
    createdAt: row.created_at,
  };
}

export async function fetchMixTracks(matchId: string): Promise<MixTrack[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('mix_tracks')
    .select('id, match_id, added_by, track, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return (data as MixTrackRow[])
    .map(mapRow)
    .filter((t): t is MixTrack => t !== null);
}

/** Adds the signed-in user's own track. A plain client insert — mix_tracks_insert_member already permits it. */
export async function addMixTrack(
  matchId: string,
  track: Track,
): Promise<MixTrack | null> {
  const me = getMyProfileId();
  if (!supabase || !me) return null;

  const { data, error } = await supabase
    .from('mix_tracks')
    .insert({ match_id: matchId, added_by: me, track })
    .select('id, match_id, added_by, track, created_at')
    .single();

  if (error || !data) return null;
  return mapRow(data as MixTrackRow);
}

/**
 * Search Last.fm for a track to add.
 *
 * Goes through the `track-search` Edge Function rather than calling Last.fm
 * directly, because the API key lives in function secrets and must never be
 * in the bundle. Returns an empty list rather than throwing on any failure —
 * the picker always has your own top tracks to fall back to, so a search that
 * cannot run degrades to what the app offered before search existed.
 */
export async function searchTracks(query: string): Promise<Track[]> {
  if (!supabase) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const { data, error } = await supabase.functions.invoke('track-search', {
    body: { q },
  });
  if (error || !data?.tracks) return [];
  return data.tracks as Track[];
}

/**
 * Asks the mock to contribute one of its own tracks back, fire-and-forget.
 * Meaningful only right after the human's own add succeeds — mirrors
 * `triggerMockReply`: the actual contribution arrives later as a realtime
 * INSERT, never as anything in this call's response.
 */
export async function triggerMockMixAdd(matchId: string): Promise<void> {
  if (!supabase) return;
  await supabase.functions.invoke('mock-mix-add', {
    body: { match_id: matchId },
  });
}

/**
 * Live contributions from either side. Requires `public.mix_tracks` in the
 * `supabase_realtime` publication (see the migrations).
 */
export function subscribeToMixTracks(
  matchId: string,
  onInsert: (track: MixTrack) => void,
): () => void {
  const client = supabase;
  if (!client) return () => {};

  const channel: RealtimeChannel = client
    .channel(`mix_tracks:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mix_tracks',
        filter: `match_id=eq.${matchId}`,
      },
      (payload) => {
        const mapped = mapRow(payload.new as MixTrackRow);
        if (mapped) onInsert(mapped);
      },
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
