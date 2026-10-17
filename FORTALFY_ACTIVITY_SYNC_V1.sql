create table if not exists public.fortalfy_activity (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  water_ml integer not null default 0 check (water_ml between 0 and 10000000),
  workouts_logged integer not null default 0 check (workouts_logged between 0 and 1000000),
  workout_entries jsonb not null default '[]'::jsonb check (jsonb_typeof(workout_entries) = 'array'),
  meal_entries jsonb not null default '[]'::jsonb check (jsonb_typeof(meal_entries) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.fortalfy_activity enable row level security;
revoke all on public.fortalfy_activity from public, anon, authenticated;

create or replace function public.get_fortalfy_activity()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  activity_row public.fortalfy_activity%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into activity_row
  from public.fortalfy_activity
  where user_id = caller_id;

  if not found then
    return jsonb_build_object(
      'waterMl', 0,
      'workoutsLogged', 0,
      'workoutEntries', '[]'::jsonb,
      'mealEntries', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'waterMl', activity_row.water_ml,
    'workoutsLogged', activity_row.workouts_logged,
    'workoutEntries', activity_row.workout_entries,
    'mealEntries', activity_row.meal_entries
  );
end;
$$;

create or replace function public.record_fortalfy_activity(p_kind text, p_detail jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  entry_id text;
  entry_date date;
  entry_name text;
  entry_number integer;
  normalized_entry jsonb;
  activity_row public.fortalfy_activity%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_kind = 'water' then
    if p_detail is not null then
      raise exception 'Invalid water entry' using errcode = '22023';
    end if;
    insert into public.fortalfy_activity (user_id, water_ml)
    values (caller_id, 250)
    on conflict (user_id) do update
      set water_ml = least(public.fortalfy_activity.water_ml + 250, 10000000),
          updated_at = now();
  elsif p_kind = 'workout' then
    if jsonb_typeof(p_detail) is distinct from 'object' then
      raise exception 'Invalid workout entry' using errcode = '22023';
    end if;
    entry_id := p_detail ->> 'id';
    entry_name := btrim(coalesce(p_detail ->> 'name', ''));
    entry_date := (p_detail ->> 'date')::date;
    entry_number := (p_detail ->> 'minutes')::integer;
    if entry_id is null or entry_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or entry_name = '' or length(entry_name) > 60
      or entry_number is null or entry_number not between 1 and 600
      or entry_date is null or entry_date not between current_date - 365 and current_date then
      raise exception 'Invalid workout entry' using errcode = '22023';
    end if;
    normalized_entry := jsonb_build_object(
      'id', entry_id, 'name', entry_name, 'minutes', entry_number, 'date', entry_date::text
    );
    insert into public.fortalfy_activity (user_id, workouts_logged, workout_entries)
    values (caller_id, 1, jsonb_build_array(normalized_entry))
    on conflict (user_id) do update
      set workouts_logged = least(public.fortalfy_activity.workouts_logged + 1, 1000000),
          workout_entries = (
            select coalesce(jsonb_agg(entries.value order by entries.ordinality), '[]'::jsonb)
            from jsonb_array_elements(
              public.fortalfy_activity.workout_entries || jsonb_build_array(normalized_entry)
            ) with ordinality as entries(value, ordinality)
            where entries.ordinality > jsonb_array_length(
              public.fortalfy_activity.workout_entries || jsonb_build_array(normalized_entry)
            ) - 100
          ),
          updated_at = now();
  elsif p_kind = 'meal' then
    if jsonb_typeof(p_detail) is distinct from 'object' then
      raise exception 'Invalid meal entry' using errcode = '22023';
    end if;
    entry_id := p_detail ->> 'id';
    entry_name := btrim(coalesce(p_detail ->> 'name', ''));
    entry_date := (p_detail ->> 'date')::date;
    entry_number := (p_detail ->> 'calories')::integer;
    if entry_id is null or entry_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or entry_name = '' or length(entry_name) > 60
      or entry_number is null or entry_number not between 0 and 10000
      or entry_date is null or entry_date not between current_date - 29 and current_date then
      raise exception 'Invalid meal entry' using errcode = '22023';
    end if;
    normalized_entry := jsonb_build_object(
      'id', entry_id, 'name', entry_name, 'calories', entry_number, 'date', entry_date::text
    );
    insert into public.fortalfy_activity (user_id, meal_entries)
    values (caller_id, jsonb_build_array(normalized_entry))
    on conflict (user_id) do update
      set meal_entries = (
        select coalesce(jsonb_agg(entries.value order by entries.ordinality), '[]'::jsonb)
        from jsonb_array_elements(
          public.fortalfy_activity.meal_entries || jsonb_build_array(normalized_entry)
        ) with ordinality as entries(value, ordinality)
        where entries.value ->> 'date' >= (current_date - 29)::text
      ),
          updated_at = now();
  elsif p_kind = 'removeMeal' then
    entry_id := p_detail #>> '{}';
    if entry_id is null or entry_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Invalid meal id' using errcode = '22023';
    end if;
    update public.fortalfy_activity
      set meal_entries = (
        select coalesce(jsonb_agg(entries.value order by entries.ordinality), '[]'::jsonb)
        from jsonb_array_elements(public.fortalfy_activity.meal_entries)
          with ordinality as entries(value, ordinality)
        where entries.value ->> 'id' <> entry_id
      ),
          updated_at = now()
    where user_id = caller_id;
  else
    raise exception 'Unsupported activity type' using errcode = '22023';
  end if;

  select * into activity_row
  from public.fortalfy_activity
  where user_id = caller_id;

  if not found then
    return jsonb_build_object(
      'waterMl', 0,
      'workoutsLogged', 0,
      'workoutEntries', '[]'::jsonb,
      'mealEntries', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'waterMl', activity_row.water_ml,
    'workoutsLogged', activity_row.workouts_logged,
    'workoutEntries', activity_row.workout_entries,
    'mealEntries', activity_row.meal_entries
  );
end;
$$;

revoke all on function public.get_fortalfy_activity() from public, anon;
revoke all on function public.record_fortalfy_activity(text, jsonb) from public, anon;
grant execute on function public.get_fortalfy_activity() to authenticated;
grant execute on function public.record_fortalfy_activity(text, jsonb) to authenticated;
