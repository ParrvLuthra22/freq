import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import * as React from 'react';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Authentication.
 *
 * Two ways in: Google, and a one-tap demo account so the app can be explored
 * without handing over an identity first — this is a portfolio piece as much as
 * a product, and a sign-in wall in front of a demo defeats the point.
 *
 * Everything degrades: with no Supabase project configured the app runs in local
 * mode off `seed/users.json`, exactly as it did before auth existed.
 */

// Required on web so the popup can hand the session back to the opener.
WebBrowser.maybeCompleteAuthSession();

export type AuthMode = 'loading' | 'signed-out' | 'signed-in' | 'local';

export type AuthState = {
  mode: AuthMode;
  session: Session | null;
  /** True while a sign-in round trip is open, so buttons can disable. */
  busy: boolean;
  error: string | null;
};

/**
 * Where the provider sends the user back.
 *
 * `makeRedirectUri` resolves this per platform — an https origin on web, the
 * `freq://` scheme in the dev build — so the same call works on both targets.
 */
export function redirectUri(): string {
  return makeRedirectUri({ scheme: 'freq', path: 'auth/callback' });
}

/**
 * Pull tokens out of a provider redirect.
 *
 * Supabase returns them in the URL fragment, not the query string, so they never
 * reach a server log. Both are handled because some flows normalise one to the
 * other.
 */
function tokensFromUrl(url: string): { access_token: string; refresh_token: string } | null {
  const fragment = url.includes('#') ? url.split('#')[1] : '';
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const params = new URLSearchParams(fragment || query);

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

/** Google, via Supabase's OAuth endpoint. */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };

  const redirectTo = redirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // Take the URL ourselves rather than letting the SDK navigate: native has
      // no page to navigate, and on web this keeps the flow in a popup.
      skipBrowserRedirect: true,
    },
  });

  if (error) return { error: error.message };
  if (!data?.url) return { error: 'No sign-in URL returned.' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') {
    // Dismissing the sheet is a normal thing to do, not a failure to report.
    return { error: result.type === 'cancel' || result.type === 'dismiss' ? null : 'Sign-in failed.' };
  }

  const tokens = tokensFromUrl(result.url);
  if (!tokens) {
    // On web the SDK's own detectSessionInUrl may already have consumed them.
    const { data: existing } = await supabase.auth.getSession();
    return { error: existing.session ? null : 'Could not read the sign-in response.' };
  }

  const { error: sessionError } = await supabase.auth.setSession(tokens);
  return { error: sessionError?.message ?? null };
}

/**
 * The demo account.
 *
 * Anonymous sign-in gives every visitor their own throwaway user, so exploring
 * cannot collide with anyone else's swipes — a single shared demo login would
 * mean one person's likes showing up in another's deck. Requires anonymous
 * sign-ins to be enabled for the project.
 */
export async function signInAsDemo(): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' };

  const { error } = await supabase.auth.signInAnonymously();
  if (!error) return { error: null };

  return {
    error: /disabled|not enabled/i.test(error.message)
      ? 'Demo sign-in is off for this project — enable anonymous sign-ins in Supabase.'
      : error.message,
  };
}

/** Apple. Stubbed — needs expo-apple-authentication and a configured provider. */
export async function signInWithApple(): Promise<{ error: string | null }> {
  return { error: 'Apple sign-in is not wired up yet.' };
}

/** Email magic link. Stubbed — needs an email template and a deep-link handler. */
export async function signInWithMagicLink(_email: string): Promise<{ error: string | null }> {
  return { error: 'Magic-link sign-in is not wired up yet.' };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Whether Apple sign-in should even be offered. */
export const appleAvailable = Platform.OS === 'ios';

/**
 * Current auth state.
 *
 * Resolves to `local` when no project is configured, so the whole app stays
 * usable while the backend is being wired rather than being gated behind a
 * sign-in that cannot succeed.
 */
export function useAuth(): AuthState & {
  google: () => Promise<void>;
  demo: () => Promise<void>;
  leave: () => Promise<void>;
} {
  const [session, setSession] = React.useState<Session | null>(null);
  const [mode, setMode] = React.useState<AuthMode>(isSupabaseConfigured ? 'loading' : 'local');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setMode(data.session ? 'signed-in' : 'signed-out');
    });

    // Keeps the gate honest across token refresh, sign-out in another tab, and
    // the redirect landing back on web.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setMode(next ? 'signed-in' : 'signed-out');
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const run = React.useCallback(async (fn: () => Promise<{ error: string | null }>) => {
    setBusy(true);
    setError(null);
    const { error: failure } = await fn();
    if (failure) setError(failure);
    setBusy(false);
  }, []);

  return {
    mode,
    session,
    busy,
    error,
    google: React.useCallback(() => run(signInWithGoogle), [run]),
    demo: React.useCallback(() => run(signInAsDemo), [run]),
    leave: React.useCallback(async () => {
      await signOut();
    }, []),
  };
}
