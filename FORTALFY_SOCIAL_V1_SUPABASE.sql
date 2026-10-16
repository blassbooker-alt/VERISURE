-- Fortalfy social feed, private media, and approved partner discovery.
-- Apply after PRODUCAO_BACKEND_SUPABASE.sql and FORTALFY_AUTH_ONBOARDING_V1.sql.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists city text,
  add column if not exists avatar_path text,
  add column if not exists cover_path text,
  add column if not exists is_private boolean not null default false,
  add column if not exists partner_approved_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null;

alter table public.posts
  add column if not exists visibility text not null default 'public',
  add column if not exists shared_post_id uuid references public.posts(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts add constraint posts_body_check
  check (
    char_length(body) <= 5000
    and (shared_post_id is not null or char_length(body) >= 1)
  );
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility in ('public', 'followers'));

create index if not exists posts_published_id_idx
  on public.posts (published_at desc, id desc);
create index if not exists posts_shared_post_idx
  on public.posts (shared_post_id) where shared_post_id is not null;

create table if not exists public.profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint profile_follows_not_self check (follower_id <> followed_id)
);

create table if not exists public.follow_requests (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follow_requests_not_self check (follower_id <> followed_id)
);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

alter table public.post_comments
  add column if not exists parent_comment_id uuid references public.post_comments(id) on delete cascade,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.post_comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.hidden_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 1000),
  created_at timestamptz not null default now(),
  constraint content_reports_one_target check (num_nonnulls(post_id, comment_id) = 1)
);

create table if not exists public.partner_listings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  address text not null check (char_length(address) between 3 and 300),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  modalities text[] not null default '{}',
  opening_hours jsonb not null default '{}'::jsonb,
  website_url text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_fortalfy_signup_profile_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_kind text := coalesce(new.raw_user_meta_data ->> 'kind', 'cliente');
begin
  if requested_kind not in ('cliente', 'personal', 'nutricionista', 'academia') then
    requested_kind := 'cliente';
  end if;
  update public.profiles
    set kind = requested_kind::public.profile_kind
    where id = new.id;
  return new;
end;
$$;

revoke all on function public.set_fortalfy_signup_profile_kind() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_set_profile_kind on auth.users;
create trigger on_auth_user_created_set_profile_kind
  after insert on auth.users
  for each row execute function public.set_fortalfy_signup_profile_kind();

create index if not exists partner_listings_coordinates_idx
  on public.partner_listings (latitude, longitude);
create index if not exists profile_follows_followed_idx
  on public.profile_follows (followed_id, created_at desc);
create index if not exists posts_author_published_idx
  on public.posts (author_id, published_at desc, id desc);
create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at, id);
create index if not exists post_media_post_order_idx
  on public.post_media (post_id, sort_order);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, delete on public.post_likes to authenticated;
grant select, insert, update, delete on public.post_comments to authenticated;
grant select, insert, delete on public.profile_follows to authenticated;
grant select, insert, update, delete on public.follow_requests to authenticated;
grant select, insert, update, delete on public.post_media to authenticated;
grant select, insert, delete on public.post_comment_likes to authenticated;
grant select, insert, delete on public.saved_posts to authenticated;
grant select, insert, delete on public.hidden_posts to authenticated;
grant select, insert on public.content_reports to authenticated;
grant select, insert, update, delete on public.partner_listings to authenticated;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.profile_follows enable row level security;
alter table public.follow_requests enable row level security;
alter table public.post_media enable row level security;
alter table public.post_comment_likes enable row level security;
alter table public.saved_posts enable row level security;
alter table public.hidden_posts enable row level security;
alter table public.content_reports enable row level security;
alter table public.partner_listings enable row level security;

drop policy if exists "profiles visible to authenticated" on public.profiles;
drop policy if exists "social profiles visible to permitted users" on public.profiles;
create policy "social profiles visible to permitted users" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or not is_private
    or partner_approved_at is not null
    or exists (
      select 1 from public.profile_follows f
      where f.follower_id = auth.uid() and f.followed_id = profiles.id
    )
  );

drop policy if exists "profile owner updates own profile" on public.profiles;
create policy "profile owner updates own profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
revoke update on public.profiles from authenticated;
grant update (display_name, username, bio, city, avatar_path, cover_path, is_private)
  on public.profiles to authenticated;
drop policy if exists "profile owner inserts own profile" on public.profiles;

drop policy if exists "published posts visible to authenticated" on public.posts;
create policy "published posts visible to authenticated" on public.posts
  for select to authenticated
  using (
    author_id = auth.uid()
    or (
      (visibility = 'public' or exists (
        select 1 from public.profile_follows f
        where f.follower_id = auth.uid() and f.followed_id = posts.author_id
      ))
      and exists (
        select 1 from public.profiles p
        where p.id = posts.author_id
          and (not p.is_private or p.id = auth.uid() or exists (
            select 1 from public.profile_follows f
            where f.follower_id = auth.uid() and f.followed_id = p.id
          ))
      )
    )
  );
drop policy if exists "users create own posts" on public.posts;
create policy "users create own posts" on public.posts
  for insert to authenticated with check (auth.uid() = author_id);
drop policy if exists "authors update own posts" on public.posts;
create policy "authors update own posts" on public.posts
  for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
drop policy if exists "authors delete own posts" on public.posts;
create policy "authors delete own posts" on public.posts for delete to authenticated using (auth.uid() = author_id);

drop policy if exists "likes visible to authenticated" on public.post_likes;
create policy "likes visible to authenticated" on public.post_likes
  for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "users like as themselves" on public.post_likes;
create policy "users like as themselves" on public.post_likes
  for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "users remove own likes" on public.post_likes;
create policy "users remove own likes" on public.post_likes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "comments visible to authenticated" on public.post_comments;
create policy "comments visible to authenticated" on public.post_comments
  for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "users comment as themselves" on public.post_comments;
create policy "users comment as themselves" on public.post_comments
  for insert to authenticated
  with check (auth.uid() = author_id and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "authors update own comments" on public.post_comments;
create policy "authors update own comments" on public.post_comments
  for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
drop policy if exists "authors delete own comments" on public.post_comments;
create policy "authors delete own comments" on public.post_comments for delete to authenticated using (auth.uid() = author_id);

drop policy if exists "authenticated can read follows" on public.profile_follows;
create policy "authenticated can read follows" on public.profile_follows for select to authenticated using (true);
drop policy if exists "users follow as themselves" on public.profile_follows;
create policy "users follow as themselves" on public.profile_follows
  for insert to authenticated with check (auth.uid() = follower_id and follower_id <> followed_id);
drop policy if exists "users unfollow as themselves" on public.profile_follows;
create policy "users unfollow as themselves" on public.profile_follows for delete to authenticated using (auth.uid() = follower_id);

drop policy if exists "users read own follow requests" on public.follow_requests;
create policy "users read own follow requests" on public.follow_requests
  for select to authenticated using (auth.uid() = follower_id or auth.uid() = followed_id);
drop policy if exists "users create follow requests" on public.follow_requests;
create policy "users create follow requests" on public.follow_requests
  for insert to authenticated with check (
    auth.uid() = follower_id and follower_id <> followed_id
    and exists (select 1 from public.profiles p where p.id = followed_id and p.is_private)
  );
drop policy if exists "users cancel own follow requests" on public.follow_requests;
create policy "users cancel own follow requests" on public.follow_requests
  for delete to authenticated using (auth.uid() = follower_id or auth.uid() = followed_id);
drop policy if exists "profile owners answer follow requests" on public.follow_requests;
create policy "profile owners answer follow requests" on public.follow_requests
  for update to authenticated using (auth.uid() = followed_id) with check (auth.uid() = followed_id);

drop policy if exists "post media visible with post" on public.post_media;
create policy "post media visible with post" on public.post_media
  for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "authors manage post media" on public.post_media;
create policy "authors manage post media" on public.post_media
  for all to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

drop policy if exists "comment likes visible with comment" on public.post_comment_likes;
create policy "comment likes visible with comment" on public.post_comment_likes
  for select to authenticated using (exists (select 1 from public.post_comments c where c.id = comment_id));
drop policy if exists "users like comments as themselves" on public.post_comment_likes;
create policy "users like comments as themselves" on public.post_comment_likes
  for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.post_comments c where c.id = comment_id));
drop policy if exists "users remove own comment likes" on public.post_comment_likes;
create policy "users remove own comment likes" on public.post_comment_likes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "users manage own saved posts" on public.saved_posts;
create policy "users manage own saved posts" on public.saved_posts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users manage own hidden posts" on public.hidden_posts;
create policy "users manage own hidden posts" on public.hidden_posts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users submit content reports" on public.content_reports;
create policy "users submit content reports" on public.content_reports
  for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists "reporters read own reports" on public.content_reports;
create policy "reporters read own reports" on public.content_reports
  for select to authenticated using (auth.uid() = reporter_id);

drop policy if exists "approved partner listings are visible" on public.partner_listings;
create policy "approved partner listings are visible" on public.partner_listings
  for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = profile_id
        and p.partner_approved_at is not null
        and p.kind in ('personal', 'nutricionista', 'academia', 'marca')
    )
  );
drop policy if exists "partners manage own listing" on public.partner_listings;
create policy "partners manage own listing" on public.partner_listings
  for all to authenticated
  using (auth.uid() = profile_id)
  with check (
    auth.uid() = profile_id
    and exists (select 1 from public.profiles p where p.id = profile_id and p.kind in ('personal', 'nutricionista', 'academia', 'marca'))
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-media', 'social-media', false, 41943040, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do nothing;

drop policy if exists "social media authorized readers" on storage.objects;
create policy "social media authorized readers" on storage.objects
  for select to authenticated using (
    bucket_id = 'social-media'
    and (
      auth.uid()::text = split_part(name, '/', 1)
      or (
        split_part(name, '/', 2) = 'profile'
        and exists (
          select 1 from public.profiles p
          where p.id::text = split_part(name, '/', 1)
            and (
              not p.is_private or p.id = auth.uid() or exists (
                select 1 from public.profile_follows f
                where f.follower_id = auth.uid() and f.followed_id = p.id
              )
            )
        )
      )
      or (
        split_part(name, '/', 2) = 'posts'
        and exists (
          select 1 from public.posts p
          where p.id::text = split_part(name, '/', 3)
            and (
              p.author_id = auth.uid()
              or (
                (p.visibility = 'public' or exists (
                  select 1 from public.profile_follows f
                  where f.follower_id = auth.uid() and f.followed_id = p.author_id
                ))
                and exists (
                  select 1 from public.profiles owner
                  where owner.id = p.author_id
                    and (not owner.is_private or owner.id = auth.uid() or exists (
                      select 1 from public.profile_follows f
                      where f.follower_id = auth.uid() and f.followed_id = owner.id
                    ))
                )
              )
            )
        )
      )
    )
  );
drop policy if exists "social media owners upload" on storage.objects;
create policy "social media owners upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'social-media' and auth.uid()::text = split_part(name, '/', 1)
  );
drop policy if exists "social media owners update" on storage.objects;
create policy "social media owners update" on storage.objects
  for update to authenticated using (
    bucket_id = 'social-media' and auth.uid()::text = split_part(name, '/', 1)
  ) with check (
    bucket_id = 'social-media' and auth.uid()::text = split_part(name, '/', 1)
  );
drop policy if exists "social media owners delete" on storage.objects;
create policy "social media owners delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'social-media' and auth.uid()::text = split_part(name, '/', 1)
  );