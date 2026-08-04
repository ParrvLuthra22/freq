-- FREQ schema.
--
-- Shapes follow seed/users.json so the mock corpus and real rows are the same
-- thing. Scoring stays client-side (src/lib/score.ts) and reads its corpus from
-- here, so anything the algorithm consumes — ranked artists, tracks, the 24-bin
-- hour histogram, tags — has to survive the round trip intact.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────

-- `auth_id` is null for the seeded mock people: they have no login but must sit
-- in the same table, because the deck, scoring and matches all treat them as
-- ordinary candidates. `slug` keeps the seed's stable ids ("odessa") usable as
-- a lookup key on the client.
create table if not exists public.profiles (
  id                 uuid primary key default gen_random_uuid(),
  auth_id            uuid unique references auth.users (id) on delete cascade,
  slug               text unique not null,
  name               text not null,
  age                smallint check (age between 18 and 120),
  campus             text,

  archetype          jsonb not null default '{}'::jsonb,   -- {name, description}
  week               jsonb,                                -- {artist, plays, stat}
  top_artists        jsonb not null default '[]'::jsonb,   -- [{name, rank}]
  top_tracks         jsonb not null default '[]'::jsonb,   -- [{title, artist}]
  -- Exactly 24 bins, one per hour. The rhythm component is meaningless otherwise.
  listening_hours    smallint[] not null default '{}'::smallint[]
                     check (cardinality(listening_hours) in (0, 24)),
  tags               text[] not null default '{}'::text[],
  energy             jsonb not null default '{}'::jsonb,   -- {night, emotional, highEnergy, exploratory}

  -- Authored editorial copy. The algorithm supplies numbers; none of this is generated.
  reason             text,
  reason_soft        text,
  chips              jsonb not null default '[]'::jsonb,   -- [{label, rare}]
  line               text,
  flirt              text,
  song               jsonb,                                -- {title, artist} | null
  notes              jsonb not null default '{}'::jsonb,   -- {hours, rarity}

  -- Per-person content for the in-thread games.
  quiz               jsonb,                                -- {options[], answer}
  swap               jsonb,                                -- {track, verdict}
  take_answer        smallint check (take_answer between 0 and 100),
  opening_thread     jsonb not null default '[]'::jsonb,   -- [{sender, text}]

  -- Only meaningful on the signed-in user's own row.
  current_frequency  text,
  swap_picks         text[] not null default '{}'::text[],
  card_artist        text,

  is_mock            boolean not null default false,
  -- Seeded pretence that they swiped first, so liking back matches instantly.
  liked_you          boolean not null default false,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists profiles_is_mock_idx on public.profiles (is_mock);

-- ─────────────────────────────────────────────────────────────────────────────
-- artists_corpus
-- ─────────────────────────────────────────────────────────────────────────────

-- Rarity is only meaningful against a population, so the corpus is a table in
-- its own right rather than something derived per request. `popularity` is the
-- seed's `rank`: low means obscure, and under 35 renders the "Rare" chip.
create table if not exists public.artists_corpus (
  name        text primary key,
  popularity  smallint not null check (popularity between 0 and 100),
  tags        text[] not null default '{}'::text[],
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- swipes
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.likes (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references public.profiles (id) on delete cascade,
  to_id       uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (from_id, to_id),
  check (from_id <> to_id)
);

create index if not exists likes_to_id_idx on public.likes (to_id);

create table if not exists public.passes (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid not null references public.profiles (id) on delete cascade,
  to_id       uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (from_id, to_id),
  check (from_id <> to_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- matches
-- ─────────────────────────────────────────────────────────────────────────────

-- A match is one unordered pair. Storing it ordered (a < b) plus a unique
-- constraint is what actually prevents (x,y) and (y,x) both existing; a plain
-- unique(a,b) would happily allow the mirror row.
create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  a           uuid not null references public.profiles (id) on delete cascade,
  b           uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (a, b),
  check (a < b)
);

create index if not exists matches_a_idx on public.matches (a);
create index if not exists matches_b_idx on public.matches (b);

-- ─────────────────────────────────────────────────────────────────────────────
-- messages
-- ─────────────────────────────────────────────────────────────────────────────

-- `type` distinguishes plain text from the in-thread games, which are live cards
-- in the conversation rather than links out — so their state belongs in the
-- thread's own ordering, not beside it.
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  sender_id   uuid not null references public.profiles (id) on delete cascade,
  type        text not null default 'text'
              check (type in ('text', 'quiz', 'flirt', 'swap', 'take', 'system')),
  body        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists messages_match_created_idx
  on public.messages (match_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- game_sessions
-- ─────────────────────────────────────────────────────────────────────────────

-- One row per game per match. Blind Swap in particular needs somewhere neutral
-- to hold both picks before either is revealed.
create table if not exists public.game_sessions (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  game        text not null check (game in ('quiz', 'flirt', 'swap', 'take')),
  state       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (match_id, game)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- mix_tracks
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.mix_tracks (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  added_by    uuid not null references public.profiles (id) on delete cascade,
  track       jsonb not null,                       -- {title, artist}
  created_at  timestamptz not null default now()
);

create index if not exists mix_tracks_match_idx on public.mix_tracks (match_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_unread_idx
  on public.notifications (user_id, read) where read = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists game_sessions_touch_updated_at on public.game_sessions;
create trigger game_sessions_touch_updated_at
  before update on public.game_sessions
  for each row execute function public.touch_updated_at();
