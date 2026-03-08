-- Migration 004: RLS policies for new audit tables
-- Run in Supabase SQL editor after 003_audit_redesign.sql.

alter table public.irl_audit_assignments enable row level security;
alter table public.irl_assignment_labs enable row level security;
alter table public.audit_evidence enable row level security;
alter table public.audit_reports enable row level security;

do $$
begin

  -- -------------------------------------------------------
  -- irl_audit_assignments
  -- -------------------------------------------------------

  -- SELECT: auditor sees their own; audit_manager/admin sees all
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'irl_audit_assignments'
      and policyname = 'irl_assignments_select'
  ) then
    create policy irl_assignments_select
      on public.irl_audit_assignments
      for select
      to authenticated
      using (
        assigned_auditor_user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      );
  end if;

  -- INSERT: audit_manager or admin only
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'irl_audit_assignments'
      and policyname = 'irl_assignments_insert'
  ) then
    create policy irl_assignments_insert
      on public.irl_audit_assignments
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      );
  end if;

  -- UPDATE: audit_manager/admin, or assigned auditor (status only via application logic)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'irl_audit_assignments'
      and policyname = 'irl_assignments_update'
  ) then
    create policy irl_assignments_update
      on public.irl_audit_assignments
      for update
      to authenticated
      using (
        assigned_auditor_user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      )
      with check (
        assigned_auditor_user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      );
  end if;

  -- DELETE: audit_manager or admin only
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'irl_audit_assignments'
      and policyname = 'irl_assignments_delete'
  ) then
    create policy irl_assignments_delete
      on public.irl_audit_assignments
      for delete
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      );
  end if;

  -- -------------------------------------------------------
  -- irl_assignment_labs
  -- -------------------------------------------------------

  -- SELECT: auditor for their assignment; lab owner; audit_manager/admin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'irl_assignment_labs'
      and policyname = 'irl_assignment_labs_select'
  ) then
    create policy irl_assignment_labs_select
      on public.irl_assignment_labs
      for select
      to authenticated
      using (
        exists (
          select 1 from public.irl_audit_assignments a
          where a.id = irl_assignment_labs.assignment_id
            and a.assigned_auditor_user_id = auth.uid()
        )
        or exists (
          select 1 from public.labs l
          where l.id = irl_assignment_labs.lab_id
            and l.owner_user_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      );
  end if;

  -- INSERT/UPDATE/DELETE: audit_manager/admin or the assigned auditor
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'irl_assignment_labs'
      and policyname = 'irl_assignment_labs_insert'
  ) then
    create policy irl_assignment_labs_insert
      on public.irl_assignment_labs
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'irl_assignment_labs'
      and policyname = 'irl_assignment_labs_update'
  ) then
    create policy irl_assignment_labs_update
      on public.irl_assignment_labs
      for update
      to authenticated
      using (
        exists (
          select 1 from public.irl_audit_assignments a
          where a.id = irl_assignment_labs.assignment_id
            and a.assigned_auditor_user_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      )
      with check (
        exists (
          select 1 from public.irl_audit_assignments a
          where a.id = irl_assignment_labs.assignment_id
            and a.assigned_auditor_user_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'irl_assignment_labs'
      and policyname = 'irl_assignment_labs_delete'
  ) then
    create policy irl_assignment_labs_delete
      on public.irl_assignment_labs
      for delete
      to authenticated
      using (
        exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      );
  end if;

  -- -------------------------------------------------------
  -- audit_evidence
  -- -------------------------------------------------------

  -- SELECT: the auditor who uploaded, the lab owner, audit_manager/admin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_evidence'
      and policyname = 'audit_evidence_select'
  ) then
    create policy audit_evidence_select
      on public.audit_evidence
      for select
      to authenticated
      using (
        uploaded_by_user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'auditor', 'admin'))
        )
      );
  end if;

  -- INSERT: auditor/audit_manager/admin only
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_evidence'
      and policyname = 'audit_evidence_insert'
  ) then
    create policy audit_evidence_insert
      on public.audit_evidence
      for insert
      to authenticated
      with check (
        uploaded_by_user_id = auth.uid()
        and exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('auditor', 'audit_manager', 'admin'))
        )
      );
  end if;

  -- DELETE: the uploader or admin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_evidence'
      and policyname = 'audit_evidence_delete'
  ) then
    create policy audit_evidence_delete
      on public.audit_evidence
      for delete
      to authenticated
      using (
        uploaded_by_user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role = 'admin')
        )
      );
  end if;

  -- -------------------------------------------------------
  -- audit_reports
  -- -------------------------------------------------------

  -- SELECT: the auditor who wrote it, the lab owner, audit_manager/admin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_reports'
      and policyname = 'audit_reports_select'
  ) then
    create policy audit_reports_select
      on public.audit_reports
      for select
      to authenticated
      using (
        auditor_user_id = auth.uid()
        or exists (
          select 1 from public.labs l
          where l.id = audit_reports.lab_id and l.owner_user_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      );
  end if;

  -- INSERT: auditor (for their assignment) or audit_manager/admin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_reports'
      and policyname = 'audit_reports_insert'
  ) then
    create policy audit_reports_insert
      on public.audit_reports
      for insert
      to authenticated
      with check (
        auditor_user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      );
  end if;

  -- UPDATE: auditor (their own report) or audit_manager/admin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_reports'
      and policyname = 'audit_reports_update'
  ) then
    create policy audit_reports_update
      on public.audit_reports
      for update
      to authenticated
      using (
        auditor_user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      )
      with check (
        auditor_user_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
            and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
        )
      );
  end if;

  -- audit_bookings: update existing select policy to include auditor role
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_bookings'
      and policyname = 'audit_bookings_select_owner_requester_or_admin'
  ) then
    drop policy audit_bookings_select_owner_requester_or_admin on public.audit_bookings;
  end if;

  create policy audit_bookings_select_owner_requester_or_staff
    on public.audit_bookings
    for select
    to authenticated
    using (
      requester_user_id = auth.uid()
      or assigned_auditor_user_id = auth.uid()
      or exists (
        select 1 from public.labs l
        where l.id = audit_bookings.lab_id and l.owner_user_id = auth.uid()
      )
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and (coalesce(p.is_admin, false) = true or p.role in ('auditor', 'audit_manager', 'admin'))
      )
    );

  -- audit_bookings: auditor can update their assigned booking (notes, phase1_completed_at)
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_bookings'
      and policyname = 'audit_bookings_admin_update'
  ) then
    drop policy audit_bookings_admin_update on public.audit_bookings;
  end if;

  create policy audit_bookings_staff_update
    on public.audit_bookings
    for update
    to authenticated
    using (
      assigned_auditor_user_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
      )
    )
    with check (
      assigned_auditor_user_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and (coalesce(p.is_admin, false) = true or p.role in ('audit_manager', 'admin'))
      )
    );

end
$$;
