import * as React from 'react';

/**
 * The "IT'S MUTUAL" toast — a global signal, not a screen's local state.
 *
 * A delayed match can land while the user is anywhere in the app: mid-swipe on
 * Discover, reading a different thread, editing their profile. `confirmMatch`
 * in `store.ts` is the single place a match transitions from "pending" to
 * "real" — both for the local setTimeout fallback and for a realtime
 * notification arriving from Supabase — so it is also the single place that
 * calls `showMatchToast`. One trigger point, shown from one component mounted
 * once at the root layout so it renders over whatever screen is active.
 */

const AUTO_DISMISS_MS = 6000;

let userId: string | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function showMatchToast(targetUserId: string): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  userId = targetUserId;
  emit();
  dismissTimer = setTimeout(dismissMatchToast, AUTO_DISMISS_MS);
}

export function dismissMatchToast(): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = null;
  userId = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string | null {
  return userId;
}

/** The slug of whoever just matched, or null when there is nothing to show. */
export function useMatchToast(): string | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
