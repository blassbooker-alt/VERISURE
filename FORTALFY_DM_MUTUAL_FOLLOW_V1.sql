-- Enforce mutual follows for direct messages at the database boundary.
-- Requires FORTALFY_FOOD_SOCIAL_SUPABASE.sql and FORTALFY_COMMUNICATION_V1.sql.

create or replace function public.can_send_dm(user_one uuid, user_two uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select user_one is not null
    and user_two is not null
    and user_one <> user_two
    and exists (
      select 1
      from public.profile_follows first_follow
      join public.profile_follows reciprocal_follow
        on reciprocal_follow.follower_id = first_follow.followed_id
       and reciprocal_follow.followed_id = first_follow.follower_id
      where first_follow.follower_id = user_one
        and first_follow.followed_id = user_two
    );
$$;

revoke all on function public.can_send_dm(uuid, uuid) from public;
grant execute on function public.can_send_dm(uuid, uuid) to authenticated;

drop policy if exists "members start visible profile conversations" on public.dm_conversations;
create policy "members start mutually followed conversations" on public.dm_conversations
  for insert to authenticated with check (
    auth.uid() in (member_one, member_two)
    and public.can_send_dm(
      auth.uid(),
      case when auth.uid() = member_one then member_two else member_one end
    )
    and public.can_view_profile(
      case when auth.uid() = member_one then member_two else member_one end
    )
  );

drop policy if exists "members send messages as themselves" on public.direct_messages;
create policy "mutually followed members send messages as themselves" on public.direct_messages
  for insert to authenticated with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.dm_conversations conversation
      where conversation.id = conversation_id
        and auth.uid() in (conversation.member_one, conversation.member_two)
        and public.can_send_dm(
          auth.uid(),
          case
            when auth.uid() = conversation.member_one then conversation.member_two
            else conversation.member_one
          end
        )
    )
  );
