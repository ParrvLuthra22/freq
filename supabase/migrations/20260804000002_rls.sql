-- Row-level security.
--
-- Default deny: RLS is enabled on every table and nothing is readable or
-- writable without a policy that names it. The seeded mock people have no
-- auth_id, so they can never be impersonated — they are readable as candidates
-- and writable by nobody.

-- ─────────────────────────────────────────────────────────────────────────────
-- helpers
-- ─────────────────────────────────────────────────────────────────────────────

-- Maps the JWT to a profile row.
--
-- SECURITY DEFINER on purpose: policies on `profiles` call this, and a policy
-- that re-queried `profiles` under RLS would recurse. Definer runs it as the
-- owner, bypassing RLS for this one narrow lookup. search_path is pinned so the
-- elevated function cannot be redirected by a caller-controlled path.
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select id from public.profiles where auth_id = auth.uid();
$$;

-- Whether the caller is one of the two people in a match. Also definer, so the
-- messages/mix policies do not depend on the caller being able to read `matches`.
create or replace function public.is_match_member(match uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = match
      and public.current_profile_id() in (m.a, m.b)
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- grants
-- ─────────────────────────────────────────────────────────────────────────────

-- Two separate gates, and both have to be right: GRANT decides which statements
-- a role may attempt, RLS decides which rows it then sees. A hosted Supabase
-- project grants these by default, but stating them here keeps the migrations
-- portable and makes the privilege surface reviewable in one place rather than
-- inherited invisibly.
--
-- Least privilege on purpose: no delete on matches or messages, and no insert
-- on matches or notifications — those are service-role concerns.
grant usage on schema public to anon, authenticated;

grant select, insert, update          on public.profiles       to authenticated;
grant select                          on public.artists_corpus to authenticated;
grant select, insert, delete          on public.likes          to authenticated;
grant select, insert, delete          on public.passes         to authenticated;
grant select                          on public.matches        to authenticated;
grant select, insert                  on public.messages       to authenticated;
grant select, insert, update          on public.game_sessions  to authenticated;
grant select, insert, delete          on public.mix_tracks     to authenticated;
grant select, update                  on public.notifications  to authenticated;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.is_match_member(uuid) to authenticated;

alter table public.profiles       enable row level security;
alter table public.artists_corpus enable row level security;
alter table public.likes          enable row level security;
alter table public.passes         enable row level security;
alter table public.matches        enable row level security;
alter table public.messages       enable row level security;
alter table public.game_sessions  enable row level security;
alter table public.mix_tracks     enable row level security;
alter table public.notifications  enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────

-- Readable: your own row, anyone in the discoverable pool, and anyone you have
-- matched with.
--
-- "In Discover" currently means the seeded candidate pool (is_mock). Once real
-- users are discoverable this predicate is the single place that widens — and it
-- should widen to an explicit `discoverable` flag rather than "every profile",
-- since this table holds the whole population.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select
  to authenticated
  using (
    auth_id = auth.uid()
    or is_mock
    or exists (
      select 1 from public.matches m
      where public.current_profile_id() in (m.a, m.b)
        and profiles.id in (m.a, m.b)
    )
  );

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert
  to authenticated
  with check (auth_id = auth.uid());

-- `with check` as well as `using`, or a row could be updated into someone
-- else's ownership.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  to authenticated
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- artists_corpus — read-only reference data
-- ─────────────────────────────────────────────────────────────────────────────

-- Rarity is relative to the whole population, so every signed-in user needs the
-- full corpus for scoring. It carries no personal data. Writes are service-role
-- only, which needs no policy.
drop policy if exists artists_corpus_select on public.artists_corpus;
create policy artists_corpus_select on public.artists_corpus
  for select
  to authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- likes / passes — yours only
-- ─────────────────────────────────────────────────────────────────────────────

-- Deliberately not readable by the recipient. Who liked you is surfaced through
-- a controlled path, not by letting clients query the likes table.
drop policy if exists likes_select_own on public.likes;
create policy likes_select_own on public.likes
  for select to authenticated
  using (from_id = public.current_profile_id());

drop policy if exists likes_insert_own on public.likes;
create policy likes_insert_own on public.likes
  for insert to authenticated
  with check (from_id = public.current_profile_id());

drop policy if exists likes_delete_own on public.likes;
create policy likes_delete_own on public.likes
  for delete to authenticated
  using (from_id = public.current_profile_id());

drop policy if exists passes_select_own on public.passes;
create policy passes_select_own on public.passes
  for select to authenticated
  using (from_id = public.current_profile_id());

drop policy if exists passes_insert_own on public.passes;
create policy passes_insert_own on public.passes
  for insert to authenticated
  with check (from_id = public.current_profile_id());

drop policy if exists passes_delete_own on public.passes;
create policy passes_delete_own on public.passes
  for delete to authenticated
  using (from_id = public.current_profile_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- matches — read-only to members
-- ─────────────────────────────────────────────────────────────────────────────

-- No insert policy: a match is a consequence of two likes, decided server-side.
-- Letting a client insert one would let anyone declare themselves matched and
-- thereby unseal a face.
drop policy if exists matches_select_member on public.matches;
create policy matches_select_member on public.matches
  for select to authenticated
  using (public.current_profile_id() in (a, b));

-- ─────────────────────────────────────────────────────────────────────────────
-- messages / game_sessions / mix_tracks — members of that match only
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists messages_select_member on public.messages;
create policy messages_select_member on public.messages
  for select to authenticated
  using (public.is_match_member(match_id));

-- Membership *and* authorship: a member may not post as the other person.
drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages
  for insert to authenticated
  with check (
    public.is_match_member(match_id)
    and sender_id = public.current_profile_id()
  );

drop policy if exists game_sessions_select_member on public.game_sessions;
create policy game_sessions_select_member on public.game_sessions
  for select to authenticated
  using (public.is_match_member(match_id));

drop policy if exists game_sessions_write_member on public.game_sessions;
create policy game_sessions_write_member on public.game_sessions
  for insert to authenticated
  with check (public.is_match_member(match_id));

drop policy if exists game_sessions_update_member on public.game_sessions;
create policy game_sessions_update_member on public.game_sessions
  for update to authenticated
  using (public.is_match_member(match_id))
  with check (public.is_match_member(match_id));

drop policy if exists mix_tracks_select_member on public.mix_tracks;
create policy mix_tracks_select_member on public.mix_tracks
  for select to authenticated
  using (public.is_match_member(match_id));

drop policy if exists mix_tracks_insert_member on public.mix_tracks;
create policy mix_tracks_insert_member on public.mix_tracks
  for insert to authenticated
  with check (
    public.is_match_member(match_id)
    and added_by = public.current_profile_id()
  );

drop policy if exists mix_tracks_delete_own on public.mix_tracks;
create policy mix_tracks_delete_own on public.mix_tracks
  for delete to authenticated
  using (added_by = public.current_profile_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- notifications — yours only
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = public.current_profile_id());

-- Update only, so a client can mark something read but cannot invent a
-- notification for itself or anyone else.
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());
