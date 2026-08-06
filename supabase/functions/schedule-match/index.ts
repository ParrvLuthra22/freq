// schedule-match
//
// The delayed half of a like-back. attempt_match (an RPC, called directly by
// the client) already handles the instant case — a mock whose liked_you is
// already true. This function exists for the other case: a mock who has not
// "liked you back" yet needs to actually do that a few seconds later, which
// means writing a real `likes` row on their behalf. A mock has no session, so
// that write can only happen through a privileged, server-side path — hence an
// Edge Function rather than a client-scheduled timer, which was the old
// design and could not survive the app being backgrounded or closed.
//
// Responds immediately and does the wait server-side via EdgeRuntime.waitUntil,
// rather than holding the HTTP request open for several seconds. The client
// never sees the delayed confirmation in this response — it arrives later as a
// realtime INSERT on `notifications`, which is what actually drives the
// "IT'S MUTUAL" toast.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Keeps the felt timing close to the client's old MATCH_DELAY (4200ms) without
// being perfectly identical every time — a fixed delay across every mock reads
// as scripted in a way a small spread does not.
const MIN_DELAY_MS = 3200;
const MAX_DELAY_MS = 4800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

  let targetProfileId: string;
  try {
    const body = await req.json();
    targetProfileId = body.target_profile_id;
    if (!targetProfileId || typeof targetProfileId !== 'string') {
      return jsonResponse({ error: 'target_profile_id is required' }, 400);
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Scoped to the caller's own JWT — used only to establish who they are and to
  // read profiles, both of which RLS already permits them.
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

  if (me.id === targetProfileId) {
    return jsonResponse({ error: 'Cannot match yourself' }, 400);
  }

  const { data: target, error: targetError } = await userClient
    .from('profiles')
    .select('id, is_mock')
    .eq('id', targetProfileId)
    .single();
  if (targetError || !target) return jsonResponse({ error: 'Target profile not found' }, 404);

  // Only mock candidates get a scripted "they like you back eventually" beat —
  // a real signed-in person's like is either already mutual or it just isn't.
  if (!target.is_mock) {
    return jsonResponse({ scheduled: false, reason: 'target is not a mock profile' }, 200);
  }

  // Privileged: confirm_match is not granted to `authenticated`, only to this
  // role, and it is the only thing in this function that needs to be.
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);

  const later = (async () => {
    await sleep(delay);
    const { error } = await serviceClient.rpc('confirm_match', {
      user_profile_id: me.id,
      mock_profile_id: target.id,
    });
    if (error) {
      // Nothing is listening for this response — the only place a failure here
      // could surface is the function's own logs.
      console.error('confirm_match failed', error);
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
