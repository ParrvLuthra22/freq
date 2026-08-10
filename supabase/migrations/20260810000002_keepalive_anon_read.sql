-- Lets the keep-alive workflow (.github/workflows/supabase-keepalive.yml) run a
-- real, verifiable read against the free project with only the anon key —
-- no service-role key in a repo secret, no throwaway anonymous auth user
-- created every run. artists_corpus carries no personal data (see its
-- policy's own comment in 20260804000002_rls.sql), so exposing it read-only
-- to anon costs nothing and gives the cron a genuine 200 to assert on.

grant select on public.artists_corpus to anon;

drop policy if exists artists_corpus_select_anon on public.artists_corpus;
create policy artists_corpus_select_anon on public.artists_corpus
  for select
  to anon
  using (true);
