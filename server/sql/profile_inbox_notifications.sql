-- Migration: add inbox email notification preference to public.profiles
-- Safe to run multiple times.

begin;

alter table if exists public.profiles
  add column if not exists inbox_email_notifications_enabled boolean;

comment on column public.profiles.inbox_email_notifications_enabled is
  'When true/false, explicitly controls email forwarding for lab inbox requests. Null means status-based default (off for verified_passive, on otherwise).';

commit;
