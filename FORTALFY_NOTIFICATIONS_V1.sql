-- Fortalfy account notifications and Web Push subscriptions.
-- Apply after PRODUCAO_BACKEND_SUPABASE.sql, FORTALFY_SOCIAL_V1_SUPABASE.sql,
-- FORTALFY_COMMUNICATION_V1.sql, FORTALFY_PROFESSIONAL_PROFILES_AND_LINKS_V1.sql,
-- FORTALFY_MP_SANDBOX_V1.sql, and FORTALFY_FOOD_SOCIAL_SUPABASE.sql.
-- Database triggers persist events; pg_net dispatches the queue asynchronously.

begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create table if not exists public.fortalfy_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in (
    'social.like','social.comment','social.reply','social.mention','social.follow',
    'chat.message','workout.reminder','workout.schedule_changed','partner.request_accepted',
    'professional.approved','professional.review_update','shop.order_update',
    'account.security','system.important'
  )),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 300),
  image_url text,
  target_route text not null default '/home' check (target_route ~ '^/[A-Za-z0-9/_?=&.%+-]*$'),
  target_entity_id uuid,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  read_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  group_key text,
  group_window_started_at timestamptz,
  group_count integer not null default 1 check (group_count > 0),
  push_attempts integer not null default 0 check (push_attempts >= 0),
  last_push_error text
);

create index if not exists fortalfy_notifications_recipient_created_idx
  on public.fortalfy_notifications(recipient_user_id, created_at desc);
drop index if exists public.fortalfy_notifications_active_group_idx;
create index fortalfy_notifications_active_group_idx
  on public.fortalfy_notifications(recipient_user_id, group_key)
  where group_key is not null and read_at is null;

create table if not exists public.fortalfy_notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  likes_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  mentions_enabled boolean not null default true,
  messages_enabled boolean not null default true,
  workout_reminders_enabled boolean not null default true,
  partner_updates_enabled boolean not null default true,
  shop_updates_enabled boolean not null default true,
  security_enabled boolean not null default true,
  marketing_enabled boolean not null default false,
  sound_enabled boolean not null default true,
  vibration_enabled boolean not null default true,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00',
  timezone text not null default 'America/Sao_Paulo' check (char_length(timezone) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (timezone <> '')
);

create table if not exists public.fortalfy_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('web','android_pwa','ios_pwa')),
  browser text not null default 'unknown',
  device_name text,
  endpoint_hash bytea not null unique,
  subscription jsonb not null check (jsonb_typeof(subscription) = 'object'),
  permission_status text not null default 'granted' check (permission_status in ('granted','denied','default')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error_code text
);
create index if not exists fortalfy_push_subscriptions_active_user_idx
  on public.fortalfy_push_subscriptions(user_id, last_seen_at desc) where revoked_at is null;

create table if not exists private.fortalfy_notification_queue (
  notification_id uuid primary key references public.fortalfy_notifications(id) on delete cascade,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.fortalfy_notification_delivery_audit (
  id bigint generated always as identity primary key,
  notification_id uuid references public.fortalfy_notifications(id) on delete set null,
  subscription_id uuid references public.fortalfy_push_subscriptions(id) on delete set null,
  outcome text not null check (outcome in ('sent','failed','expired','skipped','opened')),
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists fortalfy_notification_delivery_audit_created_idx
  on public.fortalfy_notification_delivery_audit(created_at desc);

alter table public.fortalfy_notifications enable row level security;
alter table public.fortalfy_notification_preferences enable row level security;
alter table public.fortalfy_push_subscriptions enable row level security;
alter table public.fortalfy_notification_delivery_audit enable row level security;
alter table private.fortalfy_notification_queue enable row level security;

drop policy if exists "users read own notifications" on public.fortalfy_notifications;
create policy "users read own notifications" on public.fortalfy_notifications
  for select to authenticated using (recipient_user_id = (select auth.uid()));
drop policy if exists "users mark own notifications read" on public.fortalfy_notifications;
create policy "users mark own notifications read" on public.fortalfy_notifications
  for update to authenticated using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));
drop policy if exists "users manage own notification preferences" on public.fortalfy_notification_preferences;
create policy "users manage own notification preferences" on public.fortalfy_notification_preferences
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "users read own push subscriptions" on public.fortalfy_push_subscriptions;
create policy "users read own push subscriptions" on public.fortalfy_push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.fortalfy_notification_delivery_audit from public, anon, authenticated;
revoke all on private.fortalfy_notification_queue from public, anon, authenticated;
revoke insert, delete on public.fortalfy_notifications from public, anon, authenticated;
grant select on public.fortalfy_notifications to authenticated;
grant update (read_at) on public.fortalfy_notifications to authenticated;
grant select, insert, update on public.fortalfy_notification_preferences to authenticated;
grant select on public.fortalfy_push_subscriptions to authenticated;
grant usage, select on sequence public.fortalfy_notification_delivery_audit_id_seq to service_role;
grant all on public.fortalfy_notifications, public.fortalfy_notification_preferences,
  public.fortalfy_push_subscriptions, public.fortalfy_notification_delivery_audit to service_role;
grant all on private.fortalfy_notification_queue to service_role;

create or replace function public.register_fortal_push_subscription(
  p_subscription jsonb, p_platform text, p_device_name text default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_endpoint text := p_subscription ->> 'endpoint';
  v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_platform not in ('web','android_pwa','ios_pwa') then raise exception 'Invalid platform'; end if;
  if v_endpoint is null or char_length(v_endpoint) > 2048
     or p_subscription #>> '{keys,p256dh}' is null
     or p_subscription #>> '{keys,auth}' is null then
    raise exception 'Invalid push subscription';
  end if;
  insert into public.fortalfy_push_subscriptions as existing (
    user_id, platform, browser, device_name, endpoint_hash, subscription,
    permission_status, revoked_at, last_seen_at
  ) values (
    v_user_id, p_platform, 'browser', left(coalesce(p_device_name,''),160),
    extensions.digest(v_endpoint, 'sha256'), p_subscription, 'granted', null, now()
  ) on conflict (endpoint_hash) do update set
    user_id = excluded.user_id, platform = excluded.platform,
    device_name = excluded.device_name, subscription = excluded.subscription,
    permission_status = 'granted', revoked_at = null, last_seen_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.revoke_fortal_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.fortalfy_push_subscriptions
  set revoked_at = now(), permission_status = 'denied'
  where user_id = auth.uid() and endpoint_hash = extensions.digest(p_endpoint, 'sha256');
end;
$$;
revoke all on function public.register_fortal_push_subscription(jsonb,text,text) from public, anon;
grant execute on function public.register_fortal_push_subscription(jsonb,text,text) to authenticated;
revoke all on function public.revoke_fortal_push_subscription(text) from public, anon;
grant execute on function public.revoke_fortal_push_subscription(text) to authenticated;

create or replace function private.enqueue_fortal_notification_push()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into private.fortalfy_notification_queue(notification_id)
  values (new.id) on conflict (notification_id) do update
    set available_at = now(), claimed_at = null;
  return new;
end;
$$;
drop trigger if exists fortalfy_notification_enqueue_push on public.fortalfy_notifications;
create trigger fortalfy_notification_enqueue_push
  after insert or update of group_count on public.fortalfy_notifications
  for each row when (new.read_at is null)
  execute function private.enqueue_fortal_notification_push();

create or replace function private.create_fortal_notification(
  p_recipient uuid, p_actor uuid, p_type text, p_title text, p_body text,
  p_route text, p_entity uuid default null, p_priority text default 'normal',
  p_group_key text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_existing public.fortalfy_notifications%rowtype;
  v_enabled boolean := true;
  v_preference_key text;
  v_group_window interval := interval '10 minutes';
begin
  if p_recipient is null or p_actor = p_recipient then return null; end if;
  if p_type not in ('social.like','social.comment','social.reply','social.mention','social.follow',
    'chat.message','workout.reminder','workout.schedule_changed','partner.request_accepted',
    'professional.approved','professional.review_update','shop.order_update','account.security','system.important') then
    return null;
  end if;

  v_preference_key := case p_type
    when 'social.like' then 'likes_enabled'
    when 'social.comment' then 'comments_enabled'
    when 'social.reply' then 'comments_enabled'
    when 'social.mention' then 'mentions_enabled'
    when 'social.follow' then 'likes_enabled'
    when 'chat.message' then 'messages_enabled'
    when 'workout.reminder' then 'workout_reminders_enabled'
    when 'workout.schedule_changed' then 'partner_updates_enabled'
    when 'partner.request_accepted' then 'partner_updates_enabled'
    when 'professional.approved' then 'partner_updates_enabled'
    when 'professional.review_update' then 'partner_updates_enabled'
    when 'shop.order_update' then 'shop_updates_enabled'
    when 'account.security' then 'security_enabled'
    else null end;
  if v_preference_key is not null then
    execute format('select coalesce((select %I from public.fortalfy_notification_preferences where user_id = $1), true)', v_preference_key)
      into v_enabled using p_recipient;
  end if;
  if not v_enabled then return null; end if;

  if p_group_key is not null then
    select * into v_existing from public.fortalfy_notifications
    where recipient_user_id = p_recipient and group_key = p_group_key
      and read_at is null and group_window_started_at > now() - v_group_window
    order by created_at desc limit 1 for update;
    if found then
      update public.fortalfy_notifications set
        group_count = group_count + 1,
        body = case p_type
          when 'social.like' then 'Mais uma pessoa curtiu sua publicação.'
          when 'social.comment' then 'Você recebeu mais um comentário.'
          else p_body end,
        created_at = now(), actor_user_id = p_actor
      where id = v_existing.id returning id into v_id;
      return v_id;
    end if;
  end if;

  insert into public.fortalfy_notifications (
    recipient_user_id, actor_user_id, type, title, body, target_route,
    target_entity_id, priority, group_key, group_window_started_at
  ) values (
    p_recipient, p_actor, p_type, left(p_title,120), left(p_body,300),
    case when p_route ~ '^/[A-Za-z0-9/_?=&.%+-]*$' then p_route else '/home' end,
    p_entity, p_priority, p_group_key, case when p_group_key is null then null else now() end
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.create_fortal_notification(uuid,uuid,text,text,text,text,uuid,text,text) from public, anon, authenticated;
grant execute on function private.create_fortal_notification(uuid,uuid,text,text,text,text,uuid,text,text) to service_role;

create or replace function private.notify_fortal_post_like()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_actor text;
begin
  select author_id into v_owner from public.posts where id = new.post_id;
  select coalesce(display_name,'Alguém') into v_actor from public.profiles where id = new.user_id;
  perform private.create_fortal_notification(v_owner,new.user_id,'social.like',
    case when v_actor = 'Alguém' then 'Nova curtida' else v_actor || ' curtiu sua publicação' end,
    'Uma pessoa curtiu sua publicação.', '/feed?post=' || new.post_id::text, new.post_id, 'low',
    'social.like:' || new.post_id::text);
  return new;
end;
$$;
drop trigger if exists fortalfy_notify_post_like on public.post_likes;
create trigger fortalfy_notify_post_like after insert on public.post_likes
  for each row execute function private.notify_fortal_post_like();

create or replace function private.notify_fortal_post_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_actor text; v_parent_owner uuid; v_mentioned record;
begin
  select author_id into v_owner from public.posts where id = new.post_id;
  select coalesce(display_name,'Alguém') into v_actor from public.profiles where id = new.author_id;
  if new.parent_comment_id is not null then
    select author_id into v_parent_owner from public.post_comments where id = new.parent_comment_id;
    perform private.create_fortal_notification(v_parent_owner,new.author_id,'social.reply',
      'Nova resposta','Alguém respondeu ao seu comentário.','/feed?post=' || new.post_id::text,new.post_id,'normal',null);
  end if;
  if v_owner is distinct from v_parent_owner then
    perform private.create_fortal_notification(v_owner,new.author_id,'social.comment',
      case when v_actor = 'Alguém' then 'Novo comentário' else v_actor || ' comentou na sua publicação' end,
      'Você recebeu um novo comentário.','/feed?post=' || new.post_id::text,new.post_id,'normal',
      case when new.parent_comment_id is null then 'social.comment:' || new.post_id::text else null end);
  end if;
  for v_mentioned in select id from public.profiles
    where username is not null and id <> new.author_id
      and strpos(lower(new.body), '@' || lower(username)) > 0
  loop
    perform private.create_fortal_notification(v_mentioned.id,new.author_id,'social.mention',
      'Você foi mencionado','Alguém mencionou você em um comentário.',
      '/feed?post=' || new.post_id::text,new.post_id,'normal',null);
  end loop;
  return new;
end;
$$;
drop trigger if exists fortalfy_notify_post_comment on public.post_comments;
create trigger fortalfy_notify_post_comment after insert on public.post_comments
  for each row execute function private.notify_fortal_post_comment();

create or replace function private.notify_fortal_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor text;
begin
  select coalesce(display_name,'Alguém') into v_actor from public.profiles where id = new.follower_id;
  perform private.create_fortal_notification(new.followed_id,new.follower_id,'social.follow',
    case when v_actor = 'Alguém' then 'Novo seguidor' else v_actor || ' começou a seguir você' end,
    'Você tem uma nova conexão na Fortalfy.','/people',new.follower_id,'low',null);
  return new;
end;
$$;
drop trigger if exists fortalfy_notify_follow on public.profile_follows;
create trigger fortalfy_notify_follow after insert on public.profile_follows
  for each row execute function private.notify_fortal_follow();

create or replace function private.notify_fortal_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recipient uuid; v_conversation uuid; v_sender text;
begin
  select case when member_one = new.sender_id then member_two else member_one end, id
    into v_recipient, v_conversation from public.dm_conversations where id = new.conversation_id;
  select coalesce(display_name,'Alguém') into v_sender from public.profiles where id = new.sender_id;
  perform private.create_fortal_notification(v_recipient,new.sender_id,'chat.message','Nova mensagem',
    'Você recebeu uma nova mensagem.','/messages?conversation=' || v_conversation::text,v_conversation,'normal',null);
  return new;
end;
$$;
drop trigger if exists fortalfy_notify_direct_message on public.direct_messages;
create trigger fortalfy_notify_direct_message after insert on public.direct_messages
  for each row execute function private.notify_fortal_message();

create or replace function private.notify_fortal_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recipient uuid; v_actor uuid; v_body text; v_title text;
begin
  if tg_op = 'INSERT' then
    v_recipient := new.professional_id; v_actor := new.customer_id;
    v_title := 'Nova solicitação de agendamento'; v_body := 'Você recebeu uma nova solicitação de horário.';
  elsif new.status is distinct from old.status then
    v_recipient := case when auth.uid() = new.customer_id then new.professional_id else new.customer_id end;
    v_actor := auth.uid();
    v_title := 'Atualização no agendamento';
    v_body := case new.status::text
      when 'confirmada' then 'Seu horário foi confirmado pelo profissional.'
      when 'recusada' then 'O profissional não pôde aceitar este horário.'
      when 'cancelada' then 'Um agendamento foi cancelado.'
      when 'concluida' then 'O atendimento foi marcado como concluído.'
      else 'O status do seu agendamento foi atualizado.' end;
  else return new;
  end if;
  perform private.create_fortal_notification(v_recipient,v_actor,'workout.schedule_changed',v_title,v_body,
    '/messages',new.id,'high',null);
  return new;
end;
$$;
drop trigger if exists fortalfy_notify_booking on public.bookings;
create trigger fortalfy_notify_booking after insert or update of status on public.bookings
  for each row execute function private.notify_fortal_booking();

create or replace function private.notify_fortal_professional_application()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_type text; v_title text; v_body text;
begin
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then return new; end if;
  v_type := case when new.status = 'approved' then 'professional.approved' else 'professional.review_update' end;
  v_title := case when new.status = 'approved' then 'Cadastro profissional aprovado' else 'Atualização do cadastro profissional' end;
  v_body := case new.status when 'approved' then 'Seu perfil profissional foi aprovado.'
    when 'correction_required' then 'Há uma atualização importante na revisão do seu cadastro.'
    when 'rejected' then 'A equipe concluiu a revisão do seu cadastro.'
    when 'suspended' then 'Há uma atualização importante no status do seu perfil.'
    else 'O status do seu cadastro profissional foi atualizado.' end;
  perform private.create_fortal_notification(new.profile_id,null,v_type,v_title,v_body,'/professional',new.id,'high',null);
  return new;
end;
$$;
drop trigger if exists fortalfy_notify_professional_application on public.professional_applications;
create trigger fortalfy_notify_professional_application after update of status on public.professional_applications
  for each row execute function private.notify_fortal_professional_application();

create or replace function private.notify_fortal_shop_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recipient uuid; v_actor uuid; v_title text; v_body text;
begin
  if tg_op = 'INSERT' then
    v_recipient := new.customer_id;
    v_title := 'Pedido recebido'; v_body := 'Seu pedido da FortalShop foi registrado.';
  elsif new.status is distinct from old.status then
    v_recipient := new.customer_id; v_actor := auth.uid();
    v_title := 'Atualização do pedido';
    v_body := case new.status when 'approved' then 'O pagamento do seu pedido foi aprovado.'
      when 'cancelled' then 'Seu pedido foi cancelado.' when 'refunded' then 'Seu pedido foi reembolsado.'
      else 'O status do seu pedido foi atualizado.' end;
  else return new;
  end if;
  perform private.create_fortal_notification(v_recipient,v_actor,'shop.order_update',v_title,v_body,'/shop',new.id,'normal',null);
  return new;
end;
$$;
drop trigger if exists fortalfy_notify_shop_order on public.shop_orders;
create trigger fortalfy_notify_shop_order after insert on public.shop_orders
  for each row execute function private.notify_fortal_shop_order();
create trigger fortalfy_notify_shop_order_status after update of status on public.shop_orders
  for each row execute function private.notify_fortal_shop_order();

create or replace function private.notify_fortal_food_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recipient uuid; v_actor uuid; v_title text; v_body text;
begin
  if tg_op = 'INSERT' then
    v_recipient := new.restaurant_id; v_actor := new.customer_id;
    v_title := 'Novo pedido FortalFood'; v_body := 'Um cliente enviou um novo pedido.';
  elsif new.status is distinct from old.status then
    v_recipient := case when auth.uid() = new.customer_id then new.restaurant_id else new.customer_id end;
    v_actor := auth.uid(); v_title := 'Atualização do pedido FortalFood';
    v_body := case new.status when 'accepted' then 'O restaurante aceitou seu pedido.'
      when 'preparing' then 'Seu pedido está sendo preparado.' when 'ready' then 'Seu pedido está pronto para retirada.'
      when 'delivered' then 'Seu pedido foi entregue.' when 'cancelled' then 'Seu pedido foi cancelado.'
      else 'O status do pedido foi atualizado.' end;
  else return new;
  end if;
  perform private.create_fortal_notification(v_recipient,v_actor,'shop.order_update',v_title,v_body,'/food',new.id,'normal',null);
  return new;
end;
$$;
drop trigger if exists fortalfy_notify_food_order on public.food_orders;
create trigger fortalfy_notify_food_order after insert on public.food_orders
  for each row execute function private.notify_fortal_food_order();
create trigger fortalfy_notify_food_order_status after update of status on public.food_orders
  for each row execute function private.notify_fortal_food_order();

-- Service-role-only RPCs keep queue access and push endpoints off client sessions.
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
    'priority', n.priority, 'groupKey', n.group_key, 'recipientId', n.recipient_user_id,
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

create or replace function public.finish_fortal_notification_push(p_notification_id uuid, p_results jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sent integer := 0; v_skipped integer := 0; v_attempts integer; v_result jsonb; v_outcome text; v_error text; v_subscription_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role','') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  for v_result in select value from jsonb_array_elements(coalesce(p_results,'[]'::jsonb)) loop
    v_subscription_id := (v_result ->> 'subscriptionId')::uuid;
    v_outcome := case when v_result ->> 'outcome' in ('sent','failed','expired','skipped') then v_result ->> 'outcome' else 'failed' end;
    v_error := left(v_result ->> 'errorCode',80);
    if v_outcome = 'sent' then v_sent := v_sent + 1; end if;
    if v_outcome = 'skipped' then v_skipped := v_skipped + 1; end if;
    insert into public.fortalfy_notification_delivery_audit(notification_id,subscription_id,outcome,error_code)
      values (p_notification_id,v_subscription_id,v_outcome,v_error);
    update public.fortalfy_push_subscriptions set
      last_success_at = case when v_outcome = 'sent' then now() else last_success_at end,
      last_failure_at = case when v_outcome <> 'sent' then now() else last_failure_at end,
      last_error_code = case when v_outcome = 'sent' then null else v_error end,
      revoked_at = case when v_outcome = 'expired' then now() else revoked_at end,
      permission_status = case when v_outcome = 'expired' then 'denied' else permission_status end
    where id = v_subscription_id;
  end loop;
  update public.fortalfy_notifications set
    delivered_at = case when v_sent > 0 then now() else delivered_at end,
    push_attempts = push_attempts + 1
  where id = p_notification_id;
  select attempts into v_attempts from private.fortalfy_notification_queue where notification_id = p_notification_id;
  if v_sent > 0 or v_skipped > 0 or coalesce(v_attempts,0) >= 5 then
    delete from private.fortalfy_notification_queue where notification_id = p_notification_id;
  else
    update private.fortalfy_notification_queue set claimed_at = null,
      available_at = now() + make_interval(secs => least(3600,30 * power(2,greatest(coalesce(v_attempts,1)-1,0))::integer)),
      last_error = 'Transient push delivery failure'
    where notification_id = p_notification_id;
  end if;
end;
$$;
revoke all on function public.claim_fortal_notification_push_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_fortal_notification_push_batch(integer) to service_role;
revoke all on function public.finish_fortal_notification_push(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.finish_fortal_notification_push(uuid,jsonb) to service_role;

create or replace function private.dispatch_fortal_notification_queue()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text; v_count bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'fortalfy_push_worker_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'fortalfy_push_worker_secret' limit 1;
  if coalesce(v_url,'') = '' or coalesce(v_secret,'') = '' then return 0; end if;
  select count(*) into v_count
  from private.fortalfy_notification_queue q
  join public.fortalfy_notifications n on n.id = q.notification_id
  left join public.fortalfy_notification_preferences pref on pref.user_id = n.recipient_user_id
  where q.available_at <= now() and (q.claimed_at is null or q.claimed_at < now() - interval '5 minutes')
    and n.read_at is null and (n.expires_at is null or n.expires_at > now())
    and (n.priority = 'high' or case
      when coalesce(pref.quiet_hours_start,'22:00'::time) = coalesce(pref.quiet_hours_end,'07:00'::time) then true
      when coalesce(pref.quiet_hours_start,'22:00'::time) < coalesce(pref.quiet_hours_end,'07:00'::time)
        then timezone(coalesce(pref.timezone,'America/Sao_Paulo'),now())::time not between
          coalesce(pref.quiet_hours_start,'22:00'::time) and coalesce(pref.quiet_hours_end,'07:00'::time)
      else timezone(coalesce(pref.timezone,'America/Sao_Paulo'),now())::time < coalesce(pref.quiet_hours_start,'22:00'::time)
        and timezone(coalesce(pref.timezone,'America/Sao_Paulo'),now())::time >= coalesce(pref.quiet_hours_end,'07:00'::time)
      end);
  if v_count > 0 then
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('batchSize', least(v_count,100)),
      headers := jsonb_build_object('Content-Type','application/json','x-fortal-worker-secret',v_secret),
      timeout_milliseconds := 5000
    );
  end if;
  return coalesce(v_count,0);
end;
$$;
revoke all on function private.dispatch_fortal_notification_queue() from public, anon, authenticated;
grant execute on function private.dispatch_fortal_notification_queue() to postgres, service_role;

do $$ begin
  if not exists (select 1 from cron.job where jobname = 'fortalfy-notification-push-dispatch') then
    perform cron.schedule('fortalfy-notification-push-dispatch','* * * * *',
      'select private.dispatch_fortal_notification_queue()');
  end if;
end $$;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'fortalfy_notifications') then
    alter publication supabase_realtime add table public.fortalfy_notifications;
  end if;
end $$;

commit;
