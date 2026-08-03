import { Redirect } from 'expo-router';

import { usePersistedState } from '@/lib/store';

/**
 * Entry route.
 *
 * Onboarding is a one-time thing, so anyone who has finished it goes straight
 * to today's drop. Persisted state is already hydrated before the first paint
 * (see the root layout), so this reads the settled value rather than flashing
 * onboarding at a returning user.
 */
export default function Index() {
  const { onboarded } = usePersistedState();
  return <Redirect href={onboarded ? '/discover' : '/onboarding'} />;
}
