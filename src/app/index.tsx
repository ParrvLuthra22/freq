import { Redirect } from 'expo-router';

// No persisted onboarding-complete state yet (mock-first) — always start there.
export default function Index() {
  return <Redirect href="/onboarding" />;
}
