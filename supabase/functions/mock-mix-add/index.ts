// mock-mix-add
//
// The mock's side of "both people can add tracks" to the FREQ Mix. A human
// adding a track from a song message is a plain client-side insert
// (mix_tracks_insert_member already permits it) — nothing privileged about
// that half. This function is the other half: a mock has no session, so
// contributing one of its own tracks back can only happen through a
// service-role write, same reasoning as every other mock action this app has
// (schedule-match, schedule-like, mock-reply's game moves).
//
// Called once per human contribution, not on a timer — the client fires this
// right after its own insert succeeds, the same way it asks mock-reply for a
// text reply after sending. No LLM, no cost: the mock's next track is just
// the next of its own `top_tracks` not already in this match's mix.
//
// Responds immediately; the wait and the actual insert happen server-side via
// EdgeRuntime.waitUntil. The client never sees the mock's contribution in
// this response — it arrives later as a realtime INSERT on `mix_tracks`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Long enough to read as "picking a track", not an instant echo.
const MIN_DELAY_MS = 1500;
const MAX_DELAY_MS = 3500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trackKey(track: { title?: string; artist?: string }): string {
  return `${track.title ?? ''}::${track.artist ?? ''}`.toLowerCase();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

  let matchId: string;
  try {
    const body = await req.json();
    matchId = body.match_id;
    if (!matchId || typeof matchId !== 'string') {
      return jsonResponse({ error: 'match_id is required' }, 400);
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

  const { data: me } = await userClient.from('profiles').select('id').eq('auth_id', user.id).single();
  if (!me) return jsonResponse({ error: 'No profile for this account' }, 404);

  // matches_select_member RLS means this row only comes back if `me` is
  // actually in it — a non-member's match_id resolves to "not found", which
  // doubles as the membership check.
  const { data: match } = await userClient.from('matches').select('a, b').eq('id', matchId).single();
  if (!match) return jsonResponse({ error: 'Match not found' }, 404);

  const mockProfileId = match.a === me.id ? match.b : match.a;
  const { data: mock } = await userClient
    .from('profiles')
    .select('id, is_mock, top_tracks')
    .eq('id', mockProfileId)
    .single();
  if (!mock) return jsonResponse({ error: 'Other profile not found' }, 404);

  if (!mock.is_mock) {
    return jsonResponse({ scheduled: false, reason: 'match is not with a mock profile' }, 200);
  }

  const topTracks = (mock.top_tracks ?? []) as { title: string; artist: string }[];
  if (topTracks.length === 0) {
    return jsonResponse({ scheduled: false, reason: 'mock has no tracks to offer' }, 200);
  }

  // Privileged: a mock has no session, so its half of the mix can only be
  // written through the service-role key.
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: existing, error: existingError } = await serviceClient
    .from('mix_tracks')
    .select('track')
    .eq('match_id', matchId);
  if (existingError) return jsonResponse({ error: 'Could not load existing mix' }, 500);

  const used = new Set(
    (existing ?? []).map((row: { track: { title?: string; artist?: string } }) => trackKey(row.track))
  );
  const eligible = topTracks.filter((track) => !used.has(trackKey(track)));

  if (eligible.length === 0) {
    return jsonResponse({ scheduled: false, reason: 'no eligible track left to add' }, 200);
  }

  const track = eligible[Math.floor(Math.random() * eligible.length)];
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);

  const later = (async () => {
    await sleep(delay);
    const { error } = await serviceClient
      .from('mix_tracks')
      .insert({ match_id: matchId, added_by: mockProfileId, track });
    if (error) {
      console.error('mock mix insert failed', error);
    }
  })();

  // @ts-ignore — EdgeRuntime is a Supabase Edge Functions / Deno Deploy global.
  if (typeof EdgeRuntime !== 'undefined') {
    // @ts-ignore — see above.
    EdgeRuntime.waitUntil(later);
  } else {
    await later;
  }

  return jsonResponse({ scheduled: true, delayMs: Math.round(delay) });
});
