-- Migration 003: Two-phase audit redesign
-- Run in Supabase SQL editor after 001_role_column.sql and 002_organizations.sql.
--
-- Phase 1 = online audit, self-scheduled by the lab (existing slot/booking system)
-- Phase 2 = IRL audit, dispatched by an audit_manager based on profile completeness + geography

-- -------------------------------------------------------
-- 1. Extend existing audit_bookings for Phase 1 tracking
-- -------------------------------------------------------
alter table public.audit_bookings
  add column if not exists assigned_auditor_user_id uuid
    references auth.users(id) on delete set null,
  add column if not exists phase1_completed_at timestamptz null,
  add column if not exists auditor_notes text null;

create index if not exists idx_audit_bookings_assigned_auditor
  on public.audit_bookings (assigned_auditor_user_id);

-- -------------------------------------------------------
-- 2. IRL audit assignments (manager dispatches auditor to an area)
-- -------------------------------------------------------
create table if not exists public.irl_audit_assignments (
  id bigserial primary key,
  assigned_auditor_user_id uuid not null references auth.users(id) on delete restrict,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  scheduled_date date not null,
  area_label text null,          -- e.g. "Paris Nord", "Strasbourg"
  notes text null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_irl_assignments_auditor
  on public.irl_audit_assignments (assigned_auditor_user_id);
create index if not exists idx_irl_assignments_status
  on public.irl_audit_assignments (status);
create index if not exists idx_irl_assignments_date
  on public.irl_audit_assignments (scheduled_date);

-- -------------------------------------------------------
-- 3. Labs included in each IRL assignment
-- -------------------------------------------------------
create table if not exists public.irl_assignment_labs (
  id bigserial primary key,
  assignment_id bigint not null references public.irl_audit_assignments(id) on delete cascade,
  lab_id bigint not null references public.labs(id) on delete cascade,
  visit_status text not null default 'pending'
    check (visit_status in ('pending', 'visited', 'skipped')),
  visited_at timestamptz null,
  unique (assignment_id, lab_id)
);

create index if not exists idx_irl_assignment_labs_assignment
  on public.irl_assignment_labs (assignment_id);
create index if not exists idx_irl_assignment_labs_lab
  on public.irl_assignment_labs (lab_id);

-- -------------------------------------------------------
-- 4. Audit evidence (photos/docs uploaded by auditor per lab visit)
-- -------------------------------------------------------
create table if not exists public.audit_evidence (
  id bigserial primary key,
  -- evidence can be linked to either a Phase 1 online booking or a Phase 2 IRL assignment lab
  booking_id bigint null references public.audit_bookings(id) on delete cascade,
  irl_assignment_lab_id bigint null references public.irl_assignment_labs(id) on delete cascade,
  uploaded_by_user_id uuid not null references auth.users(id),
  storage_path text not null,     -- Supabase Storage path
  file_name text not null,
  evidence_type text not null default 'photo'
    check (evidence_type in ('photo', 'document', 'other')),
  notes text null,
  created_at timestamptz not null default now(),
  check (
    (booking_id is not null and irl_assignment_lab_id is null)
    or (booking_id is null and irl_assignment_lab_id is not null)
  )
);

create index if not exists idx_audit_evidence_booking_id
  on public.audit_evidence (booking_id);
create index if not exists idx_audit_evidence_irl_lab
  on public.audit_evidence (irl_assignment_lab_id);

-- -------------------------------------------------------
-- 5. Audit reports (issued after IRL visit is complete)
-- -------------------------------------------------------
create table if not exists public.audit_reports (
  id bigserial primary key,
  irl_assignment_lab_id bigint not null references public.irl_assignment_labs(id) on delete cascade,
  lab_id bigint not null references public.labs(id) on delete cascade,
  auditor_user_id uuid not null references auth.users(id),
  equipment_verified jsonb null,              -- snapshot of verified equipment items
  report_summary text null,
  glass_id_issued_at timestamptz null,
  verification_pdf_storage_path text null,    -- Supabase Storage path
  pdf_signed_at timestamptz null,
  pdf_signed_by_user_id uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (irl_assignment_lab_id)
);

create index if not exists idx_audit_reports_lab_id
  on public.audit_reports (lab_id);
create index if not exists idx_audit_reports_auditor
  on public.audit_reports (auditor_user_id);

-- -------------------------------------------------------
-- 6. Auto-update updated_at triggers
-- -------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_irl_assignments_set_updated_at'
  ) then
    create trigger trg_irl_assignments_set_updated_at
      before update on public.irl_audit_assignments
      for each row
      execute procedure public.set_current_timestamp_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_audit_reports_set_updated_at'
  ) then
    create trigger trg_audit_reports_set_updated_at
      before update on public.audit_reports
      for each row
      execute procedure public.set_current_timestamp_updated_at();
  end if;
end
$$;

-- -------------------------------------------------------
-- 7. Grants
-- -------------------------------------------------------
grant select on table public.irl_audit_assignments to authenticated;
grant insert, update, delete on table public.irl_audit_assignments to authenticated;
grant usage, select on sequence public.irl_audit_assignments_id_seq to authenticated;

grant select on table public.irl_assignment_labs to authenticated;
grant insert, update, delete on table public.irl_assignment_labs to authenticated;
grant usage, select on sequence public.irl_assignment_labs_id_seq to authenticated;

grant select on table public.audit_evidence to authenticated;
grant insert, delete on table public.audit_evidence to authenticated;
grant usage, select on sequence public.audit_evidence_id_seq to authenticated;

grant select on table public.audit_reports to authenticated;
grant insert, update on table public.audit_reports to authenticated;
grant usage, select on sequence public.audit_reports_id_seq to authenticated;
