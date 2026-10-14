-- Public-by-default profile discovery for authenticated Fortalfy members.
-- Apply after PRODUCAO_BACKEND_SUPABASE.sql and FORTALFY_SOCIAL_V1_SUPABASE.sql.
-- Existing profiles that explicitly chose private visibility remain private.

alter table public.profiles
  alter column is_private set default false;

alter table public.profiles enable row level security;

drop policy if exists "profiles visible to authenticated" on public.profiles;
drop policy if exists "social profiles visible to permitted users" on public.profiles;
create policy "social profiles visible to permitted users" on public.profiles
  for select to authenticated using (public.can_view_profile(id));

grant select (
  id, display_name, username, kind, city, business_name, bio, avatar_path,
  cover_path, verified_at, partner_approved_at, is_private, created_at, updated_at
) on public.profiles to authenticated;

create index if not exists profiles_public_discovery_name_idx
  on public.profiles (lower(display_name), id)
  where is_private = false;
