-- Public profile discovery and private one-to-one messaging.
-- Apply after the existing social schema migration.

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

create table if not exists public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  member_one uuid not null references public.profiles(id) on delete cascade,
  member_two uuid not null references public.profiles(id) on delete cascade,
  member_one_read_at timestamptz,
  member_two_read_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  check (member_one <> member_two),
  check (member_one::text < member_two::text),
  unique (member_one, member_two)
);
create index if not exists dm_conversations_member_one_activity_idx
  on public.dm_conversations(member_one, last_message_at desc nulls last, created_at desc);
create index if not exists dm_conversations_member_two_activity_idx
  on public.dm_conversations(member_two, last_message_at desc nulls last, created_at desc);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages(conversation_id, created_at, id);

create or replace function public.touch_dm_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.dm_conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists direct_messages_touch_conversation on public.direct_messages;
create trigger direct_messages_touch_conversation
after insert on public.direct_messages
for each row execute function public.touch_dm_conversation();

create or replace function public.guard_dm_read_receipt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.member_one is distinct from old.member_one
     or new.member_two is distinct from old.member_two then
    raise exception 'Conversation members are managed by the server';
  end if;
  if auth.uid() = old.member_one
     and new.member_two_read_at is distinct from old.member_two_read_at then
    raise exception 'Members can only update their own read receipt';
  elsif auth.uid() = old.member_two
     and new.member_one_read_at is distinct from old.member_one_read_at then
    raise exception 'Members can only update their own read receipt';
  elsif auth.uid() is not null and auth.uid() not in (old.member_one, old.member_two) then
    raise exception 'Only conversation members can update read receipts';
  end if;
  return new;
end;
$$;
drop trigger if exists dm_conversations_guard_read_receipt on public.dm_conversations;
create trigger dm_conversations_guard_read_receipt
before update on public.dm_conversations
for each row execute function public.guard_dm_read_receipt();

alter table public.dm_conversations enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "conversation members read conversations" on public.dm_conversations;
create policy "conversation members read conversations" on public.dm_conversations
  for select to authenticated using (auth.uid() in (member_one, member_two));
drop policy if exists "members start visible profile conversations" on public.dm_conversations;
create policy "members start visible profile conversations" on public.dm_conversations
  for insert to authenticated with check (
    auth.uid() in (member_one, member_two)
    and public.can_view_profile(case when auth.uid() = member_one then member_two else member_one end)
  );
drop policy if exists "conversation members update own read receipt" on public.dm_conversations;
create policy "conversation members update own read receipt" on public.dm_conversations
  for update to authenticated using (auth.uid() in (member_one, member_two))
  with check (auth.uid() in (member_one, member_two));

drop policy if exists "conversation members read messages" on public.direct_messages;
create policy "conversation members read messages" on public.direct_messages
  for select to authenticated using (
    exists (
      select 1 from public.dm_conversations c
      where c.id = conversation_id and auth.uid() in (c.member_one, c.member_two)
    )
  );
drop policy if exists "members send messages as themselves" on public.direct_messages;
create policy "members send messages as themselves" on public.direct_messages
  for insert to authenticated with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.dm_conversations c
      where c.id = conversation_id and auth.uid() in (c.member_one, c.member_two)
    )
  );

grant select, insert on public.dm_conversations to authenticated;
grant update (member_one_read_at, member_two_read_at) on public.dm_conversations to authenticated;
grant select, insert on public.direct_messages to authenticated;
