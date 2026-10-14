-- Additive Supabase schema for the Fortalfy Food and social ecosystem.
-- Apply PRODUCAO_BACKEND_SUPABASE.sql first. Can be applied before or after
-- FORTALFY_SOCIAL_V1_SUPABASE.sql.
-- This migration creates server-side structures. The current Food UI remains local;
-- its menu, checkout, and order flows are not connected to these tables.

create table if not exists public.profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index if not exists profile_follows_followed_idx
  on public.profile_follows(followed_id, created_at desc);

create or replace function public.validate_follow_target()
returns trigger
language plpgsql
set search_path = ''
as $$
declare target_kind public.profile_kind;
begin
  select kind into target_kind from public.profiles where id = new.followed_id;
  if target_kind is null then
    raise exception 'The followed profile does not exist';
  end if;
  return new;
end;
$$;
drop trigger if exists profile_follows_validate_target on public.profile_follows;
create trigger profile_follows_validate_target
before insert or update of followed_id on public.profile_follows
for each row execute function public.validate_follow_target();

create table if not exists public.food_menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text not null check (char_length(description) between 1 and 2000),
  price numeric(10,2) not null check (price > 0),
  currency char(3) not null default 'BRL' check (currency = 'BRL'),
  image_paths text[] not null default '{}',
  ingredients jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  portion_label text,
  portion_weight_g numeric(9,2) check (portion_weight_g is null or portion_weight_g > 0),
  allergens text[] not null default '{}',
  customizations jsonb not null default '[]'::jsonb check (jsonb_typeof(customizations) = 'array'),
  available boolean not null default false,
  stock integer check (stock is null or stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stock is null or stock > 0 or not available)
);
create index if not exists food_menu_items_restaurant_idx
  on public.food_menu_items(restaurant_id, available, created_at desc);

create or replace function public.validate_food_item_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.restaurant_id and p.kind = 'restaurante'
  ) then
    raise exception 'A food item must reference a restaurant profile';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists food_menu_items_validate_owner on public.food_menu_items;
create trigger food_menu_items_validate_owner
before insert or update on public.food_menu_items
for each row execute function public.validate_food_item_owner();

create table if not exists public.food_nutrition_facts (
  menu_item_id uuid primary key references public.food_menu_items(id) on delete cascade,
  energy_kcal numeric(10,2) check (energy_kcal is null or energy_kcal >= 0),
  energy_kj numeric(10,2) check (energy_kj is null or energy_kj >= 0),
  carbohydrates_g numeric(10,3) check (carbohydrates_g is null or carbohydrates_g >= 0),
  sugars_total_g numeric(10,3) check (sugars_total_g is null or sugars_total_g >= 0),
  sugars_added_g numeric(10,3) check (sugars_added_g is null or sugars_added_g >= 0),
  protein_g numeric(10,3) check (protein_g is null or protein_g >= 0),
  fat_total_g numeric(10,3) check (fat_total_g is null or fat_total_g >= 0),
  fat_saturated_g numeric(10,3) check (fat_saturated_g is null or fat_saturated_g >= 0),
  fat_trans_g numeric(10,3) check (fat_trans_g is null or fat_trans_g >= 0),
  fiber_g numeric(10,3) check (fiber_g is null or fiber_g >= 0),
  sodium_mg numeric(10,3) check (sodium_mg is null or sodium_mg >= 0),
  salt_g numeric(10,3) check (salt_g is null or salt_g >= 0),
  source_name text,
  source_date date,
  status text not null default 'partner_provided'
    check (status in ('partner_provided', 'verified')),
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  check (status <> 'verified' or verified_at is not null)
);

create or replace function public.prevent_partner_self_verifying_nutrition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'verified' and auth.uid() is not null and not public.is_fortalfy_admin() then
    if tg_op = 'INSERT' then
      raise exception 'Only an authorized Fortalfy administrator can verify nutrition facts';
    elsif old.status is distinct from 'verified' then
      raise exception 'Only an authorized Fortalfy administrator can verify nutrition facts';
    else
      raise exception 'Verified nutrition facts can only be changed by an authorized administrator';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists food_nutrition_facts_prevent_self_verification on public.food_nutrition_facts;
create trigger food_nutrition_facts_prevent_self_verification
before insert or update on public.food_nutrition_facts
for each row execute function public.prevent_partner_self_verifying_nutrition();

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'revoked')),
  document_paths text[] not null default '{}',
  applicant_note text check (char_length(coalesce(applicant_note,'')) <= 2000),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_note text check (char_length(coalesce(reviewer_note,'')) <= 2000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (
    (status = 'pending' and reviewed_at is null)
    or (status <> 'pending' and reviewed_at is not null)
  )
);
create unique index if not exists verification_requests_one_pending_idx
  on public.verification_requests(profile_id) where status = 'pending';

-- JWT app_metadata is controlled by trusted server-side administration, not the client.
create or replace function public.is_fortalfy_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create or replace function public.prevent_self_verification_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_fortalfy_admin() then
    if tg_op = 'INSERT' then
      if new.verified_at is not null or new.partner_approved_at is not null then
        raise exception 'Only an authorized Fortalfy administrator can set approval fields';
      end if;
    elsif new.verified_at is distinct from old.verified_at
          or new.partner_approved_at is distinct from old.partner_approved_at then
      raise exception 'Only an authorized Fortalfy administrator can change approval fields';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_prevent_self_verification on public.profiles;
create trigger profiles_prevent_self_verification
before insert or update on public.profiles
for each row execute function public.prevent_self_verification_changes();

alter table public.posts
  add column if not exists food_menu_item_id uuid
  references public.food_menu_items(id) on delete set null;
alter table public.posts
  add column if not exists shared_post_id uuid
  references public.posts(id) on delete set null;

create table if not exists public.food_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  restaurant_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'awaiting_confirmation'
    check (status in ('awaiting_confirmation', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled')),
  currency char(3) not null default 'BRL' check (currency = 'BRL'),
  subtotal numeric(10,2) not null check (subtotal >= 0),
  delivery_fee numeric(10,2) check (delivery_fee is null or delivery_fee >= 0),
  discount numeric(10,2) not null default 0 check (discount >= 0),
  total numeric(10,2) check (total is null or total >= 0),
  delivery_address jsonb,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  check (customer_id <> restaurant_id),
  check ((status = 'delivered' and delivered_at is not null) or status <> 'delivered')
);
create index if not exists food_orders_customer_idx on public.food_orders(customer_id, created_at desc);
create index if not exists food_orders_restaurant_idx on public.food_orders(restaurant_id, created_at desc);

create or replace function public.validate_food_order_restaurant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.restaurant_id and p.kind = 'restaurante'
  ) then
    raise exception 'A food order must reference a restaurant profile';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists food_orders_validate_restaurant on public.food_orders;
create trigger food_orders_validate_restaurant
before insert or update on public.food_orders
for each row execute function public.validate_food_order_restaurant();

create table if not exists public.food_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.food_orders(id) on delete cascade,
  menu_item_id uuid references public.food_menu_items(id) on delete set null,
  product_name_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  customizations_snapshot jsonb not null default '[]'::jsonb
    check (jsonb_typeof(customizations_snapshot) = 'array'),
  nutrition_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.food_orders(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  restaurant_id uuid not null references public.profiles(id) on delete restrict,
  stars smallint not null check (stars between 1 and 5),
  recommends boolean not null,
  comment text check (char_length(coalesce(comment,'')) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists restaurant_reviews_restaurant_idx
  on public.restaurant_reviews(restaurant_id, created_at desc);

create or replace function public.validate_reviewed_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.food_orders o
    where o.id = new.order_id and o.customer_id = new.customer_id
      and o.restaurant_id = new.restaurant_id and o.status = 'delivered'
      and o.delivered_at is not null
  ) then
    raise exception 'A restaurant review requires the authenticated customer''s delivered order';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists restaurant_reviews_validate_order on public.restaurant_reviews;
create trigger restaurant_reviews_validate_order
before insert or update on public.restaurant_reviews
for each row execute function public.validate_reviewed_order();

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  review_id uuid references public.restaurant_reviews(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(post_id, comment_id, review_id) = 1)
);
alter table public.content_reports
  add column if not exists review_id uuid
  references public.restaurant_reviews(id) on delete cascade;
alter table public.content_reports
  drop constraint if exists content_reports_check;
alter table public.content_reports
  drop constraint if exists content_reports_target_check;
alter table public.content_reports
  add constraint content_reports_target_check
  check (num_nonnulls(post_id, comment_id, review_id) = 1);
create unique index if not exists content_reports_once_per_post_idx
  on public.content_reports(reporter_id, post_id) where post_id is not null;
create unique index if not exists content_reports_once_per_comment_idx
  on public.content_reports(reporter_id, comment_id) where comment_id is not null;
create unique index if not exists content_reports_once_per_review_idx
  on public.content_reports(reporter_id, review_id) where review_id is not null;

alter table public.profile_follows enable row level security;
alter table public.food_menu_items enable row level security;
alter table public.food_nutrition_facts enable row level security;
alter table public.verification_requests enable row level security;
alter table public.food_orders enable row level security;
alter table public.food_order_items enable row level security;
alter table public.restaurant_reviews enable row level security;
alter table public.content_reports enable row level security;

drop policy if exists "authenticated can read follows" on public.profile_follows;
create policy "authenticated can read follows" on public.profile_follows
  for select to authenticated using (true);
drop policy if exists "users follow as themselves" on public.profile_follows;
create policy "users follow as themselves" on public.profile_follows
  for insert to authenticated with check (auth.uid() = follower_id);
drop policy if exists "users unfollow as themselves" on public.profile_follows;
create policy "users unfollow as themselves" on public.profile_follows
  for delete to authenticated using (auth.uid() = follower_id);

drop policy if exists "available menu items readable" on public.food_menu_items;
create policy "available menu items readable" on public.food_menu_items
  for select to authenticated using (available or restaurant_id = auth.uid() or public.is_fortalfy_admin());
drop policy if exists "restaurant owners manage menu items" on public.food_menu_items;
create policy "restaurant owners manage menu items" on public.food_menu_items
  for all to authenticated using (auth.uid() = restaurant_id)
  with check (auth.uid() = restaurant_id);

drop policy if exists "nutrition facts follow menu visibility" on public.food_nutrition_facts;
create policy "nutrition facts follow menu visibility" on public.food_nutrition_facts
  for select to authenticated using (
    public.is_fortalfy_admin()
    or exists (select 1 from public.food_menu_items m where m.id = menu_item_id and (m.available or m.restaurant_id = auth.uid()))
  );
drop policy if exists "restaurant owners manage nutrition facts" on public.food_nutrition_facts;
create policy "restaurant owners manage nutrition facts" on public.food_nutrition_facts
  for all to authenticated using (
    exists (select 1 from public.food_menu_items m where m.id = menu_item_id and m.restaurant_id = auth.uid())
  ) with check (
    exists (select 1 from public.food_menu_items m where m.id = menu_item_id and m.restaurant_id = auth.uid())
  );
drop policy if exists "administrators verify nutrition facts" on public.food_nutrition_facts;
create policy "administrators verify nutrition facts" on public.food_nutrition_facts
  for update to authenticated using (public.is_fortalfy_admin())
  with check (public.is_fortalfy_admin());

drop policy if exists "applicants read own verification requests" on public.verification_requests;
create policy "applicants read own verification requests" on public.verification_requests
  for select to authenticated using (auth.uid() = profile_id or public.is_fortalfy_admin());
drop policy if exists "businesses request verification" on public.verification_requests;
create policy "businesses request verification" on public.verification_requests
  for insert to authenticated with check (
    auth.uid() = profile_id and status = 'pending' and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.kind in ('personal', 'nutricionista', 'restaurante', 'academia', 'marca')
    )
  );
drop policy if exists "administrators review verification requests" on public.verification_requests;
create policy "administrators review verification requests" on public.verification_requests
  for update to authenticated using (public.is_fortalfy_admin())
  with check (public.is_fortalfy_admin() and reviewer_id = auth.uid());

drop policy if exists "customers and restaurants read involved orders" on public.food_orders;
create policy "customers and restaurants read involved orders" on public.food_orders
  for select to authenticated using (auth.uid() = customer_id or auth.uid() = restaurant_id or public.is_fortalfy_admin());
-- Orders and fulfillment/payment transitions are created by a trusted server, never by browser roles.

drop policy if exists "participants read order items" on public.food_order_items;
create policy "participants read order items" on public.food_order_items
  for select to authenticated using (
    exists (
      select 1 from public.food_orders o
      where o.id = order_id and (o.customer_id = auth.uid() or o.restaurant_id = auth.uid() or public.is_fortalfy_admin())
    )
  );

drop policy if exists "authenticated users read restaurant reviews" on public.restaurant_reviews;
create policy "authenticated users read restaurant reviews" on public.restaurant_reviews
  for select to authenticated using (true);
drop policy if exists "customers review their delivered orders" on public.restaurant_reviews;
create policy "customers review their delivered orders" on public.restaurant_reviews
  for insert to authenticated with check (
    auth.uid() = customer_id and exists (
      select 1 from public.food_orders o
      where o.id = order_id and o.customer_id = auth.uid()
        and o.restaurant_id = restaurant_id and o.status = 'delivered'
        and o.delivered_at is not null
    )
  );
drop policy if exists "customers edit own reviews" on public.restaurant_reviews;
create policy "customers edit own reviews" on public.restaurant_reviews
  for update to authenticated using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);
drop policy if exists "customers delete own reviews" on public.restaurant_reviews;
create policy "customers delete own reviews" on public.restaurant_reviews
  for delete to authenticated using (auth.uid() = customer_id);

drop policy if exists "users submit content reports" on public.content_reports;
create policy "users submit content reports" on public.content_reports
  for insert to authenticated with check (auth.uid() = reporter_id and status = 'pending');
drop policy if exists "reporters and moderators read reports" on public.content_reports;
create policy "reporters and moderators read reports" on public.content_reports
  for select to authenticated using (auth.uid() = reporter_id or public.is_fortalfy_admin());
drop policy if exists "moderators manage reports" on public.content_reports;
create policy "moderators manage reports" on public.content_reports
  for update to authenticated using (public.is_fortalfy_admin())
  with check (public.is_fortalfy_admin());

create or replace view public.restaurant_review_stats
with (security_invoker = true) as
select restaurant_id, count(*)::bigint as review_count,
       avg(stars)::numeric(4,2) as average_stars,
       round(100.0 * count(*) filter (where recommends) / nullif(count(*), 0), 1) as recommendation_percent,
       count(*) filter (where recommends)::bigint as recommendation_count
from public.restaurant_reviews
group by restaurant_id;

create or replace view public.restaurant_review_star_distribution
with (security_invoker = true) as
select restaurant_id, stars, count(*)::bigint as review_count
from public.restaurant_reviews
group by restaurant_id, stars;
