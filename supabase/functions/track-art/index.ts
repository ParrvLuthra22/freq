// track-art
//
// Real album covers for tracks the app already knows about, looked up by
// (title, artist) through Last.fm's `track.getInfo`.
//
// Two things learned from the API before writing this, both of which shape it:
//
// 1. `track.search` returns Last.fm's grey placeholder star for essentially
//    every result, so search results cannot supply art. `track.getInfo` is the
//    endpoint that actually carries the album image.
// 2. `getInfo` still returns that same placeholder when it has nothing, and it
//    is a real URL that loads — so it has to be filtered by hash, or the UI
//    fills with grey stars instead of falling back to its own artwork.
//
// Batched because a Mix screen asks about every tile at once; one request per
// tile would be both slow and a good way to meet Last.fm's rate limit.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const LASTFM_API_KEY = Deno.env.get('LASTFM_API_KEY');

/** Last.fm's "no image" star. A real URL that loads, which is why it must be caught by hash. */
const PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f';

/** Enough for a full Mix screen in one call, small enough to stay polite. */
const MAX_TRACKS = 24;

/** 300x300 — the largest Last.fm offers, and still small enough for a grid tile. */
const PREFERRED_SIZE = 'extralarge';

type TrackKey = { title: string; artist: string };
type LastfmImage = { size?: string; '#text'?: string };

const keyOf = (t: TrackKey) => `${t.title}::${t.artist}`;

async function artFor(track: TrackKey): Promise<string | null> {
  const url =
    'https://ws.audioscrobbler.com/2.0/?method=track.getInfo' +
    `&artist=${encodeURIComponent(track.artist)}` +
    `&track=${encodeURIComponent(track.title)}` +
    `&api_key=${LASTFM_API_KEY}&format=json&autocorrect=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const images: LastfmImage[] = data?.track?.album?.image ?? [];
    if (images.length === 0) return null;

    const chosen =
      images.find((i) => i.size === PREFERRED_SIZE)?.['#text'] ||
      images[images.length - 1]?.['#text'] ||
      '';

    if (!chosen || chosen.includes(PLACEHOLDER)) return null;
    return chosen;
  } catch {
    // One track failing to resolve is not worth failing the batch over — the
    // caller renders its own artwork for anything that comes back null.
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Not signed in' }, 401);

  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await caller.auth.getUser();
  if (!user) return jsonResponse({ error: 'Not signed in' }, 401);

  // No key is a deployment choice, not a failure: every caller already draws
  // its own artwork when a lookup returns nothing.
  if (!LASTFM_API_KEY) return jsonResponse({ art: {} });

  let tracks: TrackKey[] = [];
  try {
    const body = await req.json();
    tracks = Array.isArray(body.tracks) ? body.tracks.slice(0, MAX_TRACKS) : [];
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const valid = tracks.filter(
    (t) => typeof t?.title === 'string' && typeof t?.artist === 'string' && t.title && t.artist,
  );
  if (valid.length === 0) return jsonResponse({ art: {} });

  const results = await Promise.all(valid.map((t) => artFor(t)));

  const art: Record<string, string> = {};
  valid.forEach((track, i) => {
    const found = results[i];
    if (found) art[keyOf(track)] = found;
  });

  return jsonResponse({ art });
});
