-- Support for mock users behaving on their own: a delayed like-back, and rate
-- limited / cached AI chat replies. Both are driven by Edge Functions using the
-- service-role key — neither path is reachable directly by a client.

-- ─────────────────────────────────────────────────────────────────────────────
-- confirm_match: the delayed half of a like-back.
-- ─────────────────────────────────────────────────────────────────────────────

-- attempt_match (see the earlier migration) decides mutuality from whatever is
-- true *right now*. A mock whose liked_you starts false needs to actually
-- become true a few seconds later — the mock "deciding" to like back — which
-- means inserting a real `likes` row on the mock's behalf. A mock has no
-- session and no JWT, so nothing about that write can go through RLS as the
-- mock; it can only happen through a SECURITY DEFINER path that is itself
-- locked to service_role.
--
-- Takes both ids as arguments rather than resolving the caller from auth.uid()
-- like attempt_match does: this runs from an Edge Function's background task
-- with no user JWT in scope, so there is no caller to resolve.
create or replace function public.confirm_match(user_profile_id uuid, mock_profile_id uuid)
returns table (match_id uuid)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  lo  uuid;
  hi  uuid;
  mid uuid;
begin
  insert into public.likes (from_id, to_id) values (mock_profile_id, user_profile_id)
  on conflict (from_id, to_id) do nothing;

  lo := least(user_profile_id, mock_profile_id);
  hi := greatest(user_profile_id, mock_profile_id);

  insert into public.matches (a, b) values (lo, hi)
  on conflict (a, b) do nothing
  returning id into mid;

  if mid is null then
    select id into mid from public.matches where a = lo and b = hi;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (user_profile_id, 'match', jsonb_build_object('match_id', mid, 'other_id', mock_profile_id))
  on conflict (user_id, ((payload->>'match_id'))) where type = 'match' do nothing;

  return query select mid;
end;
$$;

-- Deliberately not granted to authenticated: a client calling this directly
-- with an arbitrary pair of ids would let anyone manufacture a match with
-- anyone. Only the schedule-match Edge Function, using the service-role key,
-- is meant to reach this.
revoke all on function public.confirm_match(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_match(uuid, uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- mock_reply_usage: caching + rate limiting for mock-reply.
-- ─────────────────────────────────────────────────────────────────────────────

-- One row per generated reply, keyed to the message it replied to. The unique
-- constraint on in_reply_to is the cache: a second call for the same trigger
-- message (a retry, a double-invoke) finds the existing row and reuses
-- reply_message_id instead of paying for another completion. created_at
-- doubles as the rate-limit ledger — the Edge Function counts recent rows for
-- a profile rather than trusting anything the client claims about usage.
create table if not exists public.mock_reply_usage (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  match_id         uuid not null references public.matches (id) on delete cascade,
  in_reply_to      uuid not null unique references public.messages (id) on delete cascade,
  reply_message_id uuid references public.messages (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists mock_reply_usage_profile_created_idx
  on public.mock_reply_usage (profile_id, created_at);

-- RLS enabled with no policies for anon/authenticated: default-deny. Only the
-- Edge Function's service-role key ever reads or writes this table — it is
-- usage accounting, not something a client has any business seeing.
alter table public.mock_reply_usage enable row level security;
