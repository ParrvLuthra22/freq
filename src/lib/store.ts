import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';

import {
  getDropCandidates,
  getUserById,
  updateMe,
  type DiscoverUser,
  type Me,
} from '@/lib/seed';

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

/** Today's drop, frozen once chosen so it cannot reshuffle underneath the user. */
export type Drop = { date: string; ids: string[] };

export type PersistedState = {
  profile: Partial<ProfileDraft>;
  likedIds: string[];
  onboarded: boolean;
  drop: Drop | null;
};

const EMPTY: PersistedState = {
  profile: {},
  likedIds: [],
  onboarded: false,
  drop: null,
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
      drop: parsed.drop ?? null,
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

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Today's drop, and what is left of it.
 *
 * The set is chosen once per day and then frozen: reacting to someone spends
 * them from the drop rather than pulling a replacement in. That finiteness is
 * the product — you get a considered handful, not a feed that refills as fast
 * as you can empty it.
 */
export function useDailyDrop(): { drop: DiscoverUser[]; remaining: DiscoverUser[] } {
  const { likedIds, drop } = usePersistedState();
  const today = todayKey();
  const isCurrent = drop?.date === today;

  React.useEffect(() => {
    if (isCurrent) return;
    // Deliberately not keyed on likedIds — a new like must never re-roll the day.
    const ids = getDropCandidates(state.likedIds).map((user) => user.id);
    setState({ ...state, drop: { date: today, ids } });
  }, [isCurrent, today]);

  return React.useMemo(() => {
    if (!isCurrent || !drop) return { drop: [], remaining: [] };

    const users = drop.ids
      .map((id) => getUserById(id))
      .filter((user): user is DiscoverUser => user !== undefined);

    return { drop: users, remaining: users.filter((user) => !likedIds.includes(user.id)) };
  }, [isCurrent, drop, likedIds]);
}
