-- Migration 001: Add role column to profiles
-- Run in Supabase SQL editor.
-- Backward-compatible: existing is_admin boolean flags are preserved.

-- 1. Add role enum column (defaults to 'user')
alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'auditor', 'audit_manager', 'admin'));

-- 2. Backfill: existing admins get role='admin'
update public.profiles
  set role = 'admin'
  where coalesce(is_admin, false) = true
    and role = 'user';

-- 3. Helper function used in RLS policies across tables
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
as $$
  select coalesce(role, 'user')
  from public.profiles
  where user_id = auth.uid()
$$;

-- 4. Update audit_slots RLS to also accept audit_manager role
--    (currently only checks is_admin)

-- Drop and recreate the insert policy to include audit_manager
do $$
begin
  -- Insert: audit_manager or admin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_slots'
      and policyname = 'audit_slots_admin_insert'
  ) then
    drop policy audit_slots_admin_insert on public.audit_slots;
  end if;

  create policy audit_slots_audit_manager_insert
    on public.audit_slots
    for insert
    to authenticated
    with check (
      exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
      )
    );

  -- Update: audit_manager or admin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_slots'
      and policyname = 'audit_slots_admin_update'
  ) then
    drop policy audit_slots_admin_update on public.audit_slots;
  end if;

  create policy audit_slots_audit_manager_update
    on public.audit_slots
    for update
    to authenticated
    using (
      exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
      )
    )
    with check (
      exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
      )
    );

  -- Delete: audit_manager or admin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_slots'
      and policyname = 'audit_slots_admin_delete'
  ) then
    drop policy audit_slots_admin_delete on public.audit_slots;
  end if;

  create policy audit_slots_audit_manager_delete
    on public.audit_slots
    for delete
    to authenticated
    using (
      exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
      )
    );

  -- Select: update existing select policy to show all slots to audit_manager
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_slots'
      and policyname = 'audit_slots_select_active_or_admin'
  ) then
    drop policy audit_slots_select_active_or_admin on public.audit_slots;
  end if;

  create policy audit_slots_select_active_or_staff
    on public.audit_slots
    for select
    to authenticated
    using (
      is_active = true
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'auditor', 'admin'))
      )
    );
end
$$;
