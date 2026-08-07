import * as React from 'react';

/**
 * The floating notification toast — a global signal, not a screen's local
 * state. Two things can land while the user is anywhere in the app: a match
 * confirming (mutual, face unseals) or a mock sending a fresh like (not yet
 * mutual, face stays sealed). `confirmMatch` and `receiveAdmirerLike` in
 * store.ts are the only two places either kind actually arrives — both for
 * the local setTimeout fallback and for a realtime notification — so they are
 * also the only two places that call into here. One trigger point per kind,
 * shown from one component mounted once at the root layout.
 */

export type ToastKind = 'match' | 'like';
type Toast = { userId: string; kind: ToastKind };

const AUTO_DISMISS_MS = 6000;

let toast: Toast | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function show(targetUserId: string, kind: ToastKind): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  toast = { userId: targetUserId, kind };
  emit();
  dismissTimer = setTimeout(dismissToast, AUTO_DISMISS_MS);
}

export function showMatchToast(targetUserId: string): void {
  show(targetUserId, 'match');
}

export function showLikeToast(targetUserId: string): void {
  show(targetUserId, 'like');
}

export function dismissToast(): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = null;
  toast = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Toast | null {
  return toast;
}

/** Whoever just matched or liked you, or null when there is nothing to show. */
export function useToast(): Toast | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
