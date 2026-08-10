// lastfm-profile
//
// Rebuilds the signed-in user's own profile from real Last.fm listening data:
// top artists/tracks, position-weighted tags (same weighting scheme
// scripts/gen_v2_seed.py uses for the mock corpus — tags_for()), an
// hour-of-day histogram derived from recent scrobble timestamps, and energy
// axes derived from that histogram plus the weighted tags. Each artist's
// Last.fm global listener count becomes its popularity/rarity signal in
// artists_corpus, on the same 0-100 "low = obscure" scale the mock corpus
// already uses — score.ts has never cared where a rank number came from.
//
// LASTFM_API_KEY lives only in this function's secrets (`supabase secrets set
// LASTFM_API_KEY=...`), never in the app.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LASTFM_API_KEY = Deno.env.get('LASTFM_API_KEY');

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

const TOP_ARTISTS_LIMIT = 10;
// How many of those top artists get an artist.getTopTags call, in the same
// rank order gen_v2_seed.py's ARTISTS lists use for position weighting.
const TAGGED_ARTISTS_LIMIT = 8;
const TOP_TRACKS_LIMIT = 10;
const RECENT_TRACKS_PAGES = 2;
const RECENT_TRACKS_PER_PAGE = 200;
const TAGS_PER_ARTIST = 3;
// Matches gen_v2_seed.py's tags_for(limit=6): up to 5 weighted tags, plus one mood tag.
const CORPUS_TAG_LIMIT = 6;

// Last.fm listener counts span a few hundred to several million; log-scaled
// onto the corpus's 0-100 popularity range so it means the same thing as
// artists_corpus.popularity and BaseProfile.topArtists[].rank elsewhere.
const MIN_LISTENERS = 100;
const MAX_LISTENERS = 5_000_000;

// Last.fm's own rule: 2-15 characters, starts with a letter, then
// letters/digits/underscores/hyphens. Mirrored client-side in lib/lastfm.ts
// for fast feedback — that copy is a courtesy, this one is the boundary.
const LASTFM_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{1,14}$/;

type LastfmArtistEntry = { name: string; playcount: string; listeners: string };
type LastfmTrackEntry = { name: string; artist: { name: string } };
type LastfmRecentTrack = { date?: { uts: string }; '@attr'?: { nowplaying?: string } };
type LastfmTag = { name: string; count: number };
type Energy = { night: number; emotional: number; highEnergy: number; exploratory: number };

async function lastfmGet(params: Record<string, string>): Promise<any> {
  const url = new URL(LASTFM_BASE);
  url.searchParams.set('api_key', LASTFM_API_KEY!);
  url.searchParams.set('format', 'json');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data?.error) {
    throw new Error(typeof data.message === 'string' ? data.message : 'Last.fm request failed');
  }
  return data;
}

function mapPopularity(listeners: number): number {
  const clamped = Math.max(MIN_LISTENERS, Math.min(MAX_LISTENERS, listeners || MIN_LISTENERS));
  const t =
    (Math.log10(clamped) - Math.log10(MIN_LISTENERS)) / (Math.log10(MAX_LISTENERS) - Math.log10(MIN_LISTENERS));
  return Math.round(Math.max(0, Math.min(1, t)) * 100);
}

/** Up to two pages of recent scrobbles, stopping early once a short page shows we hit the end of their history. */
async function fetchRecentTrackTimestamps(username: string): Promise<number[]> {
  const timestamps: number[] = [];
  for (let page = 1; page <= RECENT_TRACKS_PAGES; page += 1) {
    const data = await lastfmGet({
      method: 'user.getrecenttracks',
      user: username,
      limit: String(RECENT_TRACKS_PER_PAGE),
      page: String(page),
    });
    const tracks: LastfmRecentTrack[] = data?.recenttracks?.track ?? [];
    if (tracks.length === 0) break;
    for (const t of tracks) {
      // The currently-playing track (if any) carries no timestamp.
      if (t['@attr']?.nowplaying === 'true' || !t.date) continue;
      timestamps.push(Number(t.date.uts));
    }
    if (tracks.length < RECENT_TRACKS_PER_PAGE) break;
  }
  return timestamps;
}

/**
 * A 24-bin hour-of-day histogram, scaled so the busiest hour reads 100 — the
 * same shape the mock HOURS arrays use. Last.fm does not expose the
 * listener's timezone, so this bins in UTC: an honest limitation, not a
 * precision the data does not actually have.
 */
function deriveListeningHours(timestamps: number[]): number[] {
  const bins = new Array(24).fill(0);
  for (const uts of timestamps) {
    const hour = new Date(uts * 1000).getUTCHours();
    bins[hour] += 1;
  }
  const max = Math.max(...bins, 1);
  return bins.map((v) => Math.round((v / max) * 100));
}

/** Position-weighted tag counts across ranked top artists — identical scheme to gen_v2_seed.py's tags_for(). */
function weightedTagCounts(artistTags: string[][]): string[] {
  const counter = new Map<string, number>();
  const n = artistTags.length;
  artistTags.forEach((tags, i) => {
    const weight = Math.max(1, n - i);
    for (const tag of tags) {
      counter.set(tag, (counter.get(tag) ?? 0) + weight);
    }
  });
  return [...counter.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}

const EMOTIONAL_KEYWORDS = [
  'folk', 'singer-songwriter', 'acoustic', 'ambient', 'slowcore', 'sad', 'melancholic',
  'dream pop', 'soul', 'ballad', 'shoegaze', 'sadcore', 'chamber',
];
const HIGH_ENERGY_KEYWORDS = [
  'punk', 'metal', 'electronic', 'dance', 'techno', 'house', 'hardcore',
  'drum and bass', 'hip hop', 'hip-hop', 'rap', 'edm', 'industrial',
];
/** 12-hour label for an hour index, matching how the You tab's clock reads. */
function hourLabel(hour: number): string {
  if (hour === 0) return 'midnight';
  if (hour === 12) return 'noon';
  const suffix = hour < 12 ? 'am' : 'pm';
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`;
}

/**
 * The one-line "current frequency" blurb on the You tab.
 *
 * Derived here rather than left alone: a fresh profile row ships with template
 * copy naming a seeded artist, and leaving that in place would have the line
 * contradict the real top-artist list rendered directly beneath it — the exact
 * "why isn't this my data" tell we're trying to remove.
 */
function describeFrequency(artist: string, plays: number, listeningHours: number[]): string {
  const opener = `${artist} on heavy rotation — ${plays.toLocaleString('en-US')} plays`;
  const peak = listeningHours.reduce(
    (best, value, i) => (value > listeningHours[best] ? i : best),
    0
  );
  // An all-zero histogram means there were no recent scrobbles to read an hour
  // off of — better to say nothing than to invent a midnight habit.
  if (listeningHours[peak] === 0) return `${opener}.`;
  return `${opener}, mostly around ${hourLabel(peak)}.`;
}

const MOOD_TAG: Record<keyof Energy, string> = {
  night: 'late-night',
  emotional: 'melancholic',
  highEnergy: 'euphoric',
  exploratory: 'restless',
};

/**
 * Energy from real signal rather than authored (gen_v2_seed.py hand-wrote
 * these for the mock corpus — real listening has no equivalent to copy):
 * `night` is the share of listening that actually falls in the 12am-4am
 * bins, scaled against a uniform baseline; `emotional`/`highEnergy` come from
 * how often the weighted tags hit a curated keyword set; `exploratory` is how
 * many distinct tags showed up relative to the largest possible spread.
 */
function deriveEnergy(rawTags: string[], listeningHours: number[], taggedArtistCount: number): Energy {
  const nightHours = [0, 1, 2, 3, 4];
  const totalHours = listeningHours.reduce((a, b) => a + b, 0) || 1;
  const nightSum = nightHours.reduce((sum, h) => sum + (listeningHours[h] ?? 0), 0);
  const nightShare = nightSum / totalHours;
  const uniformShare = nightHours.length / 24;
  const night = Math.round(Math.max(0, Math.min(1, (nightShare / uniformShare) * 0.5)) * 100);

  const emotionalHits = rawTags.filter((t) => EMOTIONAL_KEYWORDS.some((k) => t.includes(k))).length;
  const highEnergyHits = rawTags.filter((t) => HIGH_ENERGY_KEYWORDS.some((k) => t.includes(k))).length;
  const emotional = Math.round(Math.min(100, 30 + emotionalHits * 15));
  const highEnergy = Math.round(Math.min(100, 30 + highEnergyHits * 15));

  const uniqueTags = new Set(rawTags).size;
  const maxPossible = Math.max(1, taggedArtistCount * TAGS_PER_ARTIST);
  const exploratory = Math.round(Math.min(100, (uniqueTags / maxPossible) * 100));

  return { night, emotional, highEnergy, exploratory };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!LASTFM_API_KEY) return jsonResponse({ error: 'Last.fm is not configured for this project.' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

  let username: string;
  try {
    const body = await req.json();
    username = typeof body.username === 'string' ? body.username.trim() : '';
    if (!username) return jsonResponse({ error: 'A Last.fm username is required' }, 400);
    // Same rule the client checks before ever calling this — that check is a
    // courtesy, this one is the boundary. Catches malformed input before it
    // ever reaches Last.fm's API, not just an empty string.
    if (!LASTFM_USERNAME_PATTERN.test(username)) {
      return jsonResponse({ error: `"${username}" isn't a valid Last.fm username.` }, 400);
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401);

  const { data: me, error: meError } = await userClient
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .single();
  if (meError || !me) return jsonResponse({ error: 'No profile for this account' }, 404);

  // Fail fast and clearly on a bad username, before doing any other work.
  try {
    await lastfmGet({ method: 'user.getinfo', user: username });
  } catch {
    return jsonResponse({ error: `Could not find a Last.fm user called "${username}".` }, 404);
  }

  let topArtistsRaw: LastfmArtistEntry[];
  let topTracksRaw: LastfmTrackEntry[];
  let recentTimestamps: number[];
  try {
    const [artistsData, tracksData, timestamps] = await Promise.all([
      lastfmGet({ method: 'user.gettopartists', user: username, period: 'overall', limit: '20' }),
      lastfmGet({ method: 'user.gettoptracks', user: username, period: 'overall', limit: String(TOP_TRACKS_LIMIT) }),
      fetchRecentTrackTimestamps(username),
    ]);
    topArtistsRaw = artistsData?.topartists?.artist ?? [];
    topTracksRaw = tracksData?.toptracks?.track ?? [];
    recentTimestamps = timestamps;
  } catch (error) {
    console.error('lastfm fetch failed', error);
    return jsonResponse({ error: 'Could not reach Last.fm right now.' }, 502);
  }

  if (topArtistsRaw.length === 0) {
    return jsonResponse({ error: `${username} has no scrobbled artists on Last.fm yet.` }, 422);
  }

  const rankedArtists = topArtistsRaw.slice(0, TOP_ARTISTS_LIMIT);
  const taggedSlice = rankedArtists.slice(0, TAGGED_ARTISTS_LIMIT);

  const tagResults = await Promise.all(
    taggedSlice.map(async (artist) => {
      try {
        const data = await lastfmGet({ method: 'artist.gettoptags', artist: artist.name });
        const tags: LastfmTag[] = data?.toptags?.tag ?? [];
        return tags
          .slice(0, TAGS_PER_ARTIST)
          .map((t) => t.name.toLowerCase())
          .filter(Boolean);
      } catch {
        return []; // A poorly-tagged artist just contributes nothing, not a failure.
      }
    })
  );

  const rawTags = weightedTagCounts(tagResults);
  const listeningHours = deriveListeningHours(recentTimestamps);
  const energy = deriveEnergy(rawTags, listeningHours, taggedSlice.length);

  const moodAxis = (Object.keys(energy) as (keyof Energy)[]).reduce((best, key) =>
    energy[key] > energy[best] ? key : best
  );
  const moodTag = MOOD_TAG[moodAxis];
  const tags = rawTags.slice(0, CORPUS_TAG_LIMIT - 1);
  if (!tags.includes(moodTag)) tags.push(moodTag);

  const topArtists = rankedArtists.map((a) => ({
    name: a.name,
    rank: mapPopularity(Number(a.listeners) || 0),
  }));
  const topTracks = topTracksRaw.map((t) => ({ title: t.name, artist: t.artist.name }));

  const topArtist = rankedArtists[0];
  const week = topArtist
    ? {
        artist: topArtist.name,
        plays: Number(topArtist.playcount) || 0,
        stat: `${topArtist.playcount} PLAYS · FROM LAST.FM`,
      }
    : undefined;

  // Everything past this point does a privileged write to artists_corpus,
  // which `authenticated` has select-only on by design — service-role is the
  // only way in, same reasoning as every mock-side write in this app.
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const corpusRows = rankedArtists.map((a, i) => ({
    name: a.name,
    popularity: mapPopularity(Number(a.listeners) || 0),
    tags: tagResults[i] ?? [],
  }));
  const { error: corpusError } = await serviceClient.from('artists_corpus').upsert(corpusRows, { onConflict: 'name' });
  if (corpusError) {
    console.error('artists_corpus upsert failed', corpusError);
  }

  // The user's own row — profiles_update_own already permits this, no
  // elevated privilege needed for a person editing their own profile.
  const { error: profileError } = await userClient
    .from('profiles')
    .update({
      top_artists: topArtists,
      top_tracks: topTracks,
      listening_hours: listeningHours,
      tags,
      energy,
      ...(week ? { week } : {}),
      ...(topArtist
        ? {
            current_frequency: describeFrequency(
              topArtist.name,
              Number(topArtist.playcount) || 0,
              listeningHours
            ),
          }
        : {}),
      lastfm_username: username,
      lastfm_synced_at: new Date().toISOString(),
    })
    .eq('id', me.id);

  if (profileError) {
    console.error('profile update failed', profileError);
    return jsonResponse({ error: 'Could not save your profile.' }, 500);
  }

  return jsonResponse({ ok: true, artistCount: topArtists.length });
});
