-- attempt_match: the only way a match row can come into existence.
--
-- profiles_select and the matches table deliberately have no client insert
-- policy — a client declaring its own match would let anyone unseal a face.
-- But mock candidates never write their own `likes` row (they have no
-- auth_id), so "liking someone who already liked you" needs a path that can
-- see liked_you and decide mutuality on the server, not trust a client-supplied
-- boolean. This function is that path: it always records the caller's like,
-- and only inserts a match when it can prove mutuality itself — either a real
-- reciprocal like row, or the target being a seeded mock with liked_you = true.

create or replace function public.attempt_match(target_profile_id uuid)
returns table (match_id uuid, matched boolean)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  me          uuid := public.current_profile_id();
  target_mock boolean;
  target_liked_you boolean;
  reciprocal  boolean;
  lo          uuid;
  hi          uuid;
  mid         uuid;
begin
  if me is null then
    raise exception 'attempt_match: no profile for caller';
  end if;
  if me = target_profile_id then
    raise exception 'attempt_match: cannot match yourself';
  end if;

  select is_mock, liked_you into target_mock, target_liked_you
  from public.profiles where id = target_profile_id;

  if not found then
    raise exception 'attempt_match: target profile does not exist';
  end if;

  -- Always record the swipe itself, whether or not it turns out mutual.
  insert into public.likes (from_id, to_id) values (me, target_profile_id)
  on conflict (from_id, to_id) do nothing;

  select exists (
    select 1 from public.likes where from_id = target_profile_id and to_id = me
  ) into reciprocal;

  if not (reciprocal or (target_mock and target_liked_you)) then
    return query select null::uuid, false;
    return;
  end if;

  lo := least(me, target_profile_id);
  hi := greatest(me, target_profile_id);

  insert into public.matches (a, b) values (lo, hi)
  on conflict (a, b) do nothing
  returning id into mid;

  if mid is null then
    select id into mid from public.matches where a = lo and b = hi;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (me, 'match', jsonb_build_object('match_id', mid, 'other_id', target_profile_id))
  on conflict (user_id, ((payload->>'match_id'))) where type = 'match' do nothing;

  return query select mid, true;
end;
$$;

-- Without this, calling attempt_match twice for the same pair (a retry after a
-- dropped connection, a double-tap) would insert a second "it's mutual"
-- notification and inflate the unread badge — the match insert is already
-- idempotent via unique(a,b), but the notification insert was not.
create unique index if not exists notifications_match_once
  on public.notifications (user_id, ((payload->>'match_id')))
  where type = 'match';

grant execute on function public.attempt_match(uuid) to authenticated;
