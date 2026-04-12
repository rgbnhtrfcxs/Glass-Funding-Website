create table if not exists public.org_lab_link_requests (
  id bigserial primary key,
  org_id bigint not null references public.organizations(id) on delete cascade,
  lab_id bigint not null references public.labs(id) on delete cascade,
  requested_by_user_id uuid null references auth.users(id) on delete set null,
  status text not null default 'pending',
  created_at timestamp with time zone not null default now(),
  responded_at timestamp with time zone null,
  constraint org_lab_link_requests_status_check check (
    status = any (array['pending'::text, 'approved'::text, 'declined'::text, 'cancelled'::text])
  )
);

create index if not exists idx_org_lab_link_requests_org_id
on public.org_lab_link_requests using btree (org_id);

create index if not exists idx_org_lab_link_requests_lab_id
on public.org_lab_link_requests using btree (lab_id);

create index if not exists idx_org_lab_link_requests_status
on public.org_lab_link_requests using btree (status);

create unique index if not exists idx_org_lab_link_requests_one_pending
on public.org_lab_link_requests (org_id, lab_id)
where status = 'pending';
