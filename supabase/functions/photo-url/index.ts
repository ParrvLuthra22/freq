// photo-url
//
// The only way a profile photo is ever read.
//
// The `profile-photos` bucket is private and carries no SELECT policy at all,
// so object URLs do not resolve without a signature. This function is what
// decides whether a signature is issued: it verifies, with the caller's own
// JWT, that the caller either owns the photo or is mutually matched with the
// person in it, and only then signs — with the service role — a short-lived
// URL.
//
// That ordering is the whole security argument. The service-role key can read
// any object in the project, so it is never allowed to touch storage until
// after the match check has passed against the caller's identity. The caller's
// identity comes from their JWT, never from the request body, so asking for
// someone else's photo is not a thing the body can express.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BUCKET = 'profile-photos';

// The match is re-checked on every call, so the only thing this window governs
// is an ALREADY-issued URL: Supabase signed URLs cannot be revoked
// individually, so the TTL is the blast radius of an unmatch or a block.
//
// 60s is chosen to make that radius small while still covering what the app
// actually does with the URL, which is hand it straight to an <Image> that
// loads in well under a second. Expiry only affects new requests — bytes
// already fetched stay on screen — so a manager left open does not break.
//
// Unmatching does not exist yet: there is no UI for it, and the client has no
// delete grant on `matches`. When it does ship, this constant is not a
// sufficient answer on its own — cutting off an in-flight viewer means
// streaming the bytes through this function so every read re-checks the match,
// at the cost of proxying image traffic. Noting the seam here so that decision
// is made deliberately rather than inherited.
const SIGNED_URL_TTL_SECONDS = 60;

type Body = {
  /** Slug of the profile whose photos are wanted. Omit for your own. */
  slug?: string;
  /** Sign every photo rather than only the primary one. */
  all?: boolean;
};

type PhotoRow = {
  id: string;
  path: string;
  position: number;
  is_primary: boolean;
};

type SignedResult = { path: string; signedUrl: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Not signed in' }, 401);

  // Caller-scoped client: every read below runs under their RLS, so the match
  // check cannot be tricked by anything in the request body.
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await caller.auth.getUser();
  if (userError || !user) return jsonResponse({ error: 'Not signed in' }, 401);

  let body: Body = {};
  try {
    if (req.headers.get('content-length') !== '0') body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { data: me, error: meError } = await caller
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle();
  if (meError || !me) return jsonResponse({ error: 'No profile for this account' }, 404);

  // Resolve the target. No slug means "my own photos", which is always allowed.
  let targetId = me.id as string;
  if (body.slug) {
    const { data: target, error: targetError } = await caller
      .from('profiles')
      .select('id')
      .eq('slug', body.slug)
      .maybeSingle();
    if (targetError || !target) return jsonResponse({ error: 'No such profile' }, 404);
    targetId = target.id as string;
  }

  if (targetId !== me.id) {
    // The gate. `has_mutual_match_with` is security-definer and evaluates
    // against the caller's own profile id, so this cannot be spoofed by the
    // body either.
    const { data: matched, error: matchError } = await caller.rpc('has_mutual_match_with', {
      target: targetId,
    });
    if (matchError) return jsonResponse({ error: 'Could not verify the match' }, 500);
    if (!matched) {
      // Deliberately not 404: the profile exists, and pretending otherwise
      // would be a lie the client can disprove. It simply is not unsealed yet.
      return jsonResponse({ error: 'Their face is sealed until you both swipe.' }, 403);
    }
  }

  const { data: photos, error: photosError } = await caller
    .from('profile_photos')
    .select('id, path, position, is_primary')
    .eq('profile_id', targetId)
    .order('position', { ascending: true });
  if (photosError) return jsonResponse({ error: 'Could not read photos' }, 500);

  const rows = (photos ?? []) as PhotoRow[];
  if (rows.length === 0) return jsonResponse({ photos: [] });

  const wanted: PhotoRow[] = body.all
    ? rows
    : [rows.find((p) => p.is_primary) ?? rows[0]];

  // Only now, after the check has passed, does the service role get involved.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(
      wanted.map((p) => p.path),
      SIGNED_URL_TTL_SECONDS,
    );
  if (signError) return jsonResponse({ error: 'Could not sign the photo URL' }, 500);

  const byPath = new Map(
    ((signed ?? []) as SignedResult[]).map((s) => [s.path, s.signedUrl]),
  );

  return jsonResponse({
    photos: wanted
      .map((p: PhotoRow) => ({
        id: p.id,
        isPrimary: p.is_primary,
        position: p.position,
        url: byPath.get(p.path) ?? null,
      }))
      .filter((p: { url: string | null }) => p.url !== null),
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });
});
