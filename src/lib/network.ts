import * as React from 'react';

/**
 * Whether the device currently has a network path at all — not whether
 * Supabase is reachable, just the OS-level signal. Web-only by design:
 * `navigator.onLine` and the `online`/`offline` window events exist there
 * natively, and web is this app's actual deploy target. Native has no
 * equivalent without a dedicated module (`expo-network` or similar) this
 * app doesn't carry yet, so it always reports online there — silently
 * assuming connectivity is safer than a false "offline" that could never
 * clear without that module in place.
 */
export function useOnline(): boolean {
  const [online, setOnline] = React.useState(() =>
    typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true
  );

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('addEventListener' in window)) return;

    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
