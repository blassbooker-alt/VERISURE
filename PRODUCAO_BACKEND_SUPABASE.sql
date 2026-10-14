-- Fortalfy: esquema inicial para Supabase/PostgreSQL.
-- Revise e teste em projeto de desenvolvimento antes de aplicar em produção.
create extension if not exists pgcrypto;

create type public.profile_kind as enum ('cliente','personal','nutricionista','academia','restaurante','marca');
create type public.booking_status as enum ('solicitada','confirmada','recusada','concluida','cancelada');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 120),
  kind public.profile_kind not null default 'cliente',
  phone text,
  city text,
  business_name text,
  bio text check (char_length(coalesce(bio,'')) <= 2000),
  avatar_path text,
  cover_path text,
  verified_at timestamptz,
  partner_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  media_path text,
  sponsored boolean not null default false,
  published_at timestamptz not null default now()
);
create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  modality text not null check (modality in ('presencial','online')),
  note text check (char_length(coalesce(note,'')) <= 2000),
  status public.booking_status not null default 'solicitada',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_id <> professional_id)
);
create index if not exists posts_published_idx on public.posts(published_at desc);
create index if not exists bookings_customer_idx on public.bookings(customer_id, starts_at desc);
create index if not exists bookings_professional_idx on public.bookings(professional_id, starts_at desc);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.bookings enable row level security;

-- Perfis públicos: leitura limitada a campos de perfil pela API; nunca exponha dados sensíveis.
create policy "profiles visible to authenticated" on public.profiles for select to authenticated using (true);
create policy "profile owner inserts own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profile owner updates own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "published posts visible to authenticated" on public.posts for select to authenticated using (true);
create policy "users create own posts" on public.posts for insert to authenticated with check (auth.uid() = author_id);
create policy "authors update own posts" on public.posts for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "authors delete own posts" on public.posts for delete to authenticated using (auth.uid() = author_id);

create policy "likes visible to authenticated" on public.post_likes for select to authenticated using (true);
create policy "users like as themselves" on public.post_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "users remove own likes" on public.post_likes for delete to authenticated using (auth.uid() = user_id);

create policy "comments visible to authenticated" on public.post_comments for select to authenticated using (true);
create policy "users comment as themselves" on public.post_comments for insert to authenticated with check (auth.uid() = author_id);
create policy "authors update own comments" on public.post_comments for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "authors delete own comments" on public.post_comments for delete to authenticated using (auth.uid() = author_id);

create policy "booking visible to involved users" on public.bookings for select to authenticated using (auth.uid() = customer_id or auth.uid() = professional_id);
create policy "customer creates own booking" on public.bookings for insert to authenticated with check (auth.uid() = customer_id);
create policy "involved user updates booking" on public.bookings for update to authenticated using (auth.uid() = customer_id or auth.uid() = professional_id) with check (auth.uid() = customer_id or auth.uid() = professional_id);

-- ATENÇÃO: restrinja transições de status com função SQL/RPC antes de produção; a policy acima
-- é uma base inicial e não substitui testes de autorização nem revisão independente de segurança.
