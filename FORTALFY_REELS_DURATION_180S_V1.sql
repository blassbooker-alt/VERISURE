-- Apply after FORTALFY_REELS_9_16_SUPABASE.sql.
-- Raises the Reel duration limit without changing size, aspect ratio, or approval rules.

alter table public.fortalreel_video_validations
  drop constraint if exists fortalreel_video_validations_duration_seconds_check;

alter table public.fortalreel_video_validations
  add constraint fortalreel_video_validations_duration_seconds_check
  check (duration_seconds > 0 and duration_seconds <= 180);

do $$
declare
  function_definition text;
begin
  function_definition := pg_get_functiondef('public.guard_fortalreel_post()'::regprocedure);
  if position('validation.duration_seconds <= 90' in function_definition) > 0 then
    execute replace(function_definition, 'validation.duration_seconds <= 90', 'validation.duration_seconds <= 180');
  elsif position('validation.duration_seconds <= 180' in function_definition) = 0 then
    raise exception 'Could not locate the FortalReels post duration validation.';
  end if;

  function_definition := pg_get_functiondef('public.guard_fortalreel_post_media()'::regprocedure);
  if position('validation.duration_seconds <= 90' in function_definition) > 0 then
    execute replace(function_definition, 'validation.duration_seconds <= 90', 'validation.duration_seconds <= 180');
  elsif position('validation.duration_seconds <= 180' in function_definition) = 0 then
    raise exception 'Could not locate the FortalReels media duration validation.';
  end if;

  function_definition := pg_get_functiondef(
    'public.publish_fortalreel(uuid, uuid, text, text, text, integer, integer, numeric)'::regprocedure
  );
  if position('p_duration_seconds > 90' in function_definition) > 0 then
    execute replace(function_definition, 'p_duration_seconds > 90', 'p_duration_seconds > 180');
  elsif position('p_duration_seconds > 180' in function_definition) = 0 then
    raise exception 'Could not locate the FortalReels publish duration validation.';
  end if;
end;
$$;
