-- Weekly client plans and reserved, case-insensitive Fortalfy usernames.
-- Apply after PRODUCAO_BACKEND_SUPABASE.sql, FORTALFY_AUTH_ONBOARDING_V1.sql,
-- FORTALFY_SOCIAL_V1_SUPABASE.sql, and FORTALFY_STORIES_SUPABASE.sql.

create table if not exists public.reserved_usernames (
  username text primary key check (username ~ '^[a-z0-9._]{3,30}$'),
  created_at timestamptz not null default now()
);

insert into public.reserved_usernames (username)
values ('leblon')
on conflict (username) do nothing;

create or replace function public.is_fortalfy_username_available(
  p_username text,
  p_profile_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized text := lower(btrim(coalesce(p_username, '')));
  actor_id uuid := auth.uid();
begin
  if (actor_id is null and p_profile_id is not null)
     or (actor_id is not null and p_profile_id is not null and p_profile_id <> actor_id) then
    return false;
  end if;
  if normalized !~ '^[a-z0-9._]{3,30}$' then
    return false;
  end if;
  if exists (select 1 from public.reserved_usernames r where r.username = normalized)
     and not exists (
       select 1 from public.profiles p
       where p.id = actor_id and lower(p.username) = normalized
     ) then
    return false;
  end if;
  return not exists (
    select 1 from public.profiles p
    where lower(p.username) = normalized
      and (actor_id is null or p.id <> actor_id)
  );
end;
$$;

revoke all on function public.is_fortalfy_username_available(text, uuid) from public;
grant execute on function public.is_fortalfy_username_available(text, uuid) to anon, authenticated;

create or replace function public.protect_fortalfy_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := lower(btrim(coalesce(new.username, '')));
begin
  if normalized = '' then
    new.username := null;
    return new;
  end if;
  if normalized !~ '^[a-z0-9._]{3,30}$' then
    raise exception 'Username must contain 3-30 lowercase letters, numbers, dots, or underscores'
      using errcode = '23514';
  end if;
  if exists (select 1 from public.reserved_usernames r where r.username = normalized)
     and not (
       tg_op = 'UPDATE'
       and lower(coalesce(old.username, '')) = normalized
       and old.id = new.id
     ) then
    raise exception 'This username is reserved'
      using errcode = '23505', constraint = 'profiles_username_lower_unique';
  end if;
  new.username := normalized;
  return new;
end;
$$;

drop trigger if exists profiles_protect_fortalfy_username on public.profiles;
create trigger profiles_protect_fortalfy_username
  before insert or update of username on public.profiles
  for each row execute function public.protect_fortalfy_username();

create or replace function public.provision_fortalfy_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  display_name_value text;
  username_value text;
  birth_date_value date;
  goals_value text[];
  interests_value text[];
  terms_accepted boolean;
begin
  display_name_value := left(coalesce(
    nullif(btrim(metadata ->> 'display_name'), ''),
    nullif(btrim(metadata ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Pessoa Fortalfy'
  ), 120);

  username_value := lower(btrim(coalesce(metadata ->> 'username', '')));
  if username_value = '' then
    username_value := 'user_' || left(replace(new.id::text, '-', ''), 12);
  elsif username_value !~ '^[a-z0-9._]{3,30}$' then
    raise exception 'Username must contain 3-30 lowercase letters, numbers, dots, or underscores';
  end if;

  if coalesce(metadata ->> 'birth_date', '') <> '' then
    birth_date_value := (metadata ->> 'birth_date')::date;
    if birth_date_value > current_date then
      raise exception 'Birth date cannot be in the future';
    end if;
  end if;

  select coalesce(array_agg(value), '{}')
    into goals_value
    from jsonb_array_elements_text(
      case when jsonb_typeof(metadata -> 'goals') = 'array' then metadata -> 'goals' else '[]'::jsonb end
    ) as item(value)
    where value = any(array['emagrecimento','forca','cardio','mobilidade','alimentacao','bem-estar','comunidade']);

  select coalesce(array_agg(value), '{}')
    into interests_value
    from jsonb_array_elements_text(
      case when jsonb_typeof(metadata -> 'interests') = 'array' then metadata -> 'interests' else '[]'::jsonb end
    ) as item(value)
    where value = any(array['feed','food','shop','treinos','pass']);

  terms_accepted := metadata ->> 'accepted_terms' = 'true';

  insert into public.profiles (id, display_name, username, city)
  values (new.id, display_name_value, username_value, nullif(left(btrim(metadata ->> 'city'), 120), ''))
  on conflict (id) do update
    set display_name = excluded.display_name,
        username = coalesce(public.profiles.username, excluded.username);

  insert into public.user_preferences (
    user_id, birth_date, goals, interests, accepted_terms_at, onboarding_completed
  )
  values (
    new.id,
    birth_date_value,
    goals_value,
    interests_value,
    case when terms_accepted then now() else null end,
    birth_date_value is not null and terms_accepted and cardinality(goals_value) > 0 and cardinality(interests_value) > 0
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.provision_fortalfy_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_provision_fortalfy on auth.users;
create trigger on_auth_user_created_provision_fortalfy
  after insert on auth.users
  for each row execute function public.provision_fortalfy_auth_user();

create table if not exists public.weekly_training_plans (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  title text not null check (char_length(title) between 3 and 120),
  days jsonb not null check (jsonb_typeof(days) = 'array'),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, client_id, week_start),
  check (professional_id <> client_id)
);

create table if not exists public.weekly_nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  title text not null check (char_length(title) between 3 and 120),
  daily_calorie_goal integer not null check (daily_calorie_goal between 500 and 10000),
  days jsonb not null check (jsonb_typeof(days) = 'array'),
  restaurants jsonb not null default '[]'::jsonb check (jsonb_typeof(restaurants) = 'array'),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, client_id, week_start),
  check (professional_id <> client_id)
);

create table if not exists public.training_plan_completions (
  plan_id uuid not null references public.weekly_training_plans(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  day_index integer not null check (day_index between 0 and 6),
  completed_at timestamptz not null default now(),
  primary key (plan_id, day_index)
);

create index if not exists weekly_training_plans_client_week_idx
  on public.weekly_training_plans (client_id, week_start desc);
create index if not exists weekly_training_plans_professional_week_idx
  on public.weekly_training_plans (professional_id, week_start desc);
create index if not exists weekly_nutrition_plans_client_week_idx
  on public.weekly_nutrition_plans (client_id, week_start desc);
create index if not exists weekly_nutrition_plans_professional_week_idx
  on public.weekly_nutrition_plans (professional_id, week_start desc);

create or replace function public.validate_fortalfy_weekly_training_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  day jsonb;
  exercise jsonb;
begin
  if jsonb_typeof(new.days) is distinct from 'array' then
    raise exception 'A training plan must include all seven days';
  end if;
  if jsonb_array_length(new.days) <> 7 then
    raise exception 'A training plan must include all seven days';
  end if;
  for day in select value from jsonb_array_elements(new.days) loop
    if coalesce(btrim(day ->> 'workout_name'), '') = ''
       or jsonb_typeof(day -> 'exercises') is distinct from 'array' then
      raise exception 'Each training day needs a workout name and at least one exercise';
    end if;
    if jsonb_array_length(day -> 'exercises') < 1 then
      raise exception 'Each training day needs a workout name and at least one exercise';
    end if;
    for exercise in select value from jsonb_array_elements(day -> 'exercises') loop
      if coalesce(btrim(exercise ->> 'name'), '') = ''
         or coalesce(btrim(exercise ->> 'description'), '') = ''
         or coalesce(btrim(exercise ->> 'sets'), '') = ''
         or coalesce(btrim(exercise ->> 'reps'), '') = ''
         or coalesce(btrim(exercise ->> 'load'), '') = ''
         or coalesce(btrim(exercise ->> 'rest'), '') = ''
         or coalesce(exercise ->> 'video_url', '') !~ '^https://[^[:space:]]+$' then
        raise exception 'Every exercise requires description, sets, reps, load, rest, and an HTTPS video URL';
      end if;
    end loop;
  end loop;
  if tg_op = 'UPDATE'
     and (new.title is distinct from old.title or new.days is distinct from old.days) then
    new.confirmed_at := null;
    delete from public.training_plan_completions where plan_id = old.id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_fortalfy_weekly_nutrition_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  day jsonb;
  meal_name text;
  meal jsonb;
  restaurant jsonb;
begin
  if jsonb_typeof(new.days) is distinct from 'array' then
    raise exception 'A nutrition plan must include all seven days';
  end if;
  if jsonb_array_length(new.days) <> 7 then
    raise exception 'A nutrition plan must include all seven days';
  end if;
  for day in select value from jsonb_array_elements(new.days) loop
    foreach meal_name in array array['cafe','almoco','lanche','jantar','ceia'] loop
      meal := day -> meal_name;
      if jsonb_typeof(meal) is distinct from 'object'
         or coalesce(btrim(meal ->> 'description'), '') = ''
         or coalesce(meal ->> 'calories', '') !~ '^[0-9]+$' then
        raise exception 'Each day needs breakfast, lunch, snack, dinner, and supper with calories';
      end if;
      if (meal ->> 'calories')::numeric > 10000 then
        raise exception 'Meal calories cannot exceed 10,000';
      end if;
    end loop;
  end loop;
  if jsonb_typeof(new.restaurants) is distinct from 'array' then
    raise exception 'A nutrition plan must include at least one recommended restaurant';
  end if;
  if jsonb_array_length(new.restaurants) < 1 then
    raise exception 'A nutrition plan must include at least one recommended restaurant';
  end if;
  for restaurant in select value from jsonb_array_elements(new.restaurants) loop
    if coalesce(btrim(restaurant ->> 'name'), '') = ''
       or coalesce(btrim(restaurant ->> 'address'), '') = ''
       or coalesce(btrim(restaurant ->> 'dishes'), '') = ''
       or coalesce(btrim(restaurant ->> 'price_range'), '') = '' then
      raise exception 'Every restaurant recommendation needs a name, address, dishes, and price range';
    end if;
  end loop;
  if tg_op = 'UPDATE'
     and (new.title is distinct from old.title
       or new.daily_calorie_goal is distinct from old.daily_calorie_goal
       or new.days is distinct from old.days
       or new.restaurants is distinct from old.restaurants) then
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
drop trigger if exists weekly_nutrition_plans_validate on public.weekly_nutrition_plans;
create trigger weekly_nutrition_plans_validate
  before insert or update on public.weekly_nutrition_plans
  for each row execute function public.validate_fortalfy_weekly_nutrition_plan();

create or replace function public.is_fortalfy_plan_client(
  plan_professional_id uuid,
  plan_client_id uuid,
  expected_kind public.profile_kind
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles professional
    join public.bookings booking on booking.professional_id = professional.id
    where professional.id = plan_professional_id
      and auth.uid() in (plan_professional_id, plan_client_id)
      and professional.partner_approved_at is not null
      and professional.kind = expected_kind
      and booking.customer_id = plan_client_id
      and booking.status in ('solicitada', 'confirmada', 'concluida')
  );
$$;

revoke all on function public.is_fortalfy_plan_client(uuid, uuid, public.profile_kind) from public, anon;
grant execute on function public.is_fortalfy_plan_client(uuid, uuid, public.profile_kind) to authenticated;

alter table public.reserved_usernames enable row level security;
alter table public.weekly_training_plans enable row level security;
alter table public.weekly_nutrition_plans enable row level security;
alter table public.training_plan_completions enable row level security;

drop policy if exists "participants read weekly training plans" on public.weekly_training_plans;
create policy "participants read weekly training plans" on public.weekly_training_plans
  for select to authenticated using (client_id = auth.uid() or professional_id = auth.uid());
drop policy if exists "approved personal creates client training plans" on public.weekly_training_plans;
create policy "approved personal creates client training plans" on public.weekly_training_plans
  for insert to authenticated with check (
    professional_id = auth.uid()
    and public.is_fortalfy_plan_client(professional_id, client_id, 'personal')
  );
drop policy if exists "approved personal updates client training plans" on public.weekly_training_plans;
create policy "approved personal updates client training plans" on public.weekly_training_plans
  for update to authenticated using (
    professional_id = auth.uid()
    and public.is_fortalfy_plan_client(professional_id, client_id, 'personal')
  ) with check (
    professional_id = auth.uid()
    and public.is_fortalfy_plan_client(professional_id, client_id, 'personal')
  );
drop policy if exists "approved personal deletes client training plans" on public.weekly_training_plans;
create policy "approved personal deletes client training plans" on public.weekly_training_plans
  for delete to authenticated using (
    professional_id = auth.uid()
    and public.is_fortalfy_plan_client(professional_id, client_id, 'personal')
  );

drop policy if exists "participants read weekly nutrition plans" on public.weekly_nutrition_plans;
create policy "participants read weekly nutrition plans" on public.weekly_nutrition_plans
  for select to authenticated using (client_id = auth.uid() or professional_id = auth.uid());
drop policy if exists "approved nutritionist creates client plans" on public.weekly_nutrition_plans;
create policy "approved nutritionist creates client plans" on public.weekly_nutrition_plans
  for insert to authenticated with check (
    professional_id = auth.uid()
    and public.is_fortalfy_plan_client(professional_id, client_id, 'nutricionista')
  );
drop policy if exists "approved nutritionist updates client plans" on public.weekly_nutrition_plans;
create policy "approved nutritionist updates client plans" on public.weekly_nutrition_plans
  for update to authenticated using (
    professional_id = auth.uid()
    and public.is_fortalfy_plan_client(professional_id, client_id, 'nutricionista')
  ) with check (
    professional_id = auth.uid()
    and public.is_fortalfy_plan_client(professional_id, client_id, 'nutricionista')
  );
drop policy if exists "approved nutritionist deletes client plans" on public.weekly_nutrition_plans;
create policy "approved nutritionist deletes client plans" on public.weekly_nutrition_plans
  for delete to authenticated using (
    professional_id = auth.uid()
    and public.is_fortalfy_plan_client(professional_id, client_id, 'nutricionista')
  );

drop policy if exists "clients read own training completion" on public.training_plan_completions;
create policy "clients read own training completion" on public.training_plan_completions
  for select to authenticated using (
    client_id = auth.uid()
    or exists (
      select 1 from public.weekly_training_plans plan
      where plan.id = plan_id and plan.professional_id = auth.uid()
    )
  );
drop policy if exists "clients mark own plan day complete" on public.training_plan_completions;
create policy "clients mark own plan day complete" on public.training_plan_completions
  for insert to authenticated with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.weekly_training_plans plan
      where plan.id = plan_id and plan.client_id = auth.uid() and plan.confirmed_at is not null
    )
  );
drop policy if exists "clients undo own plan day completion" on public.training_plan_completions;
create policy "clients undo own plan day completion" on public.training_plan_completions
  for delete to authenticated using (client_id = auth.uid());
grant select, insert, delete on public.training_plan_completions to authenticated;

create or replace function public.confirm_fortalfy_training_plan(plan_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare result timestamptz;
begin
  update public.weekly_training_plans
    set confirmed_at = coalesce(confirmed_at, now())
    where id = plan_id and client_id = auth.uid()
    returning confirmed_at into result;
  if result is null then
    raise exception 'Training plan not found for this account';
  end if;
  return result;
end;
$$;

create or replace function public.confirm_fortalfy_nutrition_plan(plan_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare result timestamptz;
begin
  update public.weekly_nutrition_plans
    set confirmed_at = coalesce(confirmed_at, now())
    where id = plan_id and client_id = auth.uid()
    returning confirmed_at into result;
  if result is null then
    raise exception 'Nutrition plan not found for this account';
  end if;
  return result;
end;
$$;

revoke all on function public.confirm_fortalfy_training_plan(uuid) from public, anon;
revoke all on function public.confirm_fortalfy_nutrition_plan(uuid) from public, anon;
grant execute on function public.confirm_fortalfy_training_plan(uuid) to authenticated;
grant execute on function public.confirm_fortalfy_nutrition_plan(uuid) to authenticated;

grant select, insert, update, delete on public.weekly_training_plans to authenticated;
grant select, insert, update, delete on public.weekly_nutrition_plans to authenticated;

notify pgrst, 'reload schema';
