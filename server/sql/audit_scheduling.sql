-- Audit scheduling tables for verification slot management.
-- Run in Supabase SQL editor before enabling the admin audit scheduler.

create table if not exists public.audit_slots (
  id bigserial primary key,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Europe/Paris',
  capacity integer not null default 1 check (capacity > 0),
  is_active boolean not null default true,
  notes text null,
  created_by_user_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_audit_slots_starts_at on public.audit_slots (starts_at);
create index if not exists idx_audit_slots_active on public.audit_slots (is_active);

create table if not exists public.audit_bookings (
  id bigserial primary key,
  slot_id bigint not null references public.audit_slots(id) on delete cascade,
  lab_id bigint not null references public.labs(id) on delete cascade,
  requester_user_id uuid not null,
  requester_email text null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  availability text null,
  payment text null,
  address_line1 text null,
  address_line2 text null,
  city text null,
  state text null,
  postal_code text null,
  country text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_audit_bookings_slot_id on public.audit_bookings (slot_id);
create index if not exists idx_audit_bookings_status on public.audit_bookings (status);
create index if not exists idx_audit_bookings_lab_id on public.audit_bookings (lab_id);
create index if not exists idx_audit_bookings_requester_user_id on public.audit_bookings (requester_user_id);

create table if not exists public.audit_booking_reminders (
  id bigserial primary key,
  booking_id bigint not null references public.audit_bookings(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('24h', '2h')),
  sent_at timestamptz not null default now(),
  unique (booking_id, reminder_type)
);

create index if not exists idx_audit_booking_reminders_booking_id on public.audit_booking_reminders (booking_id);

-- Keep updated_at in sync automatically.
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
    select 1
    from pg_trigger
    where tgname = 'trg_audit_slots_set_updated_at'
  ) then
    create trigger trg_audit_slots_set_updated_at
      before update on public.audit_slots
      for each row
      execute procedure public.set_current_timestamp_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_audit_bookings_set_updated_at'
  ) then
    create trigger trg_audit_bookings_set_updated_at
      before update on public.audit_bookings
      for each row
      execute procedure public.set_current_timestamp_updated_at();
  end if;
end
$$;

-- ------------------------------------------------------------
-- Grants + RLS policies
-- ------------------------------------------------------------

grant select on table public.audit_slots to authenticated;
grant select, insert on table public.audit_bookings to authenticated;
grant usage, select on sequence public.audit_bookings_id_seq to authenticated;

alter table public.audit_slots enable row level security;
alter table public.audit_bookings enable row level security;
alter table public.audit_booking_reminders enable row level security;

-- audit_slots
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_slots'
      and policyname = 'audit_slots_select_active_or_admin'
  ) then
    create policy audit_slots_select_active_or_admin
      on public.audit_slots
      for select
      to authenticated
      using (
        is_active = true
        or exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and coalesce(p.is_admin, false) = true
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_slots'
      and policyname = 'audit_slots_admin_insert'
  ) then
    create policy audit_slots_admin_insert
      on public.audit_slots
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and coalesce(p.is_admin, false) = true
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_slots'
      and policyname = 'audit_slots_admin_update'
  ) then
    create policy audit_slots_admin_update
      on public.audit_slots
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and coalesce(p.is_admin, false) = true
        )
      )
      with check (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and coalesce(p.is_admin, false) = true
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_slots'
      and policyname = 'audit_slots_admin_delete'
  ) then
    create policy audit_slots_admin_delete
      on public.audit_slots
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and coalesce(p.is_admin, false) = true
        )
      );
  end if;
end
$$;

-- audit_bookings
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_bookings'
      and policyname = 'audit_bookings_select_owner_requester_or_admin'
  ) then
    create policy audit_bookings_select_owner_requester_or_admin
      on public.audit_bookings
      for select
      to authenticated
      using (
        requester_user_id = auth.uid()
        or exists (
          select 1
          from public.labs l
          where l.id = audit_bookings.lab_id
            and l.owner_user_id = auth.uid()
        )
        or exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and coalesce(p.is_admin, false) = true
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_bookings'
      and policyname = 'audit_bookings_insert_requester_or_admin'
  ) then
    create policy audit_bookings_insert_requester_or_admin
      on public.audit_bookings
      for insert
      to authenticated
      with check (
        requester_user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and coalesce(p.is_admin, false) = true
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_bookings'
      and policyname = 'audit_bookings_admin_update'
  ) then
    create policy audit_bookings_admin_update
      on public.audit_bookings
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and coalesce(p.is_admin, false) = true
        )
      )
      with check (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and coalesce(p.is_admin, false) = true
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_bookings'
      and policyname = 'audit_bookings_admin_delete'
  ) then
    create policy audit_bookings_admin_delete
      on public.audit_bookings
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and coalesce(p.is_admin, false) = true
        )
      );
  end if;
end
$$;

-- audit_booking_reminders (admin only)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_booking_reminders'
      and policyname = 'audit_booking_reminders_admin_all'
  ) then
    create policy audit_booking_reminders_admin_all
      on public.audit_booking_reminders
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and coalesce(p.is_admin, false) = true
        )
      )
      with check (
        exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and coalesce(p.is_admin, false) = true
        )
      );
  end if;
end
$$;
