-- Professional applications and public profile links.
-- Apply after PRODUCAO_BACKEND_SUPABASE.sql and the existing profile migrations.

alter type public.profile_kind add value if not exists 'empresa';
alter type public.profile_kind add value if not exists 'vendedor';
alter type public.profile_kind add value if not exists 'influenciador';

create or replace function public.set_fortalfy_signup_profile_kind()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_kind text := coalesce(new.raw_user_meta_data ->> 'kind', 'cliente');
begin
  if requested_kind not in (
    'cliente', 'personal', 'nutricionista', 'academia', 'restaurante',
    'marca', 'empresa', 'vendedor', 'influenciador'
  ) then
    requested_kind := 'cliente';
  end if;
  perform set_config('fortalfy.allow_profile_kind_change', 'on', true);
  update public.profiles
    set kind = requested_kind::public.profile_kind
    where id = new.id;
  perform set_config('fortalfy.allow_profile_kind_change', 'off', true);
  return new;
end;
$$;

revoke all on function public.set_fortalfy_signup_profile_kind() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_set_profile_kind on auth.users;
create trigger on_auth_user_created_set_profile_kind
  after insert on auth.users
  for each row execute function public.set_fortalfy_signup_profile_kind();

create or replace function public.guard_fortalfy_profile_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind is distinct from old.kind
    and coalesce(current_setting('fortalfy.allow_profile_kind_change', true), 'off') <> 'on'
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Profile category cannot be changed by the profile owner';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_kind_change on public.profiles;
create trigger profiles_guard_kind_change
  before update of kind on public.profiles
  for each row execute function public.guard_fortalfy_profile_kind();

create table if not exists public.professional_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('empresa','marca','vendedor','restaurante','nutricionista','personal','influenciador')),
  status text not null default 'draft' check (status in ('draft','under_review','approved','correction_required','rejected','suspended')),
  private_data jsonb not null default '{}'::jsonb check (jsonb_typeof(private_data) = 'object' and pg_column_size(private_data) <= 32768),
  public_data jsonb not null default '{}'::jsonb check (jsonb_typeof(public_data) = 'object'),
  reviewer_note text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, kind),
  check (char_length(coalesce(reviewer_note, '')) <= 2000)
);

create index if not exists professional_applications_owner_idx
  on public.professional_applications(profile_id, updated_at desc);
create index if not exists professional_applications_review_idx
  on public.professional_applications(status, updated_at desc);

alter table public.professional_applications enable row level security;
grant select, insert, update on public.professional_applications to authenticated;

drop policy if exists "applicants read own professional applications" on public.professional_applications;
create policy "applicants read own professional applications" on public.professional_applications
  for select to authenticated
  using (profile_id = auth.uid() or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

drop policy if exists "applicants create own professional applications" on public.professional_applications;
create policy "applicants create own professional applications" on public.professional_applications
  for insert to authenticated
  with check (profile_id = auth.uid() and status = 'draft');

drop policy if exists "applicants edit own professional applications" on public.professional_applications;
create policy "applicants edit own professional applications" on public.professional_applications
  for update to authenticated
  using (profile_id = auth.uid() or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  with check (profile_id = auth.uid() or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create or replace function public.guard_fortalfy_professional_application()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_admin boolean := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
  is_submit boolean := coalesce(current_setting('fortalfy.application_submission', true), 'off') = 'on';
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.submitted_at is not null or new.reviewer_note is not null then
      raise exception 'Professional applications must begin as drafts';
    end if;
    return new;
  end if;
  if not is_admin and (
    new.profile_id is distinct from old.profile_id
    or new.kind is distinct from old.kind
    or new.status is distinct from old.status and not is_submit
    or new.submitted_at is distinct from old.submitted_at and not is_submit
    or new.reviewer_note is distinct from old.reviewer_note
  ) then
    raise exception 'Only an authorized reviewer can change application status or review notes';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists professional_applications_guard on public.professional_applications;
create trigger professional_applications_guard
  before insert or update on public.professional_applications
  for each row execute function public.guard_fortalfy_professional_application();

create table if not exists public.professional_profile_public (
  application_id uuid primary key references public.professional_applications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('empresa','marca','vendedor','restaurante','nutricionista','personal','influenciador')),
  public_data jsonb not null check (jsonb_typeof(public_data) = 'object'),
  updated_at timestamptz not null default now()
);

create index if not exists professional_profile_public_owner_idx
  on public.professional_profile_public(profile_id, updated_at desc);

alter table public.professional_profile_public enable row level security;
grant select on public.professional_profile_public to anon, authenticated;

drop policy if exists "approved professional profile details are public" on public.professional_profile_public;
create policy "approved professional profile details are public" on public.professional_profile_public
  for select to anon, authenticated
  using (true);

create table if not exists public.professional_application_audit (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.professional_applications(id) on delete cascade,
  actor_id uuid,
  previous_status text,
  new_status text not null,
  created_at timestamptz not null default now()
);
alter table public.professional_application_audit enable row level security;
grant select on public.professional_application_audit to authenticated;

drop policy if exists "admins read professional application audit" on public.professional_application_audit;
create policy "admins read professional application audit" on public.professional_application_audit
  for select to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

create or replace function public.sync_fortalfy_professional_public_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.public_data := jsonb_build_object(
    'displayName', left(btrim(coalesce(new.private_data ->> 'displayName', '')), 120),
    'description', left(btrim(coalesce(new.private_data ->> 'description', '')), 2000),
    'city', left(btrim(coalesce(new.private_data ->> 'city', '')), 120),
    'website', case
      when coalesce(new.private_data ->> 'website', '') ~* '^https://[^/[:space:]]+'
        and coalesce(new.private_data ->> 'website', '') !~* '^https://[^/@]*@'
      then left(btrim(new.private_data ->> 'website'), 2048)
      else ''
    end
  );
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists professional_applications_public_data on public.professional_applications;
create trigger professional_applications_public_data
  before insert or update of private_data, public_data on public.professional_applications
  for each row execute function public.sync_fortalfy_professional_public_profile();

create or replace function public.publish_fortalfy_professional_public_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' then
    insert into public.professional_profile_public(application_id, profile_id, kind, public_data)
    values (new.id, new.profile_id, new.kind, new.public_data)
    on conflict (application_id) do update
      set profile_id = excluded.profile_id,
          kind = excluded.kind,
          public_data = excluded.public_data,
          updated_at = now();
  else
    delete from public.professional_profile_public where application_id = new.id;
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.professional_application_audit(application_id, actor_id, previous_status, new_status)
    values (new.id, auth.uid(), old.status, new.status);
  elsif tg_op = 'INSERT' then
    insert into public.professional_application_audit(application_id, actor_id, previous_status, new_status)
    values (new.id, auth.uid(), null, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists professional_applications_publish on public.professional_applications;
create trigger professional_applications_publish
  after insert or update on public.professional_applications
  for each row execute function public.publish_fortalfy_professional_public_profile();

drop policy if exists "approved stores publish active products" on public.partner_store_products;
create policy "approved stores publish active products" on public.partner_store_products
  for select to anon, authenticated
  using (
    auth.uid() = partner_store_products.profile_id
    or (
      is_active and exists (
        select 1 from public.professional_profile_public approved_profile
        where approved_profile.profile_id = partner_store_products.profile_id
          and approved_profile.kind in ('marca','academia','vendedor')
      )
    )
    or (
      is_active and exists (
        select 1 from public.profiles p
        where p.id = partner_store_products.profile_id
          and p.partner_approved_at is not null
          and p.kind::text in ('marca','academia')
      )
    )
  );

drop policy if exists "stores manage their own products" on public.partner_store_products;
create policy "stores manage their own products" on public.partner_store_products
  for all to authenticated
  using (
    auth.uid() = partner_store_products.profile_id
    and (
      exists (
        select 1 from public.profiles p
        where p.id = partner_store_products.profile_id and p.kind::text in ('marca','academia')
      )
      or exists (
        select 1 from public.professional_applications application
        where application.profile_id = partner_store_products.profile_id
          and application.kind in ('marca','academia','vendedor')
      )
    )
  )
  with check (
    auth.uid() = partner_store_products.profile_id
    and (
      exists (
        select 1 from public.profiles p
        where p.id = partner_store_products.profile_id and p.kind::text in ('marca','academia')
      )
      or exists (
        select 1 from public.professional_applications application
        where application.profile_id = partner_store_products.profile_id
          and application.kind in ('marca','academia','vendedor')
      )
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
      where product.image_path = name
        and (
          auth.uid() = product.profile_id
          or (
            product.is_active
            and exists (
              select 1 from public.professional_profile_public approved_profile
              where approved_profile.profile_id = product.profile_id
                and approved_profile.kind in ('marca','academia','vendedor')
            )
          )
        )
    )
  );

create or replace function public.review_fortalfy_professional_application(
  p_application_id uuid,
  p_status text,
  p_reviewer_note text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Only a Fortalfy administrator can review applications';
  end if;
  if p_status not in ('approved','correction_required','rejected','suspended') then
    raise exception 'Invalid review status';
  end if;
  if char_length(coalesce(p_reviewer_note, '')) > 2000 then
    raise exception 'Reviewer note is too long';
  end if;
  update public.professional_applications
    set status = p_status,
        reviewer_note = nullif(btrim(p_reviewer_note), '')
    where id = p_application_id and status <> 'draft';
  if not found then
    raise exception 'Submitted application not found';
  end if;
  return p_status;
end;
$$;

revoke all on function public.review_fortalfy_professional_application(uuid, text, text) from public, anon;
grant execute on function public.review_fortalfy_professional_application(uuid, text, text) to authenticated;

create table if not exists public.professional_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.professional_applications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_kind text not null check (document_kind in ('professional_credential','business_identity','other')),
  file_name text not null check (char_length(file_name) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  constraint professional_document_path_owner check (
    storage_path like profile_id::text || '/' || application_id::text || '/%'
  )
);

create index if not exists professional_application_documents_idx
  on public.professional_application_documents(application_id, created_at desc);

create or replace function public.validate_fortalfy_professional_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'professional-documents'
      and object.name = new.storage_path
  ) then
    raise exception 'The private document must be uploaded before it is registered';
  end if;
  if not exists (
    select 1 from public.professional_applications application
    where application.id = new.application_id and application.profile_id = new.profile_id
  ) then
    raise exception 'The document must belong to the application owner';
  end if;
  return new;
end;
$$;

drop trigger if exists professional_application_documents_validate on public.professional_application_documents;
create trigger professional_application_documents_validate
  before insert or update on public.professional_application_documents
  for each row execute function public.validate_fortalfy_professional_document();

alter table public.professional_application_documents enable row level security;
grant select, insert, delete on public.professional_application_documents to authenticated;

drop policy if exists "applicants and admins read professional documents" on public.professional_application_documents;
create policy "applicants and admins read professional documents" on public.professional_application_documents
  for select to authenticated
  using (
    profile_id = auth.uid()
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

drop policy if exists "applicants upload own professional documents" on public.professional_application_documents;
create policy "applicants upload own professional documents" on public.professional_application_documents
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.professional_applications application
      where application.id = application_id
        and application.profile_id = auth.uid()
        and application.status in ('draft','correction_required','rejected')
    )
  );

drop policy if exists "applicants remove own drafts documents" on public.professional_application_documents;
create policy "applicants remove own drafts documents" on public.professional_application_documents
  for delete to authenticated
  using (
    profile_id = auth.uid()
    and exists (
      select 1 from public.professional_applications application
      where application.id = application_id
        and application.profile_id = auth.uid()
        and application.status in ('draft','correction_required','rejected')
    )
  );

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('professional-documents', 'professional-documents', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "owners and admins read professional document objects" on storage.objects;
create policy "owners and admins read professional document objects" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'professional-documents'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    )
  );

drop policy if exists "owners upload professional document objects" on storage.objects;
create policy "owners upload professional document objects" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'professional-documents'
    and split_part(name, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.professional_applications application
      where application.id::text = split_part(name, '/', 2)
        and application.profile_id = auth.uid()
        and application.status in ('draft','correction_required','rejected')
    )
  );

drop policy if exists "owners remove professional document objects" on storage.objects;
create policy "owners remove professional document objects" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'professional-documents'
    and split_part(name, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.professional_applications application
      where application.id::text = split_part(name, '/', 2)
        and application.profile_id = auth.uid()
        and application.status in ('draft','correction_required','rejected')
    )
  );

create or replace function public.submit_fortalfy_professional_application(p_application_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_row public.professional_applications%rowtype;
  required_keys text[];
  required_key text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  select * into application_row
    from public.professional_applications
    where id = p_application_id and profile_id = auth.uid()
    for update;
  if not found then
    raise exception 'Professional application not found';
  end if;
  if application_row.status not in ('draft', 'correction_required', 'rejected') then
    raise exception 'This application cannot be submitted in its current status';
  end if;
  required_keys := case application_row.kind
    when 'empresa' then array['displayName','contactEmail','phone','city','description','category']
    when 'marca' then array['displayName','contactEmail','phone','city','description','category','country']
    when 'vendedor' then array['displayName','contactEmail','phone','city','description','category']
    when 'restaurante' then array['displayName','contactEmail','phone','city','description','cuisine','address']
    when 'nutricionista' then array['displayName','contactEmail','phone','city','description','registrationNumber','registrationRegion','specialties','serviceModes']
    when 'personal' then array['displayName','contactEmail','phone','city','description','registrationNumber','specialties','serviceModes']
    when 'influenciador' then array['displayName','contactEmail','phone','city','description','fitnessNiches','socialLinks']
    else array[]::text[]
  end;
  foreach required_key in array required_keys loop
    if nullif(btrim(application_row.private_data ->> required_key), '') is null then
      raise exception 'Required application field is missing: %', required_key;
    end if;
  end loop;
  if application_row.kind in ('nutricionista', 'personal', 'vendedor')
    and not exists (
      select 1 from public.professional_application_documents document
      where document.application_id = application_row.id
        and document.profile_id = auth.uid()
    ) then
    raise exception 'Upload at least one supporting document before submission';
  end if;
  perform set_config('fortalfy.application_submission', 'on', true);
  update public.professional_applications
    set status = 'under_review', submitted_at = now(), reviewer_note = null
    where id = application_row.id;
  perform set_config('fortalfy.application_submission', 'off', true);
  return 'under_review';
end;
$$;

revoke all on function public.submit_fortalfy_professional_application(uuid) from public, anon;
grant execute on function public.submit_fortalfy_professional_application(uuid) to authenticated;

create table if not exists public.professional_profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 80),
  url text not null check (
    char_length(url) <= 2048
    and url ~* '^https://[^/[:space:]]+'
    and url !~* '^https://[^/@]*@'
  ),
  link_type text not null default 'other' check (link_type in ('social','official','booking','menu','portfolio','catalog','contact','other')),
  sort_order smallint not null check (sort_order between 0 and 7),
  is_public boolean not null default true,
  validation_status text not null default 'format_validated' check (validation_status in ('format_validated','under_review','verified','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, sort_order)
);

create index if not exists professional_profile_links_public_idx
  on public.professional_profile_links(profile_id, sort_order)
  where is_public and validation_status <> 'blocked';

alter table public.professional_profile_links enable row level security;
grant select, insert, update, delete on public.professional_profile_links to authenticated;

drop policy if exists "public profile links are readable" on public.professional_profile_links;
create policy "public profile links are readable" on public.professional_profile_links
  for select to authenticated
  using (
    (profile_id = auth.uid())
    or (
      is_public and validation_status <> 'blocked'
      and exists (
        select 1 from public.profiles p
        where p.id = profile_id and not p.is_private
      )
    )
  );

drop policy if exists "profile owners manage own links" on public.professional_profile_links;
create policy "profile owners manage own links" on public.professional_profile_links
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create or replace function public.save_fortalfy_profile_links(p_links jsonb)
returns setof public.professional_profile_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_item jsonb;
  link_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if p_links is null or jsonb_typeof(p_links) <> 'array' then
    raise exception 'Links must be provided as an array';
  end if;
  link_count := jsonb_array_length(p_links);
  if link_count > 8 then
    raise exception 'A profile can have at most eight links';
  end if;
  for link_item in select value from jsonb_array_elements(p_links) loop
    if char_length(btrim(coalesce(link_item ->> 'label', ''))) not between 1 and 80
      or char_length(coalesce(link_item ->> 'url', '')) > 2048
      or coalesce(link_item ->> 'url', '') !~* '^https://[^/[:space:]]+'
      or coalesce(link_item ->> 'url', '') ~* '^https://[^/@]*@'
      or coalesce(link_item ->> 'link_type', '') not in ('social','official','booking','menu','portfolio','catalog','contact','other')
      or (link_item ? 'is_public' and jsonb_typeof(link_item -> 'is_public') <> 'boolean') then
      raise exception 'One or more profile links are invalid';
    end if;
  end loop;
  delete from public.professional_profile_links where profile_id = auth.uid();
  return query
    insert into public.professional_profile_links(profile_id,label,url,link_type,sort_order,is_public)
    select auth.uid(),
      btrim(item.value ->> 'label'),
      btrim(item.value ->> 'url'),
      item.value ->> 'link_type',
      (item.ordinality - 1)::smallint,
      coalesce((item.value ->> 'is_public')::boolean, true)
    from jsonb_array_elements(p_links) with ordinality as item(value, ordinality)
    returning *;
end;
$$;

revoke all on function public.save_fortalfy_profile_links(jsonb) from public, anon;
grant execute on function public.save_fortalfy_profile_links(jsonb) to authenticated;

create or replace function public.update_fortalfy_profile_with_links(
  p_display_name text,
  p_username text,
  p_bio text,
  p_city text,
  p_is_private boolean,
  p_links jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_kind text;
  has_professional_application boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if char_length(btrim(coalesce(p_display_name, ''))) not between 2 and 120 then
    raise exception 'Display name must contain 2-120 characters';
  end if;
  if p_username is not null and p_username !~ '^[a-z0-9._]{3,30}$' then
    raise exception 'Username is invalid';
  end if;
  if char_length(coalesce(p_city, '')) > 120 then
    raise exception 'City is too long';
  end if;
  select kind::text into current_kind from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Profile not found';
  end if;
  select exists (
    select 1 from public.professional_applications application where application.profile_id = auth.uid()
  ) into has_professional_application;
  if char_length(coalesce(p_bio, '')) > case
    when current_kind = 'cliente' and not has_professional_application then 2000
    else 150
  end then
    raise exception 'Professional profile bios are limited to 150 characters';
  end if;
  update public.profiles set
    display_name = btrim(p_display_name),
    username = nullif(btrim(p_username), ''),
    bio = btrim(coalesce(p_bio, '')),
    city = nullif(btrim(coalesce(p_city, '')), ''),
    is_private = coalesce(p_is_private, false)
    where id = auth.uid();
  perform public.save_fortalfy_profile_links(p_links);
end;
$$;

revoke all on function public.update_fortalfy_profile_with_links(text, text, text, text, boolean, jsonb) from public, anon;
grant execute on function public.update_fortalfy_profile_with_links(text, text, text, text, boolean, jsonb) to authenticated;

create or replace function public.guard_fortalfy_profile_bio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.bio is distinct from old.bio
    and (old.kind::text <> 'cliente' or exists (
      select 1 from public.professional_applications application where application.profile_id = old.id
    ))
    and char_length(coalesce(new.bio, '')) > 150 then
    raise exception 'Professional profile bios are limited to 150 characters';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_professional_bio on public.profiles;
create trigger profiles_guard_professional_bio
  before update of bio on public.profiles
  for each row execute function public.guard_fortalfy_profile_bio();

notify pgrst, 'reload schema';
