-- Apply after FORTALFY_SOCIAL_V1_SUPABASE.sql and FORTALFY_SOCIAL_VIEWS_V1.sql.
-- Reels are visible only after the Edge Function validates the uploaded media bytes.

alter table public.posts
  add column if not exists is_reel boolean not null default false;

alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts add constraint posts_body_check
  check (
    char_length(body) <= 5000
    and (
      shared_post_id is not null
      or char_length(body) >= 1
      or media_path is not null
    )
  );

alter table public.post_media
  add column if not exists reel_validated boolean not null default false;

create table if not exists public.fortalreel_video_validations (
  storage_path text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  width integer not null check (width between 1 and 7680),
  height integer not null check (height between 1 and 7680),
  duration_seconds numeric(7,3) not null check (duration_seconds > 0 and duration_seconds <= 90),
  validated_at timestamptz not null default now(),
  constraint fortalreel_video_path_owner check (
    storage_path like owner_id::text || '/posts/%'
  ),
  constraint fortalreel_video_ratio check (
    abs(((width::numeric / height::numeric) / (9::numeric / 16)) - 1) <= 0.0025
  )
);

alter table public.fortalreel_video_validations enable row level security;
revoke all on public.fortalreel_video_validations from public, anon, authenticated;
grant select, insert, update, delete on public.fortalreel_video_validations to service_role;

create or replace function public.guard_fortalreel_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  valid_video boolean;
begin
  if tg_op = 'UPDATE' then
    if old.is_reel is distinct from new.is_reel
      or old.media_path is distinct from new.media_path
      or old.author_id is distinct from new.author_id then
      raise exception 'Reel video and author cannot be changed after publication'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.is_reel then
    if new.shared_post_id is not null or new.media_path is null then
      raise exception 'A Reel must contain one validated video'
        using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.profiles profile
      where profile.id = new.author_id
        and profile.partner_approved_at is not null
        and profile.kind in ('personal', 'nutricionista', 'academia', 'marca')
    ) then
      raise exception 'Only approved Fortalfy creators can publish Reels'
        using errcode = '42501';
    end if;
    select exists (
      select 1 from public.fortalreel_video_validations validation
      where validation.storage_path = new.media_path
        and validation.owner_id = new.author_id
        and abs(((validation.width::numeric / validation.height::numeric) / (9::numeric / 16)) - 1) <= 0.0025
        and validation.duration_seconds <= 90
    ) into valid_video;
    if not valid_video then
      raise exception 'The server has not validated this video as a 9:16 Reel'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_fortalreel_post() from public, anon, authenticated;
drop trigger if exists guard_fortalreel_post on public.posts;
create trigger guard_fortalreel_post
  before insert or update on public.posts
  for each row execute function public.guard_fortalreel_post();

create or replace function public.guard_fortalreel_post_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_author uuid;
  is_reel_post boolean;
begin
  select post.author_id, post.is_reel
    into post_author, is_reel_post
    from public.posts post
    where post.id = new.post_id;

  if not found then
    raise exception 'The parent publication does not exist'
      using errcode = '23503';
  end if;

  if is_reel_post then
    if new.media_type <> 'video' or not new.reel_validated
      or not exists (
        select 1 from public.fortalreel_video_validations validation
        where validation.storage_path = new.storage_path
          and validation.owner_id = post_author
          and abs(((validation.width::numeric / validation.height::numeric) / (9::numeric / 16)) - 1) <= 0.0025
          and validation.duration_seconds <= 90
      ) then
      raise exception 'Reel media must be validated by the Fortalfy server'
        using errcode = '23514';
    end if;
  elsif new.reel_validated then
    raise exception 'Only Reel media can be marked as validated'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_fortalreel_post_media() from public, anon, authenticated;
drop trigger if exists guard_fortalreel_post_media on public.post_media;
create trigger guard_fortalreel_post_media
  before insert or update on public.post_media
  for each row execute function public.guard_fortalreel_post_media();

create or replace function public.publish_fortalreel(
  p_post_id uuid,
  p_author_id uuid,
  p_storage_path text,
  p_body text,
  p_visibility text,
  p_width integer,
  p_height integer,
  p_duration_seconds numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_author uuid;
  existing_media text;
  existing_is_reel boolean;
begin
  if p_post_id is null or p_author_id is null or p_storage_path is null
    or p_width is null or p_height is null or p_duration_seconds is null
    or p_storage_path !~ ('^' || p_author_id::text || '/posts/' || p_post_id::text || '/00\.(mp4|webm)$')
    or p_visibility not in ('public', 'followers')
    or char_length(coalesce(p_body, '')) > 5000
    or (char_length(btrim(coalesce(p_body, ''))) = 0 and p_storage_path is null)
    or p_width < 1 or p_width > 7680
    or p_height < 1 or p_height > 7680
    or abs(((p_width::numeric / p_height::numeric) / (9::numeric / 16)) - 1) > 0.0025
    or p_duration_seconds <= 0 or p_duration_seconds > 90 then
    raise exception 'FortalReels video data is invalid'
      using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = p_author_id
      and profile.partner_approved_at is not null
      and profile.kind in ('personal', 'nutricionista', 'academia', 'marca')
  ) then
    raise exception 'Only approved Fortalfy creators can publish Reels'
      using errcode = '42501';
  end if;

  select post.author_id, post.media_path, post.is_reel
    into existing_author, existing_media, existing_is_reel
    from public.posts post
    where post.id = p_post_id;
  if found then
    if existing_author = p_author_id and existing_media = p_storage_path and existing_is_reel then
      return p_post_id;
    end if;
    raise exception 'FortalReels request id was already used'
      using errcode = '23505';
  end if;

  insert into public.fortalreel_video_validations (
    storage_path, owner_id, width, height, duration_seconds, validated_at
  ) values (
    p_storage_path, p_author_id, p_width, p_height, p_duration_seconds, now()
  );
  insert into public.posts (
    id, author_id, body, visibility, media_path, is_reel
  ) values (
    p_post_id, p_author_id, btrim(coalesce(p_body, '')), p_visibility, p_storage_path, true
  );
  insert into public.post_media (
    post_id, storage_path, media_type, sort_order, reel_validated
  ) values (
    p_post_id, p_storage_path, 'video', 0, true
  );
  return p_post_id;
end;
$$;

revoke all on function public.publish_fortalreel(uuid, uuid, text, text, text, integer, integer, numeric)
  from public, anon, authenticated;
grant execute on function public.publish_fortalreel(uuid, uuid, text, text, text, integer, integer, numeric)
  to service_role;

create or replace function public.is_fortalreel_storage_path_protected(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.fortalreel_video_validations validation
    where validation.storage_path = p_storage_path
  ) or exists (
    select 1 from public.posts post
    where post.is_reel and post.media_path = p_storage_path
  );
$$;

revoke all on function public.is_fortalreel_storage_path_protected(text) from public, anon;
grant execute on function public.is_fortalreel_storage_path_protected(text) to authenticated;

drop policy if exists "social media owners update" on storage.objects;
create policy "social media owners update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'social-media'
    and auth.uid()::text = split_part(name, '/', 1)
    and split_part(name, '/', 2) <> 'posts'
  )
  with check (
    bucket_id = 'social-media'
    and auth.uid()::text = split_part(name, '/', 1)
    and split_part(name, '/', 2) <> 'posts'
  );

drop policy if exists "social media owners delete" on storage.objects;
create policy "social media owners delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'social-media'
    and auth.uid()::text = split_part(name, '/', 1)
    and not public.is_fortalreel_storage_path_protected(name)
  );

create or replace function public.clear_fortalreel_validation_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_reel then
    delete from public.fortalreel_video_validations
    where storage_path = old.media_path and owner_id = old.author_id;
  end if;
  return old;
end;
$$;

revoke all on function public.clear_fortalreel_validation_before_delete() from public, anon, authenticated;
drop trigger if exists clear_fortalreel_validation_before_delete on public.posts;
create trigger clear_fortalreel_validation_before_delete
  before delete on public.posts
  for each row execute function public.clear_fortalreel_validation_before_delete();

create unique index if not exists post_media_one_video_per_reel_idx
  on public.post_media (post_id)
  where reel_validated;

revoke update on public.posts from authenticated;
grant update (body, visibility) on public.posts to authenticated;

create index if not exists posts_public_reels_idx
  on public.posts (published_at desc, id desc)
  where is_reel;
