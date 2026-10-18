-- Fortalfy Training & Performance V2
-- Apply after FORTALFY_WEEKLY_PLANS_AND_USERNAMES_V1.sql.
-- Adds versioned prescriptions and execution records without removing legacy data.

begin;

alter table public.weekly_training_plans
  add column if not exists status text not null default 'published',
  add column if not exists version integer not null default 1,
  add column if not exists published_at timestamptz,
  add column if not exists goal text not null default '',
  add column if not exists warmup text not null default '';

update public.weekly_training_plans
set published_at = coalesce(published_at, confirmed_at, updated_at)
where status = 'published' and published_at is null;

alter table public.weekly_training_plans
  alter column status set default 'draft';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'weekly_training_plans_status_check') then
    alter table public.weekly_training_plans
      add constraint weekly_training_plans_status_check check (status in ('draft', 'published', 'archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'weekly_training_plans_version_check') then
    alter table public.weekly_training_plans
      add constraint weekly_training_plans_version_check check (version > 0);
  end if;
end $$;

create table if not exists public.weekly_training_plan_revisions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.weekly_training_plans(id) on delete set null,
  professional_id uuid references public.profiles(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  version integer not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists weekly_training_plan_revisions_client_idx
  on public.weekly_training_plan_revisions(client_id, created_at desc);
create index if not exists weekly_training_plan_revisions_professional_idx
  on public.weekly_training_plan_revisions(professional_id, created_at desc);

create or replace function public.validate_fortalfy_weekly_training_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  day jsonb;
  exercise jsonb;
  day_number integer := 0;
begin
  if jsonb_typeof(new.days) is distinct from 'array' or jsonb_array_length(new.days) <> 7 then
    raise exception 'A training plan must include all seven days';
  end if;

  for day in select value from jsonb_array_elements(new.days) loop
    if jsonb_typeof(day -> 'exercises') is distinct from 'array' then
      raise exception 'Each training day needs an exercise list';
    end if;
    if coalesce((day ->> 'is_rest_day')::boolean, false) then
      if jsonb_array_length(day -> 'exercises') <> 0 then
        raise exception 'A rest day cannot contain prescribed exercises';
      end if;
    else
      if coalesce(btrim(day ->> 'workout_name'), '') = '' or jsonb_array_length(day -> 'exercises') < 1 then
        raise exception 'Each training day needs a workout name and at least one exercise, or must be marked as rest';
      end if;
      for exercise in select value from jsonb_array_elements(day -> 'exercises') loop
        if coalesce(btrim(exercise ->> 'name'), '') = '' then
          raise exception 'Each exercise needs a name';
        end if;
        if coalesce(btrim(exercise ->> 'sets'), '') = ''
           and coalesce(btrim(exercise ->> 'duration'), '') = ''
           and coalesce(btrim(exercise ->> 'distance'), '') = '' then
          raise exception 'Each exercise needs sets or a duration or distance';
        end if;
        if coalesce(exercise ->> 'video_url', '') <> ''
           and exercise ->> 'video_url' !~ '^https://[^[:space:]]+$' then
          raise exception 'Exercise demonstration links must use HTTPS';
        end if;
      end loop;
    end if;
    day_number := day_number + 1;
  end loop;

  if tg_op = 'UPDATE'
     and (new.title is distinct from old.title
       or new.days is distinct from old.days
       or new.goal is distinct from old.goal
       or new.warmup is distinct from old.warmup) then
    insert into public.weekly_training_plan_revisions
      (plan_id, professional_id, client_id, version, snapshot)
    values
      (old.id, old.professional_id, old.client_id, old.version,
       jsonb_build_object('title', old.title, 'days', old.days, 'goal', old.goal,
         'warmup', old.warmup, 'status', old.status, 'published_at', old.published_at,
         'confirmed_at', old.confirmed_at, 'version', old.version));
    new.version := old.version + 1;
    new.status := 'draft';
    new.published_at := null;
    new.confirmed_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists weekly_training_plans_validate on public.weekly_training_plans;
create trigger weekly_training_plans_validate
  before insert or update on public.weekly_training_plans
  for each row execute function public.validate_fortalfy_weekly_training_plan();

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.weekly_training_plans(id) on delete set null,
  client_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid references public.profiles(id) on delete set null,
  plan_version integer not null check (plan_version > 0),
  day_index integer not null check (day_index between 0 and 6),
  scheduled_date date not null,
  status text not null default 'in_progress' check (status in ('scheduled', 'in_progress', 'paused', 'completed', 'cancelled', 'rescheduled')),
  started_at timestamptz not null default now(),
  pause_started_at timestamptz,
  paused_seconds integer not null default 0 check (paused_seconds >= 0),
  completed_at timestamptz,
  duration_minutes integer check (duration_minutes between 1 and 1440),
  client_notes text not null default '' check (char_length(client_notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop index if exists public.training_sessions_one_active_day_idx;
create unique index training_sessions_one_active_day_idx
  on public.training_sessions(plan_id, day_index, scheduled_date)
  where plan_id is not null and status not in ('cancelled', 'rescheduled');
create index if not exists training_sessions_client_date_idx
  on public.training_sessions(client_id, scheduled_date desc);
create index if not exists training_sessions_professional_date_idx
  on public.training_sessions(professional_id, scheduled_date desc);

create table if not exists public.training_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  exercise_index integer not null check (exercise_index between 0 and 49),
  prescription jsonb not null check (jsonb_typeof(prescription) = 'object'),
  created_at timestamptz not null default now(),
  unique (session_id, exercise_index)
);
create index if not exists training_session_exercises_session_idx
  on public.training_session_exercises(session_id, exercise_index);

create table if not exists public.training_set_entries (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.training_session_exercises(id) on delete cascade,
  set_number integer not null check (set_number between 1 and 100),
  actual_load numeric(8,2) check (actual_load is null or actual_load >= 0),
  load_unit text not null default 'kg' check (load_unit in ('kg', 'lb', 'bodyweight', 'none')),
  actual_reps integer check (actual_reps is null or actual_reps between 0 and 10000),
  actual_duration_minutes integer check (actual_duration_minutes is null or actual_duration_minutes between 0 and 1440),
  actual_distance numeric(10,2) check (actual_distance is null or actual_distance >= 0),
  distance_unit text not null default 'km' check (distance_unit in ('km', 'm', 'mi')),
  completed boolean not null default false,
  rest_seconds integer check (rest_seconds is null or rest_seconds between 0 and 3600),
  rpe numeric(3,1) check (rpe is null or rpe between 1 and 10),
  notes text not null default '' check (char_length(notes) <= 1000),
  updated_at timestamptz not null default now(),
  unique (session_exercise_id, set_number)
);
create index if not exists training_set_entries_exercise_idx
  on public.training_set_entries(session_exercise_id, set_number);

create or replace function public.is_fortalfy_training_session_participant(session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.training_sessions s
    where s.id = session_id and auth.uid() in (s.client_id, s.professional_id)
  );
$$;

create or replace function public.is_fortalfy_training_session_client(session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.training_sessions s
    where s.id = session_id and s.client_id = auth.uid() and s.status = 'in_progress'
  );
$$;

revoke all on function public.is_fortalfy_training_session_participant(uuid) from public, anon;
revoke all on function public.is_fortalfy_training_session_client(uuid) from public, anon;
grant execute on function public.is_fortalfy_training_session_participant(uuid) to authenticated;
grant execute on function public.is_fortalfy_training_session_client(uuid) to authenticated;

create or replace function public.start_fortalfy_training_session(plan_id uuid, day_index integer, scheduled_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan public.weekly_training_plans%rowtype;
  day jsonb;
  session_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if day_index < 0 or day_index > 6 then raise exception 'Invalid training day'; end if;
  select * into plan from public.weekly_training_plans p
    where p.id = plan_id and p.client_id = auth.uid() and p.status = 'published' and p.confirmed_at is not null;
  if not found then raise exception 'Published training plan not found for this account'; end if;
  day := plan.days -> day_index;
  if coalesce((day ->> 'is_rest_day')::boolean, false)
     or jsonb_typeof(day -> 'exercises') is distinct from 'array'
     or jsonb_array_length(day -> 'exercises') = 0 then
    raise exception 'This date has no prescribed workout';
  end if;

  select s.id into session_id from public.training_sessions s
    where s.plan_id = plan.id and s.day_index = start_fortalfy_training_session.day_index
      and s.scheduled_date = start_fortalfy_training_session.scheduled_date and s.status not in ('cancelled', 'rescheduled')
    limit 1;
  if session_id is not null then return session_id; end if;

  insert into public.training_sessions(plan_id, client_id, professional_id, plan_version, day_index, scheduled_date)
    values(plan.id, plan.client_id, plan.professional_id, plan.version, day_index, scheduled_date)
    returning id into session_id;
  insert into public.training_session_exercises(session_id, exercise_index, prescription)
    select session_id, (item.ordinality - 1)::integer, item.value
    from jsonb_array_elements(day -> 'exercises') with ordinality as item(value, ordinality);
  return session_id;
end;
$$;

revoke all on function public.start_fortalfy_training_session(uuid, integer, date) from public, anon;
grant execute on function public.start_fortalfy_training_session(uuid, integer, date) to authenticated;

create or replace function public.guard_fortalfy_training_session_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.plan_id is distinct from old.plan_id
     or new.client_id is distinct from old.client_id or new.professional_id is distinct from old.professional_id
     or new.plan_version is distinct from old.plan_version or new.day_index is distinct from old.day_index
     or new.scheduled_date is distinct from old.scheduled_date or new.started_at is distinct from old.started_at then
    raise exception 'Training prescription identity and schedule are immutable';
  end if;
  if new.paused_seconds is distinct from old.paused_seconds
     and not (old.status = 'paused' and new.status in ('in_progress', 'completed', 'cancelled', 'rescheduled')) then
    raise exception 'Paused time is maintained by the session state';
  end if;
  if new.pause_started_at is distinct from old.pause_started_at
     and not ((old.status = 'in_progress' and new.status = 'paused')
       or (old.status = 'paused' and new.status in ('in_progress', 'completed', 'cancelled', 'rescheduled'))) then
    raise exception 'Pause state is maintained by the session state';
  end if;
  if new.status not in ('in_progress', 'paused', 'completed', 'cancelled', 'rescheduled') then
    raise exception 'Invalid training session status';
  end if;
  if old.status in ('completed', 'cancelled', 'rescheduled') then
    raise exception 'A finished training session cannot be changed';
  end if;
  if new.status = 'paused' and old.status = 'in_progress' then
    new.pause_started_at := now();
  elsif new.status = 'in_progress' and old.status = 'paused' then
    new.paused_seconds := old.paused_seconds + greatest(0, floor(extract(epoch from (now() - old.pause_started_at)))::integer);
    new.pause_started_at := null;
  elsif new.status = 'completed' then
    if old.status = 'paused' then
      new.paused_seconds := old.paused_seconds + greatest(0, floor(extract(epoch from (now() - old.pause_started_at)))::integer);
    end if;
    new.completed_at := now();
    new.duration_minutes := greatest(1, ceil((extract(epoch from (new.completed_at - new.started_at)) - new.paused_seconds) / 60)::integer);
    new.pause_started_at := null;
  else
    if old.status = 'paused' and new.status in ('cancelled', 'rescheduled') then
      new.paused_seconds := old.paused_seconds + greatest(0, floor(extract(epoch from (now() - old.pause_started_at)))::integer);
    end if;
    new.completed_at := null;
    new.duration_minutes := null;
    if new.status in ('cancelled', 'rescheduled') then new.pause_started_at := null; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists training_sessions_guard_update on public.training_sessions;
create trigger training_sessions_guard_update before update on public.training_sessions
  for each row execute function public.guard_fortalfy_training_session_update();

alter table public.weekly_training_plan_revisions enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_session_exercises enable row level security;
alter table public.training_set_entries enable row level security;

drop policy if exists "participants read weekly training plans" on public.weekly_training_plans;
create policy "participants read weekly training plans" on public.weekly_training_plans
  for select to authenticated using (
    (client_id = auth.uid() and status = 'published') or professional_id = auth.uid()
  );

drop policy if exists "clients read own training completion" on public.training_plan_completions;
create policy "participants read training completion" on public.training_plan_completions
  for select to authenticated using (
    client_id = auth.uid() or exists (
      select 1 from public.weekly_training_plans plan
      where plan.id = plan_id and plan.professional_id = auth.uid()
    )
  );

drop policy if exists "participants read training plan revisions" on public.weekly_training_plan_revisions;
create policy "participants read training plan revisions" on public.weekly_training_plan_revisions
  for select to authenticated using (client_id = auth.uid() or professional_id = auth.uid());
drop policy if exists "participants read training sessions" on public.training_sessions;
create policy "participants read training sessions" on public.training_sessions
  for select to authenticated using (public.is_fortalfy_training_session_participant(id));
drop policy if exists "clients update own training sessions" on public.training_sessions;
create policy "clients update own training sessions" on public.training_sessions
  for update to authenticated using (client_id = auth.uid() and status in ('in_progress', 'paused'))
  with check (client_id = auth.uid());
drop policy if exists "participants read session exercises" on public.training_session_exercises;
create policy "participants read session exercises" on public.training_session_exercises
  for select to authenticated using (public.is_fortalfy_training_session_participant(session_id));
drop policy if exists "participants read set entries" on public.training_set_entries;
create policy "participants read set entries" on public.training_set_entries
  for select to authenticated using (exists (
    select 1 from public.training_session_exercises e
    where e.id = session_exercise_id and public.is_fortalfy_training_session_participant(e.session_id)
  ));
drop policy if exists "clients manage active set entries" on public.training_set_entries;
create policy "clients manage active set entries" on public.training_set_entries
  for all to authenticated using (exists (
    select 1 from public.training_session_exercises e
    where e.id = session_exercise_id and public.is_fortalfy_training_session_client(e.session_id)
  )) with check (exists (
    select 1 from public.training_session_exercises e
    where e.id = session_exercise_id and public.is_fortalfy_training_session_client(e.session_id)
  ));

grant select on public.weekly_training_plan_revisions to authenticated;
grant select, update on public.training_sessions to authenticated;
grant select on public.training_session_exercises to authenticated;
grant select, insert, update, delete on public.training_set_entries to authenticated;

create or replace function public.publish_fortalfy_training_plan(plan_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare result timestamptz;
begin
  update public.weekly_training_plans p
    set status = 'published', published_at = now(), confirmed_at = null
    where p.id = publish_fortalfy_training_plan.plan_id and p.professional_id = auth.uid()
      and public.is_fortalfy_plan_client(p.professional_id, p.client_id, 'personal')
    returning published_at into result;
  if result is null then raise exception 'Training plan not found for this professional'; end if;
  return result;
end;
$$;
revoke all on function public.publish_fortalfy_training_plan(uuid) from public, anon;
grant execute on function public.publish_fortalfy_training_plan(uuid) to authenticated;

notify pgrst, 'reload schema';

create or replace function public.confirm_fortalfy_training_plan(plan_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare result timestamptz;
begin
  update public.weekly_training_plans p
    set confirmed_at = coalesce(p.confirmed_at, now())
    where p.id = confirm_fortalfy_training_plan.plan_id
      and p.client_id = auth.uid() and p.status = 'published'
    returning p.confirmed_at into result;
  if result is null then raise exception 'Published training plan not found for this account'; end if;
  return result;
end;
$$;
revoke all on function public.confirm_fortalfy_training_plan(uuid) from public, anon;
grant execute on function public.confirm_fortalfy_training_plan(uuid) to authenticated;

commit;
