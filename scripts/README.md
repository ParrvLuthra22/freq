# scripts

One-off maintenance scripts. Run from the repo root.

- **`gen_v2_seed.py`** — regenerates `seed/users.json` from the v2 prototype's data. Authors the ranked artist lists the live `src/lib/score.ts` needs (the prototype only ships hardcoded scores) and derives each person's tags from their artists. Run with `python3 scripts/gen_v2_seed.py`; edit the script, never `seed/users.json` directly, or the next run will overwrite you.
- **`reset-project.js`** — Expo's scaffold reset (`npm run reset-project`).
