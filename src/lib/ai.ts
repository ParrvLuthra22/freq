import AsyncStorage from '@react-native-async-storage/async-storage';

import { deriveArchetype } from '@/lib/archetype';
import type { Energy } from '@/lib/seed';
import { formatList } from '@/lib/utils';

/**
 * Base URL for the freq-ai Vercel proxy — never call Anthropic directly from
 * the app.
 *
 * Unset is a supported configuration, not a broken one: every feature here
 * already has a fallback derived from real listening data, and the proxy only
 * makes the wording better. This used to default to `http://localhost:3000`,
 * which meant a deployed build fired a request that could only ever fail —
 * one guaranteed connection error per profile build, per card, per thread.
 */
const AI_PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL?.trim() || null;
const REQUEST_TIMEOUT_MS = 8000;

type SharedSong = { title: string; artist: string } | null;

type PersonalityInput = {
  name: string;
  topArtists: string[];
  tags: string[];
  listeningHours: number[];
  /** Powers the derived fallback when no proxy is configured or reachable. */
  energy: Energy;
};
type PersonalityResult = { archetype: string; description: string };

type PairInput = {
  meName: string;
  matchName: string;
  reasons: string[];
  sharedArtists: string[];
  sharedSong: SharedSong;
};
type ExplanationResult = { text: string };
type IcebreakersResult = { openers: string[] };

async function callProxy<T>(type: string, payload: Record<string, unknown>): Promise<T> {
  // Callers all catch and fall back, so throwing here routes "no proxy
  // configured" down the exact path "proxy unreachable" already takes.
  if (!AI_PROXY_URL) throw new Error('No AI proxy configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_PROXY_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...payload }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AI proxy responded ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort — a cache write failure shouldn't break the feature.
  }
}

/** §6.1 — fires during "building your FREQ", cached to the profile. */
export async function getPersonality(input: PersonalityInput): Promise<PersonalityResult> {
  const cacheKey = `freq:ai:personality:${input.name}`;
  const cached = await readCache<PersonalityResult>(cacheKey);
  if (cached) return cached;

  try {
    const result = await callProxy<PersonalityResult>('personality', input);
    await writeCache(cacheKey, result);
    return result;
  } catch {
    // No proxy, or it's unreachable — never block the reveal moment on a
    // network call, and never hand back someone else's archetype. Derived
    // from this person's own listening, so it stays true either way.
    const derived = deriveArchetype({
      topArtists: input.topArtists,
      tags: input.tags,
      energy: input.energy,
      listeningHours: input.listeningHours,
    });
    return { archetype: derived.name, description: derived.description };
  }
}

/** §6.2 — fires on discovery cards + the sync moment, cached per pair. */
export async function getExplanation(pairKey: string, input: PairInput): Promise<ExplanationResult> {
  const cacheKey = `freq:ai:explanation:${pairKey}`;
  const cached = await readCache<ExplanationResult>(cacheKey);
  if (cached) return cached;

  try {
    const result = await callProxy<ExplanationResult>('explanation', input);
    await writeCache(cacheKey, result);
    return result;
  } catch {
    return { text: fallbackExplanation(input) };
  }
}

/** §6.3 — fires at the sync moment, refreshable in chat. */
export async function getIcebreakers(
  pairKey: string,
  input: PairInput,
  opts?: { refresh?: boolean }
): Promise<IcebreakersResult> {
  const cacheKey = `freq:ai:icebreakers:${pairKey}`;
  if (!opts?.refresh) {
    const cached = await readCache<IcebreakersResult>(cacheKey);
    if (cached) return cached;
  }

  try {
    const result = await callProxy<IcebreakersResult>('icebreakers', input);
    await writeCache(cacheKey, result);
    return result;
  } catch {
    return { openers: fallbackIcebreakers(input) };
  }
}

function fallbackExplanation({ reasons, sharedArtists }: PairInput): string {
  if (sharedArtists.length > 0) return `You both know ${formatList(sharedArtists)}.`;
  if (reasons.length > 0) return `${reasons.join(' — ')}.`;
  return "A stretch, but a promising one — you'll have to find out why.";
}

function fallbackIcebreakers({ sharedArtists, sharedSong }: PairInput): string[] {
  const openers: string[] = [];
  if (sharedSong) {
    openers.push(`You have ${sharedSong.title} by ${sharedSong.artist} in your rotation too — coincidence?`);
  }
  if (sharedArtists[0]) {
    openers.push(`Okay, ${sharedArtists[0]} — how deep does that go for you?`);
  }
  openers.push("What's been on repeat for you this week?");
  return openers.slice(0, 3);
}
