-- Fortalfy notifications v1.5: message preview privacy and conversation grouping.
-- Apply after FORTALFY_NOTIFICATIONS_V1_4_FOLLOW_COPY.sql.

begin;

alter table public.fortalfy_notification_preferences
  add column if not exists message_preview_mode text not null default 'sender_only';
alter table public.fortalfy_notification_preferences
  alter column workout_reminders_enabled set default false;

do $$
declare v_reminder_default_marker text;
begin
  select col_description('public.fortalfy_notification_preferences'::regclass, attnum)
    into v_reminder_default_marker
  from pg_attribute
  where attrelid = 'public.fortalfy_notification_preferences'::regclass
    and attname = 'workout_reminders_enabled' and not attisdropped;
  if v_reminder_default_marker is distinct from 'Fortalfy V1.5: reminder consent defaults to off.' then
    update public.fortalfy_notification_preferences
    set workout_reminders_enabled = false
    where workout_reminders_enabled is true;
    comment on column public.fortalfy_notification_preferences.workout_reminders_enabled
      is 'Fortalfy V1.5: reminder consent defaults to off.';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fortalfy_notification_preferences'::regclass
      and conname = 'fortalfy_notification_message_preview_mode_check'
  ) then
    alter table public.fortalfy_notification_preferences
      add constraint fortalfy_notification_message_preview_mode_check
      check (message_preview_mode in ('full','sender_only','hidden'));
  end if;
end;
$$;

create or replace function private.notify_fortal_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recipient uuid; v_conversation uuid; v_sender text; v_preview text;
begin
  select case when member_one = new.sender_id then member_two else member_one end, id
    into v_recipient, v_conversation from public.dm_conversations where id = new.conversation_id;
  select coalesce(nullif(btrim(display_name),''),'Alguém') into v_sender
    from public.profiles where id = new.sender_id;
  v_preview := left(regexp_replace(btrim(new.body), '[[:space:]]+', ' ', 'g'), 180);
  perform private.create_fortal_notification(
    v_recipient, new.sender_id, 'chat.message', v_sender,
    v_preview, '/messages?conversation=' || v_conversation::text,
    v_conversation, 'normal', 'chat.message:' || v_conversation::text
  );
  return new;
end;
$$;

create or replace function public.claim_fortal_notification_push_batch(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_rows jsonb;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  with pending as (
    select q.notification_id
    from private.fortalfy_notification_queue q
    join public.fortalfy_notifications n on n.id = q.notification_id
    left join public.fortalfy_notification_preferences pref on pref.user_id = n.recipient_user_id
    where q.available_at <= now()
      and (q.claimed_at is null or q.claimed_at < now() - interval '5 minutes')
      and n.read_at is null
      and (n.expires_at is null or n.expires_at > now())
      and (n.priority = 'high' or case
        when coalesce(pref.quiet_hours_start, '22:00'::time) = coalesce(pref.quiet_hours_end, '07:00'::time) then true
        when coalesce(pref.quiet_hours_start, '22:00'::time) < coalesce(pref.quiet_hours_end, '07:00'::time)
          then timezone(coalesce(pref.timezone, 'America/Sao_Paulo'), now())::time not between
            coalesce(pref.quiet_hours_start, '22:00'::time) and coalesce(pref.quiet_hours_end, '07:00'::time)
        else timezone(coalesce(pref.timezone, 'America/Sao_Paulo'), now())::time < coalesce(pref.quiet_hours_start, '22:00'::time)
          and timezone(coalesce(pref.timezone, 'America/Sao_Paulo'), now())::time >= coalesce(pref.quiet_hours_end, '07:00'::time)
        end)
    order by q.created_at
    limit greatest(1, least(coalesce(p_limit, 100), 100))
    for update of q skip locked
  ), claimed as (
    update private.fortalfy_notification_queue q
    set claimed_at = now(), attempts = attempts + 1
    from pending p
    where q.notification_id = p.notification_id
    returning q.notification_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id,
    'notificationType', n.type,
    'title', case when n.type = 'chat.message' and coalesce(pref.message_preview_mode, 'sender_only') = 'hidden'
      then 'Nova mensagem' else n.title end,
    'body', case
      when n.type <> 'chat.message' then n.body
      when coalesce(pref.message_preview_mode, 'sender_only') = 'hidden' then 'Abra a Fortalfy para visualizar.'
      when coalesce(pref.message_preview_mode, 'sender_only') = 'sender_only' then 'Enviou uma mensagem para você.'
      when n.group_count > 1 then n.group_count::text || ' novas mensagens. ' || n.body
      else n.body end,
    'targetRoute', n.target_route,
    'entityId', n.target_entity_id,
    'priority', n.priority,
    'groupKey', n.group_key,
    'groupCount', n.group_count,
    'recipientId', n.recipient_user_id,
    'soundEnabled', coalesce(pref.sound_enabled, true),
    'vibration', coalesce(pref.vibration_enabled, true),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'subscription', s.subscription))
      from public.fortalfy_push_subscriptions s
      where s.user_id = n.recipient_user_id
        and s.revoked_at is null
        and s.permission_status = 'granted'
    ), '[]'::jsonb)
  )), '[]'::jsonb)
  into v_rows
  from claimed c
  join public.fortalfy_notifications n on n.id = c.notification_id
  left join public.fortalfy_notification_preferences pref on pref.user_id = n.recipient_user_id;

  return v_rows;
end;
$$;

revoke all on function public.claim_fortal_notification_push_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_fortal_notification_push_batch(integer) to service_role;

commit;
