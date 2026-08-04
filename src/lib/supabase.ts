import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * Supabase client.
 *
 * Credentials come from the environment — `EXPO_PUBLIC_*` vars are inlined into
 * the bundle at build time, which is correct for the anon key (it is public by
 * design and only useful alongside row-level security) and never acceptable for
 * the service-role key. Nothing here may ever read a service key.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** False until the project is configured, so callers can fall back to the seed. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Session storage.
 *
 * Native has no `localStorage`, so sessions persist through AsyncStorage. On web
 * the default storage is already correct, and handing supabase-js AsyncStorage
 * there would fight its own URL-based session detection — web is a deploy target,
 * so this has to stay right on both.
 */
const isWeb = Platform.OS === 'web';

function createSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: {
      storage: isWeb ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Only the web build can be landed on by an OAuth redirect carrying a session.
      detectSessionInUrl: isWeb,
    },
  });
}

/**
 * Null until the project is configured. Callers should branch on
 * `isSupabaseConfigured` rather than assuming a client exists — the app still
 * runs entirely off `seed/users.json` while the backend is being wired.
 */
export const supabase = createSupabase();

/** Narrowing helper for the call sites that genuinely require a live backend. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured — set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}
