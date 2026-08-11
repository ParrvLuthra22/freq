# FREQ

Music-taste dating app. You discover people by what they actually play — not a
photo, not a bio.

**Live demo → [freq-sand.vercel.app](https://freq-sand.vercel.app)** (no account
needed; "Try the demo" signs you in anonymously)

The signature mechanic: **faces stay sealed.** Before a mutual match you see a
name, their artist of the week, and your musical overlap. Their avatar is their
own album sleeve, blurred, with a "?". Only a mutual swipe unseals the face.

---

## The algorithm

`src/lib/score.ts` is the point of the project. Five weighted components produce
a 0–100 compatibility score plus a ranked, machine-readable reason list:

| Component | Weight | What it measures |
|---|---|---|
| Rarity-weighted artist overlap | ×0.30 | Shared artists, weighted by how obscure they are both globally and in this user base |
| Shared tracks | ×0.25 | Same, at track level |
| Taste worlds | ×0.20 | Cosine similarity over genre tags |
| Adjacent taste | ×0.15 | Item-item CF — your artist sits next to theirs in the corpus |
| Listening rhythm | ×0.10 | Pearson over a 24-bin hour histogram |

Design decisions worth naming:

- **Rarity is the whole point.** Sharing a megastar is worth almost nothing;
  sharing someone with 200 listeners is the signal. Every overlap is weighted by
  a blend of global obscurity and inverse document frequency.
- **Jaccard and overlap coefficient are blended**, because each fails alone.
  Jaccard punishes people who simply listen to more than you; overlap
  coefficient over-rewards a thin profile.
- **Rhythm uses Pearson, not raw cosine.** Raw cosine on all-positive histograms
  scores ~0.9 for everyone, which makes the component useless. Mean-centring
  measures *shape* — do you both spike at 2am.
- **Adjacent taste is framed as connection**, `directShare + (1 - directShare) ×
  adjacency`. Measuring adjacency alone inverted the component: the more two
  people genuinely shared, the less non-overlapping taste was left to bridge, so
  the strongest matches scored zero and lost to weaker ones. There is a
  regression test pinning this.
- **The displayed score is `raw^0.62`.** Presentation only — strictly monotonic,
  so it reorders nothing. Real set-overlap lands around 0.35 even for an
  excellent match, which would render as "35%" and read as a rejection.
  `/breakdown/[id]` shows the honest, untouched per-component values.

Verified by `npm test`: self-match scores **100**, fully-disjoint profiles score
**11** (not 0 — a faint rhythm correlation survives), and the seeded deck holds
its documented order: Odessa 89 > Rune 74 > Marlowe 61 > Thea 45 > Juno 37 >
Vesper 35.

---

## Stack

- **Expo SDK 57**, React Native 0.86, React 19.2, Expo Router (file-based)
- **Reanimated v4.5** — required; RN 0.86 removed a shim v3 depends on
- **NativeWind v4**, react-native-svg, gesture-handler, AsyncStorage
- **Supabase** — Postgres, Auth, Realtime, Edge Functions
- Scoring stays **client-side** and pure; it reads its corpus from the DB
- Deploys as an **Expo web export → Vercel**

## Running it

```bash
npm install
cp .env.example .env    # fill in the Supabase values
npx expo start
```

The app runs fully without a backend. With no Supabase project configured,
`isSupabaseConfigured` is false and everything reads from `seed/users.json` —
discovery, matching, scoring and chat all work against the mock corpus.

```bash
npm test        # Jest — the scoring algorithm and archetype derivation
npm run lint
npx tsc --noEmit
```

## Environment

| Variable | Required | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | for the backend | Public by design |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | for the backend | Public by design — only useful alongside RLS. **Never** put the service-role key in an `EXPO_PUBLIC_` var |
| `EXPO_PUBLIC_AI_PROXY_URL` | no | Optional. Unset means every AI feature uses its derived fallback |

Edge-function secrets (set with `supabase secrets set`, never in the app
bundle):

| Secret | Required | Notes |
|---|---|---|
| `LASTFM_API_KEY` | for Last.fm connect | Without it, `lastfm-profile` refuses every request |
| `LLM_API_KEY` | for mock replies | Absent means mock matches stay silent rather than failing |
| `LLM_BASE_URL` | no | Defaults to Groq. Any OpenAI-compatible endpoint works |
| `LLM_MODEL` | no | Defaults to `llama-3.3-70b-versatile` |

`mock-reply` speaks the OpenAI chat-completions shape, so the provider is a
config choice rather than a code one:

| Provider | `LLM_BASE_URL` | Free tier |
|---|---|---|
| **Groq** (default) | `https://api.groq.com/openai/v1` | ~1,000 req/day, no card |
| OpenRouter | `https://openrouter.ai/api/v1` | 50 req/day until $10 credit |
| Cerebras | `https://api.cerebras.ai/v1` | ~1M tokens/day |

The function caps itself at 20 replies/hour per profile and 200/hour globally,
so a runaway demo can't exhaust a free tier or a budget.

## Backend

```bash
supabase link --project-ref <ref>
supabase db push
supabase functions deploy <name>
```

Migrations live in `supabase/migrations/`. The mock-seed migration is
**generated** from `seed/users.json` by `scripts/gen_seed_migration.py` — edit
the seed and regenerate rather than hand-editing the SQL, or the two drift.

Anonymous sign-ins must be enabled for the demo login to work.

## Deploying

Vercel builds from `vercel.json` (`expo export -p web` → `dist`, with an SPA
rewrite so dynamic routes like `/chat/[id]` resolve client-side).

Two GitHub Actions workflows:

- **Test** — runs `npm ci && npm test` on every push and PR
- **Supabase keep-alive** — every 3 days, queries `artists_corpus` with only the
  anon key so the free project never auto-pauses

## What's real and what isn't

Honest inventory, since this is a portfolio piece as much as a product:

**Real** — the scoring algorithm, rarity weighting and corpus stats; Last.fm
connect (rebuilds your profile from actual scrobbles); Supabase auth, matching,
realtime chat, the shared Mix, and the in-thread games; offline caching.

**Mock** — the Spotify button proceeds without any OAuth; candidate profiles are
seeded rather than real users; mock matches reply via an Edge Function, and only
when `ANTHROPIC_API_KEY` is set.

**Optional** — the AI proxy (`../freq-ai`) improves archetype, explanation and
icebreaker copy. Every one of those has a fallback derived from real listening
data, so an unset proxy costs polish, not correctness.

## Layout

```
src/
  app/            Expo Router routes — tabs, onboarding, chat, mix, reveal
  components/     Owned UI primitives, themed to the brand tokens
  lib/
    score.ts      The algorithm
    archetype.ts  Archetype derived from listening data
    store.ts      useSyncExternalStore over AsyncStorage
    chat.ts       Messages + realtime
supabase/
  migrations/     Schema, RLS, generated seed
  functions/      Edge Functions
seed/users.json   Mock corpus
```
