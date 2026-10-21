-- FortalCreator program foundation. Apply after:
-- FORTALFY_PROFESSIONAL_PROFILES_AND_LINKS_V1.sql and
-- FORTALFY_PROFESSIONAL_ONBOARDING_V2.sql.
-- Payments, biometric verification, referral attribution and video delivery are intentionally not implemented here.

begin;

create table if not exists public.creator_program_levels (
  level_key text primary key check (level_key in ('Start','Pro','Oficial')),
  criteria jsonb not null default '{}'::jsonb check (jsonb_typeof(criteria) = 'object'),
  benefits jsonb not null default '[]'::jsonb check (jsonb_typeof(benefits) = 'array'),
  is_active boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.creator_program_levels(level_key) values ('Start'),('Pro'),('Oficial') on conflict do nothing;
alter table public.creator_program_levels enable row level security;
grant select on public.creator_program_levels to authenticated;
grant insert, update, delete on public.creator_program_levels to authenticated;
drop policy if exists "users read active Creator levels" on public.creator_program_levels;
create policy "users read active Creator levels" on public.creator_program_levels
  for select to authenticated using (is_active or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');
drop policy if exists "admins manage Creator levels" on public.creator_program_levels;
create policy "admins manage Creator levels" on public.creator_program_levels
  for all to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');

create table if not exists public.creator_metrics_snapshots (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  valid_referral_visits bigint not null default 0 check (valid_referral_visits >= 0),
  activated_users bigint not null default 0 check (activated_users >= 0),
  fortalfy_followers bigint not null default 0 check (fortalfy_followers >= 0),
  content_quality_score numeric(5,2) check (content_quality_score between 0 and 100),
  content_regularity_score numeric(5,2) check (content_regularity_score between 0 and 100),
  assigned_level text references public.creator_program_levels(level_key) on delete set null,
  source_details jsonb not null default '{}'::jsonb check (jsonb_typeof(source_details) = 'object'),
  calculated_at timestamptz not null default now()
);
alter table public.creator_metrics_snapshots enable row level security;
grant select on public.creator_metrics_snapshots to authenticated;
grant insert, update, delete on public.creator_metrics_snapshots to authenticated;
drop policy if exists "Creators read own metrics and admins read all" on public.creator_metrics_snapshots;
create policy "Creators read own metrics and admins read all" on public.creator_metrics_snapshots
  for select to authenticated using (profile_id = auth.uid() or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');
drop policy if exists "Admins manage Creator metric snapshots" on public.creator_metrics_snapshots;
create policy "Admins manage Creator metric snapshots" on public.creator_metrics_snapshots
  for all to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');

create table if not exists public.creator_course_instructors (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now()
);
alter table public.creator_course_instructors enable row level security;
grant select, insert, update, delete on public.creator_course_instructors to authenticated;
drop policy if exists "Instructors read own authorization and admins read all" on public.creator_course_instructors;
create policy "Instructors read own authorization and admins read all" on public.creator_course_instructors
  for select to authenticated using (profile_id = auth.uid() or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');
drop policy if exists "Admins authorize course instructors" on public.creator_course_instructors;
create policy "Admins authorize course instructors" on public.creator_course_instructors
  for all to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin' and approved_by = auth.uid());

create table if not exists public.creator_courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  summary text not null default '' check (char_length(summary) <= 3000),
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creator_courses_catalog_idx on public.creator_courses(status, created_at desc);
alter table public.creator_courses enable row level security;
grant select, insert, update, delete on public.creator_courses to authenticated;
drop policy if exists "Users read published Creator courses" on public.creator_courses;
create policy "Users read published Creator courses" on public.creator_courses
  for select to authenticated using (status = 'published' or instructor_id = auth.uid() or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');
drop policy if exists "Authorized instructors manage own Creator courses" on public.creator_courses;
create policy "Authorized instructors manage own Creator courses" on public.creator_courses
  for all to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin' or (instructor_id = auth.uid() and exists (select 1 from public.creator_course_instructors i where i.profile_id = auth.uid())))
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin' or (instructor_id = auth.uid() and exists (select 1 from public.creator_course_instructors i where i.profile_id = auth.uid())));

create table if not exists public.creator_course_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.creator_courses(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null default '' check (char_length(body) <= 50000),
  media_path text,
  position integer not null default 0 check (position >= 0),
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  unique(course_id, position)
);
create or replace function public.guard_creator_course_publication()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'published'
     and not exists (select 1 from public.creator_course_lessons where course_id = new.id) then
    raise exception 'A course needs at least one lesson before publication';
  end if;
  return new;
end;
$$;
drop trigger if exists creator_course_publication_guard on public.creator_courses;
create trigger creator_course_publication_guard before insert or update of status on public.creator_courses
  for each row execute function public.guard_creator_course_publication();

create table if not exists public.creator_course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.creator_courses(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','refunded','revoked')),
  enrolled_at timestamptz not null default now(),
  unique(course_id, profile_id)
);
create table if not exists public.creator_course_orders (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.creator_courses(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status text not null default 'pending' check (status in ('pending','paid','cancelled','refunded')),
  provider text,
  provider_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_payment_id)
);
alter table public.creator_course_orders enable row level security;
grant select on public.creator_course_orders to authenticated;
drop policy if exists "Learners and admins read Creator course orders" on public.creator_course_orders;
create policy "Learners and admins read Creator course orders" on public.creator_course_orders
  for select to authenticated using (profile_id = auth.uid() or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');
alter table public.creator_course_enrollments enable row level security;
grant select on public.creator_course_enrollments to authenticated;
drop policy if exists "Learners and course instructors read Creator enrollments" on public.creator_course_enrollments;
create policy "Learners and course instructors read Creator enrollments" on public.creator_course_enrollments
  for select to authenticated using (
    profile_id = auth.uid()
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin'
    or exists (select 1 from public.creator_courses c where c.id = course_id and c.instructor_id = auth.uid())
  );

create index if not exists creator_course_lessons_order_idx on public.creator_course_lessons(course_id, position);
alter table public.creator_course_lessons enable row level security;
grant select, insert, update, delete on public.creator_course_lessons to authenticated;
drop policy if exists "Enrolled users read Creator lessons" on public.creator_course_lessons;
create policy "Enrolled users read Creator lessons" on public.creator_course_lessons
  for select to authenticated using (
    is_preview and exists (select 1 from public.creator_courses c where c.id = course_id and c.status = 'published')
    or exists (select 1 from public.creator_course_enrollments e where e.course_id = creator_course_lessons.course_id and e.profile_id = auth.uid() and e.status = 'active')
    or exists (select 1 from public.creator_courses c where c.id = course_id and (c.instructor_id = auth.uid() or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin'))
  );
drop policy if exists "Authorized instructors manage Creator lessons" on public.creator_course_lessons;
create policy "Authorized instructors manage Creator lessons" on public.creator_course_lessons
  for all to authenticated
  using (exists (select 1 from public.creator_courses c where c.id = course_id and (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin' or (c.instructor_id = auth.uid() and exists (select 1 from public.creator_course_instructors i where i.profile_id = auth.uid())))))
  with check (exists (select 1 from public.creator_courses c where c.id = course_id and (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin' or (c.instructor_id = auth.uid() and exists (select 1 from public.creator_course_instructors i where i.profile_id = auth.uid())))));

create or replace function public.enroll_free_creator_course(p_course_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare enrollment_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (select 1 from public.creator_courses where id = p_course_id and status = 'published' and price_cents = 0) then
    raise exception 'Course is unavailable for free enrollment';
  end if;
  insert into public.creator_course_enrollments(course_id, profile_id, status)
  values (p_course_id, auth.uid(), 'active')
  on conflict (course_id, profile_id) do update set status = 'active'
  returning id into enrollment_id;
  return enrollment_id;
end;
$$;
revoke all on function public.enroll_free_creator_course(uuid) from public, anon;
grant execute on function public.enroll_free_creator_course(uuid) to authenticated;

create table if not exists public.creator_live_events (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  description text not null default '' check (char_length(description) <= 3000),
  starts_at timestamptz not null,
  access_mode text not null default 'approved_creator' check (access_mode in ('public','approved_creator')),
  status text not null default 'draft' check (status in ('draft','published','cancelled','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace function public.guard_creator_live_publication()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'published' and new.starts_at <= now() then
    raise exception 'A live must be scheduled in the future before publication';
  end if;
  return new;
end;
$$;
drop trigger if exists creator_live_publication_guard on public.creator_live_events;
create trigger creator_live_publication_guard before insert or update of status, starts_at on public.creator_live_events
  for each row execute function public.guard_creator_live_publication();
create index if not exists creator_live_events_schedule_idx on public.creator_live_events(status, starts_at);
alter table public.creator_live_events enable row level security;
grant select, insert, update, delete on public.creator_live_events to authenticated;
drop policy if exists "Users read published Creator live schedule" on public.creator_live_events;
create policy "Users read published Creator live schedule" on public.creator_live_events
  for select to authenticated using (
    instructor_id = auth.uid()
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin'
    or (status = 'published' and (
      access_mode = 'public'
      or exists (select 1 from public.professional_applications a where a.profile_id = auth.uid() and a.kind = 'influenciador' and a.status = 'approved')
    ))
  );
drop policy if exists "Authorized instructors manage Creator lives" on public.creator_live_events;
create policy "Authorized instructors manage Creator lives" on public.creator_live_events
  for all to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin' or (instructor_id = auth.uid() and exists (select 1 from public.creator_course_instructors i where i.profile_id = auth.uid())))
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin' or (instructor_id = auth.uid() and exists (select 1 from public.creator_course_instructors i where i.profile_id = auth.uid())));

create table if not exists public.creator_live_registrations (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.creator_live_events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'registered' check (status in ('registered','cancelled')),
  created_at timestamptz not null default now(),
  unique(live_id, profile_id)
);
alter table public.creator_live_registrations enable row level security;
grant select on public.creator_live_registrations to authenticated;
drop policy if exists "Participants read own Creator live registrations" on public.creator_live_registrations;
create policy "Participants read own Creator live registrations" on public.creator_live_registrations
  for select to authenticated using (
    profile_id = auth.uid()
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin'
    or exists (select 1 from public.creator_live_events l where l.id = live_id and l.instructor_id = auth.uid())
  );
create or replace function public.register_creator_live(p_live_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare registration_id uuid; live_row public.creator_live_events%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  select * into live_row from public.creator_live_events where id = p_live_id and status = 'published';
  if not found then raise exception 'Live is unavailable'; end if;
  if live_row.access_mode = 'approved_creator' and not exists (
    select 1 from public.professional_applications where profile_id = auth.uid() and kind = 'influenciador' and status = 'approved'
  ) then raise exception 'An approved Creator profile is required'; end if;
  insert into public.creator_live_registrations(live_id, profile_id, status)
  values (p_live_id, auth.uid(), 'registered')
  on conflict (live_id, profile_id) do update set status = 'registered'
  returning id into registration_id;
  return registration_id;
end;
$$;
revoke all on function public.register_creator_live(uuid) from public, anon;
grant execute on function public.register_creator_live(uuid) to authenticated;

create table if not exists public.creator_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  description text not null default '' check (char_length(description) <= 5000),
  opportunity_type text not null check (opportunity_type in ('collab','unboxing','campaign','product')),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','open','closed','cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists creator_campaigns_open_idx on public.creator_campaigns(status, starts_at);
alter table public.creator_campaigns enable row level security;
grant select, insert, update, delete on public.creator_campaigns to authenticated;
drop policy if exists "Creators read open campaigns and admins read all" on public.creator_campaigns;
create policy "Creators read open campaigns and admins read all" on public.creator_campaigns
  for select to authenticated using (status = 'open' or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');
drop policy if exists "Admins manage Creator campaigns" on public.creator_campaigns;
create policy "Admins manage Creator campaigns" on public.creator_campaigns
  for all to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin' and created_by = auth.uid());

create table if not exists public.creator_campaign_applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.creator_campaigns(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  message text not null default '' check (char_length(message) <= 2000),
  status text not null default 'pending' check (status in ('pending','selected','declined','withdrawn')),
  created_at timestamptz not null default now(),
  unique(campaign_id, profile_id)
);
alter table public.creator_campaign_applications enable row level security;
grant select on public.creator_campaign_applications to authenticated;
drop policy if exists "Applicants and admins read campaign applications" on public.creator_campaign_applications;
create policy "Applicants and admins read campaign applications" on public.creator_campaign_applications
  for select to authenticated using (profile_id = auth.uid() or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');
create table if not exists public.creator_campaign_decisions (
  id bigint generated always as identity primary key,
  campaign_application_id uuid not null references public.creator_campaign_applications(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  previous_status text not null,
  new_status text not null check (new_status in ('selected','declined')),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
alter table public.creator_campaign_decisions enable row level security;
grant select on public.creator_campaign_decisions to authenticated;
drop policy if exists "Applicants and admins read campaign decision history" on public.creator_campaign_decisions;
create policy "Applicants and admins read campaign decision history" on public.creator_campaign_decisions
  for select to authenticated using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin'
    or exists (select 1 from public.creator_campaign_applications a where a.id = campaign_application_id and a.profile_id = auth.uid())
  );
create or replace function public.apply_to_creator_campaign(p_campaign_id uuid, p_message text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare application_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if char_length(coalesce(p_message,'')) > 2000 then raise exception 'Application message is too long'; end if;
  if not exists (select 1 from public.professional_applications where profile_id = auth.uid() and kind = 'influenciador' and status = 'approved') then
    raise exception 'An approved Creator profile is required';
  end if;
  if not exists (select 1 from public.creator_campaigns where id = p_campaign_id and status = 'open') then
    raise exception 'Campaign is unavailable';
  end if;
  insert into public.creator_campaign_applications(campaign_id, profile_id, message)
  values (p_campaign_id, auth.uid(), btrim(coalesce(p_message,'')))
  on conflict (campaign_id, profile_id) do update set message = excluded.message, status = 'pending'
  returning id into application_id;
  return application_id;
end;
$$;
revoke all on function public.apply_to_creator_campaign(uuid,text) from public, anon;
grant execute on function public.apply_to_creator_campaign(uuid,text) to authenticated;

create or replace function public.review_creator_campaign_application(p_application_id uuid, p_status text, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare previous_status text;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then raise exception 'Administrator access is required'; end if;
  if p_status not in ('selected','declined') or char_length(coalesce(p_note,'')) > 2000 then raise exception 'Invalid campaign decision'; end if;
  select status into previous_status from public.creator_campaign_applications where id = p_application_id for update;
  if not found then raise exception 'Campaign application not found'; end if;
  update public.creator_campaign_applications set status = p_status where id = p_application_id;
  insert into public.creator_campaign_decisions(campaign_application_id, reviewer_id, previous_status, new_status, note)
  values (p_application_id, auth.uid(), previous_status, p_status, btrim(coalesce(p_note,'')));
end;
$$;
revoke all on function public.review_creator_campaign_application(uuid,text,text) from public, anon;
grant execute on function public.review_creator_campaign_application(uuid,text,text) to authenticated;

commit;
