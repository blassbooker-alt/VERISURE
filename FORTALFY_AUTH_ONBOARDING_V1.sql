-- Provision a private, persistent onboarding record whenever Supabase Auth creates a user.
-- Apply after PRODUCAO_BACKEND_SUPABASE.sql and the social profile migrations.

alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date,
  goals text[] not null default '{}',
  interests text[] not null default '{}',
  accepted_terms_at timestamptz,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_goals_valid check (
    goals <@ array['emagrecimento','forca','cardio','mobilidade','alimentacao','bem-estar','comunidade']::text[]
  ),
  constraint user_preferences_interests_valid check (
    interests <@ array['feed','food','shop','treinos','pass']::text[]
  )
);

alter table public.user_preferences enable row level security;
drop policy if exists "users read own preferences" on public.user_preferences;
create policy "users read own preferences" on public.user_preferences
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "users update own preferences" on public.user_preferences;
create policy "users update own preferences" on public.user_preferences
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
grant select, update on public.user_preferences to authenticated;

insert into public.user_preferences (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

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
  elsif username_value !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must contain 3-24 lowercase letters, numbers, or underscores';
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
