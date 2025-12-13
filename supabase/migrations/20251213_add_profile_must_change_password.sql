-- Add must_change_password flag to profiles
alter table if exists public.profiles
  add column if not exists must_change_password boolean not null default false;

-- Existing users: keep as false (no force).
