-- Create vacations table
create table if not exists public.vacations (
  id bigserial primary key,
  collaborator_id bigint not null references public.collaborators(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  days integer not null,
  period text null,
  remuneration numeric(12,2) null,
  created_at timestamp with time zone default now()
);

-- Indexes
create index if not exists idx_vacations_start_date on public.vacations(start_date desc);
create index if not exists idx_vacations_collaborator on public.vacations(collaborator_id);

-- RLS policies
alter table public.vacations enable row level security;

-- Admins/managers full access
create policy if not exists "vacations_admin_all" on public.vacations
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin','super','gestor-plantoes')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin','super','gestor-plantoes')
    )
  );

-- Users can read only their own
create policy if not exists "vacations_user_read_own" on public.vacations
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.collaborator_id = public.vacations.collaborator_id
    )
  );
