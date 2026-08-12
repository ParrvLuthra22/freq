// track-search
//
// A thin, authenticated proxy over Last.fm's `track.search`.
//
// It exists because the Mix needs a way to add a song that isn't already in
// your own top tracks, and searching needs the Last.fm key — which lives only
// in this project's function secrets and must never reach the bundle. So the
// client sends a query and gets back titles and artists; it never sees a key.
//
// Auth is required even though the results are public data. An open proxy
// would let anyone burn this project's Last.fm rate limit, and requiring a JWT
// costs the app nothing since only signed-in users can add to a Mix anyway.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const LASTFM_API_KEY = Deno.env.get('LASTFM_API_KEY');

const LIMIT = 20;
const MAX_QUERY = 120;

type SearchHit = { name?: string; artist?: string };
type Track = { title: string; artist: string };

// Scrobbles are user-submitted, so Last.fm's index carries a lot of YouTube
// rips: titles that repeat the artist, "(official audio)" suffixes, and rows
// whose artist field is actually a video description. Raw results put the
// clean match several rows down, which makes the picker feel worse than the
// data behind it actually is.

/** "(official audio)", "[HD]", "(lyric video)" and friends, only at the end. */
const NOISE = /[([]\s*(official\s*)?(music\s*)?(audio|video|lyrics?|lyric video|hd|hq|visualizer|explicit|remaster(ed)?( \d{4})?)\s*[)\]]\s*$/i;

function tidy(raw: string): string {
  let s = raw.trim();
  // Suffixes can stack: "… (Official Video) (HD)".
  for (let i = 0; i < 3 && NOISE.test(s); i += 1) s = s.replace(NOISE, '').trim();
  return s.replace(/\s{2,}/g, ' ').trim();
}

function clean(hits: SearchHit[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];

  for (const hit of hits) {
    const artist = tidy(hit.artist ?? '');
    let title = tidy(hit.name ?? '');
    if (!artist || !title) continue;

    // An artist field holding a whole video description is not an artist.
    if (artist.length > 60 || artist.includes(' - ')) continue;

    // "boygenius - True Blue" by boygenius → "True Blue".
    const prefix = `${artist.toLowerCase()} - `;
    if (title.toLowerCase().startsWith(prefix)) title = title.slice(prefix.length).trim();
    if (!title) continue;

    const key = `${title.toLowerCase()}::${artist.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, artist });
  }

  return out;
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

  if (!LASTFM_API_KEY) {
    // A deployment choice, not a crash: the client falls back to your own top
    // tracks, which is what the picker offered before search existed.
    return jsonResponse({ tracks: [], unavailable: true });
  }

  let query = '';
  try {
    const body = await req.json();
    query = typeof body.q === 'string' ? body.q.trim().slice(0, MAX_QUERY) : '';
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  if (query.length < 2) return jsonResponse({ tracks: [] });

  const url =
    'https://ws.audioscrobbler.com/2.0/?method=track.search' +
    `&track=${encodeURIComponent(query)}` +
    `&api_key=${LASTFM_API_KEY}&format=json&limit=${LIMIT}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return jsonResponse({ error: 'Could not reach Last.fm right now.' }, 502);
  }
  if (!res.ok) return jsonResponse({ error: 'Could not reach Last.fm right now.' }, 502);

  const data = await res.json();
  const hits: SearchHit[] = data?.results?.trackmatches?.track ?? [];

  return jsonResponse({ tracks: clean(hits) });
});
