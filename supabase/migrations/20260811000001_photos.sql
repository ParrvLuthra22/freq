-- Profile photos, and the privacy model that makes "sealed until matched" true.
--
-- The product promise is that nobody sees your face before a mutual match. That
-- is only a real promise if it holds at the storage layer, not just in the UI —
-- so the bucket is private, there is no select policy for anon or authenticated
-- on the objects themselves, and the ONLY read path is a short-lived signed URL
-- minted by the `photo-url` Edge Function after it has verified a match.
--
-- Writes are different: a user manages their own photos directly from the
-- client, so owner-scoped insert/update/delete policies live here rather than
-- behind a function. Ownership is encoded in the object path — the first path
-- segment is the owner's profile id — which is what the policies check.

-- ─────────────────────────────────────────────────────────────────────────────
-- table
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.profile_photos (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  -- Path inside the `profile-photos` bucket: "<profile_id>/<uuid>.jpg".
  path        text not null unique,
  -- 0-based display order. The primary photo is not implied by position, since
  -- someone may want their third photo to be the one a match unseals.
  position    integer not null default 0,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists profile_photos_profile_idx
  on public.profile_photos (profile_id, position);

-- At most one primary per profile, enforced by the database rather than by
-- whichever client wrote last.
create unique index if not exists profile_photos_one_primary
  on public.profile_photos (profile_id)
  where is_primary;

-- A cap the UI also states (1–6). Enforced here so a direct API call cannot
-- quietly exceed it.
create or replace function public.enforce_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if (select count(*) from public.profile_photos where profile_id = new.profile_id) >= 6 then
    raise exception 'A profile can hold at most 6 photos';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_photos_limit on public.profile_photos;
create trigger profile_photos_limit
  before insert on public.profile_photos
  for each row execute function public.enforce_photo_limit();

-- ─────────────────────────────────────────────────────────────────────────────
-- match helper
-- ─────────────────────────────────────────────────────────────────────────────

-- Whether the caller and `target` are mutually matched. Definer, like
-- `is_match_member`, so a policy using it does not also require the caller to
-- be able to read `matches` directly.
create or replace function public.has_mutual_match_with(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.matches m
    where (m.a = public.current_profile_id() and m.b = target)
       or (m.b = public.current_profile_id() and m.a = target)
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- grants + RLS on the metadata rows
-- ─────────────────────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.profile_photos to authenticated;

alter table public.profile_photos enable row level security;

-- You can always see your own rows. You can see a matched user's rows too —
-- but a row is only a path, and a path is worthless without a signed URL, so
-- this leaks nothing on its own. It is what lets a matched profile know how
-- many photos exist and which one is primary.
drop policy if exists profile_photos_select on public.profile_photos;
create policy profile_photos_select on public.profile_photos
  for select
  to authenticated
  using (
    profile_id = public.current_profile_id()
    or public.has_mutual_match_with(profile_id)
  );

drop policy if exists profile_photos_insert_own on public.profile_photos;
create policy profile_photos_insert_own on public.profile_photos
  for insert
  to authenticated
  with check (profile_id = public.current_profile_id());

drop policy if exists profile_photos_update_own on public.profile_photos;
create policy profile_photos_update_own on public.profile_photos
  for update
  to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

drop policy if exists profile_photos_delete_own on public.profile_photos;
create policy profile_photos_delete_own on public.profile_photos
  for delete
  to authenticated
  using (profile_id = public.current_profile_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- the bucket
-- ─────────────────────────────────────────────────────────────────────────────

-- `public => false`. This is the single most important line in the migration:
-- it is what stops the object URLs from resolving without a signature.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  5242880,                                  -- 5 MB, matched by the client
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owner-scoped writes. The first path segment is the owner's profile id, so
-- `(storage.foldername(name))[1]` is the ownership claim being checked.
drop policy if exists profile_photos_object_insert on storage.objects;
create policy profile_photos_object_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = public.current_profile_id()::text
  );

drop policy if exists profile_photos_object_update on storage.objects;
create policy profile_photos_object_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = public.current_profile_id()::text
  );

drop policy if exists profile_photos_object_delete on storage.objects;
create policy profile_photos_object_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = public.current_profile_id()::text
  );

-- Deliberately absent: any SELECT policy on storage.objects for this bucket.
--
-- Without one, no client — signed in, matched, or otherwise — can read an
-- object through the ordinary storage API. Reads happen only through a signed
-- URL, which `photo-url` mints with the service role after checking
-- `has_mutual_match_with`. A user reading their OWN photos back goes through
-- the same function, which is a small cost for having exactly one read path to
-- audit instead of two.
--
-- NSFW moderation would belong between upload and first read: a trigger on
-- insert into this bucket (or a queue drained by an Edge Function) sending the
-- object to an image-moderation API, with `profile_photos` carrying a
-- `moderation_status` column that `photo-url` requires to be 'approved' before
-- it will sign. Not built — noted so the seam is obvious rather than assumed.
