-- Partnership interest is reviewed separately from professional identity verification.
-- Requires the professional_applications schema from the existing onboarding SQL scripts.
begin;

create table if not exists public.professional_partnership_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.professional_applications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','under_review','correction_required','approved','rejected')),
  request_data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(request_data) = 'object' and pg_column_size(request_data) <= 8192),
  reviewer_note text check (char_length(coalesce(reviewer_note,'')) <= 2000),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  assigned_reviewer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists professional_partnership_requests_review_idx
  on public.professional_partnership_requests(status, submitted_at);
create index if not exists professional_partnership_requests_owner_idx
  on public.professional_partnership_requests(profile_id, updated_at desc);

alter table public.professional_partnership_requests enable row level security;
revoke all on public.professional_partnership_requests from anon, authenticated;
grant select on public.professional_partnership_requests to authenticated;

drop policy if exists "owners and admins read partnership requests" on public.professional_partnership_requests;
create policy "owners and admins read partnership requests" on public.professional_partnership_requests
  for select to authenticated
  using (profile_id = auth.uid() or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');

create table if not exists public.professional_partnership_request_audit (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.professional_partnership_requests(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('approved','correction_required','rejected')),
  reason text not null check (char_length(btrim(reason)) between 3 and 2000),
  decided_at timestamptz not null default now()
);
alter table public.professional_partnership_request_audit enable row level security;
revoke all on public.professional_partnership_request_audit from anon, authenticated;
grant select on public.professional_partnership_request_audit to authenticated;
drop policy if exists "admins read partnership request audit" on public.professional_partnership_request_audit;
create policy "admins read partnership request audit" on public.professional_partnership_request_audit
  for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');

create or replace function public.save_fortalfy_partnership_request(p_application_id uuid, p_request_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  request_id uuid;
  profile_owner uuid;
  current_status text;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if p_request_data is null or jsonb_typeof(p_request_data) <> 'object' or pg_column_size(p_request_data) > 8192 then
    raise exception 'Partnership request data is invalid or too large';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_request_data) as field(key)
    where field.key not in ('business_goals','products_or_services','promotion_interest','marketing_interest','commercial_interest','additional_information')
  ) then raise exception 'Partnership request contains unsupported fields'; end if;
  select profile_id into profile_owner from public.professional_applications
    where id = p_application_id and profile_id = auth.uid();
  if profile_owner is null then raise exception 'Owned professional application not found'; end if;
  select id, status into request_id, current_status from public.professional_partnership_requests
    where application_id = p_application_id for update;
  if request_id is not null and current_status not in ('draft','correction_required','rejected') then
    raise exception 'Partnership request cannot be edited in its current status';
  end if;
  if request_id is null then
    insert into public.professional_partnership_requests(application_id, profile_id, request_data)
      values (p_application_id, auth.uid(), p_request_data) returning id into request_id;
  else
    update public.professional_partnership_requests set request_data = p_request_data,
      reviewer_note = null, reviewed_at = null, assigned_reviewer_id = null, updated_at = now()
      where id = request_id;
  end if;
  return request_id;
end;
$$;
revoke all on function public.save_fortalfy_partnership_request(uuid,jsonb) from public, anon;
grant execute on function public.save_fortalfy_partnership_request(uuid,jsonb) to authenticated;

create or replace function public.submit_fortalfy_partnership_request(p_request_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  request_row public.professional_partnership_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  select * into request_row from public.professional_partnership_requests
    where id = p_request_id and profile_id = auth.uid() for update;
  if not found then raise exception 'Partnership request not found'; end if;
  if request_row.status not in ('draft','correction_required','rejected') then
    raise exception 'Partnership request cannot be submitted in its current status';
  end if;
  if jsonb_typeof(request_row.request_data -> 'business_goals') is distinct from 'string'
    or jsonb_typeof(request_row.request_data -> 'products_or_services') is distinct from 'string'
    or jsonb_typeof(request_row.request_data -> 'additional_information') is distinct from 'string'
    or char_length(btrim(coalesce(request_row.request_data ->> 'business_goals',''))) not between 10 and 1200
    or char_length(btrim(coalesce(request_row.request_data ->> 'products_or_services',''))) not between 10 and 1200
    or jsonb_typeof(request_row.request_data -> 'promotion_interest') is distinct from 'boolean'
    or jsonb_typeof(request_row.request_data -> 'marketing_interest') is distinct from 'boolean'
    or jsonb_typeof(request_row.request_data -> 'commercial_interest') is distinct from 'boolean'
    or char_length(coalesce(request_row.request_data ->> 'additional_information','')) > 2000 then
    raise exception 'Complete the partnership goals and offer details before submission';
  end if;
  update public.professional_partnership_requests set status = 'under_review', submitted_at = now(),
    reviewer_note = null, reviewed_at = null, assigned_reviewer_id = null, updated_at = now()
    where id = p_request_id;
  return 'under_review';
end;
$$;
revoke all on function public.submit_fortalfy_partnership_request(uuid) from public, anon;
grant execute on function public.submit_fortalfy_partnership_request(uuid) to authenticated;

create or replace function public.review_fortalfy_partnership_request(p_request_id uuid, p_status text, p_reviewer_note text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then
    raise exception 'Only an authorized Fortalfy administrator can review partnership requests';
  end if;
  if p_status not in ('approved','correction_required','rejected') then raise exception 'Invalid partnership decision'; end if;
  if char_length(btrim(coalesce(p_reviewer_note,''))) not between 3 and 2000 then raise exception 'Add a decision reason'; end if;
  update public.professional_partnership_requests set status = p_status,
    reviewer_note = btrim(p_reviewer_note), reviewed_at = now(), assigned_reviewer_id = auth.uid(), updated_at = now()
    where id = p_request_id and status in ('under_review','approved','rejected','correction_required');
  if not found then raise exception 'Submitted partnership request not found'; end if;
  insert into public.professional_partnership_request_audit(request_id, reviewer_id, decision, reason)
    values (p_request_id, auth.uid(), p_status, btrim(p_reviewer_note));
  return p_status;
end;
$$;
revoke all on function public.review_fortalfy_partnership_request(uuid,text,text) from public, anon;
grant execute on function public.review_fortalfy_partnership_request(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
