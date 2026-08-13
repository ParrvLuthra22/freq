# FREQ

Music-taste dating app. You discover people by what they *actually* listen to.
Dark-first, editorial, flirty-but-refined. Expo + React Native, runs in Expo Go.

Full plan: `docs/freq-app-plan.md` — read the relevant milestone section when asked.
Brand board (visual reference): `docs/freq-brand-identity-v2.html` — open it to see the intended look.

## Non-negotiable stack rules
- **Expo SDK 54** (React Native 0.81.5, React 19.1, New Architecture).
- **Reanimated 4.1.7 — v4, not v3.** An earlier note here said SDK 54 needs v3; that is wrong. The
  sdk-54 bundled-native-modules manifest pins `~4.1.1`, which is what `expo install --fix` picks.
- **NativeWind v4** for styling (Tailwind classes). react-native-reusables for components.
- **Everything must run in Expo Go** (`npx expo start`) — verified against Expo Go 54.0.2.
  `expo-dev-client` is deliberately absent so `expo start` defaults to Expo Go. Do NOT add libraries
  that need a dev build (no Skia, no native Spotify playback SDK, no remote-push native modules).
- Graphics via **react-native-svg** (Expo Go safe). Gestures via react-native-gesture-handler.
- Use `npx expo install <pkg>` (not plain npm install) so versions match the SDK.

## Brand tokens
Dark (default):
  ink #100F0D (bg) · charcoal #1B1815 (card) · ivory #F3ECE1 (text)
  ash #8B857A (muted) · signal #E6A99E (accent) · champagne #C9B79C (luxe/data)
Light (cream):
  paper #F1E8DB (bg) · card #F8F1E6 · ink-text #171310 (text)
  taupe #726A5E (muted) · signal-deep #C67E6F (accent) · bronze #9C7C4E (luxe/data)

Define these as CSS variables in `global.css` and as Tailwind theme colors. Dark is the default.

## Typography
- Display = **Fraunces** (editorial serif; italics for the flirty accent). Headlines, scores.
- Body/UI = **Geist**. Everything functional. Sentence case, never ALL CAPS.
- Data/labels = **Geist Mono**. Scores, percentages, metadata (uppercase, wide tracking).
Build `<Display>`, `<Body>`, `<Mono>` text components once and reuse — RN has no CSS cascade,
so every text node must be styled explicitly.

## The signature component
`<FreqDial score={92} size={200} />` — react-native-svg ring + Reanimated stroke-dashoffset
draw-on animation + Fraunces number centered. It is the score, the loading state, the profile
centerpiece, and the share card. One component, reused everywhere.

## Voice (for any generated copy)
Flirty through wit, never volume. Specific and knowing — name the artist, the hour, the rare overlap.
Warm, adult, a little teasing. Sentence case, real punctuation, em dashes. Never emoji-stuffed,
never "Hey you matched!", never crude, never judgmental about anyone's taste.

## Conventions
- Expo Router (file-based). Tabs: discover / freq / sync / rooms. Onboarding is a separate stack.
- Keep components small and owned (copy-paste reusables into `components/ui`, theme to brand tokens).
- Supabase is live (Postgres + RLS, Auth, Realtime, Storage, Edge Functions). `seed/users.json` is
  the mock corpus and the fallback when no project is configured.
- After each milestone, verify `npx expo start` still loads cleanly in Expo Go before moving on.
- **Web verification cannot catch native-only breakage.** `crypto.randomUUID()` passed every web test
  and threw on the phone (Hermes has no `crypto` — use `expo-crypto`). Keyboard avoidance, file reads,
  permission prompts and the share sheet are all in this category.
- Forms need `KeyboardAvoidingView` *and* `keyboardShouldPersistTaps="handled"`; without the second,
  the first tap on a button is swallowed by the keyboard dismiss and looks like a dead button.
