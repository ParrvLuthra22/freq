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
  scheduleAdmirerLike,
  scheduleMatch,
  subscribeToAdmirerLikes,
  subscribeToDelayedMatches,
} from '@/lib/remote-store';
import { syncOnboardingComplete, syncProfile } from '@/lib/profile-sync';
import {
  getMe,
  getUserById,
  updateMe,
  type DiscoverUser,
  type Me,
} from '@/lib/seed';
import { supabase } from '@/lib/supabase';
import { showLikeToast, showMatchToast } from '@/lib/toast';

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
  /** Who has liked you and you have not yet decided on — the Likes tab's inbound side. */
  admirerIds: string[];
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
  admirerIds: [],
  cardArtist: null,
};

let state: PersistedState = EMPTY;
let hydrated = false;
/** Set once a session's corpus + snapshot have been reconciled, so it only runs once per session. */
let reconciledFor: string | null = null;
/** Torn down and re-established alongside `reconciledFor`, not left running across sign-out. */
let stopWatchingForDelayedMatches: (() => void) | null = null;
let stopWatchingForAdmirerLikes: (() => void) | null = null;

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
 * Keeps `me.week` — "the artist someone is meeting people through this week,
 * the face of their card" (see seed.ts) — in sync with the chosen card
 * artist. A null `cardArtist` falls back to the top artist, same as the
 * store's own `cardArtist` field documents. This is the one place a picked
 * artist actually becomes what a candidate's deck would show for you; the
 * picker itself only ever sets the string.
 */
function applyCardArtist(artist: string | null): void {
  const me = getMe();
  const displayArtist = artist ?? me.topArtists[0]?.name ?? me.week.artist;
  if (displayArtist === me.week.artist) return;
  updateMe({
    week: { ...me.week, artist: displayArtist, stat: 'Chosen this week' },
  });
}

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
      admirerIds: arr(parsed.admirerIds),
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
    applyCardArtist(state.cardArtist);

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
export async function reconcileWithSupabase(
  session: Session | null,
): Promise<void> {
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
  if (snapshot.profile.lookingFor !== null)
    profile.lookingFor = snapshot.profile.lookingFor;

  setState({
    ...state,
    profile,
    likedIds: snapshot.likedSlugs,
    passedIds: snapshot.passedSlugs,
    matchIds: snapshot.matchedSlugs,
    unreadIds: snapshot.unreadSlugs,
    admirerIds: snapshot.admirerSlugs,
    cardArtist: snapshot.cardArtist ?? state.cardArtist,
  });

  const mePatch: Partial<Me> = {};
  if (snapshot.profile.name) mePatch.name = snapshot.profile.name;
  if (snapshot.profile.age !== null) mePatch.age = snapshot.profile.age;
  if (snapshot.profile.campus) mePatch.campus = snapshot.profile.campus;
  if (Object.keys(mePatch).length > 0) updateMe(mePatch);
  applyCardArtist(snapshot.cardArtist ?? state.cardArtist);

  // A delayed like-back confirms on the server, not on a client timer, so the
  // only way to learn it happened — on whatever screen the user is currently
  // on — is to stay subscribed for it. Guards against a slug the snapshot
  // above already knows about, which covers the instant-match case: that path
  // inserts the same `match` notification this listens for, and it must not
  // re-fire the toast for a match the optimistic update already showed.
  stopWatchingForDelayedMatches?.();
  stopWatchingForDelayedMatches = subscribeToDelayedMatches((slug) => {
    if (!state.matchIds.includes(slug)) confirmMatch(slug);
  });

  // Same idea for a fresh admirer landing live, plus the nudge that can
  // produce one — fire-and-forget, once per reconciled session. The Edge
  // Function itself decides whether anything actually happens (see
  // schedule-like's own comment).
  stopWatchingForAdmirerLikes?.();
  stopWatchingForAdmirerLikes = subscribeToAdmirerLikes((slug) =>
    receiveAdmirerLike(slug),
  );
  void scheduleAdmirerLike().catch(() => {});
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
  applyCardArtist(artist);
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
 *
 * When the server comes back and says it is genuinely not mutual yet (as
 * opposed to the call simply failing — those two cases are told apart by
 * `false` vs `null`), that is the cue to ask `schedule-match` to make it so a
 * few seconds later, server-side, rather than trusting a client-side timer to
 * still be running when it should fire.
 */
export function like(userId: string): boolean {
  const user = getUserById(userId);
  const mutual = user?.likedYou === true;

  setState({
    ...state,
    likedIds: state.likedIds.includes(userId)
      ? state.likedIds
      : [...state.likedIds, userId],
    matchIds:
      mutual && !state.matchIds.includes(userId)
        ? [...state.matchIds, userId]
        : state.matchIds,
  });

  void remoteLike(userId)
    .then((matched) => {
      if (matched === false) void scheduleMatch(userId).catch(() => {});
    })
    .catch(() => {});

  return mutual;
}

/**
 * A pending like came back mutual — the single place a match transitions from
 * "pending" to "real", whether that is the local setTimeout fallback (no
 * project configured) or a delayed confirmation arriving over realtime. Both
 * paths funnel through here, so the toast only has to be wired in one place.
 */
export function confirmMatch(userId: string): void {
  if (state.matchIds.includes(userId)) return;
  setState({
    ...state,
    matchIds: [...state.matchIds, userId],
    unreadIds: state.unreadIds.includes(userId)
      ? state.unreadIds
      : [...state.unreadIds, userId],
  });
  void remoteConfirmMatch(userId).catch(() => {});
  showMatchToast(userId);
}

/**
 * A mock sent a fresh like, landing live over realtime — the Likes-tab
 * counterpart to `confirmMatch`. Unlike a match, this never unseals a face or
 * opens a thread; it only adds them to the inbound list and surfaces a toast,
 * since liking back is still a decision the user has to make.
 */
export function receiveAdmirerLike(userId: string): void {
  if (state.admirerIds.includes(userId)) return;
  setState({ ...state, admirerIds: [...state.admirerIds, userId] });
  showLikeToast(userId);
}

export function markRead(userId: string): void {
  if (!state.unreadIds.includes(userId)) return;
  setState({
    ...state,
    unreadIds: state.unreadIds.filter((id) => id !== userId),
  });
  void remoteMarkRead(userId).catch(() => {});
}

/** Wipe everything — used by the "start over" affordance. */
export function resetStore(): void {
  reconciledFor = null;
  stopWatchingForDelayedMatches?.();
  stopWatchingForDelayedMatches = null;
  stopWatchingForAdmirerLikes?.();
  stopWatchingForAdmirerLikes = null;
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
    [matchIds],
  );
}

/** True once a face has earned the right to be shown. */
export function isUnsealed(userId: string): boolean {
  return state.matchIds.includes(userId);
}
