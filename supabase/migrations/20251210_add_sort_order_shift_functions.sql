-- Add fixed sort order to shift_functions
alter table if exists public.shift_functions
  add column if not exists sort_order integer null;

-- Optional: initialize sort_order with alphabetical rank (smaller first)
-- This block sets sort_order only where it is null
with ranked as (
  select id, row_number() over (order by name asc) as rn
  from public.shift_functions
)
update public.shift_functions f
set sort_order = r.rn
from ranked r
where f.id = r.id and f.sort_order is null;

-- Helpful index if sorting frequently
create index if not exists shift_functions_sort_order_idx on public.shift_functions(sort_order asc, name asc);
