alter table public.labs
add column if not exists slug text;

update public.labs
set slug = regexp_replace(
  regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g'),
  '(^-+|-+$)',
  '',
  'g'
)
where slug is null;

update public.labs
set slug = 'lab-' || id
where slug is null or slug = '';

with ranked as (
  select
    id,
    slug,
    row_number() over (partition by slug order by id) as rn
  from public.labs
)
update public.labs as labs
set slug = case
  when ranked.rn = 1 then ranked.slug
  else ranked.slug || '-' || ranked.rn
end
from ranked
where labs.id = ranked.id;

alter table public.labs
alter column slug set not null;

create unique index if not exists idx_labs_slug_unique
on public.labs using btree (slug);
