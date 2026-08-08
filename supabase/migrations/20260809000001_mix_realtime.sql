-- Realtime on mix_tracks — deliberately deferred until now (see the comment
-- on the messages-realtime migration: "game_*, wink and mix_add stay
-- deferred rather than added speculatively — those ship with the features
-- that produce them"). This is that feature.
--
-- No RLS or grant changes: mix_tracks_select_member/_insert_member/_delete_own
-- (see the RLS migration) already cover everything the FREQ Mix needs — both
-- match members can read the whole mix and add their own tracks. The mock's
-- side of a contribution goes through a service-role insert from the
-- mock-mix-add Edge Function, which bypasses RLS entirely rather than needing
-- a policy of its own.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mix_tracks'
    ) then
      alter publication supabase_realtime add table public.mix_tracks;
    end if;
  end if;
end
$$;
