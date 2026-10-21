-- Fortalfy professional onboarding safeguards and Creator review evidence.
-- Apply after FORTALFY_PROFESSIONAL_PROFILES_AND_LINKS_V1.sql.

begin;

alter table public.professional_applications
  add column if not exists sla_due_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists assigned_reviewer_id uuid references public.profiles(id) on delete set null,
  add column if not exists current_revision integer not null default 1 check (current_revision > 0);

alter table public.professional_applications drop constraint if exists professional_applications_kind_check;
alter table public.professional_applications add constraint professional_applications_kind_check
  check (kind in ('empresa','marca','vendedor','restaurante','nutricionista','personal','influenciador','academia'));
alter table public.professional_profile_public drop constraint if exists professional_profile_public_kind_check;
alter table public.professional_profile_public add constraint professional_profile_public_kind_check
  check (kind in ('empresa','marca','vendedor','restaurante','nutricionista','personal','influenciador','academia'));

create table if not exists public.professional_verification_policy (
  policy_key text primary key,
  minimum_followers integer not null check (minimum_followers >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.professional_verification_policy(policy_key, minimum_followers)
values ('fortalfy_creator', 100000)
on conflict (policy_key) do nothing;
alter table public.professional_verification_policy enable row level security;
grant select, insert, update, delete on public.professional_verification_policy to authenticated;
drop policy if exists "admins manage professional verification policy" on public.professional_verification_policy;
create policy "admins manage professional verification policy" on public.professional_verification_policy
  for all to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create table if not exists public.professional_creator_evidence (
  application_id uuid primary key references public.professional_applications(id) on delete cascade,
  observed_followers jsonb not null check (jsonb_typeof(observed_followers) = 'object'),
  observed_total bigint not null check (observed_total >= 0),
  ownership_confirmed boolean not null default false,
  validation_method text not null check (validation_method in ('manual','official_api')),
  evidence_note text not null check (char_length(btrim(evidence_note)) between 3 and 2000),
  observed_at timestamptz not null default now(),
  observed_by uuid not null references public.profiles(id),
  policy_minimum integer not null check (policy_minimum >= 0)
);
alter table public.professional_creator_evidence enable row level security;
grant select on public.professional_creator_evidence to authenticated;
drop policy if exists "admins read Creator evidence" on public.professional_creator_evidence;
create policy "admins read Creator evidence" on public.professional_creator_evidence
  for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create table if not exists public.professional_application_decision_log (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.professional_applications(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  decision text not null check (decision in ('approved','correction_required','rejected','suspended')),
  reason text not null check (char_length(btrim(reason)) between 3 and 2000),
  decided_at timestamptz not null default now(),
  revision integer not null check (revision > 0)
);
alter table public.professional_application_decision_log enable row level security;
grant select on public.professional_application_decision_log to authenticated;
drop policy if exists "admins read professional decision history" on public.professional_application_decision_log;
create policy "admins read professional decision history" on public.professional_application_decision_log
  for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create table if not exists public.professional_document_access_audit (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.professional_applications(id) on delete cascade,
  document_id uuid not null references public.professional_application_documents(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  accessed_at timestamptz not null default now()
);
alter table public.professional_document_access_audit enable row level security;
grant select on public.professional_document_access_audit to authenticated;
drop policy if exists "admins read professional document access audit" on public.professional_document_access_audit;
create policy "admins read professional document access audit" on public.professional_document_access_audit
  for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create or replace function public.record_fortalfy_professional_document_access(p_storage_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  document_row public.professional_application_documents%rowtype;
  is_admin boolean := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  select * into document_row from public.professional_application_documents
    where storage_path = p_storage_path for share;
  if not found then raise exception 'Professional document not found'; end if;
  if not is_admin and document_row.profile_id <> auth.uid() then
    raise exception 'Access to this professional document is not authorized';
  end if;
  insert into public.professional_document_access_audit(application_id, document_id, actor_id)
  values (document_row.application_id, document_row.id, auth.uid());
end;
$$;
revoke all on function public.record_fortalfy_professional_document_access(text) from public, anon;
grant execute on function public.record_fortalfy_professional_document_access(text) to authenticated;

create or replace function public.guard_fortalfy_professional_application()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_admin boolean := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
  is_submit boolean := coalesce(current_setting('fortalfy.application_submission', true), 'off') = 'on';
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.submitted_at is not null or new.reviewer_note is not null then
      raise exception 'Professional applications must begin as drafts';
    end if;
    return new;
  end if;
  if not is_admin and (
    new.profile_id is distinct from old.profile_id
    or new.kind is distinct from old.kind
    or new.status is distinct from old.status and not is_submit
    or new.submitted_at is distinct from old.submitted_at and not is_submit
    or new.reviewer_note is distinct from old.reviewer_note
  ) then
    raise exception 'Only an authorized reviewer can change application status or review notes';
  end if;
  if not is_admin and new.private_data is distinct from old.private_data
    and old.status not in ('draft','correction_required','rejected') then
    raise exception 'This application is locked while it is under review or approved';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.record_fortalfy_creator_evidence(
  p_application_id uuid,
  p_observed_followers jsonb,
  p_ownership_confirmed boolean,
  p_validation_method text,
  p_evidence_note text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  followers_total bigint;
  current_minimum integer;
  platform_value jsonb;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Only an authorized reviewer can record Creator evidence';
  end if;
  if jsonb_typeof(p_observed_followers) <> 'object' then
    raise exception 'Observed follower counts must be provided by social network';
  end if;
  if p_validation_method not in ('manual','official_api') then
    raise exception 'Select a supported evidence validation method';
  end if;
  if char_length(btrim(coalesce(p_evidence_note, ''))) not between 3 and 2000 then
    raise exception 'Record where and how the evidence was checked';
  end if;
  followers_total := 0;
  for platform_value in select value from jsonb_each(p_observed_followers) loop
    if jsonb_typeof(platform_value) <> 'number' or (platform_value #>> '{}') !~ '^[0-9]{1,12}$' then
      raise exception 'Each observed follower count must be a non-negative integer';
    end if;
    followers_total := followers_total + (platform_value #>> '{}')::bigint;
  end loop;
  select minimum_followers into current_minimum
    from public.professional_verification_policy where policy_key = 'fortalfy_creator';
  if current_minimum is null then raise exception 'Creator verification policy is not configured'; end if;
  if not exists (
    select 1 from public.professional_applications
    where id = p_application_id and kind = 'influenciador' and status <> 'draft'
  ) then raise exception 'Submitted Creator application not found'; end if;
  insert into public.professional_creator_evidence(
    application_id, observed_followers, observed_total, ownership_confirmed,
    validation_method, evidence_note, observed_at, observed_by, policy_minimum
  ) values (
    p_application_id, p_observed_followers, followers_total, coalesce(p_ownership_confirmed, false),
    p_validation_method, btrim(p_evidence_note), now(), auth.uid(), current_minimum
  ) on conflict (application_id) do update set
    observed_followers = excluded.observed_followers,
    observed_total = excluded.observed_total,
    ownership_confirmed = excluded.ownership_confirmed,
    validation_method = excluded.validation_method,
    evidence_note = excluded.evidence_note,
    observed_at = excluded.observed_at,
    observed_by = excluded.observed_by,
    policy_minimum = excluded.policy_minimum;
  return followers_total;
end;
$$;
revoke all on function public.record_fortalfy_creator_evidence(uuid,jsonb,boolean,text,text) from public, anon;
grant execute on function public.record_fortalfy_creator_evidence(uuid,jsonb,boolean,text,text) to authenticated;

create or replace function public.review_fortalfy_professional_application(
  p_application_id uuid,
  p_status text,
  p_reviewer_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_kind text;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Only a Fortalfy administrator can review applications';
  end if;
  if p_status not in ('approved','correction_required','rejected','suspended') then
    raise exception 'Invalid review status';
  end if;
  if char_length(btrim(coalesce(p_reviewer_note, ''))) < 3 or char_length(p_reviewer_note) > 2000 then
    raise exception 'Add a clear reason or decision summary before saving the review';
  end if;
  select kind into application_kind from public.professional_applications
    where id = p_application_id and status <> 'draft' for update;
  if not found then raise exception 'Submitted application not found'; end if;
  if p_status = 'approved' and application_kind = 'influenciador' and not exists (
    select 1 from public.professional_creator_evidence evidence
    where evidence.application_id = p_application_id
      and evidence.ownership_confirmed
      and evidence.observed_total >= (
        select policy.minimum_followers from public.professional_verification_policy policy
        where policy.policy_key = 'fortalfy_creator'
      )
  ) then
    raise exception 'Confirm ownership and verify the configured follower minimum before approving an official Creator';
  end if;
  update public.professional_applications
    set status = p_status,
        reviewer_note = btrim(p_reviewer_note),
        reviewed_at = now(),
        assigned_reviewer_id = auth.uid(),
        approved_at = case when p_status = 'approved' then now() else approved_at end,
        rejected_at = case when p_status = 'rejected' then now() else rejected_at end
    where id = p_application_id;
  insert into public.professional_application_decision_log(application_id, reviewer_id, decision, reason, revision)
  select id, auth.uid(), p_status, btrim(p_reviewer_note), current_revision
  from public.professional_applications where id = p_application_id;
  return p_status;
end;
$$;
revoke all on function public.review_fortalfy_professional_application(uuid,text,text) from public, anon;
grant execute on function public.review_fortalfy_professional_application(uuid,text,text) to authenticated;

create or replace function public.is_fortalfy_valid_cpf(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text := regexp_replace(coalesce(p_value,''), '\D', '', 'g');
  total integer;
  remainder integer;
  expected integer;
  i integer;
  pass integer;
begin
  if length(digits) <> 11 or digits ~ '^(.)\1{10}$' then return false; end if;
  for pass in 1..2 loop
    total := 0;
    for i in 1..(8 + pass) loop
      total := total + substr(digits, i, 1)::integer * ((9 + pass) - i + 1);
    end loop;
    remainder := (total * 10) % 11;
    expected := case when remainder = 10 then 0 else remainder end;
    if expected <> substr(digits, 9 + pass, 1)::integer then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.is_fortalfy_valid_cpf(text) from public, anon, authenticated;

create or replace function public.is_fortalfy_valid_cnpj(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text := regexp_replace(coalesce(p_value,''), '\D', '', 'g');
  weights integer[];
  total integer;
  remainder integer;
  expected integer;
  i integer;
  pass integer;
begin
  if length(digits) <> 14 or digits ~ '^(.)\1{13}$' then return false; end if;
  for pass in 1..2 loop
    if pass = 1 then weights := array[5,4,3,2,9,8,7,6,5,4,3,2];
    else weights := array[6,5,4,3,2,9,8,7,6,5,4,3,2]; end if;
    total := 0;
    for i in 1..(11 + pass) loop
      total := total + substr(digits, i, 1)::integer * weights[i];
    end loop;
    remainder := total % 11;
    expected := case when remainder < 2 then 0 else 11 - remainder end;
    if expected <> substr(digits, 12 + pass, 1)::integer then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.is_fortalfy_valid_cnpj(text) from public, anon, authenticated;

create or replace function public.submit_fortalfy_professional_application(p_application_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_row public.professional_applications%rowtype;
  required_keys text[];
  required_key text;
  deadline timestamptz := now();
  local_deadline timestamp;
  business_minutes integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  select * into application_row from public.professional_applications
    where id = p_application_id and profile_id = auth.uid() for update;
  if not found then raise exception 'Professional application not found'; end if;
  if application_row.status not in ('draft', 'correction_required', 'rejected') then
    raise exception 'This application cannot be submitted in its current status';
  end if;
  required_keys := array['displayName','contactEmail','phone','city','addressCountry','addressState','addressCity','addressNeighborhood','addressStreet','addressNumber','addressPostalCode','addressType'] || case application_row.kind
    when 'empresa' then array['description','legalName','businessId','representativeName','representativeDocument','category']
    when 'marca' then array['description','legalName','businessId','representativeName','representativeDocument','category','country']
    when 'vendedor' then array['description','legalName','businessId','representativeName','representativeDocument','category']
    when 'restaurante' then array['description','legalName','businessId','representativeName','representativeDocument','cuisine']
    when 'academia' then array['description','legalName','businessId','representativeName','representativeDocument','category','services','operatingHours']
    when 'nutricionista' then array['description','legalName','personDocument','registrationNumber','registrationRegion','specialties','serviceModes']
    when 'personal' then array['description','legalName','personDocument','registrationNumber','specialties','serviceModes']
    when 'influenciador' then array['description','legalName','personDocument','birthDate','country','fitnessNiches','socialLinks','declaredFollowers']
    else array[]::text[]
  end;
  foreach required_key in array required_keys loop
    if nullif(btrim(application_row.private_data ->> required_key), '') is null then
      raise exception 'Required application field is missing: %', required_key;
    end if;
  end loop;
  if coalesce(application_row.private_data ->> 'addressType','') not in ('residencial','comercial','atendimento','sede') then
    raise exception 'Select a valid address type';
  end if;
  if regexp_replace(coalesce(application_row.private_data ->> 'addressPostalCode',''), '\D', '', 'g') !~ '^[0-9]{8}$' then
    raise exception 'Enter a valid postal code';
  end if;
  if application_row.kind = 'influenciador' and (application_row.private_data ->> 'birthDate')::date > current_date - interval '18 years' then
    raise exception 'Official Creator applications are limited to adults';
  end if;
  if application_row.kind in ('nutricionista','personal','influenciador')
    and not public.is_fortalfy_valid_cpf(application_row.private_data ->> 'personDocument') then
    raise exception 'A valid CPF is required for private identity review';
  end if;
  if application_row.kind in ('empresa','marca','vendedor','restaurante','academia') and (
    not public.is_fortalfy_valid_cnpj(application_row.private_data ->> 'businessId')
    or not public.is_fortalfy_valid_cpf(application_row.private_data ->> 'representativeDocument')
  ) then
    raise exception 'A valid CNPJ and legal representative CPF are required';
  end if;
  if not exists (
    select 1 from public.professional_application_documents document
    where document.application_id = application_row.id and document.profile_id = auth.uid()
  ) then raise exception 'Upload at least one supporting document before submission'; end if;
  -- Target is 24 weekday business hours (09:00-17:00, São Paulo time).
  -- Public holidays are not in the configured calendar and may extend the deadline.
  while business_minutes < 1440 loop
    deadline := deadline + interval '1 minute';
    local_deadline := deadline at time zone 'America/Sao_Paulo';
    if extract(isodow from local_deadline) < 6
      and local_deadline::time > time '09:00'
      and local_deadline::time <= time '17:00' then
      business_minutes := business_minutes + 1;
    end if;
  end loop;
  perform set_config('fortalfy.application_submission', 'on', true);
  update public.professional_applications
    set status = 'under_review', submitted_at = now(), sla_due_at = deadline,
        current_revision = case when submitted_at is null then 1 else current_revision + 1 end,
        reviewer_note = null, reviewed_at = null, rejected_at = null
    where id = application_row.id;
  perform set_config('fortalfy.application_submission', 'off', true);
  return 'under_review';
end;
$$;
revoke all on function public.submit_fortalfy_professional_application(uuid) from public, anon;
grant execute on function public.submit_fortalfy_professional_application(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
