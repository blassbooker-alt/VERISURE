-- Apply after PRODUCAO_BACKEND_SUPABASE.sql and FORTALFY_SOCIAL_V1_SUPABASE.sql.
-- Partner stores can publish their own real products; nothing is seeded here.

create or replace function public.set_fortalfy_signup_profile_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_kind text := coalesce(new.raw_user_meta_data ->> 'kind', 'cliente');
begin
  if requested_kind not in ('cliente', 'personal', 'nutricionista', 'academia', 'marca') then
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
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.kind in ('personal', 'nutricionista', 'academia', 'marca')
    )
  );

create table if not exists public.partner_store_products (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  category text not null check (char_length(category) between 2 and 60),
  description text not null default '' check (char_length(description) <= 1200),
  price numeric(10,2) not null check (price > 0),
  image_path text not null,
  is_launch boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_store_product_image_owned check (image_path like profile_id::text || '/store-products/%')
);

create index if not exists partner_store_products_public_idx
  on public.partner_store_products(profile_id, is_launch desc, created_at desc)
  where is_active;

alter table public.partner_store_products enable row level security;
grant select on public.partner_store_products to anon, authenticated;
grant insert, update, delete on public.partner_store_products to authenticated;

drop policy if exists "approved stores publish active products" on public.partner_store_products;
create policy "approved stores publish active products" on public.partner_store_products
  for select to anon, authenticated
  using (
    (auth.uid() = profile_id)
    or (
      is_active
      and exists (
        select 1 from public.profiles p
        where p.id = profile_id
          and p.kind in ('marca', 'academia')
          and p.partner_approved_at is not null
      )
    )
  );

drop policy if exists "stores manage their own products" on public.partner_store_products;
create policy "stores manage their own products" on public.partner_store_products
  for all to authenticated
  using (
    auth.uid() = profile_id
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.kind in ('marca', 'academia')
    )
  )
  with check (
    auth.uid() = profile_id
    and exists (
      select 1 from public.profiles p
      where p.id = profile_id and p.kind in ('marca', 'academia')
    )
  );

drop policy if exists "approved storefront product images are readable" on storage.objects;
create policy "approved storefront product images are readable" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'social-media'
    and split_part(name, '/', 2) = 'store-products'
    and exists (
      select 1
      from public.partner_store_products product
      join public.profiles profile on profile.id = product.profile_id
      where product.image_path = name
        and (
          auth.uid() = product.profile_id
          or (product.is_active and profile.partner_approved_at is not null)
        )
    )
  );
