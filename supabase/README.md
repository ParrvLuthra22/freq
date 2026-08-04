# supabase

Schema, row-level security, and the mock seed.

```
migrations/
  20260804000001_init.sql        tables, constraints, indexes, triggers
  20260804000002_rls.sql         grants + RLS policies
  20260804000003_seed_mock.sql   GENERATED — 6 mock profiles + 19-artist corpus
tests/
  local_auth_stub.sql            local-only; NOT applied to a real project
```

## Applying

```bash
supabase link --project-ref <ref>
supabase db push
```

Then set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`
(see `.env.example`). Until they're set, `isSupabaseConfigured` is false and the
app runs entirely off `seed/users.json`.

## The seed migration is generated

`20260804000003_seed_mock.sql` is produced from `seed/users.json`:

```bash
python3 scripts/gen_seed_migration.py
```

Edit the seed and regenerate — never hand-edit the SQL, or the two drift. It's
idempotent (`on conflict … do update`), so re-applying updates in place. The
artist corpus is derived from the profiles themselves, so it can't disagree with
the rows referencing it.

## Verifying without Docker

`supabase start` needs Docker. Without it, the migrations can still be checked
against any local Postgres — this is what `tests/local_auth_stub.sql` is for. It
fakes the `auth` schema, `auth.uid()` and the `anon`/`authenticated` roles that a
real project already provides.

```bash
createdb freq_check
psql -d freq_check -f supabase/tests/local_auth_stub.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d freq_check -f "$f"; done
```

To exercise RLS, impersonate a user inside a transaction:

```sql
begin;
  set local role authenticated;
  set local request.jwt.sub = '<a uuid from auth.users>';
  select count(*) from public.profiles;   -- own + mock pool + matched only
rollback;
```

This proves the SQL parses, the constraints hold and the policies filter as
intended. It does **not** prove anything about Supabase's own auth, realtime or
storage behaviour — only a real project does that.

## Notes on the design

- **Mock people live in `profiles` like anyone else**, with `auth_id` null and
  `is_mock` true. The deck, scoring and matches treat them as ordinary
  candidates, so a separate table would mean branching everywhere.
- **`matches` stores one ordered pair** (`check (a < b)` plus `unique (a, b)`).
  A plain unique constraint would happily allow both `(x,y)` and `(y,x)`.
- **Grants and RLS are separate gates.** Grants say which statements a role may
  attempt; RLS says which rows it then sees. Both are stated explicitly here
  rather than inherited from project defaults, so the privilege surface is
  reviewable and the migrations are portable.
- **No client insert on `matches`.** A match is a consequence of two likes and is
  decided server-side — letting a client insert one would let anyone declare
  themselves matched and unseal a face.
- **`likes` is not readable by its recipient.** Who liked you is surfaced through
  a controlled path, not by letting clients query the table.
- **"In Discover" currently means `is_mock`.** When real users become
  discoverable, `profiles_select` is the single place that widens — and it should
  widen to an explicit `discoverable` flag, not to every row.
