-- In-thread games: patch_game_state, and Realtime on game_sessions.
--
-- game_* was deliberately left out of the realtime publication when messages
-- got added (see the earlier migration's comment) — this is the feature that
-- ships it.

-- ─────────────────────────────────────────────────────────────────────────────
-- patch_game_state
-- ─────────────────────────────────────────────────────────────────────────────

-- Both players write into the same `state` jsonb column, but different keys —
-- the human's own guess/value, the mock's. A client that read the row,
-- spread its own key over a local copy, and wrote the whole column back could
-- clobber whichever key the other side had just landed. `state || patch` is
-- a database-side shallow merge, so the two writers can never race each other
-- that way regardless of timing.
--
-- Deliberately SECURITY INVOKER (the default) rather than DEFINER: unlike
-- attempt_match or confirm_match, this has no privilege to elevate — the
-- point is that the update still goes through game_sessions_update_member
-- exactly as if the caller had issued the UPDATE directly. That policy already
-- covers both callers this needs to serve: `authenticated` for the human's own
-- move, and `service_role` (which bypasses RLS) for the mock's, from
-- mock-reply.
create or replace function public.patch_game_state(session_id uuid, patch jsonb)
returns table (state jsonb)
language sql
set search_path = public, pg_catalog
as $$
  update public.game_sessions
  set state = state || patch
  where id = session_id
  returning state;
$$;

grant execute on function public.patch_game_state(uuid, jsonb) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- realtime
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_sessions'
    ) then
      alter publication supabase_realtime add table public.game_sessions;
    end if;
  end if;
end
$$;
