-- =========================================================
-- Financeiro: consolidação/conciliação bancária
-- =========================================================

-- Helpers de acesso (security definer para não depender da RLS de profiles)
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','super')
  )
$$;

create or replace function public.can_financeiro()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role in ('admin','super') or p.can_access_financeiro = true)
  )
$$;

-- Bancos cadastrados para conciliação
create table if not exists public.fin_banks (
  id bigserial primary key,
  name text not null,
  logo_url text,
  agency text,
  account text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Esquemas de importação (mapeamento de colunas de cada layout de planilha)
create table if not exists public.fin_import_schemes (
  id bigserial primary key,
  bank_id bigint references public.fin_banks(id) on delete cascade,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Lotes de importação de extrato
create table if not exists public.fin_statement_imports (
  id bigserial primary key,
  bank_id bigint not null references public.fin_banks(id) on delete restrict,
  scheme_id bigint references public.fin_import_schemes(id) on delete set null,
  filename text,
  total_rows integer not null default 0,
  inserted_rows integer not null default 0,
  skipped_rows integer not null default 0,
  imported_by uuid,
  created_at timestamptz not null default now()
);

-- Lançamentos externos (linhas do extrato bancário importado)
create table if not exists public.fin_statement_entries (
  id bigserial primary key,
  bank_id bigint not null references public.fin_banks(id) on delete restrict,
  import_id bigint references public.fin_statement_imports(id) on delete set null,
  occurred_at timestamptz not null,
  movimentacao text not null,              -- 'Débito' | 'Crédito'
  tipo text,                               -- 'Pix' | 'Transação' | 'Recebível de Cartão' | 'Pagamento' | ...
  amount_cents bigint not null,            -- valor assinado em centavos
  balance_before_cents bigint,
  balance_after_cents bigint,
  fee_cents bigint not null default 0,
  situacao text,
  counterpart text,                        -- Destino (débito) ou Origem (crédito)
  counterpart_doc text,
  counterpart_institution text,
  nosso_numero text,
  raw jsonb,
  fingerprint text not null,               -- chave de deduplicação
  status text not null default 'unmatched' check (status in ('unmatched','matched','ignored')),
  reconciliation_id bigint,
  created_at timestamptz not null default now()
);

create unique index if not exists fin_statement_entries_bank_fp_uidx
  on public.fin_statement_entries(bank_id, fingerprint);
create index if not exists fin_statement_entries_bank_date_idx
  on public.fin_statement_entries(bank_id, occurred_at desc);
create index if not exists fin_statement_entries_status_idx
  on public.fin_statement_entries(bank_id, status);

-- Lançamentos internos (livro-caixa do cliente)
create table if not exists public.fin_internal_entries (
  id bigserial primary key,
  bank_id bigint not null references public.fin_banks(id) on delete restrict,
  entry_date date not null,
  description text not null,
  amount_cents bigint not null,            -- valor assinado em centavos
  status text not null default 'unmatched' check (status in ('unmatched','matched','ignored')),
  reconciliation_id bigint,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists fin_internal_entries_bank_date_idx
  on public.fin_internal_entries(bank_id, entry_date desc);
create index if not exists fin_internal_entries_status_idx
  on public.fin_internal_entries(bank_id, status);

-- Trilha de auditoria das conciliações
create table if not exists public.reconciliation_logs (
  id bigserial primary key,
  bank_id bigint not null references public.fin_banks(id) on delete restrict,
  user_id uuid,
  user_email text,
  internal_ids bigint[] not null default '{}',
  external_ids bigint[] not null default '{}',
  internal_total_cents bigint not null default 0,
  external_total_cents bigint not null default 0,
  discrepancy_cents bigint not null default 0,
  discrepancy_reason text,
  status text not null default 'RECONCILED' check (status in ('RECONCILED','UNDONE')),
  undone_at timestamptz,
  undone_by uuid,
  created_at timestamptz not null default now()
);

alter table public.fin_statement_entries
  add constraint fin_statement_entries_recon_fk
  foreign key (reconciliation_id) references public.reconciliation_logs(id) on delete set null;

alter table public.fin_internal_entries
  add constraint fin_internal_entries_recon_fk
  foreign key (reconciliation_id) references public.reconciliation_logs(id) on delete set null;

-- =========================================================
-- RPC: conciliação atômica (match 1:1, 1:N, N:1, parcial c/ baixa)
-- =========================================================
create or replace function public.fin_reconcile(
  p_bank_id bigint,
  p_internal_ids bigint[],
  p_external_ids bigint[],
  p_reason text default null
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_internal_total bigint := 0;
  v_external_total bigint := 0;
  v_diff bigint;
  v_log_id bigint;
  v_email text;
  v_count int;
begin
  if not public.can_financeiro() then
    raise exception 'forbidden: sem acesso ao financeiro';
  end if;
  if coalesce(array_length(p_internal_ids,1),0) = 0 and coalesce(array_length(p_external_ids,1),0) = 0 then
    raise exception 'selecione ao menos um lançamento';
  end if;

  select count(*) into v_count from public.fin_statement_entries
   where bank_id = p_bank_id and status = 'unmatched' and id = any(p_external_ids);
  if v_count <> coalesce(array_length(p_external_ids,1),0) then
    raise exception 'há lançamentos externos inválidos ou já conciliados';
  end if;

  select count(*) into v_count from public.fin_internal_entries
   where bank_id = p_bank_id and status = 'unmatched' and id = any(p_internal_ids);
  if v_count <> coalesce(array_length(p_internal_ids,1),0) then
    raise exception 'há lançamentos internos inválidos ou já conciliados';
  end if;

  select coalesce(sum(amount_cents),0) into v_external_total
    from public.fin_statement_entries
   where bank_id = p_bank_id and id = any(p_external_ids);
  select coalesce(sum(amount_cents),0) into v_internal_total
    from public.fin_internal_entries
   where bank_id = p_bank_id and id = any(p_internal_ids);

  v_diff := abs(v_internal_total) - abs(v_external_total);
  if v_diff <> 0 and (p_reason is null or btrim(p_reason) = '') then
    raise exception 'diferença de valores exige um motivo de discrepância';
  end if;

  select email into v_email from public.profiles where id = auth.uid();

  insert into public.reconciliation_logs
    (bank_id, user_id, user_email, internal_ids, external_ids,
     internal_total_cents, external_total_cents, discrepancy_cents, discrepancy_reason)
  values
    (p_bank_id, auth.uid(), v_email,
     coalesce(p_internal_ids,'{}'), coalesce(p_external_ids,'{}'),
     v_internal_total, v_external_total, v_diff,
     case when v_diff <> 0 then p_reason else null end)
  returning id into v_log_id;

  update public.fin_statement_entries
     set status = 'matched', reconciliation_id = v_log_id
   where id = any(p_external_ids);
  update public.fin_internal_entries
     set status = 'matched', reconciliation_id = v_log_id
   where id = any(p_internal_ids);

  return v_log_id;
end;
$$;

-- RPC: desfazer conciliação (devolve as linhas ao pool de não conciliados)
create or replace function public.fin_undo_reconciliation(p_log_id bigint)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_financeiro() then
    raise exception 'forbidden: sem acesso ao financeiro';
  end if;

  update public.reconciliation_logs
     set status = 'UNDONE', undone_at = now(), undone_by = auth.uid()
   where id = p_log_id and status = 'RECONCILED';
  if not found then
    raise exception 'conciliação não encontrada ou já desfeita';
  end if;

  update public.fin_statement_entries
     set status = 'unmatched', reconciliation_id = null
   where reconciliation_id = p_log_id;
  update public.fin_internal_entries
     set status = 'unmatched', reconciliation_id = null
   where reconciliation_id = p_log_id;

  return true;
end;
$$;

grant execute on function public.fin_reconcile(bigint, bigint[], bigint[], text) to authenticated;
grant execute on function public.fin_undo_reconciliation(bigint) to authenticated;

-- =========================================================
-- RLS
-- =========================================================
alter table public.fin_banks enable row level security;
alter table public.fin_import_schemes enable row level security;
alter table public.fin_statement_imports enable row level security;
alter table public.fin_statement_entries enable row level security;
alter table public.fin_internal_entries enable row level security;
alter table public.reconciliation_logs enable row level security;

do $$
begin
  -- Bancos: leitura p/ quem tem financeiro; escrita só admin
  if not exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
    where p.polname='fin_banks_read' and c.relname='fin_banks') then
    create policy fin_banks_read on public.fin_banks
      for select using (public.can_financeiro());
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
    where p.polname='fin_banks_admin_write' and c.relname='fin_banks') then
    create policy fin_banks_admin_write on public.fin_banks
      for all using (public.is_admin()) with check (public.is_admin());
  end if;

  -- Esquemas: idem
  if not exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
    where p.polname='fin_schemes_read' and c.relname='fin_import_schemes') then
    create policy fin_schemes_read on public.fin_import_schemes
      for select using (public.can_financeiro());
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
    where p.polname='fin_schemes_admin_write' and c.relname='fin_import_schemes') then
    create policy fin_schemes_admin_write on public.fin_import_schemes
      for all using (public.is_admin()) with check (public.is_admin());
  end if;

  -- Imports / extrato / internos / logs: financeiro lê e escreve
  if not exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
    where p.polname='fin_imports_all' and c.relname='fin_statement_imports') then
    create policy fin_imports_all on public.fin_statement_imports
      for all using (public.can_financeiro()) with check (public.can_financeiro());
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
    where p.polname='fin_entries_all' and c.relname='fin_statement_entries') then
    create policy fin_entries_all on public.fin_statement_entries
      for all using (public.can_financeiro()) with check (public.can_financeiro());
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
    where p.polname='fin_internal_all' and c.relname='fin_internal_entries') then
    create policy fin_internal_all on public.fin_internal_entries
      for all using (public.can_financeiro()) with check (public.can_financeiro());
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
    where p.polname='recon_logs_all' and c.relname='reconciliation_logs') then
    create policy recon_logs_all on public.reconciliation_logs
      for all using (public.can_financeiro()) with check (public.can_financeiro());
  end if;
end $$;

-- Bucket público para logotipos dos bancos
insert into storage.buckets (id, name, public)
values ('fin-logos', 'fin-logos', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
    join pg_namespace n on n.oid=c.relnamespace
    where p.polname='fin_logos_write' and c.relname='objects' and n.nspname='storage') then
    create policy fin_logos_write on storage.objects
      for insert to authenticated
      with check (bucket_id = 'fin-logos' and public.can_financeiro());
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on c.oid=p.polrelid
    join pg_namespace n on n.oid=c.relnamespace
    where p.polname='fin_logos_update' and c.relname='objects' and n.nspname='storage') then
    create policy fin_logos_update on storage.objects
      for update to authenticated
      using (bucket_id = 'fin-logos' and public.can_financeiro());
  end if;
end $$;

-- Esquema padrão de importação: layout do extrato Stone
insert into public.fin_import_schemes (bank_id, name, config)
select null, 'Padrão Stone', '{
  "map": {
    "Movimentação": "movimentacao",
    "Tipo": "tipo",
    "Valor": "valor",
    "Saldo antes": "saldo_antes",
    "Saldo depois": "saldo_depois",
    "Tarifa": "tarifa",
    "Data": "data",
    "Nosso Número": "nosso_numero",
    "Situação": "situacao",
    "Destino": "destino",
    "Destino Documento": "destino_doc",
    "Destino Instituição": "destino_inst",
    "Destino Agência": "destino_agencia",
    "Destino Conta": "destino_conta",
    "Origem": "origem",
    "Origem Documento": "origem_doc",
    "Origem Instituição": "origem_inst",
    "Origem Agência": "origem_agencia",
    "Origem Conta": "origem_conta"
  },
  "counterpart": { "debit": "destino", "credit": "origem" }
}'::jsonb
where not exists (select 1 from public.fin_import_schemes where name = 'Padrão Stone');
