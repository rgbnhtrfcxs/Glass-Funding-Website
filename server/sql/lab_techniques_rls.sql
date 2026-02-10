-- RLS policies for public.lab_techniques
-- Run after creating the table.

alter table if exists public.lab_techniques enable row level security;

drop policy if exists lab_techniques_select_visible on public.lab_techniques;
create policy lab_techniques_select_visible
on public.lab_techniques
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.labs l
    where l.id = lab_techniques.lab_id
      and coalesce(l.is_visible, true) = true
  )
);

drop policy if exists lab_techniques_insert_owner_or_admin on public.lab_techniques;
create policy lab_techniques_insert_owner_or_admin
on public.lab_techniques
for insert
to authenticated
with check (
  exists (
    select 1
    from public.labs l
    where l.id = lab_techniques.lab_id
      and l.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.is_admin, false) = true
  )
);

drop policy if exists lab_techniques_update_owner_or_admin on public.lab_techniques;
create policy lab_techniques_update_owner_or_admin
on public.lab_techniques
for update
to authenticated
using (
  exists (
    select 1
    from public.labs l
    where l.id = lab_techniques.lab_id
      and l.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.is_admin, false) = true
  )
)
with check (
  exists (
    select 1
    from public.labs l
    where l.id = lab_techniques.lab_id
      and l.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.is_admin, false) = true
  )
);

drop policy if exists lab_techniques_delete_owner_or_admin on public.lab_techniques;
create policy lab_techniques_delete_owner_or_admin
on public.lab_techniques
for delete
to authenticated
using (
  exists (
    select 1
    from public.labs l
    where l.id = lab_techniques.lab_id
      and l.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.is_admin, false) = true
  )
);
