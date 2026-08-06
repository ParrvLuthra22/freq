-- Local-only stand-in for what Supabase provides.
--
-- NOT a migration and never applied to a real project — Supabase already ships
-- the auth schema, auth.uid() and the anon/authenticated roles. This exists so
-- the migrations can be applied against a plain Postgres to check they parse,
-- constrain and seed correctly without needing Docker or a hosted project.
--
--   createdb freq_check
--   psql -d freq_check -f supabase/tests/local_auth_stub.sql
--   psql -d freq_check -f supabase/migrations/*.sql   (in order)

create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);

-- Real Supabase reads the sub claim out of the request JWT. Locally this reads a
-- session GUC so a test can impersonate a user with `set local request.jwt.sub`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

-- On a real project service_role already has full access to every table in
-- public, on top of the RLS bypass above — that is what lets Edge Functions do
-- privileged writes. Granted explicitly here only because a fresh local
-- Postgres has nothing configuring that by default; this line has no
-- equivalent to apply against an actual Supabase project.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
