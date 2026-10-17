-- Official Fortalfy gym plates and operational check-ins.
-- Apply after PRODUCAO_BACKEND_SUPABASE.sql, FORTALFY_SOCIAL_V1_SUPABASE.sql,
-- and FORTALFY_FOOD_SOCIAL_SUPABASE.sql (partner listings and admin helper).
-- This migration deliberately creates no financial ledger, rate, or simulated membership.

create table if not exists public.fortalfy_gym_units (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  listing_id uuid not null references public.partner_listings(id) on delete restrict,
  unit_name text not null check (char_length(unit_name) between 2 and 120),
  address text not null check (char_length(address) between 3 and 300),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  timezone_name text not null,
  checkin_radius_m integer not null check (checkin_radius_m between 25 and 1000),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, profile_id)
);

create table if not exists public.fortalfy_gym_plates (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.fortalfy_gym_units(id) on delete restrict,
  public_id uuid not null unique default gen_random_uuid(),
  status text not null default 'pending_installation'
    check (status in ('pending_installation', 'active', 'disabled', 'replaced')),
  nfc_tag_label text check (char_length(coalesce(nfc_tag_label, '')) <= 120),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fortalfy_gym_plates_unit_idx
  on public.fortalfy_gym_plates(unit_id, created_at desc);
create unique index if not exists fortalfy_gym_plates_one_active_per_unit_idx
  on public.fortalfy_gym_plates(unit_id) where status = 'active';

create table if not exists public.fortalfy_gym_plate_events (
  id bigint generated always as identity primary key,
  plate_id uuid not null references public.fortalfy_gym_plates(id) on delete restrict,
  event_type text not null check (event_type in ('installation', 'maintenance', 'nfc_registration', 'status_change', 'replacement')),
  notes text not null check (char_length(notes) between 5 and 2000),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists fortalfy_gym_plate_events_history_idx
  on public.fortalfy_gym_plate_events(plate_id, created_at desc);

create table if not exists public.fortalfy_gym_access_contracts (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.fortalfy_gym_units(id) on delete restrict,
  contract_reference text not null check (char_length(contract_reference) between 3 and 120),
  status text not null default 'active' check (status in ('active', 'suspended', 'expired')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  notes text not null check (char_length(notes) between 5 and 2000),
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from),
  unique (unit_id, contract_reference)
);
create unique index if not exists fortalfy_gym_access_contracts_one_active_idx
  on public.fortalfy_gym_access_contracts(unit_id) where status = 'active';
create index if not exists fortalfy_gym_access_contracts_validity_idx
  on public.fortalfy_gym_access_contracts(unit_id, status, valid_from, valid_until);

create table if not exists public.fortalfy_gym_access_contract_events (
  id bigint generated always as identity primary key,
  contract_id uuid not null references public.fortalfy_gym_access_contracts(id) on delete restrict,
  event_type text not null check (event_type in ('approved', 'suspended', 'expired')),
  notes text not null check (char_length(notes) between 5 and 2000),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists fortalfy_gym_access_contract_events_history_idx
  on public.fortalfy_gym_access_contract_events(contract_id, created_at desc);

-- The subscription system is not currently connected. Only a trusted server-side
-- integration may provision these entitlements; the browser cannot grant access.
create table if not exists public.fortalfy_pass_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider_subscription_id text not null unique,
  status text not null check (status in ('active', 'paused', 'cancelled', 'expired')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from)
);
create index if not exists fortalfy_pass_entitlements_user_status_idx
  on public.fortalfy_pass_entitlements(user_id, status, valid_from desc);

create table if not exists public.fortalfy_gym_checkins (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  unit_id uuid not null references public.fortalfy_gym_units(id) on delete restrict,
  plate_id uuid not null references public.fortalfy_gym_plates(id) on delete restrict,
  contract_id uuid not null references public.fortalfy_gym_access_contracts(id) on delete restrict,
  service_date date not null,
  access_method_claimed text not null check (access_method_claimed in ('qr', 'nfc')),
  location_accuracy_m double precision not null check (location_accuracy_m between 0 and 1000),
  distance_from_unit_m double precision not null check (distance_from_unit_m >= 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  financial_status text not null default 'not_configured'
    check (financial_status in ('not_configured', 'not_eligible', 'eligible_pending_rules')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  exit_confirmation text check (exit_confirmation in ('member_confirmed_in_app')),
  unique (user_id, request_key),
  unique (user_id, unit_id, service_date),
  check (
    (status = 'in_progress' and completed_at is null and exit_confirmation is null)
    or (status = 'completed' and completed_at is not null and exit_confirmation is not null)
  )
);
create index if not exists fortalfy_gym_checkins_user_history_idx
  on public.fortalfy_gym_checkins(user_id, started_at desc);
create index if not exists fortalfy_gym_checkins_unit_history_idx
  on public.fortalfy_gym_checkins(unit_id, started_at desc);

create table if not exists public.fortalfy_gym_checkin_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete restrict,
  request_key uuid not null,
  plate_id uuid references public.fortalfy_gym_plates(id) on delete set null,
  result text not null check (result in ('accepted', 'denied')),
  reason text not null,
  created_at timestamptz not null default now(),
  unique (user_id, request_key)
);
create index if not exists fortalfy_gym_checkin_attempts_risk_idx
  on public.fortalfy_gym_checkin_attempts(result, created_at desc);

alter table public.fortalfy_gym_units enable row level security;
alter table public.fortalfy_gym_plates enable row level security;
alter table public.fortalfy_gym_plate_events enable row level security;
alter table public.fortalfy_gym_access_contracts enable row level security;
alter table public.fortalfy_gym_access_contract_events enable row level security;
alter table public.fortalfy_pass_entitlements enable row level security;
alter table public.fortalfy_gym_checkins enable row level security;
alter table public.fortalfy_gym_checkin_attempts enable row level security;

revoke all on public.fortalfy_gym_units, public.fortalfy_gym_plates,
  public.fortalfy_gym_plate_events, public.fortalfy_pass_entitlements,
  public.fortalfy_gym_access_contracts, public.fortalfy_gym_access_contract_events,
  public.fortalfy_gym_checkins, public.fortalfy_gym_checkin_attempts
  from public, anon, authenticated;
grant select on public.fortalfy_gym_units to authenticated;
grant select on public.fortalfy_gym_checkins to authenticated;
grant all on public.fortalfy_pass_entitlements to service_role;

drop policy if exists "gym units are visible to their owner and admins" on public.fortalfy_gym_units;
create policy "gym units are visible to their owner and admins"
  on public.fortalfy_gym_units for select to authenticated
  using (profile_id = auth.uid() or public.is_fortalfy_admin());

drop policy if exists "gym check-ins are visible to involved parties" on public.fortalfy_gym_checkins;
create policy "gym check-ins are visible to involved parties"
  on public.fortalfy_gym_checkins for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_fortalfy_admin()
    or exists (
      select 1 from public.fortalfy_gym_units unit
      where unit.id = unit_id and unit.profile_id = auth.uid()
    )
  );

create or replace function public.fortalfy_plate_public_info(p_public_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'unit_id', unit.id,
    'unit_name', unit.unit_name,
    'city', unit.address,
    'status', plate.status,
    'unit_active', unit.active,
    'partner_approved',
      profile.partner_approved_at is not null
      and profile.kind = 'academia'::public.profile_kind,
    'contract_active', exists (
      select 1 from public.fortalfy_gym_access_contracts access_contract
      where access_contract.unit_id = unit.id
        and access_contract.status = 'active'
        and access_contract.valid_from <= now()
        and (access_contract.valid_until is null or access_contract.valid_until > now())
    )
  )
  from public.fortalfy_gym_plates plate
  join public.fortalfy_gym_units unit on unit.id = plate.unit_id
  join public.profiles profile on profile.id = unit.profile_id
  where plate.public_id = p_public_id;
$$;
revoke all on function public.fortalfy_plate_public_info(uuid) from public;
grant execute on function public.fortalfy_plate_public_info(uuid) to anon, authenticated;

create or replace function public.fortalfy_admin_gym_listings()
returns table (
  profile_id uuid,
  listing_id uuid,
  business_name text,
  address text,
  latitude double precision,
  longitude double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_fortalfy_admin() then
    raise exception 'Admin role required';
  end if;
  return query
    select profile.id, listing.id, coalesce(profile.business_name, profile.display_name),
      listing.address, listing.latitude, listing.longitude
    from public.partner_listings listing
    join public.profiles profile on profile.id = listing.profile_id
    where profile.kind = 'academia'::public.profile_kind
      and profile.partner_approved_at is not null
    order by profile.business_name, listing.address;
end;
$$;
revoke all on function public.fortalfy_admin_gym_listings() from public, anon;
grant execute on function public.fortalfy_admin_gym_listings() to authenticated;

create or replace function public.fortalfy_admin_gym_units()
returns table (
  unit_id uuid,
  profile_id uuid,
  listing_id uuid,
  unit_name text,
  business_name text,
  address text,
  timezone_name text,
  checkin_radius_m integer,
  active boolean,
  plate_count bigint,
  active_contract_id uuid,
  contract_reference text,
  contract_status text,
  contract_valid_until timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_fortalfy_admin() then
    raise exception 'Admin role required';
  end if;
  return query
    select unit.id, unit.profile_id, unit.listing_id, unit.unit_name,
      coalesce(profile.business_name, profile.display_name), unit.address,
      unit.timezone_name, unit.checkin_radius_m, unit.active,
      (select count(*) from public.fortalfy_gym_plates plate where plate.unit_id = unit.id),
      contract.id, contract.contract_reference,
      case when contract.status = 'active' and contract.valid_until <= now()
        then 'expired' else contract.status end,
      contract.valid_until
    from public.fortalfy_gym_units unit
    join public.profiles profile on profile.id = unit.profile_id
    left join public.fortalfy_gym_access_contracts contract
      on contract.unit_id = unit.id and contract.status = 'active'
    order by profile.business_name, unit.unit_name;
end;
$$;
revoke all on function public.fortalfy_admin_gym_units() from public, anon;
grant execute on function public.fortalfy_admin_gym_units() to authenticated;

create or replace function public.fortalfy_admin_gym_plates()
returns table (
  plate_id uuid,
  public_id uuid,
  plate_status text,
  nfc_tag_label text,
  created_at timestamptz,
  unit_id uuid,
  unit_name text,
  profile_id uuid,
  business_name text,
  address text,
  latitude double precision,
  longitude double precision,
  timezone_name text,
  checkin_radius_m integer,
  installation_recorded boolean,
  event_count bigint,
  checkin_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_fortalfy_admin() then
    raise exception 'Admin role required';
  end if;
  return query
    select plate.id, plate.public_id, plate.status, plate.nfc_tag_label, plate.created_at,
      unit.id, unit.unit_name, unit.profile_id,
      coalesce(profile.business_name, profile.display_name), unit.address,
      unit.latitude, unit.longitude, unit.timezone_name, unit.checkin_radius_m,
      exists (
        select 1 from public.fortalfy_gym_plate_events event
        where event.plate_id = plate.id and event.event_type = 'installation'
      ),
      (select count(*) from public.fortalfy_gym_plate_events event where event.plate_id = plate.id),
      (select count(*) from public.fortalfy_gym_checkins checkin where checkin.plate_id = plate.id)
    from public.fortalfy_gym_plates plate
    join public.fortalfy_gym_units unit on unit.id = plate.unit_id
    join public.profiles profile on profile.id = unit.profile_id
    order by plate.created_at desc;
end;
$$;
revoke all on function public.fortalfy_admin_gym_plates() from public, anon;
grant execute on function public.fortalfy_admin_gym_plates() to authenticated;

create or replace function public.fortalfy_admin_gym_plate_history(p_plate_id uuid)
returns table (
  entry_type text,
  occurred_at timestamptz,
  detail text,
  result text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_fortalfy_admin() then
    raise exception 'Admin role required';
  end if;
  if not exists (select 1 from public.fortalfy_gym_plates plate where plate.id = p_plate_id) then
    raise exception 'Plate not found';
  end if;
  return query
    select 'plate_event'::text, event.created_at,
      event.event_type || ': ' || event.notes, null::text
    from public.fortalfy_gym_plate_events event
    where event.plate_id = p_plate_id
    union all
    select 'checkin_attempt'::text, attempt.created_at,
      coalesce(attempt.reason, 'unknown'),
      attempt.result
    from public.fortalfy_gym_checkin_attempts attempt
    where attempt.plate_id = p_plate_id
    union all
    select 'checkin'::text, checkin.started_at,
      checkin.status || ' · ' || checkin.access_method_claimed || ' · ' ||
        pg_catalog.round(checkin.distance_from_unit_m::numeric, 1)::text || ' m',
      'accepted'::text
    from public.fortalfy_gym_checkins checkin
    where checkin.plate_id = p_plate_id
    union all
    select 'contract_event'::text, event.created_at,
      event.event_type || ': ' || event.notes, null::text
    from public.fortalfy_gym_access_contract_events event
    join public.fortalfy_gym_access_contracts contract on contract.id = event.contract_id
    where contract.unit_id = (
      select plate.unit_id from public.fortalfy_gym_plates plate where plate.id = p_plate_id
    )
    order by 2 desc
    limit 100;
end;
$$;
revoke all on function public.fortalfy_admin_gym_plate_history(uuid) from public, anon;
grant execute on function public.fortalfy_admin_gym_plate_history(uuid) to authenticated;

create or replace function public.fortalfy_admin_create_gym_unit(
  p_profile_id uuid,
  p_listing_id uuid,
  p_unit_name text,
  p_address text,
  p_latitude double precision,
  p_longitude double precision,
  p_timezone_name text,
  p_checkin_radius_m integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
begin
  if not public.is_fortalfy_admin() then
    raise exception 'Admin role required';
  end if;
  if not exists (
    select 1 from public.partner_listings listing
    join public.profiles profile on profile.id = listing.profile_id
    where listing.id = p_listing_id and profile.id = p_profile_id
      and profile.kind = 'academia'::public.profile_kind
      and profile.partner_approved_at is not null
  ) then
    raise exception 'An approved academy listing is required';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone_name) then
    raise exception 'A valid IANA timezone is required';
  end if;
  insert into public.fortalfy_gym_units
    (profile_id, listing_id, unit_name, address, latitude, longitude, timezone_name, checkin_radius_m, created_by)
  values
    (p_profile_id, p_listing_id, p_unit_name, p_address, p_latitude, p_longitude, p_timezone_name, p_checkin_radius_m, auth.uid())
  returning id into result_id;
  return result_id;
end;
$$;
revoke all on function public.fortalfy_admin_create_gym_unit(uuid, uuid, text, text, double precision, double precision, text, integer) from public, anon;
grant execute on function public.fortalfy_admin_create_gym_unit(uuid, uuid, text, text, double precision, double precision, text, integer) to authenticated;

create or replace function public.fortalfy_admin_create_gym_access_contract(
  p_unit_id uuid,
  p_contract_reference text,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
begin
  if not public.is_fortalfy_admin() then
    raise exception 'Admin role required';
  end if;
  if not exists (
    select 1 from public.fortalfy_gym_units unit
    join public.profiles profile on profile.id = unit.profile_id
    where unit.id = p_unit_id and unit.active
      and profile.kind = 'academia'::public.profile_kind
      and profile.partner_approved_at is not null
  ) then
    raise exception 'An active unit at an approved academy is required';
  end if;
  with expired as (
    update public.fortalfy_gym_access_contracts
    set status = 'expired'
    where unit_id = p_unit_id and status = 'active'
      and valid_until is not null and valid_until <= now()
    returning id
  )
  insert into public.fortalfy_gym_access_contract_events
    (contract_id, event_type, notes, actor_id)
  select id, 'expired', 'Contrato expirado automaticamente após a data de vigência.', auth.uid()
  from expired;

  insert into public.fortalfy_gym_access_contracts
    (unit_id, contract_reference, valid_from, valid_until, notes, approved_by)
  values
    (p_unit_id, trim(p_contract_reference), p_valid_from, p_valid_until, trim(p_notes), auth.uid())
  returning id into result_id;
  insert into public.fortalfy_gym_access_contract_events
    (contract_id, event_type, notes, actor_id)
  values (result_id, 'approved', trim(p_notes), auth.uid());
  return result_id;
end;
$$;
revoke all on function public.fortalfy_admin_create_gym_access_contract(uuid, text, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.fortalfy_admin_create_gym_access_contract(uuid, text, timestamptz, timestamptz, text) to authenticated;

create or replace function public.fortalfy_admin_set_gym_access_contract_status(
  p_contract_id uuid,
  p_status text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_fortalfy_admin() then
    raise exception 'Admin role required';
  end if;
  if p_status not in ('suspended', 'expired') then
    raise exception 'Only suspension or expiration can be recorded';
  end if;
  update public.fortalfy_gym_access_contracts
    set status = p_status
    where id = p_contract_id and status = 'active';
  if not found then
    raise exception 'An active access contract was not found';
  end if;
  insert into public.fortalfy_gym_access_contract_events
    (contract_id, event_type, notes, actor_id)
  values (p_contract_id, p_status, trim(p_notes), auth.uid());
end;
$$;
revoke all on function public.fortalfy_admin_set_gym_access_contract_status(uuid, text, text) from public, anon;
grant execute on function public.fortalfy_admin_set_gym_access_contract_status(uuid, text, text) to authenticated;

create or replace function public.fortalfy_admin_create_gym_plate(
  p_unit_id uuid,
  p_nfc_tag_label text default null
)
returns table (plate_id uuid, public_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_plate_id uuid;
  new_public_id uuid;
begin
  if not public.is_fortalfy_admin() then
    raise exception 'Admin role required';
  end if;
  if not exists (select 1 from public.fortalfy_gym_units where id = p_unit_id and active) then
    raise exception 'Active gym unit required';
  end if;
  insert into public.fortalfy_gym_plates as inserted_plate (unit_id, nfc_tag_label, created_by)
    values (p_unit_id, nullif(trim(p_nfc_tag_label), ''), auth.uid())
    returning inserted_plate.id, inserted_plate.public_id into new_plate_id, new_public_id;
  plate_id := new_plate_id;
  public_id := new_public_id;
  return next;
end;
$$;
revoke all on function public.fortalfy_admin_create_gym_plate(uuid, text) from public, anon;
grant execute on function public.fortalfy_admin_create_gym_plate(uuid, text) to authenticated;

create or replace function public.fortalfy_admin_record_gym_plate_event(
  p_plate_id uuid,
  p_event_type text,
  p_notes text,
  p_nfc_tag_label text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_fortalfy_admin() then
    raise exception 'Admin role required';
  end if;
  if p_event_type not in ('installation', 'maintenance', 'nfc_registration', 'replacement') then
    raise exception 'Unsupported plate event';
  end if;
  if p_event_type = 'nfc_registration' then
    update public.fortalfy_gym_plates
      set nfc_tag_label = nullif(trim(p_nfc_tag_label), ''), updated_at = now()
      where id = p_plate_id;
    if not found then
      raise exception 'Plate not found';
    end if;
    if nullif(trim(p_nfc_tag_label), '') is null then
      raise exception 'NFC tag registration label is required';
    end if;
  elsif not exists (select 1 from public.fortalfy_gym_plates where id = p_plate_id) then
    raise exception 'Plate not found';
  end if;
  insert into public.fortalfy_gym_plate_events (plate_id, event_type, notes, actor_id)
  values (p_plate_id, p_event_type, trim(p_notes), auth.uid());
end;
$$;
revoke all on function public.fortalfy_admin_record_gym_plate_event(uuid, text, text, text) from public, anon;
grant execute on function public.fortalfy_admin_record_gym_plate_event(uuid, text, text, text) to authenticated;

create or replace function public.fortalfy_admin_set_gym_plate_status(
  p_plate_id uuid,
  p_status text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  target_unit uuid;
begin
  if not public.is_fortalfy_admin() then
    raise exception 'Admin role required';
  end if;
  if p_status not in ('active', 'disabled', 'replaced') then
    raise exception 'Unsupported plate status';
  end if;
  select status, unit_id into current_status, target_unit
    from public.fortalfy_gym_plates where id = p_plate_id for update;
  if not found then
    raise exception 'Plate not found';
  end if;
  if p_status = 'active' then
    if current_status in ('replaced', 'disabled') then
      raise exception 'Create a replacement plate instead of reactivating this plate';
    end if;
    if not exists (
      select 1 from public.fortalfy_gym_plate_events
      where plate_id = p_plate_id and event_type = 'installation'
    ) then
      raise exception 'Record the physical installation before activation';
    end if;
    if not exists (
      select 1 from public.fortalfy_gym_units unit
      join public.profiles profile on profile.id = unit.profile_id
      where unit.id = target_unit and unit.active
        and profile.partner_approved_at is not null
        and profile.kind = 'academia'::public.profile_kind
    ) then
      raise exception 'The unit must be active and its academy approved';
    end if;
  end if;
  update public.fortalfy_gym_plates
    set status = p_status, updated_at = now()
    where id = p_plate_id;
  insert into public.fortalfy_gym_plate_events (plate_id, event_type, notes, actor_id)
  values (
    p_plate_id,
    case when p_status = 'replaced' then 'replacement' else 'status_change' end,
    trim(p_notes),
    auth.uid()
  );
end;
$$;
revoke all on function public.fortalfy_admin_set_gym_plate_status(uuid, text, text) from public, anon;
grant execute on function public.fortalfy_admin_set_gym_plate_status(uuid, text, text) to authenticated;

create or replace function public.fortalfy_checkin_with_plate(
  p_public_id uuid,
  p_request_key uuid,
  p_method_claimed text,
  p_latitude double precision,
  p_longitude double precision,
  p_location_accuracy_m double precision
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  plate record;
  existing_attempt public.fortalfy_gym_checkin_attempts%rowtype;
  membership_exists boolean;
  distance_m double precision;
  checkin_id uuid;
  contract_id uuid;
  local_service_date date;
  rejection_reason text;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if p_public_id is null or p_request_key is null
    or p_method_claimed is null or p_method_claimed not in ('qr', 'nfc')
    or p_latitude is null or p_longitude is null or p_location_accuracy_m is null
    or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
    or p_location_accuracy_m not between 0 and 1000 then
    raise exception 'Valid idempotency key and location are required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));
  select * into existing_attempt
    from public.fortalfy_gym_checkin_attempts
    where user_id = caller_id and request_key = p_request_key;
  if found then
    if existing_attempt.result = 'accepted' then
      select id into checkin_id from public.fortalfy_gym_checkins
        where user_id = caller_id and request_key = p_request_key;
      return jsonb_build_object('accepted', true, 'checkin_id', checkin_id, 'idempotent', true);
    end if;
    return jsonb_build_object('accepted', false, 'reason', existing_attempt.reason, 'idempotent', true);
  end if;

  select candidate.id, candidate.unit_id, candidate.status, unit.active,
    unit.timezone_name, unit.checkin_radius_m, unit.latitude, unit.longitude,
      profile.partner_approved_at, profile.kind
    into plate
    from public.fortalfy_gym_plates candidate
    join public.fortalfy_gym_units unit on unit.id = candidate.unit_id
    join public.profiles profile on profile.id = unit.profile_id
    where candidate.public_id = p_public_id;
  if not found then
    rejection_reason := 'plate_not_found';
  elsif plate.status <> 'active' or not plate.active or plate.partner_approved_at is null
    or plate.kind <> 'academia'::public.profile_kind then
    rejection_reason := 'plate_or_academy_inactive';
  end if;

  if rejection_reason is null then
    select access_contract.id into contract_id
      from public.fortalfy_gym_access_contracts access_contract
      where access_contract.unit_id = plate.unit_id
        and access_contract.status = 'active'
        and access_contract.valid_from <= now()
        and (access_contract.valid_until is null or access_contract.valid_until > now())
      order by access_contract.valid_from desc
      limit 1;
    if not found then
      rejection_reason := 'no_active_gym_contract';
    end if;
  end if;

  if rejection_reason is null then
    select exists (
      select 1 from public.fortalfy_pass_entitlements entitlement
      where entitlement.user_id = caller_id and entitlement.status = 'active'
        and entitlement.valid_from <= now()
        and (entitlement.valid_until is null or entitlement.valid_until > now())
    ) into membership_exists;
    if not membership_exists then
      rejection_reason := 'no_eligible_membership';
    end if;
  end if;

  if rejection_reason is null then
    distance_m := 6371000 * 2 * pg_catalog.asin(least(1::double precision, pg_catalog.sqrt(
      pg_catalog.power(pg_catalog.sin(pg_catalog.radians(p_latitude - plate.latitude) / 2), 2)
      + pg_catalog.cos(pg_catalog.radians(plate.latitude))
        * pg_catalog.cos(pg_catalog.radians(p_latitude))
        * pg_catalog.power(pg_catalog.sin(pg_catalog.radians(p_longitude - plate.longitude) / 2), 2)
    )));
    if p_location_accuracy_m > plate.checkin_radius_m
      or distance_m + p_location_accuracy_m > plate.checkin_radius_m then
      rejection_reason := 'outside_location_radius';
    end if;
  end if;

  if rejection_reason is null then
    local_service_date := (now() at time zone plate.timezone_name)::date;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(caller_id::text || plate.unit_id::text || local_service_date::text, 1)
    );
    select id into checkin_id
      from public.fortalfy_gym_checkins
      where user_id = caller_id and status = 'in_progress';
    if found then
      rejection_reason := 'active_visit_exists';
    end if;
  end if;

  if rejection_reason is null then
    select id into checkin_id
      from public.fortalfy_gym_checkins
      where user_id = caller_id and unit_id = plate.unit_id and service_date = local_service_date;
    if found then
      rejection_reason := 'daily_access_already_recorded';
    end if;
  end if;

  if rejection_reason is not null then
    insert into public.fortalfy_gym_checkin_attempts
      (user_id, request_key, plate_id, result, reason)
    values (caller_id, p_request_key, plate.id, 'denied', rejection_reason);
    return jsonb_build_object('accepted', false, 'reason', rejection_reason, 'idempotent', false);
  end if;

  insert into public.fortalfy_gym_checkins (
    request_key, user_id, unit_id, plate_id, contract_id, service_date, access_method_claimed,
    location_accuracy_m, distance_from_unit_m, financial_status
  ) values (
    p_request_key, caller_id, plate.unit_id, plate.id, contract_id, local_service_date, p_method_claimed,
    p_location_accuracy_m, distance_m, 'not_configured'
  ) returning id into checkin_id;

  insert into public.fortalfy_gym_checkin_attempts
    (user_id, request_key, plate_id, result, reason)
  values (caller_id, p_request_key, plate.id, 'accepted', 'accepted');
  return jsonb_build_object(
    'accepted', true,
    'checkin_id', checkin_id,
    'financial_status', 'not_configured',
    'distance_m', pg_catalog.round(distance_m::numeric, 1),
    'idempotent', false
  );
end;
$$;
revoke all on function public.fortalfy_checkin_with_plate(uuid, uuid, text, double precision, double precision, double precision) from public, anon;
grant execute on function public.fortalfy_checkin_with_plate(uuid, uuid, text, double precision, double precision, double precision) to authenticated;

create or replace function public.fortalfy_checkout_gym_visit(p_checkin_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  visit public.fortalfy_gym_checkins%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  select * into visit
    from public.fortalfy_gym_checkins
    where id = p_checkin_id and user_id = caller_id
    for update;
  if not found then
    raise exception 'Check-in not found';
  end if;
  if visit.status = 'completed' then
    return jsonb_build_object('completed', true, 'completed_at', visit.completed_at, 'idempotent', true);
  end if;
  update public.fortalfy_gym_checkins
    set status = 'completed', completed_at = now(), exit_confirmation = 'member_confirmed_in_app'
    where id = p_checkin_id;
  return jsonb_build_object('completed', true, 'completed_at', now(), 'idempotent', false);
end;
$$;
revoke all on function public.fortalfy_checkout_gym_visit(uuid) from public, anon;
grant execute on function public.fortalfy_checkout_gym_visit(uuid) to authenticated;
