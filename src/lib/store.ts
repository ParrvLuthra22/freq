import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

import { updateMe, type Me } from '@/lib/seed';

/**
 * Local persistence for everything the user actually creates: their profile,
 * who they liked, and how far through onboarding they got.
 *
 * Deliberately a tiny hand-rolled store rather than a state library — the shape
 * is small, and this keeps the app dependency-free and Expo Go safe. Writes go
 * through `persist()`, which is fire-and-forget so no interaction ever waits on
 * disk.
 */

const STORAGE_KEY = 'freq:state:v1';

export type ProfileDraft = Pick<Me, 'name' | 'age' | 'campus'> & {
  lookingFor: string | null;
};

export type PersistedState = {
  profile: Partial<ProfileDraft>;
  likedIds: string[];
  onboarded: boolean;
};

const EMPTY: PersistedState = {
  profile: {},
  likedIds: [],
  onboarded: false,
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
      likedIds: Array.isArray(parsed.likedIds) ? parsed.likedIds : [],
      onboarded: parsed.onboarded === true,
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

export function toggleLike(userId: string): void {
  const liked = state.likedIds.includes(userId);
  setState({
    ...state,
    likedIds: liked
      ? state.likedIds.filter((id) => id !== userId)
      : [...state.likedIds, userId],
  });
}

export function isLiked(userId: string): boolean {
  return state.likedIds.includes(userId);
}

/** Wipe everything — used by the settings "start over" affordance. */
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

/** Convenience selector for the liked set. */
export function useLikedIds(): string[] {
  return usePersistedState().likedIds;
}
