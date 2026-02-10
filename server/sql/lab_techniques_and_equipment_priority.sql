-- Migration: lab techniques + priority equipment support
-- Safe to run multiple times.

begin;

alter table if exists public.lab_equipment
  add column if not exists is_priority boolean not null default false;

do $$
declare
  lab_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into lab_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'labs'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  if lab_id_type is null then
    raise exception 'Could not resolve type for public.labs.id';
  end if;

  execute format(
    'create table if not exists public.lab_techniques (
      id bigserial primary key,
      lab_id %s not null references public.labs(id) on delete cascade,
      name text not null,
      description text null,
      created_at timestamptz not null default now()
    )',
    lab_id_type
  );
end $$;

create index if not exists idx_lab_techniques_lab_id
  on public.lab_techniques(lab_id);

create unique index if not exists uq_lab_techniques_lab_name
  on public.lab_techniques(lab_id, name);

create index if not exists idx_lab_equipment_priority
  on public.lab_equipment(lab_id, is_priority);

commit;
