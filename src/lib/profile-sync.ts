import type { Session } from '@supabase/supabase-js';

import { deriveArchetype } from '@/lib/archetype';
import { getMe } from '@/lib/seed';
import { supabase } from '@/lib/supabase';

/**
 * Mirrors the local profile into Postgres.
 *
 * AsyncStorage stays the source of truth for the running app — it is what the
 * screens read and it works offline — and this pushes the same values up so a
 * signed-in user's profile survives a reinstall. Every function no-ops without a
 * configured project, so onboarding behaves identically in local mode.
 */

export type ProfilePatch = {
  name?: string;
  age?: number;
  campus?: string;
  lookingFor?: string | null;
};

/** A stable, readable, unique slug. The uuid tail is what guarantees uniqueness. */
function slugFor(session: Session): string {
  const name = (session.user.user_metadata?.name as string | undefined) ?? '';
  const stem =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20) || 'listener';
  return `${stem}-${session.user.id.slice(0, 8)}`;
}

/**
 * Create the row on first sign-in if it does not exist yet.
 *
 * Seeds the musical fields from the local profile so a brand-new account still
 * scores against the corpus — an empty top-artists list would make every
 * component zero and the deck meaningless.
 *
 * The editorial fields are pointedly NOT copied that way. `archetype` and
 * `current_frequency` are prose about a specific person, and taking them from
 * the mock handed every new account the same line about slowcore and ambient
 * regardless of what they listen to. The archetype is derived from the taste
 * data instead, so it at least agrees with the artists on the same screen, and
 * `current_frequency` is left unset for the Last.fm sync to fill — an absent
 * line reads better than a confidently wrong one.
 */
export async function ensureProfile(session: Session): Promise<string | null> {
  if (!supabase) return null;

  const { data: existing, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', session.user.id)
    .maybeSingle();

  if (lookupError) return null;
  if (existing) return existing.id as string;

  const me = getMe();
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      auth_id: session.user.id,
      slug: slugFor(session),
      name: me.name,
      age: me.age,
      campus: me.campus,
      archetype: deriveArchetype({
        topArtists: me.topArtists.map((a) => a.name),
        tags: me.tags,
        energy: me.energy,
        listeningHours: me.listeningHours,
      }),
      week: me.week,
      top_artists: me.topArtists,
      top_tracks: me.topTracks,
      listening_hours: me.listeningHours,
      tags: me.tags,
      energy: me.energy,
      swap_picks: me.swapPicks,
      is_mock: false,
    })
    .select('id')
    .single();

  if (error) return null;
  return data.id as string;
}

/**
 * Write onboarding answers to the signed-in user's row.
 *
 * Fire-and-forget by design: onboarding must never block on the network, and a
 * failed write is recoverable because AsyncStorage already holds the answer.
 */
export async function syncProfile(patch: ProfilePatch): Promise<void> {
  if (!supabase) return;

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return;

  await ensureProfile(session);

  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.age !== undefined) row.age = patch.age;
  if (patch.campus !== undefined) row.campus = patch.campus;
  if (patch.lookingFor !== undefined) row.looking_for = patch.lookingFor;
  if (Object.keys(row).length === 0) return;

  await supabase.from('profiles').update(row).eq('auth_id', session.user.id);
}

/** Marks onboarding finished server-side too. */
export async function syncOnboardingComplete(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) await ensureProfile(data.session);
}
