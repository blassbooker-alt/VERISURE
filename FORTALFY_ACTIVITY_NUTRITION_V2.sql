-- Apply after FORTALFY_ACTIVITY_SYNC_V1.sql.
-- Preserve the existing account-scoped activity API while storing user-entered
-- nutrition details on meal entries. Legacy entries remain valid as-is.
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
  macro_value numeric;
  normalized_entry jsonb;
  activity_row public.fortalfy_activity%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_kind = 'water' then
    if p_detail is not null then raise exception 'Invalid water entry' using errcode = '22023'; end if;
    insert into public.fortalfy_activity (user_id, water_ml) values (caller_id, 250)
    on conflict (user_id) do update
      set water_ml = least(public.fortalfy_activity.water_ml + 250, 10000000), updated_at = now();
  elsif p_kind = 'workout' then
    if jsonb_typeof(p_detail) is distinct from 'object' then raise exception 'Invalid workout entry' using errcode = '22023'; end if;
    entry_id := p_detail ->> 'id';
    entry_name := btrim(coalesce(p_detail ->> 'name', ''));
    entry_date := (p_detail ->> 'date')::date;
    entry_number := (p_detail ->> 'minutes')::integer;
    if entry_id is null or entry_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or entry_name = '' or length(entry_name) > 60 or entry_number is null or entry_number not between 1 and 600
      or entry_date is null or entry_date not between current_date - 365 and current_date then
      raise exception 'Invalid workout entry' using errcode = '22023';
    end if;
    normalized_entry := jsonb_build_object('id', entry_id, 'name', entry_name, 'minutes', entry_number, 'date', entry_date::text);
    insert into public.fortalfy_activity (user_id, workouts_logged, workout_entries)
    values (caller_id, 1, jsonb_build_array(normalized_entry))
    on conflict (user_id) do update
      set workouts_logged = least(public.fortalfy_activity.workouts_logged + 1, 1000000),
          workout_entries = (select coalesce(jsonb_agg(entries.value order by entries.ordinality), '[]'::jsonb)
            from jsonb_array_elements(public.fortalfy_activity.workout_entries || jsonb_build_array(normalized_entry))
              with ordinality as entries(value, ordinality)
            where entries.ordinality > jsonb_array_length(public.fortalfy_activity.workout_entries || jsonb_build_array(normalized_entry)) - 100),
          updated_at = now();
  elsif p_kind in ('meal', 'updateMeal') then
    if jsonb_typeof(p_detail) is distinct from 'object' then raise exception 'Invalid meal entry' using errcode = '22023'; end if;
    entry_id := p_detail ->> 'id';
    entry_name := btrim(coalesce(p_detail ->> 'name', ''));
    entry_date := (p_detail ->> 'date')::date;
    entry_number := (p_detail ->> 'calories')::integer;
    if entry_id is null or entry_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or entry_name = '' or length(entry_name) > 60 or entry_number is null or entry_number not between 0 and 10000
      or entry_date is null or entry_date not between current_date - 29 and current_date
      or coalesce(p_detail ->> 'mealType', 'other') not in ('breakfast', 'lunch', 'snack', 'dinner', 'other')
      or coalesce(p_detail ->> 'foodGroup', 'other') not in ('fruit', 'vegetable', 'other')
      or length(coalesce(p_detail ->> 'portion', '')) > 40
      or (coalesce(p_detail ->> 'time', '') <> '' and p_detail ->> 'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
      raise exception 'Invalid meal entry' using errcode = '22023';
    end if;
    normalized_entry := jsonb_build_object(
      'id', entry_id, 'name', entry_name, 'calories', entry_number, 'date', entry_date::text,
      'mealType', coalesce(p_detail ->> 'mealType', 'other'), 'foodGroup', coalesce(p_detail ->> 'foodGroup', 'other'),
      'portion', coalesce(p_detail ->> 'portion', ''), 'time', coalesce(p_detail ->> 'time', '')
    );
    foreach entry_name in array array['protein', 'carbs', 'fat'] loop
      if p_detail ? entry_name and jsonb_typeof(p_detail -> entry_name) <> 'null' then
        macro_value := (p_detail ->> entry_name)::numeric;
        if macro_value < 0 or macro_value > 1000 then raise exception 'Invalid nutrition value' using errcode = '22023'; end if;
        normalized_entry := normalized_entry || jsonb_build_object(entry_name, macro_value);
      end if;
    end loop;
    if p_kind = 'meal' then
      insert into public.fortalfy_activity (user_id, meal_entries) values (caller_id, jsonb_build_array(normalized_entry))
      on conflict (user_id) do update
        set meal_entries = (select coalesce(jsonb_agg(case when entries.value ->> 'id' = entry_id then normalized_entry else entries.value end
            order by entries.ordinality), '[]'::jsonb)
          from jsonb_array_elements(case
            when exists (select 1 from jsonb_array_elements(public.fortalfy_activity.meal_entries) as prior(value) where prior.value ->> 'id' = entry_id)
              then public.fortalfy_activity.meal_entries
            else public.fortalfy_activity.meal_entries || jsonb_build_array(normalized_entry)
          end)
            with ordinality as entries(value, ordinality)
          where entries.value ->> 'date' >= (current_date - 29)::text
          ),
            updated_at = now();
    else
      update public.fortalfy_activity
        set meal_entries = (select coalesce(jsonb_agg(case when entries.value ->> 'id' = entry_id then normalized_entry else entries.value end
              order by entries.ordinality), '[]'::jsonb)
          from jsonb_array_elements(public.fortalfy_activity.meal_entries) with ordinality as entries(value, ordinality)),
            updated_at = now()
        where user_id = caller_id and exists (select 1 from jsonb_array_elements(public.fortalfy_activity.meal_entries) as entries(value) where entries.value ->> 'id' = entry_id);
      if not found then raise exception 'Meal entry not found' using errcode = '22023'; end if;
    end if;
  elsif p_kind = 'removeMeal' then
    entry_id := p_detail #>> '{}';
    if entry_id is null or entry_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Invalid meal id' using errcode = '22023';
    end if;
    update public.fortalfy_activity
      set meal_entries = (select coalesce(jsonb_agg(entries.value order by entries.ordinality), '[]'::jsonb)
        from jsonb_array_elements(public.fortalfy_activity.meal_entries) with ordinality as entries(value, ordinality)
        where entries.value ->> 'id' <> entry_id), updated_at = now()
      where user_id = caller_id;
  else
    raise exception 'Unsupported activity type' using errcode = '22023';
  end if;

  select * into activity_row from public.fortalfy_activity where user_id = caller_id;
  if not found then
    return jsonb_build_object('waterMl', 0, 'workoutsLogged', 0, 'workoutEntries', '[]'::jsonb, 'mealEntries', '[]'::jsonb);
  end if;
  return jsonb_build_object('waterMl', activity_row.water_ml, 'workoutsLogged', activity_row.workouts_logged,
    'workoutEntries', activity_row.workout_entries, 'mealEntries', activity_row.meal_entries);
end;
$$;

revoke all on function public.record_fortalfy_activity(text, jsonb) from public, anon;
grant execute on function public.record_fortalfy_activity(text, jsonb) to authenticated;
