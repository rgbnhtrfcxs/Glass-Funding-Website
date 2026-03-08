-- Migration 002: Organization profiles + org_members + link labs to orgs
-- Run in Supabase SQL editor after 001_role_column.sql.

-- -------------------------------------------------------
-- 1. Organizations table
-- -------------------------------------------------------
create table if not exists public.organizations (
  id bigserial primary key,
  slug text unique not null,
  name text not null,
  short_description text null,
  long_description text null,
  logo_url text null,
  website text null,
  linkedin text null,
  org_type text not null default 'research_org'
    check (org_type in ('research_org', 'university', 'hospital_network', 'industry', 'other')),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organizations_slug on public.organizations (slug);
create index if not exists idx_organizations_owner on public.organizations (owner_user_id);
create index if not exists idx_organizations_visible on public.organizations (is_visible);

-- -------------------------------------------------------
-- 2. Org members table (user-org relationship with per-org role)
-- -------------------------------------------------------
create table if not exists public.org_members (
  id bigserial primary key,
  org_id bigint not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  org_role text not null default 'member'
    check (org_role in ('member', 'manager', 'owner')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists idx_org_members_org_id on public.org_members (org_id);
create index if not exists idx_org_members_user_id on public.org_members (user_id);

-- -------------------------------------------------------
-- 3. Link labs to organizations (optional, user-owned labs grouped by org)
-- -------------------------------------------------------
alter table public.labs
  add column if not exists organization_id bigint
  references public.organizations(id) on delete set null;

create index if not exists idx_labs_organization_id on public.labs (organization_id);

-- -------------------------------------------------------
-- 4. Auto-update updated_at
-- -------------------------------------------------------
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_organizations_set_updated_at'
  ) then
    create trigger trg_organizations_set_updated_at
      before update on public.organizations
      for each row
      execute procedure public.set_current_timestamp_updated_at();
  end if;
end
$$;

-- -------------------------------------------------------
-- 5. RLS policies for organizations
-- -------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;

do $$
begin
  -- organizations: public can read visible orgs
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'organizations'
      and policyname = 'organizations_select_visible_or_member'
  ) then
    create policy organizations_select_visible_or_member
      on public.organizations
      for select
      using (
        is_visible = true
        or owner_user_id = auth.uid()
        or exists (
          select 1 from public.org_members m
          where m.org_id = organizations.id and m.user_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      );
  end if;

  -- organizations: authenticated users can insert (they become owner via application logic)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'organizations'
      and policyname = 'organizations_insert_authenticated'
  ) then
    create policy organizations_insert_authenticated
      on public.organizations
      for insert
      to authenticated
      with check (owner_user_id = auth.uid());
  end if;

  -- organizations: owner, manager, or admin can update
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'organizations'
      and policyname = 'organizations_update_owner_or_manager'
  ) then
    create policy organizations_update_owner_or_manager
      on public.organizations
      for update
      to authenticated
      using (
        owner_user_id = auth.uid()
        or exists (
          select 1 from public.org_members m
          where m.org_id = organizations.id
            and m.user_id = auth.uid()
            and m.org_role in ('owner', 'manager')
        )
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role = 'admin')
        )
      )
      with check (
        owner_user_id = auth.uid()
        or exists (
          select 1 from public.org_members m
          where m.org_id = organizations.id
            and m.user_id = auth.uid()
            and m.org_role in ('owner', 'manager')
        )
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role = 'admin')
        )
      );
  end if;

  -- organizations: only owner or admin can delete
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'organizations'
      and policyname = 'organizations_delete_owner_or_admin'
  ) then
    create policy organizations_delete_owner_or_admin
      on public.organizations
      for delete
      to authenticated
      using (
        owner_user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role = 'admin')
        )
      );
  end if;

  -- org_members: members can see other members of their orgs
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'org_members'
      and policyname = 'org_members_select_own_org'
  ) then
    create policy org_members_select_own_org
      on public.org_members
      for select
      to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1 from public.org_members m2
          where m2.org_id = org_members.org_id and m2.user_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      );
  end if;

  -- org_members: org owner/manager or admin can add members
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'org_members'
      and policyname = 'org_members_insert_manager_or_admin'
  ) then
    create policy org_members_insert_manager_or_admin
      on public.org_members
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.organizations o
          where o.id = org_members.org_id
            and o.owner_user_id = auth.uid()
        )
        or exists (
          select 1 from public.org_members m
          where m.org_id = org_members.org_id
            and m.user_id = auth.uid()
            and m.org_role in ('owner', 'manager')
        )
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role = 'admin')
        )
      );
  end if;

  -- org_members: org owner/manager or admin can delete members
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'org_members'
      and policyname = 'org_members_delete_manager_or_admin'
  ) then
    create policy org_members_delete_manager_or_admin
      on public.org_members
      for delete
      to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1 from public.organizations o
          where o.id = org_members.org_id
            and o.owner_user_id = auth.uid()
        )
        or exists (
          select 1 from public.org_members m
          where m.org_id = org_members.org_id
            and m.user_id = auth.uid()
            and m.org_role in ('owner', 'manager')
        )
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role = 'admin')
        )
      );
  end if;
end
$$;

-- -------------------------------------------------------
-- 6. Grants
-- -------------------------------------------------------
grant select on table public.organizations to authenticated, anon;
grant insert, update, delete on table public.organizations to authenticated;
grant usage, select on sequence public.organizations_id_seq to authenticated;

grant select on table public.org_members to authenticated;
grant insert, delete on table public.org_members to authenticated;
grant usage, select on sequence public.org_members_id_seq to authenticated;
