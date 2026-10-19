-- Fortalfy notification UTF-8 repair.
-- Repairs only known mojibake in notification templates and affected notification
-- rows. A private before/after snapshot is written before any data is changed.
begin;

do $$
begin
  if to_regclass('public.fortalfy_notifications') is null then
    raise exception 'Missing public.fortalfy_notifications; apply the Fortalfy notification migrations first';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and p.prokind = 'f'
        and p.proname in ('create_fortal_notification', 'notify_fortal_post_like',
          'notify_fortal_post_comment', 'notify_fortal_follow', 'notify_fortal_message',
          'notify_fortal_booking', 'notify_fortal_professional_application',
          'notify_fortal_shop_order', 'notify_fortal_food_order')) <> 9 then
    raise exception 'Expected notification template functions are missing; no changes were applied';
  end if;
end;
$$;

create table if not exists private.fortal_notification_text_backup_v1 (
  notification_id uuid primary key,
  captured_at timestamptz not null default now(),
  notification_type text not null,
  previous_title text,
  previous_body text,
  corrected_title text,
  corrected_body text
);
revoke all on private.fortal_notification_text_backup_v1 from public, anon, authenticated;

create or replace function private.fortal_repair_notification_template_utf8_v1(p_text text)
returns text language plpgsql immutable set search_path = '' as $$
declare v_text text := p_text;
begin
  if v_text is null then return null; end if;
  v_text := replace(v_text, chr(195) || chr(161), 'á');
  v_text := replace(v_text, chr(195) || chr(162), 'â');
  v_text := replace(v_text, chr(195) || chr(163), 'ã');
  v_text := replace(v_text, chr(195) || chr(167), 'ç');
  v_text := replace(v_text, chr(195) || chr(169), 'é');
  v_text := replace(v_text, chr(195) || chr(170), 'ê');
  v_text := replace(v_text, chr(195) || chr(173), 'í');
  v_text := replace(v_text, chr(195) || chr(179), 'ó');
  v_text := replace(v_text, chr(195) || chr(180), 'ô');
  v_text := replace(v_text, chr(195) || chr(181), 'õ');
  v_text := replace(v_text, chr(195) || chr(186), 'ú');
  v_text := replace(v_text, chr(194) || chr(183), '·');
  return v_text;
end;
$$;
revoke all on function private.fortal_repair_notification_template_utf8_v1(text) from public, anon, authenticated;

create or replace function private.fortal_repair_notification_title_utf8_v1(p_title text, p_type text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v_title text := p_title;
  v_bad_suffix text;
  v_good_suffix text;
begin
  if v_title is null then return null; end if;
  if p_type = 'social.like' then
    v_bad_suffix := ' curtiu sua publica' || chr(195) || chr(167) || chr(195) || chr(163) || 'o';
    v_good_suffix := ' curtiu sua publicação';
  elsif p_type = 'social.comment' then
    v_bad_suffix := ' comentou na sua publica' || chr(195) || chr(167) || chr(195) || chr(163) || 'o';
    v_good_suffix := ' comentou na sua publicação.';
  elsif p_type = 'social.follow' then
    v_bad_suffix := ' come' || chr(195) || chr(167) || 'ou a seguir voc' || chr(195) || chr(170);
    v_good_suffix := ' começou a seguir você.';
  else
    return v_title;
  end if;
  if right(v_title, length(v_bad_suffix)) = v_bad_suffix then
    return left(v_title, length(v_title) - length(v_bad_suffix)) || v_good_suffix;
  end if;
  return v_title;
end;
$$;
revoke all on function private.fortal_repair_notification_title_utf8_v1(text,text) from public, anon, authenticated;

-- Snapshot only records whose known notification templates will change.
insert into private.fortal_notification_text_backup_v1 (
  notification_id, notification_type, previous_title, previous_body, corrected_title, corrected_body
)
select n.id, n.type, n.title, n.body,
  private.fortal_repair_notification_title_utf8_v1(n.title, n.type),
  case n.type
    when 'chat.message' then
      case when n.body = 'Voc' || chr(195) || chr(170) || ' recebeu uma nova mensagem.'
        then 'Você recebeu uma nova mensagem.' else n.body end
    when 'social.like' then
      case when n.body = 'Uma pessoa curtiu sua publica' || chr(195) || chr(167) || chr(195) || chr(163) || 'o.'
        then 'Uma pessoa curtiu sua publicação.' else n.body end
    when 'social.comment' then
      case when n.body = 'Voc' || chr(195) || chr(170) || ' recebeu um novo coment' || chr(195) || chr(161) || 'rio.'
        then 'Você recebeu um novo comentário.' else n.body end
    when 'social.follow' then
      case when n.body = 'Voc' || chr(195) || chr(170) || ' tem uma nova conex' || chr(195) || chr(163) || 'o na Fortalfy.'
        then 'Você tem um novo seguidor na Fortalfy.' else n.body end
    else n.body
  end
from public.fortalfy_notifications n
where n.type in ('chat.message', 'social.like', 'social.comment', 'social.follow')
  and (
    private.fortal_repair_notification_title_utf8_v1(n.title, n.type) is distinct from n.title
    or (n.type = 'chat.message' and n.body = 'Voc' || chr(195) || chr(170) || ' recebeu uma nova mensagem.')
    or (n.type = 'social.like' and n.body = 'Uma pessoa curtiu sua publica' || chr(195) || chr(167) || chr(195) || chr(163) || 'o.')
    or (n.type = 'social.comment' and n.body = 'Voc' || chr(195) || chr(170) || ' recebeu um novo coment' || chr(195) || chr(161) || 'rio.')
    or (n.type = 'social.follow' and n.body = 'Voc' || chr(195) || chr(170) || ' tem uma nova conex' || chr(195) || chr(163) || 'o na Fortalfy.')
  )
on conflict (notification_id) do nothing;

update public.fortalfy_notifications n
set title = b.corrected_title,
    body = b.corrected_body
from private.fortal_notification_text_backup_v1 b
where b.notification_id = n.id
  and (n.title is distinct from b.corrected_title or n.body is distinct from b.corrected_body);

-- Correct existing SQL templates in-place, changing only recognized UTF-8 byte pairs.
do $$
declare
  v_function record;
  v_definition text;
  v_corrected text;
begin
  for v_function in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.prokind = 'f'
      and p.proname in ('create_fortal_notification', 'notify_fortal_post_like',
        'notify_fortal_post_comment', 'notify_fortal_follow', 'notify_fortal_message',
        'notify_fortal_booking', 'notify_fortal_professional_application',
        'notify_fortal_shop_order', 'notify_fortal_food_order')
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    v_corrected := private.fortal_repair_notification_template_utf8_v1(v_definition);
    if v_corrected is distinct from v_definition then
      execute v_corrected;
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
