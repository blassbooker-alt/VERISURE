-- Privacy-aware profile connections and deduplicated video view metrics.
-- Apply after PRODUCAO_BACKEND_SUPABASE.sql, FORTALFY_SOCIAL_V1_SUPABASE.sql,
-- and FORTALFY_STORIES_SUPABASE.sql.

create table if not exists public.reel_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (post_id, viewer_id)
);

create index if not exists reel_views_post_idx
  on public.reel_views (post_id, viewed_at desc);

alter table public.reel_views enable row level security;
revoke all on public.reel_views from public, anon, authenticated;

create or replace function public.can_read_fortalfy_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.profiles profile
    where profile.id = p_profile_id
      and (
        profile.id = auth.uid()
        or not profile.is_private
        or profile.partner_approved_at is not null
        or exists (
          select 1 from public.profile_follows follow
          where follow.follower_id = auth.uid()
            and follow.followed_id = profile.id
        )
      )
  );
$$;

create or replace function public.get_fortalfy_profile_social_stats(p_profile_id uuid)
returns table (
  followers_count bigint,
  following_count bigint,
  is_following boolean,
  request_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.profile_follows f where f.followed_id = p_profile_id),
    (select count(*) from public.profile_follows f where f.follower_id = p_profile_id),
    exists (
      select 1 from public.profile_follows f
      where f.follower_id = auth.uid() and f.followed_id = p_profile_id
    ),
    (select request.status from public.follow_requests request
      where request.follower_id = auth.uid() and request.followed_id = p_profile_id)
  where public.can_read_fortalfy_profile(p_profile_id);
$$;

create or replace function public.get_fortalfy_profile_connections(
  p_profile_id uuid,
  p_direction text,
  p_offset integer default 0,
  p_limit integer default 50
)
returns table (
  connection_id uuid,
  display_name text,
  username text,
  avatar_path text,
  followed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    connection.id,
    connection.display_name,
    connection.username,
    connection.avatar_path,
    follow.created_at
  from public.profile_follows follow
  join public.profiles connection
    on connection.id = case
      when p_direction = 'followers' then follow.follower_id
      when p_direction = 'following' then follow.followed_id
      else null
    end
  where auth.uid() is not null
    and p_direction in ('followers', 'following')
    and public.can_read_fortalfy_profile(p_profile_id)
    and case
      when p_direction = 'followers' then follow.followed_id = p_profile_id
      when p_direction = 'following' then follow.follower_id = p_profile_id
      else false
    end
    and (
      connection.id = auth.uid()
      or not connection.is_private
      or connection.partner_approved_at is not null
      or exists (
        select 1 from public.profile_follows viewer_follow
        where viewer_follow.follower_id = auth.uid()
          and viewer_follow.followed_id = connection.id
      )
    )
  order by follow.created_at desc, connection.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

drop policy if exists "authenticated can read follows" on public.profile_follows;
drop policy if exists "profile connections visible to permitted users" on public.profile_follows;
create policy "profile connections visible to permitted users" on public.profile_follows
  for select to authenticated using (
    follower_id = auth.uid()
    or public.can_read_fortalfy_profile(followed_id)
  );

drop policy if exists "profile owners answer follow requests" on public.follow_requests;
revoke update on public.follow_requests from authenticated;

create or replace function public.respond_fortalfy_follow_request(
  p_follower_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_follower_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to answer a follow request'
      using errcode = '42501';
  end if;
  update public.follow_requests
    set status = case when p_accept then 'accepted' else 'rejected' end,
        updated_at = now()
    where follower_id = p_follower_id
      and followed_id = auth.uid()
      and status = 'pending'
    returning follower_id into request_follower_id;
  if request_follower_id is null then
    raise exception 'Pending follow request not found for this account'
      using errcode = 'P0002';
  end if;
  if p_accept then
    insert into public.profile_follows (follower_id, followed_id)
    values (request_follower_id, auth.uid())
    on conflict (follower_id, followed_id) do nothing;
  end if;
  return case when p_accept then 'accepted' else 'rejected' end;
end;
$$;

create or replace function public.record_fortalfy_reel_view(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to register a Reel view'
      using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.posts post
    join public.profiles author on author.id = post.author_id
    where post.id = p_post_id
      and post.author_id <> auth.uid()
      and exists (
        select 1 from public.post_media media
        where media.post_id = post.id and media.media_type = 'video'
      )
      and (
        post.author_id = auth.uid()
        or (
          (post.visibility = 'public' or exists (
            select 1 from public.profile_follows follow
            where follow.follower_id = auth.uid()
              and follow.followed_id = post.author_id
          ))
          and (
            not author.is_private
            or exists (
              select 1 from public.profile_follows follow
              where follow.follower_id = auth.uid()
                and follow.followed_id = author.id
            )
          )
        )
      )
  ) then
    raise exception 'Reel not found or not visible to this account'
      using errcode = '42501';
  end if;

  insert into public.reel_views (post_id, viewer_id)
  values (p_post_id, auth.uid())
  on conflict (post_id, viewer_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end;
$$;

create or replace function public.get_fortalfy_reel_view_counts(p_post_ids uuid[])
returns table (post_id uuid, view_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select post.id, count(view.viewer_id)
  from public.posts post
  join public.profiles author on author.id = post.author_id
  join public.post_media media on media.post_id = post.id and media.media_type = 'video'
  left join public.reel_views view on view.post_id = post.id
  where auth.uid() is not null
    and post.id = any(coalesce(p_post_ids, '{}'::uuid[]))
    and (
      post.author_id = auth.uid()
      or (
        (post.visibility = 'public' or exists (
          select 1 from public.profile_follows follow
          where follow.follower_id = auth.uid()
            and follow.followed_id = post.author_id
        ))
        and (
          not author.is_private
          or exists (
            select 1 from public.profile_follows follow
            where follow.follower_id = auth.uid()
              and follow.followed_id = author.id
          )
        )
      )
    )
  group by post.id;
$$;

create or replace function public.get_fortalfy_story_viewers(p_story_id uuid)
returns table (
  viewer_id uuid,
  viewer_name text,
  username text,
  avatar_path text,
  viewed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when viewer.id = auth.uid()
      or not viewer.is_private
      or viewer.partner_approved_at is not null
      or exists (
        select 1 from public.profile_follows follow
        where follow.follower_id = auth.uid()
          and follow.followed_id = viewer.id
      )
      then viewer.id else null end,
    case when viewer.id = auth.uid()
      or not viewer.is_private
      or viewer.partner_approved_at is not null
      or exists (
        select 1 from public.profile_follows follow
        where follow.follower_id = auth.uid()
          and follow.followed_id = viewer.id
      )
      then viewer.display_name else 'Conta privada' end,
    case when viewer.id = auth.uid()
      or not viewer.is_private
      or viewer.partner_approved_at is not null
      or exists (
        select 1 from public.profile_follows follow
        where follow.follower_id = auth.uid()
          and follow.followed_id = viewer.id
      )
      then viewer.username else null end,
    case when viewer.id = auth.uid()
      or not viewer.is_private
      or viewer.partner_approved_at is not null
      or exists (
        select 1 from public.profile_follows follow
        where follow.follower_id = auth.uid()
          and follow.followed_id = viewer.id
      )
      then viewer.avatar_path else null end,
    view.viewed_at
  from public.stories story
  join public.story_views view on view.story_id = story.id
  join public.profiles viewer on viewer.id = view.viewer_id
  where auth.uid() is not null
    and story.id = p_story_id
    and story.owner_id = auth.uid()
  order by view.viewed_at desc;
$$;

revoke all on function public.can_read_fortalfy_profile(uuid) from public, anon;
revoke all on function public.get_fortalfy_profile_social_stats(uuid) from public, anon;
revoke all on function public.get_fortalfy_profile_connections(uuid, text, integer, integer) from public, anon;
revoke all on function public.respond_fortalfy_follow_request(uuid, boolean) from public, anon;
revoke all on function public.record_fortalfy_reel_view(uuid) from public, anon;
revoke all on function public.get_fortalfy_reel_view_counts(uuid[]) from public, anon;
revoke all on function public.get_fortalfy_story_viewers(uuid) from public, anon;
grant execute on function public.can_read_fortalfy_profile(uuid) to authenticated;
grant execute on function public.get_fortalfy_profile_social_stats(uuid) to authenticated;
grant execute on function public.get_fortalfy_profile_connections(uuid, text, integer, integer) to authenticated;
grant execute on function public.respond_fortalfy_follow_request(uuid, boolean) to authenticated;
grant execute on function public.record_fortalfy_reel_view(uuid) to authenticated;
grant execute on function public.get_fortalfy_reel_view_counts(uuid[]) to authenticated;
grant execute on function public.get_fortalfy_story_viewers(uuid) to authenticated;

notify pgrst, 'reload schema';
