-- Onboarding's fourth answer.
--
-- A separate migration rather than an edit to the init file: migrations are
-- immutable once applied anywhere, and additive column changes are cheap.
alter table public.profiles
  add column if not exists looking_for text
  check (looking_for is null or looking_for in ('Date', 'Friends', 'See where it goes'));
