-- Makes the Likes tab's inbound side real: a fresh account starts with a few
-- genuine `likes` rows already pointing at it (not just the `liked_you`
-- pretence attempt_match uses for instant matches), and a mock can send a new
-- one later in the session. Both writes need privilege a client does not have
-- — mocks have no auth_id and never sign in — so both go through
-- SECURITY DEFINER functions, same reasoning as attempt_match/confirm_match.

-- ─────────────────────────────────────────────────────────────────────────────
-- get_admirer_ids: the controlled read path likes_select_own's comment promised.
-- ─────────────────────────────────────────────────────────────────────────────

-- `likes` is deliberately unreadable by the recipient (see likes_select_own in
-- the RLS migration) so a client can never learn who liked it by querying the
-- table directly. This is the narrow, intentional exception: it returns only
-- the ids, nothing else about the row, and only for the caller's own inbox.
create or replace function public.get_admirer_ids()
returns table (from_id uuid)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select l.from_id
  from public.likes l
  where l.to_id = public.current_profile_id();
$$;

grant execute on function public.get_admirer_ids() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- seed_admirer_likes: a fresh account does not start at zero.
-- ─────────────────────────────────────────────────────────────────────────────

-- Fires once, the moment a real person's profile row is first created. Writes
-- a genuine `likes` row from every mock already flagged `liked_you` — the same
-- population attempt_match treats as having swiped first — so the Likes tab
-- has something real to show before the new user has done anything at all.
-- Guarded to real accounts only: mock profiles are also inserted through this
-- table (with auth_id null), and must never like themselves into existence.
create or replace function public.seed_admirer_likes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.auth_id is not null then
    insert into public.likes (from_id, to_id)
    select p.id, new.id
    from public.profiles p
    where p.is_mock and p.liked_you
    on conflict (from_id, to_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_seed_admirer_likes on public.profiles;
create trigger profiles_seed_admirer_likes
  after insert on public.profiles
  for each row execute function public.seed_admirer_likes();

-- ─────────────────────────────────────────────────────────────────────────────
-- send_admirer_like: the delayed, occasional half.
-- ─────────────────────────────────────────────────────────────────────────────

-- Called from the schedule-like Edge Function after its own delay and its own
-- decision about whether to fire at all — this function just does the write.
-- Takes both ids as arguments rather than resolving a caller, for the same
-- reason confirm_match does: it runs from a background task with no user JWT
-- in scope.
create or replace function public.send_admirer_like(mock_profile_id uuid, user_profile_id uuid)
returns table (sent boolean)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.likes (from_id, to_id) values (mock_profile_id, user_profile_id)
  on conflict (from_id, to_id) do nothing;

  insert into public.notifications (user_id, type, payload)
  values (user_profile_id, 'like', jsonb_build_object('from_id', mock_profile_id))
  on conflict (user_id, ((payload->>'from_id'))) where type = 'like' do nothing;

  return query select true;
end;
$$;

-- Deliberately not granted to authenticated — same reasoning as confirm_match:
-- a client calling this directly could manufacture a like from anyone to
-- anyone. Only the schedule-like Edge Function, using the service-role key, is
-- meant to reach this.
revoke all on function public.send_admirer_like(uuid, uuid) from public, anon, authenticated;
grant execute on function public.send_admirer_like(uuid, uuid) to service_role;

-- Without this, two overlapping schedule-like invocations for the same mock
-- (two tabs, a retry) would insert a second "new like" notification for the
-- same admirer — the likes insert is already idempotent via unique(from_id,
-- to_id), but the notification insert was not.
create unique index if not exists notifications_like_once
  on public.notifications (user_id, ((payload->>'from_id')))
  where type = 'like';
