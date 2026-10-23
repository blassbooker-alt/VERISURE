-- Keep public marketplace access scoped to approved seller listings without
-- requiring anonymous SELECT access to the private profiles table.
begin;

grant select on public.partner_store_products to anon, authenticated;

drop policy if exists "approved stores publish active products"
  on public.partner_store_products;
drop policy if exists "approved storefront product images are readable"
  on storage.objects;

do $migration$
begin
  if to_regprocedure('public.fortalfy_is_advertiser(uuid)') is not null
     and to_regprocedure('public.fortalfy_is_commercial_content_approved(text,uuid)') is not null then
    execute $policy$
      create policy "approved stores publish active products"
        on public.partner_store_products for select to anon, authenticated
        using (
          auth.uid() = profile_id
          or (
            is_active
            and public.fortalfy_is_advertiser(profile_id)
            and public.fortalfy_is_commercial_content_approved('store_product', id)
          )
        )
    $policy$;

    execute $policy$
      create policy "approved storefront product images are readable"
        on storage.objects for select to anon, authenticated
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
        )
    $policy$;
  else
    -- Compatibility with installations that have the approved professional
    -- public view but have not installed commercial governance yet.
    execute $policy$
      create policy "approved stores publish active products"
        on public.partner_store_products for select to anon, authenticated
        using (
          auth.uid() = profile_id
          or (
            is_active
            and exists (
              select 1 from public.professional_profile_public approved_profile
              where approved_profile.profile_id = partner_store_products.profile_id
                and approved_profile.kind in ('marca', 'academia', 'vendedor')
            )
          )
        )
    $policy$;

    execute $policy$
      create policy "approved storefront product images are readable"
        on storage.objects for select to anon, authenticated
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
                  and exists (
                    select 1 from public.professional_profile_public approved_profile
                    where approved_profile.profile_id = product.profile_id
                      and approved_profile.kind in ('marca', 'academia', 'vendedor')
                  )
                )
              )
          )
        )
    $policy$;
  end if;
end
$migration$;

commit;
