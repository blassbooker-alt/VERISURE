-- Apply after the social, food, partner storefront, professional profile, and Reel migrations.
-- Commercial registration is free. Advertising and discount participation are
-- separate permissions and require explicit server-side approval/consent.

begin;

alter table public.posts
  add column if not exists commercial_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists commercial_content boolean not null default false;

create table if not exists public.fortalfy_commercial_businesses (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  application_id uuid references public.professional_applications(id) on delete set null,
  category text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  advertising_enabled boolean not null default false,
  free_registration_terms_version text,
  free_registration_accepted_at timestamptz,
  reviewer_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    free_registration_accepted_at is null
    or free_registration_terms_version is not null
  )
);

create table if not exists public.fortalfy_commercial_audit (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  previous_values jsonb,
  new_values jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists fortalfy_commercial_audit_profile_idx
  on public.fortalfy_commercial_audit(profile_id, created_at desc);

alter table public.fortalfy_commercial_businesses enable row level security;
alter table public.fortalfy_commercial_audit enable row level security;
revoke all on public.fortalfy_commercial_businesses, public.fortalfy_commercial_audit
  from public, anon, authenticated;
grant select on public.fortalfy_commercial_businesses to authenticated;
grant select on public.fortalfy_commercial_audit to authenticated;
drop policy if exists "business owners read own commercial authorization" on public.fortalfy_commercial_businesses;
create policy "business owners read own commercial authorization"
  on public.fortalfy_commercial_businesses for select to authenticated
  using (profile_id = auth.uid());
drop policy if exists "business owners read own commercial audit" on public.fortalfy_commercial_audit;
create policy "business owners read own commercial audit"
  on public.fortalfy_commercial_audit for select to authenticated
  using (
    profile_id = auth.uid()
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

create or replace function public.fortalfy_is_advertiser(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.fortalfy_commercial_businesses business
    where business.profile_id = p_profile_id
      and business.status = 'approved'
      and business.advertising_enabled
  );
$$;
revoke all on function public.fortalfy_is_advertiser(uuid) from public, anon, authenticated;
grant execute on function public.fortalfy_is_advertiser(uuid) to anon, authenticated;

create or replace function public.fortalfy_is_approved_business(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.fortalfy_commercial_businesses business
    where business.profile_id = p_profile_id
      and business.status = 'approved'
  );
$$;
revoke all on function public.fortalfy_is_approved_business(uuid) from public, anon, authenticated;
grant execute on function public.fortalfy_is_approved_business(uuid) to authenticated;

create table if not exists public.fortalfy_commercial_content_reviews (
  target_kind text not null check (target_kind in ('post', 'store_product', 'food_menu_item')),
  target_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  reviewer_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (target_kind, target_id)
);
create index if not exists fortalfy_commercial_content_review_queue_idx
  on public.fortalfy_commercial_content_reviews(status, updated_at desc);

create table if not exists public.fortalfy_commercial_content_audit (
  id bigint generated always as identity primary key,
  target_kind text not null,
  target_id uuid not null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  previous_status text,
  new_status text not null,
  reviewer_note text,
  changed_at timestamptz not null default now()
);
create index if not exists fortalfy_commercial_content_audit_target_idx
  on public.fortalfy_commercial_content_audit(target_kind, target_id, changed_at desc);
alter table public.fortalfy_commercial_content_reviews enable row level security;
alter table public.fortalfy_commercial_content_audit enable row level security;
revoke all on public.fortalfy_commercial_content_reviews, public.fortalfy_commercial_content_audit
  from public, anon, authenticated;
grant select on public.fortalfy_commercial_content_reviews to authenticated;
grant select on public.fortalfy_commercial_content_audit to authenticated;
drop policy if exists "partners read own commercial content review" on public.fortalfy_commercial_content_reviews;
create policy "partners read own commercial content review"
  on public.fortalfy_commercial_content_reviews for select to authenticated
  using (profile_id = auth.uid());
drop policy if exists "admins read commercial content audit" on public.fortalfy_commercial_content_audit;
create policy "admins read commercial content audit"
  on public.fortalfy_commercial_content_audit for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create or replace function public.fortalfy_is_commercial_content_approved(
  p_target_kind text, p_target_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.fortalfy_commercial_content_reviews review
    where review.target_kind = p_target_kind
      and review.target_id = p_target_id
      and review.status = 'approved'
  );
$$;
revoke all on function public.fortalfy_is_commercial_content_approved(text, uuid)
  from public, anon, authenticated;
grant execute on function public.fortalfy_is_commercial_content_approved(text, uuid)
  to anon, authenticated;

create or replace function public.fortalfy_queue_commercial_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_kind text;
  item_id uuid;
  owner_id uuid;
  is_commercial boolean := false;
begin
  if tg_table_name = 'posts' then
    item_kind := 'post';
    item_id := new.id;
    owner_id := new.author_id;
    is_commercial := new.sponsored or new.commercial_content or new.commercial_profile_id is not null;
  elsif tg_table_name = 'partner_store_products' then
    item_kind := 'store_product';
    item_id := new.id;
    owner_id := new.profile_id;
    is_commercial := new.is_active;
  else
    item_kind := 'food_menu_item';
    item_id := new.id;
    owner_id := new.restaurant_id;
    is_commercial := new.available;
  end if;
  if not is_commercial then return new; end if;
  insert into public.fortalfy_commercial_content_reviews (
    target_kind, target_id, profile_id, status, reviewer_note, reviewed_by, reviewed_at
  ) values (item_kind, item_id, owner_id, 'pending', null, null, null)
  on conflict (target_kind, target_id) do update
    set profile_id = excluded.profile_id,
        status = 'pending',
        reviewer_note = null,
        reviewed_by = null,
        reviewed_at = null,
        updated_at = now();
  return new;
end;
$$;
revoke all on function public.fortalfy_queue_commercial_content() from public, anon, authenticated;
drop trigger if exists fortalfy_queue_commercial_posts on public.posts;
create trigger fortalfy_queue_commercial_posts
  after insert or update of body, visibility, sponsored, commercial_content, commercial_profile_id on public.posts
  for each row execute function public.fortalfy_queue_commercial_content();
drop trigger if exists fortalfy_queue_commercial_products on public.partner_store_products;
create trigger fortalfy_queue_commercial_products
  after insert or update of name, category, description, price, image_path, is_active
  on public.partner_store_products
  for each row execute function public.fortalfy_queue_commercial_content();
drop trigger if exists fortalfy_queue_commercial_menu_items on public.food_menu_items;
create trigger fortalfy_queue_commercial_menu_items
  after insert or update of name, description, price, image_paths, available, restaurant_id
  on public.food_menu_items
  for each row execute function public.fortalfy_queue_commercial_content();

create or replace function public.fortalfy_audit_commercial_content_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.fortalfy_commercial_content_audit (
    target_kind, target_id, actor_id, action, previous_status, new_status, reviewer_note
  ) values (
    new.target_kind, new.target_id, coalesce(new.reviewed_by, auth.uid()),
    case when tg_op = 'INSERT' then 'submitted'
      when old.status is distinct from new.status then 'moderation_decision'
      else 'content_changed'
    end,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status, new.reviewer_note
  );
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.fortalfy_audit_commercial_content_review() from public, anon, authenticated;
drop trigger if exists fortalfy_audit_commercial_content_review on public.fortalfy_commercial_content_reviews;
create trigger fortalfy_audit_commercial_content_review
  before insert or update on public.fortalfy_commercial_content_reviews
  for each row execute function public.fortalfy_audit_commercial_content_review();

insert into public.fortalfy_commercial_content_reviews(target_kind, target_id, profile_id)
select 'store_product', product.id, product.profile_id
from public.partner_store_products product where product.is_active
on conflict (target_kind, target_id) do nothing;
insert into public.fortalfy_commercial_content_reviews(target_kind, target_id, profile_id)
select 'food_menu_item', item.id, item.restaurant_id
from public.food_menu_items item where item.available
on conflict (target_kind, target_id) do nothing;
insert into public.fortalfy_commercial_content_reviews(target_kind, target_id, profile_id)
select 'post', post.id, post.author_id
from public.posts post
where post.sponsored or post.commercial_content or post.commercial_profile_id is not null
on conflict (target_kind, target_id) do nothing;

create or replace function public.fortalfy_admin_list_commercial_content()
returns table (
  target_kind text,
  target_id uuid,
  profile_id uuid,
  display_name text,
  status text,
  reviewer_note text,
  details jsonb,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Only a Fortalfy administrator can review commercial content' using errcode = '42501';
  end if;
  return query
    select review.target_kind, review.target_id, review.profile_id, profile.display_name,
      review.status, review.reviewer_note,
      case review.target_kind
        when 'post' then (select jsonb_build_object('body', post.body, 'visibility', post.visibility)
          from public.posts post where post.id = review.target_id)
        when 'store_product' then (select jsonb_build_object(
          'name', product.name, 'category', product.category, 'description', product.description, 'price', product.price
        ) from public.partner_store_products product where product.id = review.target_id)
        else (select jsonb_build_object(
          'name', item.name, 'description', item.description, 'price', item.price, 'available', item.available
        ) from public.food_menu_items item where item.id = review.target_id)
      end,
      review.updated_at
    from public.fortalfy_commercial_content_reviews review
    join public.profiles profile on profile.id = review.profile_id
    where (
      (review.target_kind = 'post' and exists (
        select 1 from public.posts post where post.id = review.target_id
      ))
      or (review.target_kind = 'store_product' and exists (
        select 1 from public.partner_store_products product where product.id = review.target_id
      ))
      or (review.target_kind = 'food_menu_item' and exists (
        select 1 from public.food_menu_items item where item.id = review.target_id
      ))
    )
    order by (review.status = 'pending') desc, review.updated_at desc
    limit 500;
end;
$$;
revoke all on function public.fortalfy_admin_list_commercial_content() from public, anon;
grant execute on function public.fortalfy_admin_list_commercial_content() to authenticated;

create or replace function public.fortalfy_admin_review_commercial_content(
  p_target_kind text, p_target_id uuid, p_status text, p_reviewer_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_owner uuid;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Only a Fortalfy administrator can review commercial content' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected', 'suspended')
     or char_length(coalesce(p_reviewer_note, '')) > 2000 then
    raise exception 'Invalid commercial content decision' using errcode = '22023';
  end if;
  if not (
    (p_target_kind = 'post' and exists (select 1 from public.posts where id = p_target_id))
    or (p_target_kind = 'store_product' and exists (select 1 from public.partner_store_products where id = p_target_id))
    or (p_target_kind = 'food_menu_item' and exists (select 1 from public.food_menu_items where id = p_target_id))
  ) then
    raise exception 'Commercial content no longer exists';
  end if;
  select profile_id into content_owner
    from public.fortalfy_commercial_content_reviews
    where target_kind = p_target_kind and target_id = p_target_id;
  if not found then raise exception 'Commercial content not found'; end if;
  if p_status = 'approved' and not public.fortalfy_is_advertiser(content_owner) then
    raise exception 'The business advertising permission is not active' using errcode = '42501';
  end if;
  update public.fortalfy_commercial_content_reviews
    set status = p_status, reviewer_note = nullif(btrim(p_reviewer_note), ''),
        reviewed_by = auth.uid(), reviewed_at = now()
    where target_kind = p_target_kind and target_id = p_target_id;
end;
$$;
revoke all on function public.fortalfy_admin_review_commercial_content(text, uuid, text, text)
  from public, anon;
grant execute on function public.fortalfy_admin_review_commercial_content(text, uuid, text, text)
  to authenticated;

create or replace function public.fortalfy_audit_commercial_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.fortalfy_commercial_audit (
    profile_id, actor_id, action, previous_values, new_values
  ) values (
    new.profile_id,
    auth.uid(),
    case
      when tg_op = 'INSERT' then 'registered'
      when old.status is distinct from new.status then 'status_changed'
      when old.advertising_enabled is distinct from new.advertising_enabled then 'advertising_permission_changed'
      else 'commercial_record_changed'
    end,
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'status', old.status,
      'advertising_enabled', old.advertising_enabled,
      'reviewer_note', old.reviewer_note,
      'free_registration_terms_version', old.free_registration_terms_version,
      'free_registration_accepted_at', old.free_registration_accepted_at
    ) else null end,
    jsonb_build_object(
      'status', new.status,
      'advertising_enabled', new.advertising_enabled,
      'reviewer_note', new.reviewer_note,
      'free_registration_terms_version', new.free_registration_terms_version,
      'free_registration_accepted_at', new.free_registration_accepted_at,
      'reviewed_at', new.reviewed_at
    )
  );
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.fortalfy_audit_commercial_business() from public, anon, authenticated;
drop trigger if exists fortalfy_commercial_business_audit on public.fortalfy_commercial_businesses;
create trigger fortalfy_commercial_business_audit
  before insert or update on public.fortalfy_commercial_businesses
  for each row execute function public.fortalfy_audit_commercial_business();

create or replace function public.fortalfy_sync_commercial_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_status text;
begin
  business_status := case
    when new.status = 'approved' then 'approved'
    when new.status = 'suspended' then 'suspended'
    when new.status = 'rejected' then 'rejected'
    else 'pending'
  end;

  insert into public.fortalfy_commercial_businesses (
    profile_id, application_id, category, status, advertising_enabled
  ) values (
    new.profile_id, new.id, new.kind, business_status, false
  )
  on conflict (profile_id) do update
    set application_id = excluded.application_id,
        category = excluded.category,
        status = excluded.status,
        advertising_enabled = case
          when excluded.status = 'approved'
            then public.fortalfy_commercial_businesses.advertising_enabled
          else false
        end,
        reviewer_note = case when excluded.status = 'approved'
          then public.fortalfy_commercial_businesses.reviewer_note
          else new.reviewer_note
        end;
  return new;
end;
$$;
revoke all on function public.fortalfy_sync_commercial_application() from public, anon, authenticated;
drop trigger if exists professional_applications_sync_commercial on public.professional_applications;
create trigger professional_applications_sync_commercial
  after insert or update of status, kind, profile_id on public.professional_applications
  for each row execute function public.fortalfy_sync_commercial_application();

insert into public.fortalfy_commercial_businesses (
  profile_id, category, status, advertising_enabled
)
select profile.id, profile.kind::text,
       case when profile.partner_approved_at is not null then 'approved' else 'pending' end,
       false
from public.profiles profile
where profile.kind::text in (
  'empresa', 'marca', 'vendedor', 'restaurante', 'academia',
  'personal', 'nutricionista', 'influenciador'
)
on conflict (profile_id) do nothing;
insert into public.fortalfy_commercial_businesses (
  profile_id, application_id, category, status, advertising_enabled
)
select application.profile_id, application.id, application.kind,
       case
         when application.status = 'approved' then 'approved'
         when application.status = 'suspended' then 'suspended'
         when application.status = 'rejected' then 'rejected'
         else 'pending'
       end,
       false
from public.professional_applications application
on conflict (profile_id) do nothing;

create or replace function public.fortalfy_admin_list_commercial_businesses()
returns table (
  profile_id uuid,
  display_name text,
  username text,
  category text,
  status text,
  advertising_enabled boolean,
  reviewer_note text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Only a Fortalfy administrator can review commercial businesses'
      using errcode = '42501';
  end if;
  return query
    select business.profile_id, profile.display_name, profile.username,
      business.category, business.status, business.advertising_enabled,
      business.reviewer_note, business.updated_at
    from public.fortalfy_commercial_businesses business
    join public.profiles profile on profile.id = business.profile_id
    order by business.updated_at desc
    limit 500;
end;
$$;
revoke all on function public.fortalfy_admin_list_commercial_businesses() from public, anon;
grant execute on function public.fortalfy_admin_list_commercial_businesses() to authenticated;

create or replace function public.fortalfy_admin_set_commercial_status(
  p_profile_id uuid,
  p_status text,
  p_advertising_enabled boolean,
  p_reviewer_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Only a Fortalfy administrator can review commercial businesses'
      using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected', 'suspended', 'pending')
     or char_length(coalesce(p_reviewer_note, '')) > 2000 then
    raise exception 'Invalid commercial review data' using errcode = '22023';
  end if;
  if p_advertising_enabled and p_status <> 'approved' then
    raise exception 'Advertising requires an approved business' using errcode = '23514';
  end if;
  if p_status = 'approved' and not exists (
    select 1
    from public.fortalfy_commercial_businesses business
    join public.profiles profile on profile.id = business.profile_id
    where business.profile_id = p_profile_id
      and business.free_registration_accepted_at is not null
      and (
        exists (
          select 1 from public.professional_applications application
          where application.id = business.application_id
            and application.profile_id = business.profile_id
            and application.status = 'approved'
        )
        or (business.application_id is null and profile.partner_approved_at is not null)
      )
  ) then
    raise exception 'Business terms and an approved application are required'
      using errcode = '23514';
  end if;
  update public.fortalfy_commercial_businesses
    set status = p_status,
        advertising_enabled = p_advertising_enabled,
        reviewer_note = nullif(btrim(p_reviewer_note), ''),
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where profile_id = p_profile_id;
  if not found then raise exception 'Commercial business not found'; end if;
end;
$$;
revoke all on function public.fortalfy_admin_set_commercial_status(uuid, text, boolean, text)
  from public, anon;
grant execute on function public.fortalfy_admin_set_commercial_status(uuid, text, boolean, text)
  to authenticated;

create or replace function public.fortalfy_record_free_registration_terms(
  p_category text, p_terms_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or p_category not in ('empresa', 'marca', 'vendedor', 'restaurante', 'academia',
                           'personal', 'nutricionista', 'influenciador')
     or p_terms_version <> 'fortalfy-free-business-v1' then
    raise exception 'Current free business registration terms are required'
      using errcode = '22023';
  end if;
  insert into public.fortalfy_commercial_businesses (
    profile_id, category, status, advertising_enabled,
    free_registration_terms_version, free_registration_accepted_at
  ) values (
    auth.uid(), p_category, 'pending', false,
    p_terms_version, now()
  )
  on conflict (profile_id) do update
    set category = excluded.category,
        free_registration_terms_version = excluded.free_registration_terms_version,
        free_registration_accepted_at = excluded.free_registration_accepted_at;
end;
$$;
revoke all on function public.fortalfy_record_free_registration_terms(text, text)
  from public, anon;
grant execute on function public.fortalfy_record_free_registration_terms(text, text)
  to authenticated;

create or replace function public.fortalfy_guard_commercial_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.sponsored or old.commercial_content or old.commercial_profile_id is not null)
       and not (new.sponsored or new.commercial_content or new.commercial_profile_id is not null) then
      raise exception 'Commercial posts cannot be reclassified as personal content'
        using errcode = '42501';
    end if;
  end if;
  if new.sponsored or new.commercial_content or new.commercial_profile_id is not null then
    if new.commercial_profile_id is distinct from new.author_id
       or not public.fortalfy_is_advertiser(new.author_id) then
      raise exception 'Commercial posts require the approved advertising permission of their own business'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.fortalfy_guard_commercial_post() from public, anon, authenticated;
drop trigger if exists fortalfy_guard_commercial_post on public.posts;
create trigger fortalfy_guard_commercial_post
  before insert or update of sponsored, commercial_content, commercial_profile_id on public.posts
  for each row execute function public.fortalfy_guard_commercial_post();

create or replace function public.fortalfy_publish_commercial_reel(
  p_post_id uuid,
  p_author_id uuid,
  p_storage_path text,
  p_body text,
  p_visibility text,
  p_width integer,
  p_height integer,
  p_duration_seconds numeric,
  p_commercial boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  published_id uuid;
begin
  if p_commercial and not public.fortalfy_is_advertiser(p_author_id) then
    raise exception 'Commercial Reels require approved advertising permission'
      using errcode = '42501';
  end if;
  published_id := public.publish_fortalreel(
    p_post_id, p_author_id, p_storage_path, p_body, p_visibility,
    p_width, p_height, p_duration_seconds
  );
  if p_commercial then
    update public.posts
      set sponsored = true, commercial_content = true,
          commercial_profile_id = p_author_id
      where id = published_id and author_id = p_author_id;
  end if;
  return published_id;
end;
$$;
revoke all on function public.fortalfy_publish_commercial_reel(uuid, uuid, text, text, text, integer, integer, numeric, boolean)
  from public, anon, authenticated;
grant execute on function public.fortalfy_publish_commercial_reel(uuid, uuid, text, text, text, integer, integer, numeric, boolean)
  to service_role;

drop policy if exists "commercial post authorization is current" on public.posts;
create policy "commercial post authorization is current" on public.posts
  as restrictive for select to authenticated
  using (
    (
      not sponsored and not commercial_content and commercial_profile_id is null
    )
    or author_id = auth.uid()
    or (
      commercial_profile_id = author_id
      and public.fortalfy_is_advertiser(commercial_profile_id)
      and public.fortalfy_is_commercial_content_approved('post', id)
    )
  );

drop policy if exists "approved storefront product images are readable" on storage.objects;
create policy "approved storefront product images are readable" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'social-media'
    and split_part(name, '/', 2) = 'store-products'
    and exists (
      select 1 from public.partner_store_products product
      where product.image_path = name
        and (
          auth.uid() = product.profile_id
          or (
            product.is_active
            and public.fortalfy_is_advertiser(product.profile_id)
            and public.fortalfy_is_commercial_content_approved('store_product', product.id)
          )
        )
    )
  );

drop policy if exists "approved stores publish active products" on public.partner_store_products;
create policy "approved stores publish active products" on public.partner_store_products
  for select to anon, authenticated
  using (
    auth.uid() = profile_id
    or (
      is_active
      and public.fortalfy_is_advertiser(profile_id)
      and public.fortalfy_is_commercial_content_approved('store_product', id)
    )
  );

drop policy if exists "approved partner listings are visible" on public.partner_listings;
create policy "approved partner listings are visible" on public.partner_listings
  for select to authenticated
  using (
    profile_id = auth.uid()
    or public.fortalfy_is_approved_business(profile_id)
  );

drop policy if exists "available menu items readable" on public.food_menu_items;
create policy "available menu items readable" on public.food_menu_items
  for select to authenticated
  using (
    restaurant_id = auth.uid()
    or public.is_fortalfy_admin()
    or (
      available
      and public.fortalfy_is_advertiser(restaurant_id)
      and public.fortalfy_is_commercial_content_approved('food_menu_item', id)
    )
  );

create or replace function public.fortalfy_validate_commercial_menu_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.available and not public.fortalfy_is_advertiser(new.restaurant_id) then
    if tg_op = 'INSERT'
       or (tg_op = 'UPDATE' and (not old.available or old.restaurant_id is distinct from new.restaurant_id)) then
      raise exception 'Publishing menu items requires an approved restaurant with advertising permission'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.fortalfy_validate_commercial_menu_item() from public, anon, authenticated;
drop trigger if exists fortalfy_validate_commercial_menu_item on public.food_menu_items;
create trigger fortalfy_validate_commercial_menu_item
  before insert or update of available, restaurant_id on public.food_menu_items
  for each row execute function public.fortalfy_validate_commercial_menu_item();

create table if not exists public.fortalfy_commercial_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_kind text not null check (target_kind in ('post', 'store_product', 'food_menu_item', 'business_profile')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'actioned', 'dismissed')),
  decision_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_kind, target_id)
);
alter table public.fortalfy_commercial_reports enable row level security;
revoke all on public.fortalfy_commercial_reports from public, anon, authenticated;
grant select, insert on public.fortalfy_commercial_reports to authenticated;
drop policy if exists "users submit commercial reports as themselves" on public.fortalfy_commercial_reports;
create policy "users submit commercial reports as themselves"
  on public.fortalfy_commercial_reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'pending' and reviewed_by is null);
drop policy if exists "reporters read own commercial reports" on public.fortalfy_commercial_reports;
create policy "reporters read own commercial reports"
  on public.fortalfy_commercial_reports for select to authenticated
  using (reporter_id = auth.uid());

create table if not exists public.fortalfy_commercial_moderation_audit (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.fortalfy_commercial_reports(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  previous_status text not null,
  new_status text not null,
  decision_note text,
  changed_at timestamptz not null default now()
);
alter table public.fortalfy_commercial_moderation_audit enable row level security;
revoke all on public.fortalfy_commercial_moderation_audit from public, anon, authenticated;
grant select on public.fortalfy_commercial_moderation_audit to authenticated;
drop policy if exists "admins read commercial moderation audit" on public.fortalfy_commercial_moderation_audit;
create policy "admins read commercial moderation audit"
  on public.fortalfy_commercial_moderation_audit for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create or replace function public.fortalfy_audit_commercial_report_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status
     or old.decision_note is distinct from new.decision_note then
    insert into public.fortalfy_commercial_moderation_audit (
      report_id, actor_id, previous_status, new_status, decision_note
    ) values (
      new.id, new.reviewed_by, old.status, new.status, new.decision_note
    );
  end if;
  return new;
end;
$$;
revoke all on function public.fortalfy_audit_commercial_report_decision() from public, anon, authenticated;
drop trigger if exists fortalfy_audit_commercial_report_decision on public.fortalfy_commercial_reports;
create trigger fortalfy_audit_commercial_report_decision
  after update on public.fortalfy_commercial_reports
  for each row execute function public.fortalfy_audit_commercial_report_decision();

create or replace function public.fortalfy_report_commercial_content(
  p_target_kind text, p_target_id uuid, p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_exists boolean := false;
  report_id uuid;
begin
  if auth.uid() is null or char_length(btrim(coalesce(p_reason, ''))) not between 3 and 1000 then
    raise exception 'A valid report reason is required' using errcode = '22023';
  end if;
  if p_target_kind = 'post' then
    select exists(select 1 from public.posts where id = p_target_id) into target_exists;
  elsif p_target_kind = 'store_product' then
    select exists(select 1 from public.partner_store_products where id = p_target_id) into target_exists;
  elsif p_target_kind = 'food_menu_item' then
    select exists(select 1 from public.food_menu_items where id = p_target_id) into target_exists;
  elsif p_target_kind = 'business_profile' then
    select exists(select 1 from public.profiles where id = p_target_id) into target_exists;
  else
    raise exception 'Unsupported report target' using errcode = '22023';
  end if;
  if not target_exists then raise exception 'Reported content was not found'; end if;
  insert into public.fortalfy_commercial_reports(reporter_id, target_kind, target_id, reason)
    values (auth.uid(), p_target_kind, p_target_id, btrim(p_reason))
    returning id into report_id;
  return report_id;
exception when unique_violation then
  raise exception 'You have already reported this content' using errcode = '23505';
end;
$$;
revoke all on function public.fortalfy_report_commercial_content(text, uuid, text)
  from public, anon;
grant execute on function public.fortalfy_report_commercial_content(text, uuid, text)
  to authenticated;

create or replace function public.fortalfy_admin_list_commercial_reports()
returns setof public.fortalfy_commercial_reports
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Only a Fortalfy administrator can review reports' using errcode = '42501';
  end if;
  return query select * from public.fortalfy_commercial_reports
    order by created_at desc limit 500;
end;
$$;
revoke all on function public.fortalfy_admin_list_commercial_reports() from public, anon;
grant execute on function public.fortalfy_admin_list_commercial_reports() to authenticated;

create or replace function public.fortalfy_admin_review_commercial_report(
  p_report_id uuid, p_status text, p_decision_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Only a Fortalfy administrator can review reports' using errcode = '42501';
  end if;
  if p_status not in ('reviewed', 'actioned', 'dismissed')
     or char_length(coalesce(p_decision_note, '')) > 2000 then
    raise exception 'Invalid report decision' using errcode = '22023';
  end if;
  update public.fortalfy_commercial_reports
    set status = p_status, decision_note = nullif(btrim(p_decision_note), ''),
        reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_report_id;
  if not found then raise exception 'Commercial report not found'; end if;
end;
$$;
revoke all on function public.fortalfy_admin_review_commercial_report(uuid, text, text)
  from public, anon;
grant execute on function public.fortalfy_admin_review_commercial_report(uuid, text, text)
  to authenticated;

create table if not exists public.fortalfy_customer_benefit_consents (
  id bigint generated always as identity primary key,
  profile_id uuid not null references auth.users(id) on delete cascade,
  declaration_version text not null,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  unique (profile_id, declaration_version)
);
alter table public.fortalfy_customer_benefit_consents enable row level security;
revoke all on public.fortalfy_customer_benefit_consents from public, anon, authenticated;
grant select on public.fortalfy_customer_benefit_consents to authenticated;
drop policy if exists "customers read their benefit consent history" on public.fortalfy_customer_benefit_consents;
create policy "customers read their benefit consent history"
  on public.fortalfy_customer_benefit_consents for select to authenticated
  using (profile_id = auth.uid());

create or replace function public.fortalfy_record_customer_benefit_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'accepted_benefit_terms', 'false') = 'true' then
    insert into public.fortalfy_customer_benefit_consents (
      profile_id, declaration_version, terms_version
    ) values (
      new.id, 'fortalfy-benefits-v1',
      coalesce(new.raw_user_meta_data ->> 'benefit_terms_version', 'fortalfy-benefits-v1')
    ) on conflict (profile_id, declaration_version) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.fortalfy_record_customer_benefit_consent() from public, anon, authenticated;
drop trigger if exists fortalfy_record_customer_benefit_consent on auth.users;
create trigger fortalfy_record_customer_benefit_consent
  after insert on auth.users
  for each row execute function public.fortalfy_record_customer_benefit_consent();

create or replace function public.fortalfy_accept_customer_benefit_terms(
  p_declaration_version text, p_terms_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_declaration_version <> 'fortalfy-benefits-v1'
     or p_terms_version <> 'fortalfy-benefits-v1' then
    raise exception 'Current benefit terms are required' using errcode = '22023';
  end if;
  insert into public.fortalfy_customer_benefit_consents (
    profile_id, declaration_version, terms_version
  ) values (auth.uid(), p_declaration_version, p_terms_version)
  on conflict (profile_id, declaration_version) do nothing;
end;
$$;
revoke all on function public.fortalfy_accept_customer_benefit_terms(text, text)
  from public, anon;
grant execute on function public.fortalfy_accept_customer_benefit_terms(text, text)
  to authenticated;

create table if not exists public.fortalfy_discount_program_enrollments (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  terms_version text not null,
  funding_source text not null check (funding_source = 'partner'),
  included_conditions text not null check (char_length(included_conditions) between 3 and 2000),
  cancellation_terms text not null check (char_length(cancellation_terms) between 3 and 2000),
  accepted_at timestamptz not null default now(),
  active boolean not null default true
);
alter table public.fortalfy_discount_program_enrollments enable row level security;
revoke all on public.fortalfy_discount_program_enrollments from public, anon, authenticated;
grant select on public.fortalfy_discount_program_enrollments to authenticated;
drop policy if exists "partners read their discount program agreement" on public.fortalfy_discount_program_enrollments;
create policy "partners read their discount program agreement"
  on public.fortalfy_discount_program_enrollments for select to authenticated
  using (profile_id = auth.uid());

create table if not exists public.fortalfy_discount_program_audit (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('accepted', 'renewed', 'withdrawn')),
  terms_version text not null,
  funding_source text not null,
  included_conditions text not null,
  cancellation_terms text not null,
  changed_at timestamptz not null default now()
);
alter table public.fortalfy_discount_program_audit enable row level security;
revoke all on public.fortalfy_discount_program_audit from public, anon, authenticated;
grant select on public.fortalfy_discount_program_audit to authenticated;
drop policy if exists "partners read own discount program history" on public.fortalfy_discount_program_audit;
create policy "partners read own discount program history"
  on public.fortalfy_discount_program_audit for select to authenticated
  using (
    profile_id = auth.uid()
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

create or replace function public.fortalfy_set_discount_program_enrollment(
  p_accept boolean, p_terms_version text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_version text;
begin
  if auth.uid() is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  if p_accept then
    if p_terms_version <> 'fortalfy-partner-discounts-v1'
       or not public.fortalfy_is_advertiser(auth.uid()) then
      raise exception 'An approved business and current terms are required'
        using errcode = '42501';
    end if;
    select terms_version into previous_version
      from public.fortalfy_discount_program_enrollments
      where profile_id = auth.uid() and active;
    insert into public.fortalfy_discount_program_enrollments (
      profile_id, terms_version, funding_source, included_conditions,
      cancellation_terms, accepted_at, active
    ) values (
      auth.uid(), p_terms_version, 'partner',
      'Descontos calculados pelo plano pago ativo e calendário Fortalfy; somente itens selecionados pelo parceiro; incidência sobre o preço válido cadastrado na Fortalfy; não cumulativo por padrão; financiamento integral pelo parceiro.',
      'A adesão pode ser desativada para futuras ofertas. Pedidos já confirmados devem preservar condições e direitos do consumidor; cancelamentos e reembolsos seguirão os termos do checkout quando este estiver habilitado. O aceite não cria pedido nem desconto enquanto o checkout não estiver ativo.',
      now(), true
    )
    on conflict (profile_id) do update
      set terms_version = excluded.terms_version,
          funding_source = excluded.funding_source,
          included_conditions = excluded.included_conditions,
          cancellation_terms = excluded.cancellation_terms,
          accepted_at = excluded.accepted_at,
          active = true;
    insert into public.fortalfy_discount_program_audit (
      profile_id, actor_id, action, terms_version, funding_source,
      included_conditions, cancellation_terms
    ) values (
      auth.uid(), auth.uid(),
      case when previous_version is null then 'accepted' else 'renewed' end,
      p_terms_version, 'partner',
      'Descontos calculados pelo plano pago ativo e calendário Fortalfy; somente itens selecionados pelo parceiro; incidência sobre o preço válido cadastrado na Fortalfy; não cumulativo por padrão; financiamento integral pelo parceiro.',
      'A adesão pode ser desativada para futuras ofertas. Pedidos já confirmados devem preservar condições e direitos do consumidor; cancelamentos e reembolsos seguirão os termos do checkout quando este estiver habilitado. O aceite não cria pedido nem desconto enquanto o checkout não estiver ativo.'
    );
  else
    update public.fortalfy_discount_program_enrollments
      set active = false where profile_id = auth.uid();
    if found then
      insert into public.fortalfy_discount_program_audit (
        profile_id, actor_id, action, terms_version, funding_source,
        included_conditions, cancellation_terms
      )
      select profile_id, auth.uid(), 'withdrawn', terms_version, funding_source,
             included_conditions, cancellation_terms
      from public.fortalfy_discount_program_enrollments
      where profile_id = auth.uid();
    end if;
  end if;
end;
$$;
revoke all on function public.fortalfy_set_discount_program_enrollment(boolean, text)
  from public, anon;
grant execute on function public.fortalfy_set_discount_program_enrollment(boolean, text)
  to authenticated;

create table if not exists public.fortalfy_discount_item_eligibility (
  target_kind text not null check (target_kind in ('store_product', 'food_menu_item')),
  target_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (target_kind, target_id)
);
alter table public.fortalfy_discount_item_eligibility enable row level security;
revoke all on public.fortalfy_discount_item_eligibility from public, anon, authenticated;
grant select on public.fortalfy_discount_item_eligibility to authenticated;
drop policy if exists "partners read their eligible discount items" on public.fortalfy_discount_item_eligibility;
create policy "partners read their eligible discount items"
  on public.fortalfy_discount_item_eligibility for select to authenticated
  using (profile_id = auth.uid());

create or replace function public.fortalfy_set_discount_item_eligibility(
  p_target_kind text, p_target_id uuid, p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_owner uuid;
begin
  if auth.uid() is null
     or not exists (
       select 1 from public.fortalfy_discount_program_enrollments enrollment
       where enrollment.profile_id = auth.uid()
         and enrollment.active
         and enrollment.terms_version = 'fortalfy-partner-discounts-v1'
     )
     or not public.fortalfy_is_advertiser(auth.uid()) then
    raise exception 'An active accepted partner agreement and advertising approval are required'
      using errcode = '42501';
  end if;
  if p_target_kind = 'store_product' then
    select profile_id into item_owner from public.partner_store_products where id = p_target_id;
  elsif p_target_kind = 'food_menu_item' then
    select restaurant_id into item_owner from public.food_menu_items where id = p_target_id;
  else
    raise exception 'Unsupported commercial item type' using errcode = '22023';
  end if;
  if item_owner is distinct from auth.uid() then
    raise exception 'The item does not belong to this partner' using errcode = '42501';
  end if;
  insert into public.fortalfy_discount_item_eligibility (
    target_kind, target_id, profile_id, enabled, updated_at
  ) values (p_target_kind, p_target_id, auth.uid(), p_enabled, now())
  on conflict (target_kind, target_id) do update
    set enabled = excluded.enabled, updated_at = excluded.updated_at
    where public.fortalfy_discount_item_eligibility.profile_id = auth.uid();
  if not found then raise exception 'The item eligibility could not be saved'; end if;
end;
$$;
revoke all on function public.fortalfy_set_discount_item_eligibility(text, uuid, boolean)
  from public, anon;
grant execute on function public.fortalfy_set_discount_item_eligibility(text, uuid, boolean)
  to authenticated;

create table if not exists public.fortalfy_customer_subscriptions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('start', 'plus', 'master')),
  status text not null check (status in ('active', 'canceled', 'expired')),
  effective_from timestamptz not null,
  effective_until timestamptz,
  provider_subscription_id text not null unique,
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from)
);
alter table public.fortalfy_customer_subscriptions enable row level security;
revoke all on public.fortalfy_customer_subscriptions from public, anon, authenticated;
grant all on public.fortalfy_customer_subscriptions to service_role;

create table if not exists public.fortalfy_discount_settings (
  id boolean primary key default true check (id),
  timezone text not null default 'America/Fortaleza'
);
insert into public.fortalfy_discount_settings(id) values (true) on conflict (id) do nothing;
alter table public.fortalfy_discount_settings enable row level security;
revoke all on public.fortalfy_discount_settings from public, anon, authenticated;

create table if not exists public.fortalfy_discount_rules (
  plan text not null check (plan in ('start', 'plus', 'master')),
  day_from integer not null check (day_from between 1 and 31),
  day_to integer not null check (day_to between day_from and 31),
  percent numeric(5,2) not null check (percent between 0 and 20),
  primary key (plan, day_from),
  check (
    (plan = 'start' and percent <= 5)
    or (plan = 'plus' and percent <= 10)
    or (plan = 'master' and percent <= 20)
  )
);
insert into public.fortalfy_discount_rules(plan, day_from, day_to, percent) values
  ('start', 1, 10, 1), ('start', 11, 20, 2), ('start', 21, 25, 3), ('start', 26, 31, 5),
  ('plus', 1, 10, 2), ('plus', 11, 20, 4), ('plus', 21, 25, 6), ('plus', 26, 31, 10),
  ('master', 1, 10, 5), ('master', 11, 20, 10), ('master', 21, 25, 15), ('master', 26, 31, 20)
on conflict (plan, day_from) do nothing;
alter table public.fortalfy_discount_rules enable row level security;
revoke all on public.fortalfy_discount_rules from public, anon;
grant select on public.fortalfy_discount_rules to authenticated;
drop policy if exists "discount schedule is readable by authenticated users" on public.fortalfy_discount_rules;
create policy "discount schedule is readable by authenticated users"
  on public.fortalfy_discount_rules for select to authenticated using (true);

create table if not exists public.fortalfy_discount_rule_audit (
  id bigint generated always as identity primary key,
  plan text not null,
  old_day_from integer,
  old_day_to integer,
  day_from integer not null,
  day_to integer not null,
  old_percent numeric(5,2),
  new_percent numeric(5,2) not null,
  actor_id uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
alter table public.fortalfy_discount_rule_audit enable row level security;
revoke all on public.fortalfy_discount_rule_audit from public, anon, authenticated;
grant select on public.fortalfy_discount_rule_audit to authenticated;
drop policy if exists "admins read discount rule audit" on public.fortalfy_discount_rule_audit;
create policy "admins read discount rule audit"
  on public.fortalfy_discount_rule_audit for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create or replace function public.fortalfy_admin_set_discount_rule(
  p_plan text, p_previous_day_from integer, p_day_from integer,
  p_day_to integer, p_percent numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_percent numeric(5,2);
  old_day_to integer;
  max_percent numeric(5,2);
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Only a Fortalfy administrator can change discount rules' using errcode = '42501';
  end if;
  max_percent := case p_plan when 'start' then 5 when 'plus' then 10 when 'master' then 20 else null end;
  if max_percent is null or p_day_from not between 1 and 31 or p_day_to not between p_day_from and 31
     or p_percent < 0 or p_percent > max_percent then
    raise exception 'Invalid discount rule' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.fortalfy_discount_rules rule
    where rule.plan = p_plan
      and rule.day_from <> p_previous_day_from
      and rule.day_from <= p_day_to
      and rule.day_to >= p_day_from
  ) then
    raise exception 'Discount rule days cannot overlap' using errcode = '23514';
  end if;
  select percent, day_to into old_percent, old_day_to
    from public.fortalfy_discount_rules
    where plan = p_plan and day_from = p_previous_day_from;
  if not found then raise exception 'Discount rule not found'; end if;
  update public.fortalfy_discount_rules
    set day_from = p_day_from, day_to = p_day_to, percent = p_percent
    where plan = p_plan and day_from = p_previous_day_from;
  insert into public.fortalfy_discount_rule_audit(
    plan, old_day_from, old_day_to, day_from, day_to, old_percent, new_percent, actor_id
  ) values (
    p_plan, p_previous_day_from, old_day_to, p_day_from, p_day_to, old_percent, p_percent, auth.uid()
  );
end;
$$;
revoke all on function public.fortalfy_admin_set_discount_rule(text, integer, integer, integer, numeric)
  from public, anon;
grant execute on function public.fortalfy_admin_set_discount_rule(text, integer, integer, integer, numeric)
  to authenticated;

create or replace function public.fortalfy_get_discount_quote(
  p_target_kind text, p_target_id uuid, p_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_owner uuid;
  item_price numeric(10,2);
  item_active boolean;
  plan_name text;
  local_day integer;
  discount_percent numeric(5,2);
  current_timezone text;
  eligible boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  p_at := coalesce(p_at, now());
  if p_target_kind = 'store_product' then
    select profile_id, price, is_active into item_owner, item_price, item_active
      from public.partner_store_products where id = p_target_id;
  elsif p_target_kind = 'food_menu_item' then
    select restaurant_id, price, available into item_owner, item_price, item_active
      from public.food_menu_items where id = p_target_id;
  else
    return jsonb_build_object('eligible', false, 'reason', 'unsupported_item_type');
  end if;
  if item_owner is null or not item_active then
    return jsonb_build_object('eligible', false, 'reason', 'item_unavailable');
  end if;
  if not exists (
    select 1 from public.fortalfy_discount_item_eligibility eligibility
    join public.fortalfy_discount_program_enrollments enrollment
      on enrollment.profile_id = eligibility.profile_id and enrollment.active
      and enrollment.terms_version = 'fortalfy-partner-discounts-v1'
    where eligibility.target_kind = p_target_kind
      and eligibility.target_id = p_target_id
      and eligibility.profile_id = item_owner and eligibility.enabled
  ) or not public.fortalfy_is_advertiser(item_owner) then
    return jsonb_build_object('eligible', false, 'reason', 'partner_or_item_not_enrolled');
  end if;
  select subscription.plan into plan_name
    from public.fortalfy_customer_subscriptions subscription
    where subscription.profile_id = auth.uid()
      and subscription.status = 'active'
      and subscription.effective_from <= p_at
      and (subscription.effective_until is null or subscription.effective_until > p_at);
  if plan_name is null then
    return jsonb_build_object('eligible', false, 'reason', 'active_subscription_required');
  end if;
  if not exists (
    select 1 from public.fortalfy_customer_benefit_consents consent
    where consent.profile_id = auth.uid()
      and consent.declaration_version = 'fortalfy-benefits-v1'
      and consent.terms_version = 'fortalfy-benefits-v1'
  ) then
    return jsonb_build_object('eligible', false, 'reason', 'customer_terms_required');
  end if;
  select timezone into current_timezone from public.fortalfy_discount_settings where id;
  local_day := extract(day from timezone(current_timezone, p_at))::integer;
  select rule.percent into discount_percent
    from public.fortalfy_discount_rules rule
    where rule.plan = plan_name and local_day between rule.day_from and rule.day_to;
  if discount_percent is null then
    return jsonb_build_object('eligible', false, 'reason', 'no_discount_rule');
  end if;
  eligible := true;
  return jsonb_build_object(
    'eligible', eligible,
    'plan', plan_name,
    'basePrice', item_price,
    'percent', discount_percent,
    'discountAmount', round(item_price * discount_percent / 100, 2),
    'finalPrice', round(item_price - round(item_price * discount_percent / 100, 2), 2),
    'currency', 'BRL',
    'fundedBy', 'partner',
    'calculatedAt', p_at
  );
end;
$$;
revoke all on function public.fortalfy_get_discount_quote(text, uuid, timestamptz)
  from public, anon;
grant execute on function public.fortalfy_get_discount_quote(text, uuid, timestamptz)
  to authenticated;

create table if not exists public.fortalfy_commercial_price_history (
  id bigint generated always as identity primary key,
  target_kind text not null check (target_kind in ('store_product', 'food_menu_item')),
  target_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  old_price numeric(10,2),
  new_price numeric(10,2) not null,
  suspicious_increase boolean not null default false,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists fortalfy_commercial_price_history_target_idx
  on public.fortalfy_commercial_price_history(target_kind, target_id, changed_at desc);
create unique index if not exists fortalfy_commercial_price_history_baseline_idx
  on public.fortalfy_commercial_price_history(target_kind, target_id)
  where old_price is null;
alter table public.fortalfy_commercial_price_history enable row level security;
revoke all on public.fortalfy_commercial_price_history from public, anon, authenticated;
grant select on public.fortalfy_commercial_price_history to authenticated;
drop policy if exists "partners read own price history" on public.fortalfy_commercial_price_history;
create policy "partners read own price history"
  on public.fortalfy_commercial_price_history for select to authenticated
  using (
    profile_id = auth.uid()
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

create or replace function public.fortalfy_record_commercial_price_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_change timestamptz;
  owner_profile uuid;
  target_type text;
  prior_price numeric(10,2);
  next_price numeric(10,2);
begin
  if tg_table_name = 'partner_store_products' then
    target_type := 'store_product';
    owner_profile := new.profile_id;
  else
    target_type := 'food_menu_item';
    owner_profile := new.restaurant_id;
  end if;
  next_price := new.price;
  if tg_op = 'UPDATE' then prior_price := old.price; end if;
  select max(changed_at) into previous_change
    from public.fortalfy_commercial_price_history
    where target_kind = target_type and target_id = new.id;
  if tg_op = 'INSERT' or prior_price is distinct from next_price then
    insert into public.fortalfy_commercial_price_history (
      target_kind, target_id, profile_id, old_price, new_price,
      suspicious_increase, changed_by
    ) values (
      target_type, new.id, owner_profile, prior_price, next_price,
      prior_price is not null
        and next_price > prior_price * 1.30
        and previous_change is not null
        and previous_change > now() - interval '7 days',
      auth.uid()
    );
  end if;
  return new;
end;
$$;
revoke all on function public.fortalfy_record_commercial_price_change() from public, anon, authenticated;
drop trigger if exists fortalfy_store_product_price_history on public.partner_store_products;
create trigger fortalfy_store_product_price_history
  after insert or update of price on public.partner_store_products
  for each row execute function public.fortalfy_record_commercial_price_change();
drop trigger if exists fortalfy_food_item_price_history on public.food_menu_items;
create trigger fortalfy_food_item_price_history
  after insert or update of price on public.food_menu_items
  for each row execute function public.fortalfy_record_commercial_price_change();

insert into public.fortalfy_commercial_price_history (
  target_kind, target_id, profile_id, old_price, new_price, changed_by
)
select 'store_product', product.id, product.profile_id, null, product.price, null
from public.partner_store_products product
on conflict do nothing;

insert into public.fortalfy_commercial_price_history (
  target_kind, target_id, profile_id, old_price, new_price, changed_by
)
select 'food_menu_item', item.id, item.restaurant_id, null, item.price, null
from public.food_menu_items item
on conflict do nothing;

notify pgrst, 'reload schema';
commit;
