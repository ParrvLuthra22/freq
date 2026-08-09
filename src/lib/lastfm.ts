import { loadRemoteCorpus } from '@/lib/remote-profiles';
import { supabase } from '@/lib/supabase';

/**
 * Connecting Last.fm: a thin wrapper around the `lastfm-profile` Edge
 * Function, plus the corpus reload that makes the result actually show up.
 * `loadRemoteCorpus` is already idempotent and safe to call again — it just
 * rebuilds `getMe()`/`getUsers()` from whatever Postgres holds now, which is
 * exactly what a rebuilt profile needs downstream (score.ts included, since
 * scores are recomputed on every read, never cached across a corpus swap).
 */

export type ConnectLastfmResult = { ok: true } | { ok: false; error: string };

/**
 * Last.fm's own username rule: 2-15 characters, starts with a letter, then
 * letters/digits/underscores/hyphens. Checked here for fast feedback before
 * ever making a request, and again inside the Edge Function itself — the
 * client check is a courtesy, not the boundary that actually matters.
 */
const LASTFM_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{1,14}$/;

export function isValidLastfmUsername(username: string): boolean {
  return LASTFM_USERNAME_PATTERN.test(username.trim());
}

async function readEdgeFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (body?.error) return String(body.error);
    } catch {
      // Body wasn't JSON, or already consumed — fall through to the generic message.
    }
  }
  return 'Could not reach Last.fm right now.';
}

export async function connectLastfm(
  username: string,
): Promise<ConnectLastfmResult> {
  if (!supabase)
    return {
      ok: false,
      error: 'Connect Last.fm needs a live account, not local mode.',
    };

  const trimmed = username.trim();
  if (!trimmed) return { ok: false, error: 'Enter a Last.fm username.' };
  if (!isValidLastfmUsername(trimmed)) {
    return {
      ok: false,
      error: 'That doesn’t look like a Last.fm username — 2–15 characters, starting with a letter.',
    };
  }

  const { data, error } = await supabase.functions.invoke('lastfm-profile', {
    body: { username: trimmed },
  });
  if (error) return { ok: false, error: await readEdgeFunctionError(error) };
  if (data?.error) return { ok: false, error: String(data.error) };

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) await loadRemoteCorpus(sessionData.session);

  return { ok: true };
}
