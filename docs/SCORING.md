# The FREQ compatibility score

`src/lib/score.ts`. Pure, dependency-free TypeScript — no network calls, no
randomness — so every number in this document is reproducible from the seed
corpus in `seed/users.json`.

This is the derivation. For the short version, see the
["How the FREQ score works"](../README.md#how-the-freq-score-works) section of
the README.

## The problem

Two people who both listen to a global megastar have told you almost nothing —
everyone listens to the megastar, so it's closer to a coin-flip than a signal.
Two people who are both deep on an artist with two hundred listeners have told
you something real. A naive "shared artists / total artists" score treats both
cases identically, which makes the number useless as a compatibility signal:
it rewards broad, mainstream taste over genuine overlap.

Every component of the score exists to weight *rarity* into the overlap, so
that a shared megastar counts for close to nothing and a shared deep cut
counts for a lot. That's the whole design, and it's why the score resembles
TF‑IDF — see below.

## The formula

### Rarity

Every shared artist or track is weighted by how rare it is before it's
counted. Artist rarity blends two independent signals:

$$
\text{rarity}(x) = 0.5 \cdot \text{globalRarity}(x) + 0.5 \cdot \text{idf}(x)
$$

$$
\text{globalRarity}(x) = 1 - \frac{\text{popularity}(x)}{100}
$$

$$
\text{idf}(x) = \frac{\ln\left(N / \text{df}(x)\right)}{\ln(N)}
$$

where `popularity(x)` is the seed's global `rank` for artist `x` (0–100, low =
obscure), `N` is the number of profiles in the corpus, and `df(x)` is how many
of those profiles list `x` among their top artists. Either signal alone is
wrong: global obscurity misses an artist who's mainstream elsewhere but
unknown on this campus, and raw corpus rarity would call a briefly-trending
artist "rare" just because the user base hasn't caught up yet. Sharing
someone who scores high on both is the strongest possible signal.

Tracks have no popularity of their own, so they inherit half their rarity
from their artist:

$$
\text{rarity}(t) = 0.5 \cdot \text{idf}(t) + 0.5 \cdot \text{rarity}\left(\text{artist}(t)\right)
$$

### Why this resembles IDF

Classic TF‑IDF's inverse-document-frequency term is $\text{idf}(t) = \ln(N /
\text{df}(t))$ — rare terms (here: artists) get more weight because they carry
more discriminating power. `score.ts`'s `idf` is exactly that, divided by
$\ln(N)$:

$$
\text{idf}(x) = \frac{\ln(N/\text{df}(x))}{\ln(N)}
$$

Dividing by $\ln(N)$ is a monotonic rescale — it changes no ordering, only
compresses the range from $[0, \ln N]$ down to $[0, 1]$, which is what lets it
blend 50/50 with `globalRarity` (already bounded to $[0, 1]$) without one
signal dominating on scale alone. So this is normalized IDF used the way
IDF is used in text similarity: weight shared *terms* (artists, tracks) by
how rare they are across the corpus, so overlap on rare terms counts more
than overlap on common ones. There's no "TF" half of TF‑IDF here, because
presence in a top-artists list is binary — a profile either has the artist in
its top list or it doesn't; there's no in-profile frequency to weight by.

### Overlap: two set measures, blended

Every shared-item score (artists, tracks) is a blend of Jaccard and the
overlap coefficient, both computed over rarity-weighted sets rather than raw
counts:

$$
\text{overlap}(A, B) = 0.4 \cdot J(A, B) + 0.6 \cdot C(A, B)
$$

$$
J(A, B) = \frac{\sum_{x \in A \cap B} w(x)}{\sum_{x \in A \cup B} w(x)}
\qquad
C(A, B) = \frac{\sum_{x \in A \cap B} w(x)}{\min\left(\sum_{x \in A} w(x),\ \sum_{x \in B} w(x)\right)}
$$

where $w(x)$ is `artistRarity(x)` or `trackRarity(x)`. Jaccard alone punishes
someone for simply listening to more artists than you — a wider library isn't
incompatibility. The overlap coefficient alone rewards a thin profile whose
three artists you happen to share, overstating the match. The blend leans
toward the coefficient because taste matching cares more about what you both
reach for than about the size of the libraries around it.

### Adjacent taste (the "depth bridge")

Artist-to-artist adjacency is rebuilt from the corpus itself — item-to-item
collaborative filtering, since there's no `related-artists` API left to call:

$$
\text{sim}(a, b) = \frac{|L_a \cap L_b|}{|L_a \cup L_b|}
$$

where $L_a$ is the set of profiles with artist $a$ in their top list. A
"bridge" is a pair (your artist, their artist) that isn't a direct hit but
has $\text{sim}(a, b) > 0.25$; the top 3 by strength are kept, and their
strengths sum and saturate:

$$
\text{adjacency} = \text{clamp}_{[0,1]}\left(\frac{\sum_{\text{bridges}} \text{strength}}{3}\right)
$$

This component is framed as *connection*, not raw adjacency, because an
earlier version measured adjacency alone and it was quietly backwards: full
direct overlap leaves nothing left over to bridge, so it scored **zero**
here and lost to a weaker pair with more gaps to span. The fix credits
direct overlap first:

$$
\text{directShare} = \frac{|\text{sharedArtists}|}{|A|}
\qquad
\text{connection} = \text{directShare} + (1 - \text{directShare}) \cdot \text{adjacency}
$$

Now direct overlap can only ever help, and full overlap resolves cleanly to
`1`. `score.test.ts` pins this exact regression.

### Tag similarity

Cosine similarity over binary tag-presence vectors:

$$
\text{tagSim}(A, B) = \frac{|T_A \cap T_B|}{\sqrt{|T_A|} \cdot \sqrt{|T_B|}}
$$

### Listening rhythm

Listening hours are a 24-bin histogram. Raw cosine similarity over
all-positive histograms scores ~0.9 for nearly everyone (everyone is awake
during the day), which carries no signal. Mean-centring (Pearson) measures
*shape* instead of magnitude — do you both spike at 2am — and the result is
remapped from $[-1, 1]$ onto $[0, 1]$:

$$
\rho = \frac{\sum_i (a_i - \bar a)(b_i - \bar b)}{\sqrt{\sum_i (a_i - \bar a)^2} \cdot \sqrt{\sum_i (b_i - \bar b)^2}}
\qquad
\text{rhythmMatch} = \frac{\rho + 1}{2}
$$

### Composite and calibration

The five components combine by their weights into a raw composite, then a
monotonic curve reshapes it for display:

$$
\text{composite} = \sum_{i} w_i \cdot c_i
\qquad
\text{score} = \text{round}\left(100 \cdot \text{composite}^{0.62}\right)
$$

where $w_i$ are the weights below and $c_i$ the five raw 0–1 component
values. Set-overlap over real libraries clusters low — even a genuinely
excellent match lands around a raw composite of 0.35, which would render as
"35%" and read as a rejection. The exponent is strictly monotonic, so it
reorders nothing and preserves every relative gap; it only spreads the range
people actually occupy across the display. The honest per-component values
are what the `/breakdown/[id]` screen shows — the curve is for the headline
number only.

## Every tunable constant

| Constant | Value | Where | Reasoning |
|---|---|---|---|
| `WEIGHTS` (artistOverlap / trackOverlap / tagSimilarity / depthBridge / rhythmMatch) | `0.30 / 0.25 / 0.20 / 0.15 / 0.10` | `score.ts:13–19` | Taken from the original spec, `docs/freq-app-plan.md` §5: "weights tunable (start ~ .30/.25/.20/.15/.10)". The ordering reflects decreasing signal strength — direct rare-artist overlap is "the magic," rhythm is the weakest, most coincidental signal. TODO(parrv): confirm whether these have been deliberately retuned since the initial spec, or are still the untouched starting values — git history shows no change to `WEIGHTS` across any commit. |
| `NIGHT_HOURS = [0, 1, 2, 3, 4]` | `score.ts:33` | The comment says these are the hours that read as "late night" in generated copy. TODO(parrv): no documented reasoning for the exact boundary — e.g. why it excludes hour 23 (11pm). |
| `RARE_RANK = 35` | `score.ts:35` | Comment ties it to the UI's "Rare" chip threshold, and the same literal `35` is duplicated (not imported) in `src/app/breakdown/[id].tsx` and `src/app/(tabs)/freq.tsx`. TODO(parrv): why `35` specifically was never documented — no record of it being derived from the seed corpus's rank distribution. |
| `0.5 / 0.5` — `artistRarity` blend of `globalRarity` and `idf` | `score.ts:124` | Comment explains *why* both signals matter (each alone is wrong) but not why the split is even. TODO(parrv): confirm whether 50/50 was a deliberate calibration or a placeholder that was never revisited. |
| `0.5 / 0.5` — `trackRarity` blend of track `idf` and artist `rarity` | `score.ts:131` | Comment is explicit and intentional: "Tracks inherit half their weight from their artist, since a track has no popularity signal of its own." |
| `0.4 / 0.6` — `weightedOverlap` blend of Jaccard and overlap coefficient | `score.ts:173` | Comment documents the *direction* ("weighted toward overlap, since taste matching cares more about what you both reach for") but not the exact split. TODO(parrv): why `0.4/0.6` rather than, say, `0.3/0.7`. |
| Adjacency saturation divisor `= 3` | `score.ts:268` | Comment: "three strong adjacencies is already a meaningful signal, and shouldn't rival a direct shared artist." |
| Bridge strength threshold `> 0.25` | `score.ts:355` | No reasoning documented. TODO(parrv): why `0.25` is the cutoff for a "strong" adjacency. |
| Bridges kept `= top 3` (`.slice(0, 3)`) | `score.ts:361` | Not cross-referenced in the comment, but consistent with the `/3` saturation divisor above — three bridges are exactly enough to saturate `adjacency`. |
| Overlap-hour multiplier `= 1.2×` | `score.ts:244` | No reasoning documented for why 1.2× a profile's own mean hour-count counts as "meaningfully above average." TODO(parrv). |
| Calibration exponent `= 0.62` | `score.ts:375` | Comment explains the *purpose* (raw composites cluster low; an excellent ~0.35 raw match shouldn't render as "35%") but the exponent itself isn't derived in-repo. For reference, $0.35^{0.62} \approx 0.52$ — a raw 35% composite displays as ~52%. TODO(parrv): confirm whether `0.62` was fit to a target midpoint or chosen by eye. |

## Edge cases

All five are covered by tests added to `src/lib/score.test.ts` in this same
change, and the numbers below are the actual values those tests assert.

**Empty history.** A profile with no top artists, tracks, tags, or listening
hours (a user who hasn't synced yet) scores exactly **0** against any other
profile — not `NaN`, not a crash. Every component has an explicit
zero-denominator guard: `weightedOverlap` returns `0` when `unionWeight` or
the smaller side is `0`; `tagCosine` returns `0` when either tag set is
empty; `rhythmSimilarity` returns `0` when either histogram has zero
variance; `connection`'s `directShare` is defined as `0` when `a.topArtists`
is empty. One subtlety: `findOverlapHours` computes `meanA`/`meanB` as `0/0`
(`NaN`) when both histograms are empty, but the loop that would use them
also has bound `n = 0`, so it never executes and the `NaN` is silently
discarded — correct, but only because the two zero-lengths are coupled.

**A single shared artist among otherwise-disjoint profiles.** Two profiles
with three artists each, sharing exactly one, score **22** (with the seed
test's flat `rank: 50`, the shared artist's raw `artistOverlap` value is
`≈0.1165`). A modest, clearly non-zero signal — enough to surface in
`sharedArtists`, not enough to dominate the score.

**Identical profiles.** Two *distinct* profiles (different ids, not a
self-comparison) with identical artists, tracks, tags, and a varied listening
histogram score **100** — the same as literal self-match. But identical
profiles whose histogram is perfectly flat (zero variance — every hour
equal) score only **94**, because Pearson correlation is undefined for a
zero-variance vector, and `rhythmSimilarity`'s `normA === 0 || normB === 0`
guard returns `0` rather than `1`. So two identical people can fail to reach
100 purely because their listening pattern has no shape to correlate on —
worth knowing if a future change wants "identical ⇒ 100" as a hard
invariant.

**A shared megastar versus a shared rare artist.** Built a 7-profile corpus
where "Megastar" appears in 5 profiles and "Deep Cut" appears only in the
compared pair, everything else held equal. The megastar-sharing pair's raw
`artistOverlap` value is `≈0.072` (final score **19**); the rare-artist pair
scores `≈0.350` on the same component (final score **31**) — roughly 5×
higher for sharing one rare artist over one ubiquitous one, out of otherwise
identical profiles. This is the core thesis, verified rather than asserted.

## Worked examples, run against the real seed corpus

Computed live against `seed/users.json` via `getPairScore`, the same call
every card and `/breakdown/[id]` actually make — not a reimplementation.
Command used:

```bash
# src/lib/scratch.test.ts — not committed, delete after running
cat > src/lib/scratch.test.ts <<'EOF'
import { getMe, getPairScore } from './seed';

test('dump scores', () => {
  void getMe(); // builds the corpus as a side effect
  for (const id of ['odessa', 'thea', 'vesper']) {
    console.log(id, JSON.stringify(getPairScore(id), null, 2));
  }
});
EOF
npx jest src/lib/scratch.test.ts --silent=false
rm src/lib/scratch.test.ts
```

### Odessa — score 89 (the strongest match in the seed deck)

| Component | Value | Contribution |
|---|---:|---:|
| Rare artist overlap | 0.7687 | 23.06 / 30 |
| Shared tracks | 0.8594 | 21.49 / 25 |
| Taste worlds | 0.8333 | 16.67 / 20 |
| Adjacent taste | 0.7500 | 11.25 / 15 |
| Listening rhythm | 0.9970 | 9.97 / 10 |

Shared artists: Grouper, Duster, Adrianne Lenker, Burial, Alex G, Cocteau
Twins. Reasons, in order: *"4 rare shared artists — Grouper, Duster"*,
*"Same song on repeat — Heavy Water / I'd Rather Be Sleeping"*, *"Both
listening past 2am"*, *"Both into slowcore and lo-fi"*. Every component is
strong here, which is what a top match looks like — this isn't one lucky
shared artist, it's convergence across all five axes.

### Thea — score 45 (mid-pack, zero track overlap)

| Component | Value | Contribution |
|---|---:|---:|
| Rare artist overlap | 0.2031 | 6.09 / 30 |
| Shared tracks | 0.0000 | 0.00 / 25 |
| Taste worlds | 0.3333 | 6.67 / 20 |
| Adjacent taste | 0.5000 | 7.50 / 15 |
| Listening rhythm | 0.7798 | 7.80 / 10 |

Shared artists: Alex G, Cocteau Twins. Reasons: *"Both deep on Alex G"*,
*"Both listening past 2am"*, *"Duster sits right next to their Slowdive"*,
*"Both into folk and shoegaze"*. Zero shared tracks doesn't tank the score —
the other four components still carry their full weight — and a single
artist under `RARE_RANK` is enough to earn the singular "Both deep on X"
phrasing rather than the generic "N shared artists" line.

### Vesper — score 35 (lowest in the seed deck, opposite clocks)

| Component | Value | Contribution |
|---|---:|---:|
| Rare artist overlap | 0.0835 | 2.50 / 30 |
| Shared tracks | 0.0000 | 0.00 / 25 |
| Taste worlds | 0.3333 | 6.67 / 20 |
| Adjacent taste | 0.5833 | 8.75 / 15 |
| Listening rhythm | 0.0707 | 0.71 / 10 |

Shared artists: Cocteau Twins (one, not rare enough to clear `RARE_RANK`, so
the reason list reads the generic *"1 shared artists"* instead of "Both deep
on..."). Reasons: *"1 shared artists"*, *"Opposite clocks — they close the
day, you open it"*, *"Alex G sits right next to their Slowdive"*, *"Both
into folk and shoegaze"*. `rhythmMatch` collapsing to `0.07` is what an
actually opposite-phase pair looks like, distinct from the near-total
absence of signal in the fully-disjoint synthetic case (`score.test.ts`
pins that floor at 9–13, driven by a faint residual rhythm correlation
rather than a genuine clash like this one).

## TODOs

- TODO(parrv): confirm whether the five component `WEIGHTS` have ever been
  deliberately retuned since the initial `docs/freq-app-plan.md` §5 spec, or
  are still the untouched starting values.
- TODO(parrv): document why `NIGHT_HOURS` ends at hour 4 rather than also
  including hour 23 (11pm).
- TODO(parrv): document why `RARE_RANK = 35` was chosen.
- TODO(parrv): confirm whether the `0.5 / 0.5` split in `artistRarity` was a
  deliberate calibration or an untuned placeholder.
- TODO(parrv): document why the `weightedOverlap` blend is `0.4 / 0.6`
  specifically, beyond the documented direction of the bias.
- TODO(parrv): document why the bridge-strength inclusion threshold is
  `> 0.25`.
- TODO(parrv): document why the overlap-hour multiplier is `1.2×` a
  profile's own mean.
- TODO(parrv): confirm whether the calibration exponent `0.62` was fit to a
  target midpoint (e.g. so a "genuinely excellent" ~0.35 raw match displays
  around 50–55%) or chosen by eye.
- TODO(parrv): decide whether "two identical profiles must score 100" should
  become a hard invariant — right now a zero-variance listening histogram
  can dock a component's full weight even between otherwise-identical
  profiles (see Edge cases above).
