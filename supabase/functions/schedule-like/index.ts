// schedule-like
//
// The other half of making the Likes tab feel alive: besides the admirers
// seeded at signup (see the `profiles_seed_admirer_likes` trigger), a mock
// occasionally sends a genuinely new like partway through a session — not on
// a fixed schedule, and not every session. The client calls this once per
// reconciled session; this function decides whether anything happens at all,
// and if so, picks who and after how long. A mock has no session, so the
// actual `likes` row can only be written through a privileged, service-role
// path — same reasoning as schedule-match.
//
// Responds immediately; the wait happens server-side via EdgeRuntime.waitUntil.
// The client never sees the new like in this response — it arrives later as a
// realtime INSERT on `notifications`, which is what drives the toast and the
// inbound list update.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Long enough to land mid-session rather than the instant the tab opens —
// "occasionally", not "immediately, every time".
const MIN_DELAY_MS = 8_000;
const MAX_DELAY_MS = 20_000;

// Only six mocks exist in the seed population; burning through all of them on
// the first visit would stop feeling occasional fast. Skipping outright some
// fraction of the time is what keeps it feeling like something that just
// happens sometimes, not a guaranteed per-session drip.
const SEND_PROBABILITY = 0.7;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

  // Scoped to the caller's own JWT — used only to establish who they are.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

  const { data: me, error: meError } = await userClient
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .single();
  if (meError || !me) return jsonResponse({ error: 'No profile for this account' }, 404);

  // Privileged: send_admirer_like is not granted to `authenticated`, and
  // reading who has already liked this account only makes sense from a role
  // that isn't subject to likes_select_own's "yours only" restriction either.
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const [{ data: mocks, error: mocksError }, { data: existingLikes, error: likesError }] = await Promise.all([
    serviceClient.from('profiles').select('id').eq('is_mock', true),
    serviceClient.from('likes').select('from_id').eq('to_id', me.id),
  ]);
  if (mocksError || !mocks) return jsonResponse({ error: 'Could not load mock pool' }, 500);
  if (likesError) return jsonResponse({ error: 'Could not load existing likes' }, 500);

  const alreadyLiked = new Set((existingLikes ?? []).map((row) => row.from_id as string));
  const eligible = mocks.filter((mock) => !alreadyLiked.has(mock.id as string));

  if (eligible.length === 0) {
    return jsonResponse({ scheduled: false, reason: 'no eligible admirer' }, 200);
  }
  if (Math.random() > SEND_PROBABILITY) {
    return jsonResponse({ scheduled: false, reason: 'not this time' }, 200);
  }

  const candidate = eligible[Math.floor(Math.random() * eligible.length)];
  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);

  const later = (async () => {
    await sleep(delay);
    const { error } = await serviceClient.rpc('send_admirer_like', {
      mock_profile_id: candidate.id,
      user_profile_id: me.id,
    });
    if (error) {
      // Nothing is listening for this response — the only place a failure
      // here could surface is the function's own logs.
      console.error('send_admirer_like failed', error);
    }
  })();

  // @ts-ignore — EdgeRuntime is a Deno Deploy / Supabase Edge Functions global,
  // not something @types/deno declares.
  if (typeof EdgeRuntime !== 'undefined') {
    // @ts-ignore — see above.
    EdgeRuntime.waitUntil(later);
  } else {
    // Local `supabase functions serve` (and any other Deno runtime without
    // EdgeRuntime) has no equivalent — fall back to just awaiting it, which
    // makes the response slower locally but keeps the function correct.
    await later;
  }

  return jsonResponse({ scheduled: true, delayMs: Math.round(delay) });
});
