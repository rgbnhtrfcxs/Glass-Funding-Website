-- Seed: BioValley France organization profile
-- Run AFTER migrations 001–004.
--
-- owner_user_id is set to the first admin user found in profiles.
-- If you want a specific owner, replace the subquery with a literal UUID:
--   owner_user_id = 'your-admin-uuid-here'

do $$
declare
  v_owner_id uuid;
  v_org_id   bigint;
begin

  -- Use first admin user as the org owner
  select user_id into v_owner_id
  from public.profiles
  where coalesce(is_admin, false) = true or role = 'admin'
  order by created_at
  limit 1;

  if v_owner_id is null then
    raise exception 'No admin user found. Create an admin user first, then re-run this script.';
  end if;

  -- Insert org (skip if slug already exists)
  if not exists (
    select 1 from public.organizations where slug = 'biovalley-france'
  ) then
    insert into public.organizations (
      slug,
      name,
      short_description,
      long_description,
      logo_url,
      website,
      linkedin,
      org_type,
      owner_user_id,
      is_visible
    ) values (
      'biovalley-france',

      'BioValley France',

      'French world-class competitiveness cluster dedicated to therapeutic innovations in the Grand Est (Alsace) region, connecting life sciences and healthcare stakeholders across France, Germany, and Switzerland.',

      'BioValley France is a French competitiveness cluster established in 2005, headquartered in Illkirch-Graffenstaden near Strasbourg. It federates and animates the regional health innovation network of the Grand Est, bringing together public authorities, academic institutions, university hospitals, and industrial players around a shared mission: accelerating the development of new medical technologies, next-generation biologics, e-health solutions, and diagnostic tools.

As part of the historic trinational BioValley — founded in 1996 across Alsace (France), South Baden (Germany), and Northwestern Switzerland — BioValley France is the one-stop contact for any R&D development or business project in the region. It helps life sciences and healthcare companies identify outstanding scientific or industrial partners, access cutting-edge technology and scientific expertise, and establish operations in the Alsace ecosystem.

Key programmes include the animation of Campus Nextmed on behalf of the Eurométropole de Strasbourg, the Hôpital du Futur programme supported by the Grand Est Region and the French State, and the structuring of the regional bioproduction sector. BioValley France is a strategic partner of the IHU de Strasbourg, SATT Conectus, the incubator Quest For Health, and is a member of the DeepEst French Tech Seed and SIA consortiums.

Its international agreements span CQDM (Canada), the Japan Bioindustry Association (JBA), BioValley Basel (Switzerland), Biopro (Germany), and BioWin (Belgium), making it a true gateway to the European life sciences ecosystem.',

      null,  -- replace with logo URL if available, e.g. 'https://...'

      'https://www.biovalley-france.com',

      'https://www.linkedin.com/company/biovalley-france',

      'research_org',

      v_owner_id,

      true
    )
    returning id into v_org_id;

    raise notice 'BioValley France inserted with id=%', v_org_id;
  else
    raise notice 'BioValley France already exists, skipping insert.';
  end if;

end
$$;
