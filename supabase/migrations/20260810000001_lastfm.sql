-- Real Last.fm data for the signed-in user's own profile.
--
-- No new tables needed: the lastfm-profile Edge Function writes straight into
-- the same top_artists/top_tracks/listening_hours/tags/energy/week columns
-- the mock corpus already populates, and upserts into artists_corpus exactly
-- the way seed_mock.sql does — score.ts has never needed to know where an
-- artist's popularity number came from, mock rank or real listener count.
--
-- lastfm_username/lastfm_synced_at are the only genuinely new state: whether
-- (and who) this account is connected as, so the UI can show "Connected as
-- x" instead of a bare form every time.

alter table public.profiles add column if not exists lastfm_username text;
alter table public.profiles add column if not exists lastfm_synced_at timestamptz;
