import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as React from 'react';

import { loadRemoteCorpus } from '@/lib/remote-profiles';
import {
  fetchRemoteSnapshot,
  remoteConfirmMatch,
  remoteLike,
  remoteMarkRead,
  remotePass,
  remoteSetCardArtist,
} from '@/lib/remote-store';
import { syncOnboardingComplete, syncProfile } from '@/lib/profile-sync';
import { getUserById, updateMe, type DiscoverUser, type Me } from '@/lib/seed';
import { supabase } from '@/lib/supabase';

/**
 * Persistence for everything the user actually creates: their profile, who
 * they swiped on, who it became mutual with, and what they have not read yet.
 *
 * Supabase is the source of truth once a session exists; AsyncStorage is the
 * offline cache underneath it, not a second source of truth to keep in sync by
 * hand. The flow on every mutation is: update the in-memory store and the cache
 * immediately (so the UI never waits on the network), then fire the same change
 * at Supabase in the background. The flow on launch is the mirror image: read
 * the cache first so nothing flashes empty, then reconcile from Supabase once
 * it answers and let the network's version win.
 *
 * In local mode — no project configured, or no session yet — this behaves
 * exactly as it always has: AsyncStorage only, nothing to reconcile.
 */

const STORAGE_KEY = 'freq:state:v2';

export type ProfileDraft = Pick<Me, 'name' | 'age' | 'campus'> & {
  lookingFor: string | null;
};

export type PersistedState = {
  profile: Partial<ProfileDraft>;
  onboarded: boolean;
  /** Everyone you swiped right on, matched or not. */
  likedIds: string[];
  /** Everyone you swiped left on — they do not come back. */
  passedIds: string[];
  /** Mutual: you both swiped right. Only these unseal a face and open a thread. */
  matchIds: string[];
  /** Threads with something in them you have not opened. */
  unreadIds: string[];
  /** Which artist you chose to meet people through. Null falls back to your top. */
  cardArtist: string | null;
};

const EMPTY: PersistedState = {
  profile: {},
  onboarded: false,
  likedIds: [],
  passedIds: [],
  matchIds: [],
  unreadIds: [],
  cardArtist: null,
};

let state: PersistedState = EMPTY;
let hydrated = false;
/** Set once a session's corpus + snapshot have been reconciled, so it only runs once per session. */
let reconciledFor: string | null = null;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function persist(): void {
  // Fire-and-forget: a failed write must never block or crash a gesture.
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

function setState(next: PersistedState): void {
  state = next;
  emit();
  persist();
}

const arr = (value: unknown): string[] => (Array.isArray(value) ? value : []);

/**
 * Load the cache and re-apply the saved profile onto the seed.
 *
 * Called once at app start, before the first paint that depends on it. This is
 * step one of two — step two is `reconcileWithSupabase`, called separately once
 * a session is known, so the very first paint never waits on the network.
 */
export async function hydrateStore(): Promise<void> {
  if (hydrated) return;
  hydrated = true;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    state = {
      profile: parsed.profile ?? {},
      onboarded: parsed.onboarded === true,
      likedIds: arr(parsed.likedIds),
      passedIds: arr(parsed.passedIds),
      matchIds: arr(parsed.matchIds),
      unreadIds: arr(parsed.unreadIds),
      cardArtist: parsed.cardArtist ?? null,
    };

    // Push the saved identity back into the seed profile so every screen that
    // already reads `getMe()` picks it up with no further wiring.
    const { name, age, campus } = state.profile;
    const patch: Partial<Me> = {};
    if (name) patch.name = name;
    if (typeof age === 'number') patch.age = age;
    if (campus) patch.campus = campus;
    if (Object.keys(patch).length > 0) updateMe(patch);

    emit();
  } catch {
    // Corrupt or unreadable state should start the user clean, not crash them.
    state = EMPTY;
  }
}

/**
 * Step two: once a session exists, load the DB-backed corpus and overwrite the
 * cache with the network's version of likes/passes/matches/unread/card artist.
 *
 * Idempotent per session (`reconciledFor` guards it), safe to call from a
 * `useEffect` on every render, and a no-op — not an error — for local mode or a
 * corpus/snapshot fetch that fails, since the cache is already a complete,
 * correct answer on its own.
 */
export async function reconcileWithSupabase(session: Session | null): Promise<void> {
  if (!supabase || !session) return;
  if (reconciledFor === session.user.id) return;

  const corpusLoaded = await loadRemoteCorpus(session);
  if (!corpusLoaded) return;

  const snapshot = await fetchRemoteSnapshot();
  if (!snapshot) return;

  reconciledFor = session.user.id;

  const profile: Partial<ProfileDraft> = { ...state.profile };
  if (snapshot.profile.name) profile.name = snapshot.profile.name;
  if (snapshot.profile.age !== null) profile.age = snapshot.profile.age;
  if (snapshot.profile.campus) profile.campus = snapshot.profile.campus;
  if (snapshot.profile.lookingFor !== null) profile.lookingFor = snapshot.profile.lookingFor;

  setState({
    ...state,
    profile,
    likedIds: snapshot.likedSlugs,
    passedIds: snapshot.passedSlugs,
    matchIds: snapshot.matchedSlugs,
    unreadIds: snapshot.unreadSlugs,
    cardArtist: snapshot.cardArtist ?? state.cardArtist,
  });

  const mePatch: Partial<Me> = {};
  if (snapshot.profile.name) mePatch.name = snapshot.profile.name;
  if (snapshot.profile.age !== null) mePatch.age = snapshot.profile.age;
  if (snapshot.profile.campus) mePatch.campus = snapshot.profile.campus;
  if (Object.keys(mePatch).length > 0) updateMe(mePatch);
}

/** Save one or more onboarding answers, and mirror them onto the live profile. */
export function saveProfile(patch: Partial<ProfileDraft>): void {
  setState({ ...state, profile: { ...state.profile, ...patch } });

  const mePatch: Partial<Me> = {};
  if (patch.name !== undefined) mePatch.name = patch.name;
  if (patch.age !== undefined) mePatch.age = patch.age;
  if (patch.campus !== undefined) mePatch.campus = patch.campus;
  if (Object.keys(mePatch).length > 0) updateMe(mePatch);

  // Push the same answer upstream. Fire-and-forget and failure-tolerant: local
  // state is already written, so onboarding never waits on the network and a
  // dropped write costs nothing.
  void syncProfile(patch).catch(() => {});
}

export function completeOnboarding(): void {
  setState({ ...state, onboarded: true });
  void syncOnboardingComplete().catch(() => {});
}

export function setCardArtist(artist: string): void {
  setState({ ...state, cardArtist: artist });
  void remoteSetCardArtist(artist).catch(() => {});
}

/** Swiped left. They leave the deck and do not return. */
export function pass(userId: string): void {
  if (state.passedIds.includes(userId)) return;
  setState({ ...state, passedIds: [...state.passedIds, userId] });
  void remotePass(userId).catch(() => {});
}

/**
 * Swiped right.
 *
 * Returns whether it matched immediately — true when they had already swiped
 * right on you. Everyone else stays pending until `confirmMatch` lands, which
 * the deck delays deliberately: the wait is the point.
 *
 * Mutuality is decided locally, synchronously, off the same `likedYou` the DB
 * row for a mock candidate was seeded with — there is nothing to await here,
 * so the UI never pauses for the network. `attempt_match` runs in the
 * background afterward to make the same decision server-side and persist it;
 * for the current mock population the two cannot disagree.
 */
export function like(userId: string): boolean {
  const user = getUserById(userId);
  const mutual = user?.likedYou === true;

  setState({
    ...state,
    likedIds: state.likedIds.includes(userId) ? state.likedIds : [...state.likedIds, userId],
    matchIds: mutual && !state.matchIds.includes(userId) ? [...state.matchIds, userId] : state.matchIds,
  });

  void remoteLike(userId).catch(() => {});

  return mutual;
}

/** A pending like came back mutual — used for the delayed match. */
export function confirmMatch(userId: string): void {
  if (state.matchIds.includes(userId)) return;
  setState({
    ...state,
    matchIds: [...state.matchIds, userId],
    unreadIds: state.unreadIds.includes(userId) ? state.unreadIds : [...state.unreadIds, userId],
  });
  void remoteConfirmMatch(userId).catch(() => {});
}

export function markRead(userId: string): void {
  if (!state.unreadIds.includes(userId)) return;
  setState({ ...state, unreadIds: state.unreadIds.filter((id) => id !== userId) });
  void remoteMarkRead(userId).catch(() => {});
}

/** Wipe everything — used by the "start over" affordance. */
export function resetStore(): void {
  reconciledFor = null;
  setState({ ...EMPTY });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PersistedState {
  return state;
}

/** Subscribe a component to persisted state. Re-renders on any change. */
export function usePersistedState(): PersistedState {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Everyone you have matched with, strongest frequency first. */
export function useMatches(): DiscoverUser[] {
  const { matchIds } = usePersistedState();
  return React.useMemo(
    () =>
      matchIds
        .map((id) => getUserById(id))
        .filter((user): user is DiscoverUser => user !== undefined)
        .sort((a, b) => b.match.score - a.match.score),
    [matchIds]
  );
}

/** True once a face has earned the right to be shown. */
export function isUnsealed(userId: string): boolean {
  return state.matchIds.includes(userId);
}
