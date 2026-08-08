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

  const { data, error } = await supabase.functions.invoke('lastfm-profile', {
    body: { username: trimmed },
  });
  if (error) return { ok: false, error: await readEdgeFunctionError(error) };
  if (data?.error) return { ok: false, error: String(data.error) };

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) await loadRemoteCorpus(sessionData.session);

  return { ok: true };
}
