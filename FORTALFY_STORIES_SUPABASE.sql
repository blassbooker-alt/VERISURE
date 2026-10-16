-- Stories compartilhados entre contas usando o bucket privado social-media.
-- Aplicar depois de PRODUCAO_BACKEND_SUPABASE.sql e FORTALFY_SOCIAL_V1_SUPABASE.sql.

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 180),
  media_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint stories_media_path_owner check (
    (media_type = 'image' and media_path ~ ('^' || owner_id::text || '/stories/' || id::text || '\.(jpg|png|webp)$'))
    or (media_type = 'video' and media_path ~ ('^' || owner_id::text || '/stories/' || id::text || '\.(mp4|webm)$'))
  ),
  constraint stories_expiry_window check (
    expires_at > created_at and expires_at <= created_at + interval '24 hours'
  )
);
create index if not exists stories_active_created_idx
  on public.stories (expires_at, created_at desc);

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table if not exists public.story_likes (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create or replace function public.set_fortalfy_story_expiry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  new.expires_at := new.created_at + interval '24 hours';
  return new;
end;
$$;

drop trigger if exists stories_set_expiry on public.stories;
create trigger stories_set_expiry
  before insert on public.stories
  for each row execute function public.set_fortalfy_story_expiry();

alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.story_likes enable row level security;

drop policy if exists "visible stories are readable by permitted users" on public.stories;
create policy "visible stories are readable by permitted users" on public.stories
  for select to authenticated using (
    expires_at > now()
    and exists (
      select 1 from public.profiles owner
      where owner.id = owner_id
        and (
          owner.id = auth.uid()
          or not owner.is_private
          or exists (
            select 1 from public.profile_follows follow
            where follow.follower_id = auth.uid()
              and follow.followed_id = owner.id
          )
        )
    )
  );

drop policy if exists "users publish their own stories" on public.stories;
create policy "users publish their own stories" on public.stories
  for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists "owners delete their own stories" on public.stories;
create policy "owners delete their own stories" on public.stories
  for delete to authenticated using (auth.uid() = owner_id);

drop policy if exists "story viewers read their own or story-owner views" on public.story_views;
create policy "story viewers read their own or story-owner views" on public.story_views
  for select to authenticated using (
    viewer_id = auth.uid()
    or exists (
      select 1 from public.stories story
      where story.id = story_id and story.owner_id = auth.uid()
    )
  );

drop policy if exists "users register their own story views" on public.story_views;
create policy "users register their own story views" on public.story_views
  for insert to authenticated with check (
    viewer_id = auth.uid()
    and exists (
      select 1 from public.stories story
      where story.id = story_id
        and story.owner_id <> auth.uid()
        and story.expires_at > now()
    )
  );

drop policy if exists "users read likes on visible stories" on public.story_likes;
create policy "users read likes on visible stories" on public.story_likes
  for select to authenticated using (
    exists (select 1 from public.stories story where story.id = story_id)
  );

drop policy if exists "users like visible stories as themselves" on public.story_likes;
create policy "users like visible stories as themselves" on public.story_likes
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.stories story
      where story.id = story_id and story.expires_at > now()
    )
  );

drop policy if exists "users remove their own story likes" on public.story_likes;
create policy "users remove their own story likes" on public.story_likes
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.stories to authenticated;
grant select, insert on public.story_views to authenticated;
grant select, insert, delete on public.story_likes to authenticated;

drop policy if exists "authorized viewers read active story media" on storage.objects;
create policy "authorized viewers read active story media" on storage.objects
  for select to authenticated using (
    bucket_id = 'social-media'
    and split_part(name, '/', 2) = 'stories'
    and exists (
      select 1 from public.stories story
      where story.media_path = name and story.expires_at > now()
    )
  );
