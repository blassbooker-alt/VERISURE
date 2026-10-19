-- Adds message identity and the saved sound preference to push payloads.
-- Safe to reapply: this replaces only the service-role queue RPC.
create or replace function public.claim_fortal_notification_push_batch(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_rows jsonb;
begin
  if coalesce(auth.jwt() ->> 'role','') <> 'service_role' then
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
        when coalesce(pref.quiet_hours_start,'22:00'::time) = coalesce(pref.quiet_hours_end,'07:00'::time) then true
        when coalesce(pref.quiet_hours_start,'22:00'::time) < coalesce(pref.quiet_hours_end,'07:00'::time)
          then timezone(coalesce(pref.timezone,'America/Sao_Paulo'),now())::time not between
            coalesce(pref.quiet_hours_start,'22:00'::time) and coalesce(pref.quiet_hours_end,'07:00'::time)
        else timezone(coalesce(pref.timezone,'America/Sao_Paulo'),now())::time < coalesce(pref.quiet_hours_start,'22:00'::time)
          and timezone(coalesce(pref.timezone,'America/Sao_Paulo'),now())::time >= coalesce(pref.quiet_hours_end,'07:00'::time)
        end)
    order by q.created_at
    limit greatest(1,least(coalesce(p_limit,100),100))
    for update of q skip locked
  ), claimed as (
    update private.fortalfy_notification_queue q
    set claimed_at = now(), attempts = attempts + 1
    from pending p where q.notification_id = p.notification_id
    returning q.notification_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'title', n.title, 'body', n.body, 'targetRoute', n.target_route,
    'notificationType', n.type, 'entityId', n.entity_id,
    'priority', n.priority, 'groupKey', n.group_key, 'recipientId', n.recipient_user_id,
    'soundEnabled', coalesce(pref.sound_enabled,true),
    'vibration', coalesce(pref.vibration_enabled,true),
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'subscription', s.subscription))
      from public.fortalfy_push_subscriptions s where s.user_id = n.recipient_user_id
        and s.revoked_at is null and s.permission_status = 'granted'), '[]'::jsonb)
  )), '[]'::jsonb) into v_rows
  from claimed c
  join public.fortalfy_notifications n on n.id = c.notification_id
  left join public.fortalfy_notification_preferences pref on pref.user_id = n.recipient_user_id;
  return v_rows;
end;
$$;

revoke all on function public.claim_fortal_notification_push_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_fortal_notification_push_batch(integer) to service_role;
