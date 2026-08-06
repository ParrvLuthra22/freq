-- Chat: a 'song' message type, and Realtime on the messages table.
--
-- game_*, wink and mix_add stay deferred rather than added speculatively —
-- those ship with the features that produce them.

alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages add constraint messages_type_check
  check (type in ('text', 'song', 'quiz', 'flirt', 'swap', 'take', 'system'));

-- Postgres Changes only fires for tables in this publication. Guarded on both
-- sides: `pg_publication` itself only exists on a real Supabase project (there
-- is nothing to add the table to on a plain local Postgres used for migration
-- testing), and the membership check makes re-running this migration a no-op
-- instead of an error.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
  end if;
end
$$;
