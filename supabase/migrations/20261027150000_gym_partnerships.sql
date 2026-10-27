-- Public gym partnerships are distinct from academy registrations.
-- Only authorized, active, approved academy partnerships are exposed publicly.

create table if not exists public.gym_partnerships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  commercial_name text not null check (char_length(btrim(commercial_name)) between 2 and 160),
  partnership_type text not null default '' check (char_length(partnership_type) <= 160),
  city text not null default '' check (char_length(city) <= 120),
  neighborhood text not null default '' check (char_length(neighborhood) <= 120),
  public_description text not null default '' check (char_length(public_description) <= 3000),
  authorized_actions text[] not null default '{}',
  image_url text not null default '' check (image_url = '' or image_url ~ '^https://'),
  gallery_urls text[] not null default '{}',
  link_url text not null default '' check (link_url = '' or link_url ~ '^https://'),
  status text not null default 'negotiation' check (status in ('negotiation','awaiting_approval','active','suspended','ended')),
  publication_status text not null default 'draft' check (publication_status in ('draft','published')),
  public_authorized boolean not null default false,
  brand_use_authorized boolean not null default false,
  image_use_authorized boolean not null default false,
  starts_on date,
  ends_on date,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check (array_length(gallery_urls, 1) is null or array_length(gallery_urls, 1) <= 12),
  check (array_length(authorized_actions, 1) is null or array_length(authorized_actions, 1) <= 20)
);

create index if not exists gym_partnerships_public_idx
  on public.gym_partnerships(status, publication_status, starts_on, ends_on);

create table if not exists public.gym_partnership_admin_notes (
  partnership_id uuid primary key references public.gym_partnerships(id) on delete cascade,
  relationship_owner text not null default '' check (char_length(relationship_owner) <= 160),
  internal_notes text not null default '' check (char_length(internal_notes) <= 4000),
  updated_at timestamptz not null default now()
);

create table if not exists public.gym_partnership_history (
  id bigint generated always as identity primary key,
  partnership_id uuid not null references public.gym_partnerships(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('created','updated','deleted')),
  old_state jsonb,
  new_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gym_partnership_history_idx
  on public.gym_partnership_history(partnership_id, created_at desc);

create table if not exists public.gym_partnership_events (
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.gym_partnerships(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  image_url text not null default '' check (image_url = '' or image_url ~ '^https://'),
  starts_at timestamptz not null,
  venue text not null default '' check (char_length(venue) <= 300),
  description text not null default '' check (char_length(description) <= 3000),
  status text not null default 'scheduled' check (status in ('scheduled','realized','cancelled')),
  publication_status text not null default 'draft' check (publication_status in ('draft','published')),
  participation_info text not null default '' check (char_length(participation_info) <= 1600),
  registration_url text not null default '' check (registration_url = '' or registration_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gym_partnership_events_public_idx
  on public.gym_partnership_events(publication_status, status, starts_at);

create table if not exists public.gym_partnership_campaigns (
  id uuid primary key default gen_random_uuid(),
  partnership_id uuid not null references public.gym_partnerships(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  image_url text not null default '' check (image_url = '' or image_url ~ '^https://'),
  brand_name text not null default '' check (char_length(brand_name) <= 160),
  description text not null default '' check (char_length(description) <= 3000),
  starts_on date,
  ends_on date,
  conditions text not null default '' check (char_length(conditions) <= 1600),
  status text not null default 'draft' check (status in ('draft','published','ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index if not exists gym_partnership_campaigns_public_idx
  on public.gym_partnership_campaigns(status, starts_on, ends_on);

create or replace function public.set_gym_partnership_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists gym_partnerships_updated_at on public.gym_partnerships;
create trigger gym_partnerships_updated_at before update on public.gym_partnerships
for each row execute function public.set_gym_partnership_updated_at();
drop trigger if exists gym_partnership_events_updated_at on public.gym_partnership_events;
create trigger gym_partnership_events_updated_at before update on public.gym_partnership_events
for each row execute function public.set_gym_partnership_updated_at();
drop trigger if exists gym_partnership_campaigns_updated_at on public.gym_partnership_campaigns;
create trigger gym_partnership_campaigns_updated_at before update on public.gym_partnership_campaigns
for each row execute function public.set_gym_partnership_updated_at();

create or replace function public.guard_gym_partnership_publication()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.publication_status = 'published' then
    if new.status <> 'active' or not new.public_authorized or not new.brand_use_authorized or not new.image_use_authorized then
      raise exception 'A public partnership requires active status and explicit brand, image, and publication authorization';
    end if;
    if not exists (
      select 1 from public.profiles p
      where p.id = new.profile_id and p.kind = 'academia' and p.partner_approved_at is not null and not p.is_private
    ) then
      raise exception 'The linked academy profile must be approved and public before partnership publication';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists gym_partnerships_publication_guard on public.gym_partnerships;
create trigger gym_partnerships_publication_guard before insert or update of profile_id,status,publication_status,public_authorized,brand_use_authorized,image_use_authorized on public.gym_partnerships
for each row execute function public.guard_gym_partnership_publication();

create or replace function public.guard_gym_partnership_child_publication()
returns trigger language plpgsql set search_path = '' as $$
declare
  parent public.gym_partnerships%rowtype;
  should_publish boolean := false;
begin
  if tg_table_name = 'gym_partnership_events' then
    should_publish := new.publication_status = 'published';
  elsif tg_table_name = 'gym_partnership_campaigns' then
    should_publish := new.status = 'published';
  end if;
  if should_publish then
    select * into parent from public.gym_partnerships where id = new.partnership_id;
    if not found or parent.status <> 'active' or parent.publication_status <> 'published'
      or not parent.public_authorized or not parent.brand_use_authorized or not parent.image_use_authorized then
      raise exception 'Publish the authorized active academy partnership before publishing events or campaigns';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists gym_partnership_events_publication_guard on public.gym_partnership_events;
create trigger gym_partnership_events_publication_guard before insert or update on public.gym_partnership_events
for each row execute function public.guard_gym_partnership_child_publication();
drop trigger if exists gym_partnership_campaigns_publication_guard on public.gym_partnership_campaigns;
create trigger gym_partnership_campaigns_publication_guard before insert or update on public.gym_partnership_campaigns
for each row execute function public.guard_gym_partnership_child_publication();

create or replace function public.record_gym_partnership_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.gym_partnership_history(partnership_id, actor_id, action, old_state, new_state)
  values (
    coalesce(new.id, old.id), auth.uid(),
    case when tg_op = 'INSERT' then 'created' when tg_op = 'DELETE' then 'deleted' else 'updated' end,
    case when tg_op in ('UPDATE','DELETE') then jsonb_build_object('status', old.status, 'publication_status', old.publication_status, 'commercial_name', old.commercial_name) else null end,
    case when tg_op in ('INSERT','UPDATE') then jsonb_build_object('status', new.status, 'publication_status', new.publication_status, 'commercial_name', new.commercial_name) else null end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists gym_partnerships_history on public.gym_partnerships;
create trigger gym_partnerships_history after insert or update or delete on public.gym_partnerships
for each row execute function public.record_gym_partnership_history();

alter table public.gym_partnerships enable row level security;
alter table public.gym_partnership_admin_notes enable row level security;
alter table public.gym_partnership_history enable row level security;
alter table public.gym_partnership_events enable row level security;
alter table public.gym_partnership_campaigns enable row level security;

revoke all on public.gym_partnerships, public.gym_partnership_admin_notes, public.gym_partnership_history,
  public.gym_partnership_events, public.gym_partnership_campaigns from anon, authenticated;
grant select on public.gym_partnerships, public.gym_partnership_events, public.gym_partnership_campaigns to anon, authenticated;
grant insert, update on public.gym_partnerships to authenticated;
grant insert, update, delete on public.gym_partnership_admin_notes,
  public.gym_partnership_events, public.gym_partnership_campaigns to authenticated;
grant select on public.gym_partnership_admin_notes, public.gym_partnership_history to authenticated;

drop policy if exists "Public reads only authorized active gym partnerships" on public.gym_partnerships;
create policy "Public reads only authorized active gym partnerships" on public.gym_partnerships
for select to anon, authenticated using (
  status = 'active' and publication_status = 'published' and public_authorized
  and brand_use_authorized and image_use_authorized
  and (starts_on is null or starts_on <= current_date)
  and (ends_on is null or ends_on >= current_date)
  and exists (select 1 from public.profiles p where p.id = profile_id and p.kind = 'academia' and p.partner_approved_at is not null and not p.is_private)
);
drop policy if exists "Fortalfy admins manage gym partnerships" on public.gym_partnerships;
create policy "Fortalfy admins manage gym partnerships" on public.gym_partnerships
for all to authenticated using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin')
with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');

drop policy if exists "Fortalfy admins manage partnership notes" on public.gym_partnership_admin_notes;
create policy "Fortalfy admins manage partnership notes" on public.gym_partnership_admin_notes
for all to authenticated using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin')
with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');
drop policy if exists "Fortalfy admins read partnership history" on public.gym_partnership_history;
create policy "Fortalfy admins read partnership history" on public.gym_partnership_history
for select to authenticated using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');

drop policy if exists "Public reads events of authorized active partnerships" on public.gym_partnership_events;
create policy "Public reads events of authorized active partnerships" on public.gym_partnership_events
for select to anon, authenticated using (
  publication_status = 'published' and status in ('scheduled','realized')
  and exists (select 1 from public.gym_partnerships g where g.id = partnership_id and g.status = 'active' and g.publication_status = 'published' and g.public_authorized and g.brand_use_authorized and g.image_use_authorized and (g.starts_on is null or g.starts_on <= current_date) and (g.ends_on is null or g.ends_on >= current_date))
);
drop policy if exists "Fortalfy admins manage partnership events" on public.gym_partnership_events;
create policy "Fortalfy admins manage partnership events" on public.gym_partnership_events
for all to authenticated using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin')
with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');

drop policy if exists "Public reads campaigns of authorized active partnerships" on public.gym_partnership_campaigns;
create policy "Public reads campaigns of authorized active partnerships" on public.gym_partnership_campaigns
for select to anon, authenticated using (
  status = 'published' and (starts_on is null or starts_on <= current_date) and (ends_on is null or ends_on >= current_date)
  and exists (select 1 from public.gym_partnerships g where g.id = partnership_id and g.status = 'active' and g.publication_status = 'published' and g.public_authorized and g.brand_use_authorized and g.image_use_authorized)
);
drop policy if exists "Fortalfy admins manage partnership campaigns" on public.gym_partnership_campaigns;
create policy "Fortalfy admins manage partnership campaigns" on public.gym_partnership_campaigns
for all to authenticated using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin')
with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role','') = 'admin');

create or replace view public.gym_partnerships_public with (security_invoker = true) as
select g.id, g.profile_id, g.commercial_name, g.partnership_type, g.city, g.neighborhood,
  g.public_description, g.authorized_actions, g.image_url, g.gallery_urls, g.link_url,
  g.starts_on, g.ends_on, p.username
from public.gym_partnerships g
join public.profiles p on p.id = g.profile_id
where g.status = 'active' and g.publication_status = 'published' and g.public_authorized
  and g.brand_use_authorized and g.image_use_authorized
  and (g.starts_on is null or g.starts_on <= current_date)
  and (g.ends_on is null or g.ends_on >= current_date)
  and p.kind = 'academia' and p.partner_approved_at is not null and not p.is_private;

create or replace view public.gym_partnership_events_public with (security_invoker = true) as
select e.id, e.partnership_id, g.commercial_name as academy_name, g.city, g.neighborhood,
  e.title, e.image_url, e.starts_at, e.venue, e.description, e.status,
  e.participation_info, e.registration_url
from public.gym_partnership_events e
join public.gym_partnerships g on g.id = e.partnership_id
where e.publication_status = 'published' and e.status in ('scheduled','realized')
  and g.status = 'active' and g.publication_status = 'published' and g.public_authorized
  and g.brand_use_authorized and g.image_use_authorized
  and (g.starts_on is null or g.starts_on <= current_date) and (g.ends_on is null or g.ends_on >= current_date);

create or replace view public.gym_partnership_campaigns_public with (security_invoker = true) as
select c.id, c.partnership_id, g.commercial_name as academy_name, g.city,
  c.title, c.image_url, c.brand_name, c.description, c.starts_on, c.ends_on, c.conditions
from public.gym_partnership_campaigns c
join public.gym_partnerships g on g.id = c.partnership_id
where c.status = 'published' and (c.starts_on is null or c.starts_on <= current_date)
  and (c.ends_on is null or c.ends_on >= current_date)
  and g.status = 'active' and g.publication_status = 'published' and g.public_authorized
  and g.brand_use_authorized and g.image_use_authorized
  and (g.starts_on is null or g.starts_on <= current_date) and (g.ends_on is null or g.ends_on >= current_date);

grant select on public.gym_partnerships_public, public.gym_partnership_events_public,
  public.gym_partnership_campaigns_public to anon, authenticated;

comment on table public.gym_partnerships is 'Commercial relationship record, separate from approved academy directory registration.';
comment on column public.gym_partnerships.authorized_actions is 'Only specific actions explicitly agreed and authorized may be entered here.';
comment on column public.gym_partnerships.gallery_urls is 'HTTPS image URLs authorized for public use by the academy.';
