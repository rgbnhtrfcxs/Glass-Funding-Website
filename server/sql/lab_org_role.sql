-- Migration: add organization role classification on public.labs
-- Safe to run multiple times.

begin;

alter table if exists public.labs
  add column if not exists org_role text;

do $$
begin
  if to_regclass('public.labs') is not null then
    -- Backfill from legacy lab_profile.org_role if it exists.
    if to_regclass('public.lab_profile') is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'lab_profile'
          and column_name = 'org_role'
      ) then
      update public.labs l
      set org_role = lp.org_role
      from public.lab_profile lp
      where lp.lab_id = l.id
        and lp.org_role is not null
        and (l.org_role is null or l.org_role <> lp.org_role);

      -- Legacy cleanup: org_role now lives on public.labs.
      alter table public.lab_profile
        drop constraint if exists lab_profile_org_role_check;
      drop index if exists public.idx_lab_profile_org_role;
      alter table public.lab_profile
        drop column if exists org_role;
    end if;

    update public.labs
    set org_role = case org_role
      when 'Core Facility/Platform' then 'Core Facility / Platform'
      when 'CRO (Contract Research Organisation)' then 'CRO (Contract Research Organization)'
      when 'CDMO/CMO' then 'CDMO / CMO'
      when 'Clinical Site/Hospital Lab' then 'Clinical Site / Hospital Lab'
      when 'Testing/Certification Lab' then 'Testing / Certification Lab'
      when 'Bioinformatics/Data' then 'Bioinformatics / Data'
      when 'Regulatory/QA/ Consulting' then 'Regulatory / QA / Consulting'
      when 'Regulatory/QA/Consulting' then 'Regulatory / QA / Consulting'
      else org_role
    end
    where org_role is not null;

    alter table public.labs
      drop constraint if exists labs_org_role_check;

    alter table public.labs
      add constraint labs_org_role_check
      check (
        org_role is null
        or org_role in (
          'Research Lab',
          'Core Facility / Platform',
          'CRO (Contract Research Organization)',
          'CDMO / CMO',
          'Clinical Site / Hospital Lab',
          'Biobank',
          'Testing / Certification Lab',
          'Bioinformatics / Data',
          'Regulatory / QA / Consulting'
        )
      );

    create index if not exists idx_labs_org_role
      on public.labs(org_role);
  end if;
end $$;

commit;
