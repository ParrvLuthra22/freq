# FREQ — App Plan of Action (v1)

*Expo + React Native. Dark-first, editorial, flirty. Built on the locked brand identity (see `freq-brand-identity-v2.html`).*

**How to use this doc:** This is yours to edit. Strike anything you disagree with, add notes inline, reorder the build. Once you've marked it up, each **milestone (M0–M6)** at the bottom becomes one Claude Code prompt. Places I need a decision from you are marked **← YOUR CALL**.

---

## 1. The stack (locked & version-verified)

| Layer | Choice | Why / note |
|---|---|---|
| Framework | **Expo SDK 54** (RN 0.81, React 19.1, New Architecture) | Runs on your phone via `npx expo start` → Expo Go |
| Routing | **Expo Router** (file-based) | Standard for Expo; tab + stack nav |
| Styling | **NativeWind v4** (Tailwind for RN) | Brand tokens become Tailwind classes |
| Components | **react-native-reusables** (shadcn-for-RN) | Copy-paste, you own the code, themable to brand |
| Animation | **Reanimated v3** ⚠️ *(NOT v4)* + **Moti** | **NativeWind requires Reanimated v3 on SDK 54.** Pin it. |
| Graphics | **react-native-svg** | The Dial, waveform, icons — works in Expo Go, no dev build |
| Gestures | **react-native-gesture-handler** | Swipe/like/pan |
| Extras | expo-linear-gradient, expo-blur, expo-image, @gorhom/bottom-sheet | All Expo-Go-safe |
| Fonts | @expo-google-fonts/fraunces + Geist + Geist Mono (or bundled TTFs) | Matches brand |
| Auth (later) | **expo-auth-session** (PKCE) | Web-based Spotify/Last.fm OAuth, works in Expo Go |
| Backend (later) | **Supabase** (auth, Postgres, storage, edge functions) | Best solo-dev choice when you go real |
| AI proxy (later) | **Vercel serverless function** (you're already set up there) | Holds the API key; the app never sees it |

**The Expo Go boundary (important).** Everything in Milestones M0–M5 runs in **Expo Go** with zero native config. You only need a **dev build** (`npx expo run:ios` / EAS) at **M6**, when you add real music playback, push notifications (FREQ Drop), or the optional Skia grain/shader polish. Design the whole showcase to live inside Expo Go first.

---

## 2. Brand → code (design tokens)

Map the locked palette into `global.css` (NativeWind CSS variables) + `tailwind.config.js`, and theme react-native-reusables to match.

```
Dark (default)                     Light (cream)
--ink        #100F0D  bg           --paper    #F1E8DB  bg
--charcoal   #1B1815  card         --card-l   #F8F1E6  card
--ivory      #F3ECE1  text         --ink-t    #171310  text
--ash        #8B857A  muted        --taupe    #726A5E  muted
--signal     #E6A99E  accent       --signal-d #C67E6F  accent
--champagne  #C9B79C  luxe/data    --bronze   #9C7C4E  luxe/data
```

Type roles → components: `<Display>` (Fraunces), `<Body>` (Geist), `<Mono>` (Geist Mono, for scores/labels). Because RN has no CSS cascade, every text node is styled explicitly — build these three wrappers once and reuse.

**Signature component: `<FreqDial score={92} size={200} />`** — react-native-svg ring + Reanimated stroke-dashoffset draw-on animation + Fraunces number in the center. This one component is the score, the loading state, the profile centerpiece, and the share card. Build it early (M1); it carries the brand.

---

## 3. Navigation / information architecture

Bottom tab bar (4), with stacks inside:

```
(tabs)
├── discover      → discovery feed → profile detail → sync moment
├── freq          → "Your FREQ" (your own identity/profile)
├── sync          → matches list → chat thread
└── rooms         → (later) events/campus rooms
+ onboarding stack (auth → connect music → building-your-FREQ → done)
+ modal: share card
```

**← YOUR CALL:** keep Rooms as a visible 4th tab from day one (empty-state teaser), or hide until later?

---

## 4. Screens, one by one

Each screen lists: **job → key components → references to study → interaction/motion → data + AI touchpoints.** For references, search the app name on **Mobbin** (or just open the app) to see the current flow — these are the closest real-world comps.

### 4.1 Onboarding & auth
- **Job:** get them in fast, set the editorial tone in the first 3 seconds.
- **Components:** full-bleed dark hero, Fraunces headline, `Button` (reusables), waveform divider.
- **References:** Hinge onboarding (warm, editorial, one question per screen); Cosmos onboarding (gallery restraint); Awwwards "editorial onboarding" for motion ideas.
- **Motion:** the waveform animates in on load (Reanimated); page transitions slide + fade.
- **Data/AI:** none yet. Name, age, campus, looking-for (Date). Campus is the private-scope key.

### 4.2 Connect music
- **Job:** the pivotal action. Spotify primary, Last.fm secondary — offer both, require one.
- **Components:** two big connect cards (Spotify / Last.fm), each with a one-line "what we read" reassurance, `Sheet` for the "why we ask" detail.
- **References:** Spotify's own OAuth consent; stats.fm connect screen; Gentler Streak permissions (calm, trustworthy framing).
- **Motion:** the tapped card fills with Signal rose and the Dial begins to draw.
- **Data/AI:** `expo-auth-session` PKCE (later). **Now (mock): a "Connect" button that just loads a mock user.** Reassurance copy in brand voice: *"We read what you actually play — not who you say you are."*

### 4.3 Building your FREQ (the analysis moment)
- **Job:** turn a boring API fetch into a *moment* — this is your Wrapped-style hook.
- **Components:** animated `<FreqDial>` filling, cycling status lines in Mono ("reading 2am habits… weighing rare taste…"), then a reveal.
- **References:** Spotify Wrapped intro sequences; stats.fm "import" animation; Gyroscope loading.
- **Motion:** orchestrated 3–4s sequence (Reanimated + Moti): dial draws → lines type → archetype card flips up. This is the one place to spend animation budget.
- **Data/AI:** **AI music-personality call fires here** (see §6.1). Output cached to the profile.

### 4.4 Your FREQ (identity / self-profile)
- **Job:** the single-player payoff — fun and shareable even with zero matches. This is your retention + acquisition engine.
- **Components:** archetype header (Fraunces + italic Signal), the energy bars, top-artists list, "current frequency" chip, a big "Share my FREQ" button.
- **References:** stats.fm profile (closest comp — literally a music-identity screen); Airbuds; Apple Fitness rings for the energy viz; Gyroscope for stat storytelling.
- **Motion:** energy bars grow on mount; pull-to-refresh re-reads "current frequency."
- **Data/AI:** archetype + description from §6.1. Energy bars derived from tags + listening rhythm (see §5), *not* Spotify audio features (deprecated).

### 4.5 Discovery
- **Job:** show people *and why you'd connect*, leading with rarity, not looks.
- **Components:** profile card = photo + `FreqDial` badge + "rare overlap" chip + shared-song row. **Hinge-style (react to specific content), not Tinder blind-swipe.**
- **References:** Hinge discovery/likes (the "like a specific thing" model); Cosmos grid; Airbuds friend feed.
- **Motion:** card enter/exit spring; like triggers a Signal-rose pulse from the Dial.
- **Data/AI:** each card shows the **compatibility explanation** (§6.2). Mock: 12–20 seed profiles with real-shaped listening data.

### 4.6 The Sync (match moment)
- **Job:** replace "It's a Match!" with "You're in sync." — the emotional peak.
- **Components:** big centered `FreqDial`, Fraunces "You're in sync", the shared-artists line, "Your song" card, "Say something" CTA that pre-loads an icebreaker.
- **References:** Hinge "we think you two should meet" / Standouts; Apple Fitness "rings closed" celebration; your iMessage reference for what comes next.
- **Motion:** the two users' dials converge into one; subtle haptic (expo-haptics) on reveal.
- **Data/AI:** **icebreakers generated here** (§6.3).

### 4.7 Chat (iMessage-familiar)
- **Job:** kill the blank-chat problem; keep it warm and specific.
- **Components:** bubble list (Signal-rose sent / charcoal received, per brand), a system "opener" chip at the top, composer with a "🎵 send a song" action.
- **References:** iMessage (your ref); Hinge chat (opens with the liked content as context); Airbuds song-sharing.
- **Motion:** bubble spring-in; typing indicator.
- **Data/AI:** the auto-opener is the chosen icebreaker. "Send a song" attaches a track card. Mock: scripted threads.

### 4.8 Share card (modal)
- **Job:** the viral loop — a beautiful card for Instagram Stories.
- **Components:** 9:16 card rendering `FreqDial` + archetype + top stats + wordmark, "Save / Share" via expo-sharing; captured with react-native-view-shot.
- **References:** Spotify Wrapped share cards; stats.fm share; BeReal.
- **Data/AI:** pure composition of existing data. Two variants: "My FREQ" (solo) and "You × Them" (pair).

---

## 5. The compatibility algorithm (genuinely working)

Since Spotify killed *related artists* and *audio features*, the working score uses **surviving Spotify data + Last.fm**. Five weighted components → a 0–100 **FREQ Score**, plus a machine-readable reason list that feeds the AI explanation.

**Inputs (per user):** top artists & tracks (Spotify `/me/top/*` + Last.fm), recently-played timestamps (listening rhythm), artist genres (Spotify single-artist) + Last.fm tags, and Last.fm `artist.getSimilar` (to rebuild taste-depth).

| # | Component | How | Signal it captures |
|---|---|---|---|
| 1 | **Rarity-weighted artist overlap** | Jaccard, but each shared artist weighted by *inverse popularity* across your user base (TF-IDF style) | Sharing a niche artist ≫ sharing a megastar — **the magic** |
| 2 | **Rarity-weighted track overlap** | Same, on tracks | Strongest "wait, you too?" hits |
| 3 | **Genre/tag cosine similarity** | Build a tag vector per user from their artists' tags; cosine between vectors | Compatible *worlds* even without identical artists |
| 4 | **Taste-depth bridge** | Credit near-misses: A's artist appears in the `getSimilar` set of B's artist | Recovers the dead "Frank Ocean → Daniel Caesar" logic via Last.fm |
| 5 | **Listening-rhythm match** | 24-bin hour histogram from recently-played; cosine similarity | "Both 2am listeners" — the flirty red-flag line |

`FREQ = 100 × Σ(wᵢ · componentᵢ)`, weights tunable (start ~ .30/.25/.20/.15/.10). **Rarity needs a corpus** (all users' artist counts) — precompute over the mock set now; maintain counts in Supabase later.

**The output is two things:** the number, and a ranked reason list (e.g. `["3 rare shared artists", "both late-night", "opposite top albums"]`) — the reasons are what make the AI explanation feel true instead of generic.

---

## 6. AI feature set (specced)

All AI runs through the **Vercel proxy** (holds your API key; the RN app calls the proxy, never the model directly — **never put an API key in the app**). Every prompt gets the **brand voice guide** in its system prompt so output stays flirty-but-refined. Cache aggressively (personality per user; explanation/icebreakers per pair).

### 6.1 Music personality
- **In:** top artists + genres/tags + listening rhythm. **Out:** an archetype name (from a *controlled list* so names stay consistent — "The Midnight Romantic," etc.) + a 2-sentence editorial description.
- **Fires:** during "Building your FREQ" (§4.3). Cached to profile.

### 6.2 Compatibility explanation
- **In:** the ranked reason list from §5 + both users' overlap specifics. **Out:** 1–2 sentences in voice explaining *why* you match.
- **Fires:** on discovery card + sync moment. Cached per pair.

### 6.3 Smart icebreakers
- **In:** shared-music specifics (rare artist, shared song, rhythm clash). **Out:** 2–3 openers in voice.
- **Fires:** at the sync moment; refreshable in chat.

**← YOUR CALL:** other AI features on your wishlist? (e.g., AI-generated FREQ Mix playlist description, "explain my taste" deep-dive, weekly FREQ Drop copy.) List them and I'll spec them in.

---

## 7. Data strategy

- **Now (M0–M5): mock-first.** One local `seed/users.json` with 12–20 fake users carrying real-shaped listening data (top artists/tracks with popularity ranks, hour histograms, tags). Everything — discovery, scoring, matching, chat — runs off this. This is what lets you *showcase the design* immediately, exactly as you wanted.
- **Later (M6): real.** Supabase (auth + Postgres + storage + edge functions). Spotify/Last.fm via expo-auth-session. Artist-frequency table for rarity. Push via expo-notifications (needs dev build).

---

## 8. Build order — each milestone = one Claude Code prompt

| M | Milestone | Ships | Expo Go? |
|---|---|---|---|
| **M0** | **Scaffold** | Expo SDK 54 + Router + NativeWind v4 + Reanimated v3 + react-native-reusables + fonts + brand tokens + tab skeleton | ✅ |
| **M1** | **Design system in code** | `<FreqDial>`, waveform, `<Display/Body/Mono>`, themed buttons/cards, light+dark toggle | ✅ |
| **M2** | **Static screens on mock data** | Your FREQ, discovery card, sync moment, chat UI — all reading `users.json` | ✅ |
| **M3** | **Flows & motion** | Onboarding → connect → building-your-FREQ sequence, swipe/like gestures, share card | ✅ |
| **M4** | **Real algorithm** | §5 scoring computed live over mock users + reason lists | ✅ |
| **M5** | **AI features** | §6 via Vercel proxy (personality, explanation, icebreakers) | ✅ |
| **M6** | **Go real** *(later)* | Spotify/Last.fm auth, Supabase, push, optional Skia grain | ⚠️ dev build |

**M2 is your "cool showcase" checkpoint** — after it, the app looks and feels like FREQ, fully navigable, on your phone.

---

## 9. Open decisions (edit these, then we write M0)

1. Rooms as a 4th tab now, or later? (§3)
2. Additional AI features to spec? (§6)
3. Discovery model — confirm **Hinge-style like-a-thing**, not Tinder blind-swipe? (§4.5)
4. Photos in the mock data — use abstract gradient placeholders (on-brand, no faces) or sourced stock portraits?
5. Archetype list — want me to write the full set (8–10 names + descriptions) as part of M1?
6. Anything in the brand you want to tweak before it hardens into code?

---

*Next step after your edits: I turn M0 (and each milestone in turn) into a ready-to-paste Claude Code prompt that references the brand file and this plan.*
