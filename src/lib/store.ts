import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

import { getUserById, updateMe, type DiscoverUser, type Me } from '@/lib/seed';

/**
 * Local persistence for everything the user actually creates: their profile, who
 * they swiped on, who it became mutual with, and what they have not read yet.
 *
 * Deliberately a tiny hand-rolled store rather than a state library — the shape
 * is small, and this keeps the app dependency-free and Expo Go safe. Writes go
 * through `persist()`, which is fire-and-forget so no gesture ever waits on disk.
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
 * Load persisted state and re-apply the saved profile onto the seed.
 *
 * Called once at app start, before the first paint that depends on it.
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

/** Save one or more onboarding answers, and mirror them onto the live profile. */
export function saveProfile(patch: Partial<ProfileDraft>): void {
  setState({ ...state, profile: { ...state.profile, ...patch } });

  const mePatch: Partial<Me> = {};
  if (patch.name !== undefined) mePatch.name = patch.name;
  if (patch.age !== undefined) mePatch.age = patch.age;
  if (patch.campus !== undefined) mePatch.campus = patch.campus;
  if (Object.keys(mePatch).length > 0) updateMe(mePatch);
}

export function completeOnboarding(): void {
  setState({ ...state, onboarded: true });
}

export function setCardArtist(artist: string): void {
  setState({ ...state, cardArtist: artist });
}

/** Swiped left. They leave the deck and do not return. */
export function pass(userId: string): void {
  if (state.passedIds.includes(userId)) return;
  setState({ ...state, passedIds: [...state.passedIds, userId] });
}

/**
 * Swiped right.
 *
 * Returns whether it matched immediately — true when they had already swiped
 * right on you. Everyone else stays pending until `confirmMatch` lands, which
 * the deck delays deliberately: the wait is the point.
 */
export function like(userId: string): boolean {
  const user = getUserById(userId);
  const mutual = user?.likedYou === true;

  setState({
    ...state,
    likedIds: state.likedIds.includes(userId) ? state.likedIds : [...state.likedIds, userId],
    matchIds: mutual && !state.matchIds.includes(userId) ? [...state.matchIds, userId] : state.matchIds,
  });

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
}

export function markRead(userId: string): void {
  if (!state.unreadIds.includes(userId)) return;
  setState({ ...state, unreadIds: state.unreadIds.filter((id) => id !== userId) });
}

/** Wipe everything — used by the "start over" affordance. */
export function resetStore(): void {
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
