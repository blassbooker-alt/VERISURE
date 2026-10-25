-- Fortalfy Live catalog extensions. Additive and safe to re-run.
-- Payment and video playback remain unavailable until trusted providers are configured.

create table if not exists public.creator_live_events (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  description text not null default '' check (char_length(description) <= 3000),
  starts_at timestamptz not null,
  access_mode text not null default 'public' check (access_mode in ('public','approved_creator')),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creator_live_events add column if not exists category text not null default 'treino';
alter table public.creator_live_events add column if not exists cover_url text;
alter table public.creator_live_events add column if not exists duration_minutes integer not null default 60;
alter table public.creator_live_events add column if not exists price_cents integer not null default 0;
alter table public.creator_live_events add column if not exists participant_limit integer;
alter table public.creator_live_events add column if not exists cancellation_policy text not null default '';
alter table public.creator_live_events add column if not exists participant_information text not null default '';

alter table public.creator_live_events drop constraint if exists creator_live_events_status_check;
alter table public.creator_live_events add constraint creator_live_events_status_check
  check (status in ('draft','pending_approval','published','live','ended','cancelled'));
alter table public.creator_live_events drop constraint if exists creator_live_events_category_check;
alter table public.creator_live_events add constraint creator_live_events_category_check
  check (category in ('treino','nutricao','emagrecimento','hipertrofia','saude_bem_estar','marketing_fitness'));
alter table public.creator_live_events drop constraint if exists creator_live_events_duration_check;
alter table public.creator_live_events add constraint creator_live_events_duration_check
  check (duration_minutes between 5 and 480);
alter table public.creator_live_events drop constraint if exists creator_live_events_price_check;
alter table public.creator_live_events add constraint creator_live_events_price_check
  check (price_cents >= 0);
alter table public.creator_live_events drop constraint if exists creator_live_events_participant_limit_check;
alter table public.creator_live_events add constraint creator_live_events_participant_limit_check
  check (participant_limit is null or participant_limit between 1 and 100000);
alter table public.creator_live_events drop constraint if exists creator_live_events_cover_url_check;
alter table public.creator_live_events add constraint creator_live_events_cover_url_check
  check (cover_url is null or cover_url ~ '^https://');

create index if not exists creator_live_events_public_schedule_idx
  on public.creator_live_events(status, access_mode, starts_at);

create or replace function public.guard_creator_live_publication()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('live','ended') and coalesce(auth.jwt() ->> 'role','') <> 'service_role' then
    raise exception 'Live playback state can only be confirmed by the streaming service';
  end if;
  if new.status = 'published' then
    if new.starts_at <= now() then raise exception 'A live must be scheduled in the future before publication'; end if;
    if (tg_op = 'INSERT' or old.status <> 'published')
       and coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') <> 'admin' then
      raise exception 'Only Fortalfy administrators can approve and publish a live';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists creator_live_publication_guard on public.creator_live_events;
create trigger creator_live_publication_guard before insert or update of status, starts_at on public.creator_live_events
  for each row execute function public.guard_creator_live_publication();

create or replace function public.touch_creator_live_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists creator_live_events_updated_at on public.creator_live_events;
create trigger creator_live_events_updated_at before update on public.creator_live_events
  for each row execute function public.touch_creator_live_updated_at();

alter table public.creator_live_events enable row level security;
revoke all on public.creator_live_events from anon, authenticated;
grant select on public.creator_live_events to anon, authenticated;
grant insert, update, delete on public.creator_live_events to authenticated;
drop policy if exists "Users read published Creator live schedule" on public.creator_live_events;
create policy "Users read published Creator live schedule" on public.creator_live_events
  for select to authenticated using (
    instructor_id = auth.uid()
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin'
    or (status in ('published','live') and (
      access_mode = 'public'
      or exists (select 1 from public.professional_applications a where a.profile_id = auth.uid() and a.kind = 'influenciador' and a.status = 'approved')
    ))
  );
drop policy if exists "Guests read public Creator live schedule" on public.creator_live_events;
create policy "Guests read public Creator live schedule" on public.creator_live_events
  for select to anon using (status in ('published','live') and access_mode = 'public');
drop policy if exists "Authorized instructors manage Creator lives" on public.creator_live_events;
create policy "Authorized instructors manage Creator lives" on public.creator_live_events
  for all to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin' or (instructor_id = auth.uid() and exists (select 1 from public.professional_applications a where a.profile_id = auth.uid() and a.kind = 'influenciador' and a.status = 'approved')))
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin' or (instructor_id = auth.uid() and exists (select 1 from public.professional_applications a where a.profile_id = auth.uid() and a.kind = 'influenciador' and a.status = 'approved')));

create table if not exists public.creator_live_registrations (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.creator_live_events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'registered' check (status in ('registered','cancelled')),
  created_at timestamptz not null default now(),
  unique(live_id, profile_id)
);
alter table public.creator_live_registrations enable row level security;
revoke all on public.creator_live_registrations from anon, authenticated;
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
declare
  registration_id uuid;
  live_row public.creator_live_events%rowtype;
  registered_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  select * into live_row from public.creator_live_events where id = p_live_id for update;
  if not found or live_row.status <> 'published' then raise exception 'Live is unavailable'; end if;
  if live_row.starts_at <= now() then raise exception 'Registration is closed'; end if;
  if live_row.price_cents > 0 then raise exception 'Secure checkout is not configured'; end if;
  if live_row.access_mode = 'approved_creator' and not exists (
    select 1 from public.professional_applications where profile_id = auth.uid() and kind = 'influenciador' and status = 'approved'
  ) then raise exception 'An approved Creator profile is required'; end if;
  if live_row.participant_limit is not null then
    select count(*)::integer into registered_count from public.creator_live_registrations
      where live_id = p_live_id and status = 'registered';
    if registered_count >= live_row.participant_limit
       and not exists (select 1 from public.creator_live_registrations where live_id = p_live_id and profile_id = auth.uid() and status = 'registered') then
      raise exception 'Live is full';
    end if;
  end if;
  insert into public.creator_live_registrations(live_id, profile_id, status)
  values (p_live_id, auth.uid(), 'registered')
  on conflict (live_id, profile_id) do update set status = 'registered'
  returning id into registration_id;
  return registration_id;
end;
$$;
revoke all on function public.register_creator_live(uuid) from public, anon;
grant execute on function public.register_creator_live(uuid) to authenticated;

-- Payment records are read-only to clients. A verified provider webhook/service role
-- must be the only writer before paid access is enabled in the application.
create table if not exists public.creator_live_orders (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.creator_live_events(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','cancelled','refunded')),
  provider text,
  provider_payment_id text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_payment_id)
);
drop trigger if exists creator_live_orders_updated_at on public.creator_live_orders;
create trigger creator_live_orders_updated_at before update on public.creator_live_orders
  for each row execute function public.touch_creator_live_updated_at();
alter table public.creator_live_orders enable row level security;
revoke all on public.creator_live_orders from anon, authenticated;
grant select on public.creator_live_orders to authenticated;
drop policy if exists "Users read own Creator live orders" on public.creator_live_orders;
create policy "Users read own Creator live orders" on public.creator_live_orders
  for select to authenticated using (
    profile_id = auth.uid()
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin'
    or exists (select 1 from public.creator_live_events l where l.id = live_id and l.instructor_id = auth.uid())
  );

comment on table public.creator_live_orders is 'Server-verified payment records; no client insert/update permissions are granted.';
comment on column public.creator_live_events.cover_url is 'HTTPS cover image URL; private streaming credentials must never be stored here.';
comment on column public.creator_live_events.price_cents is 'BRL cents. Positive prices remain unavailable until server-verified checkout is integrated.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creator-live-covers', 'creator-live-covers', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Anyone can view published live covers" on storage.objects;
create policy "Anyone can view published live covers" on storage.objects
  for select to anon, authenticated using (bucket_id = 'creator-live-covers');
drop policy if exists "Authorized instructors upload live covers" on storage.objects;
create policy "Authorized instructors upload live covers" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'creator-live-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin'
      or exists (select 1 from public.professional_applications a where a.profile_id = auth.uid() and a.kind = 'influenciador' and a.status = 'approved'))
  );
drop policy if exists "Authorized instructors update live covers" on storage.objects;
create policy "Authorized instructors update live covers" on storage.objects
  for update to authenticated using (
    bucket_id = 'creator-live-covers' and (storage.foldername(name))[1] = auth.uid()::text
    and (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin'
      or exists (select 1 from public.professional_applications a where a.profile_id = auth.uid() and a.kind = 'influenciador' and a.status = 'approved'))
  ) with check (
    bucket_id = 'creator-live-covers' and (storage.foldername(name))[1] = auth.uid()::text
    and (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin'
      or exists (select 1 from public.professional_applications a where a.profile_id = auth.uid() and a.kind = 'influenciador' and a.status = 'approved'))
  );
drop policy if exists "Authorized instructors delete live covers" on storage.objects;
create policy "Authorized instructors delete live covers" on storage.objects
  for delete to authenticated using (
    bucket_id = 'creator-live-covers' and (storage.foldername(name))[1] = auth.uid()::text
    and (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin'
      or exists (select 1 from public.professional_applications a where a.profile_id = auth.uid() and a.kind = 'influenciador' and a.status = 'approved'))
  );
