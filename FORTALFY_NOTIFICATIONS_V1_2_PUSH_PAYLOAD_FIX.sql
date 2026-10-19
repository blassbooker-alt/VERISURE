-- Fortalfy notifications v1.2: include delivery metadata required by the push worker.
-- Safe additive repair: preserves notification, subscription, queue and audit rows.
-- Apply after FORTALFY_NOTIFICATIONS_V1.sql.

begin;

do $$
begin
  if to_regclass('public.fortalfy_notifications') is null
     or to_regclass('public.fortalfy_notification_preferences') is null
     or to_regclass('public.fortalfy_push_subscriptions') is null
     or to_regclass('private.fortalfy_notification_queue') is null then
    raise exception 'Fortalfy notification tables are missing; apply FORTALFY_NOTIFICATIONS_V1.sql first';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fortalfy_notifications' and column_name = 'type'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fortalfy_notifications' and column_name = 'target_entity_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fortalfy_notification_preferences' and column_name = 'sound_enabled'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fortalfy_notification_preferences' and column_name = 'vibration_enabled'
  ) then
    raise exception 'Fortalfy notification schema is incomplete; no changes were applied';
  end if;

  if to_regprocedure('private.notify_fortal_shop_order()') is null
     or to_regprocedure('private.notify_fortal_food_order()') is null then
    raise exception 'Fortalfy order notification functions are missing; apply FORTALFY_NOTIFICATIONS_V1.sql first';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shop_orders' and column_name = 'status'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'food_orders' and column_name = 'status'
  ) then
    raise exception 'Fortalfy order status columns are missing; no trigger was changed';
  end if;
end;
$$;

-- Repair only the two status triggers if missing or if their definitions drifted.
-- Existing correct definitions are left untouched.
do $repair$
declare
  r record;
  v_table regclass;
  v_function regprocedure;
  v_trigger_name text;
  v_trigger_oid oid;
  v_definition text;
begin
  for r in
    select * from (values
      ('shop_orders', 'notify_fortal_shop_order'),
      ('food_orders', 'notify_fortal_food_order')
    ) as targets(table_name, function_name)
  loop
    v_table := to_regclass(format('public.%I', r.table_name));
    v_function := to_regprocedure(format('private.%I()', r.function_name));
    v_trigger_name := format('fortalfy_notify_%s_status', replace(r.table_name, '_orders', '_order'));

    select t.oid, lower(pg_get_triggerdef(t.oid))
      into v_trigger_oid, v_definition
    from pg_trigger t
    where t.tgrelid = v_table and t.tgname = v_trigger_name and not t.tgisinternal;

    if v_trigger_oid is not null
       and v_definition like '%when ((old.status is distinct from new.status))%'
       and v_definition like '%' || lower(v_function::text) || '%' then
      continue;
    end if;

    execute format('drop trigger if exists %I on %s', v_trigger_name, v_table);
    execute format(
      'create trigger %I after update of status on %s for each row when (old.status is distinct from new.status) execute function %s',
      v_trigger_name, v_table, v_function
    );
  end loop;
end;
$repair$;

-- The worker uses these fields to select the in-app message sound, respect the
-- sound preference, suppress duplicate conversation alerts, and open deep links.
create or replace function public.claim_fortal_notification_push_batch(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
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
    'title', n.title,
    'body', n.body,
    'targetRoute', n.target_route,
    'entityId', n.target_entity_id,
    'priority', n.priority,
    'groupKey', n.group_key,
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
