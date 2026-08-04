import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';
import { usePersistedState } from '@/lib/store';

/**
 * Entry route.
 *
 * Signed out sends you to the welcome screen to pick a way in. Signed in but
 * unfinished resumes onboarding. Otherwise, straight to today's deck.
 *
 * In local mode — no Supabase project configured — auth is skipped entirely and
 * this behaves exactly as it did before auth existed. Persisted state is already
 * hydrated before first paint (see the root layout), so this reads settled
 * values rather than flashing onboarding at a returning user.
 */
export default function Index() {
  const { onboarded } = usePersistedState();
  const { mode } = useAuth();

  if (mode === 'signed-out') return <Redirect href="/onboarding" />;
  return <Redirect href={onboarded ? '/discover' : '/onboarding'} />;
}
