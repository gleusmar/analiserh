-- Add can_access_financeiro flag to profiles (acesso à área Financeiro)
alter table if exists lic.profiles
  add column if not exists can_access_financeiro boolean not null default false;
