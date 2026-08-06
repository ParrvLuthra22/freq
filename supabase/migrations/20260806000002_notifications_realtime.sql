-- The "IT'S MUTUAL" toast needs to hear about a delayed match landing on
-- whatever screen the user happens to be on, which means notifications has to
-- be part of the same publication messages already joined.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end
$$;
