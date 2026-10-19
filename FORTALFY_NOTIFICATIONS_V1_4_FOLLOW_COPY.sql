-- Normalize the historical follow notification copy and punctuation.
-- Keep a private snapshot of every row changed by this migration.
begin;

do $$
begin
  if to_regclass('public.fortalfy_notifications') is null then
    raise exception 'Missing public.fortalfy_notifications';
  end if;
  if to_regprocedure('private.notify_fortal_follow()') is null then
    raise exception 'Missing private.notify_fortal_follow()';
  end if;
end;
$$;

create table if not exists private.fortal_follow_copy_backup_v1_4 (
  notification_id uuid primary key,
  captured_at timestamptz not null default now(),
  previous_title text,
  previous_body text,
  corrected_title text not null,
  corrected_body text not null
);
alter table private.fortal_follow_copy_backup_v1_4 enable row level security;
revoke all on private.fortal_follow_copy_backup_v1_4 from public, anon, authenticated;

insert into private.fortal_follow_copy_backup_v1_4 (
  notification_id, previous_title, previous_body, corrected_title, corrected_body
)
select id, title, body,
  case
    when right(title, length(' começou a seguir você')) = ' começou a seguir você'
      then title || '.'
    else title
  end,
  'Você tem um novo seguidor na Fortalfy.'
from public.fortalfy_notifications
where type = 'social.follow'
  and (
    body is distinct from 'Você tem um novo seguidor na Fortalfy.'
    or right(title, length(' começou a seguir você')) = ' começou a seguir você'
  )
on conflict (notification_id) do nothing;

update public.fortalfy_notifications n
set title = b.corrected_title,
    body = b.corrected_body
from private.fortal_follow_copy_backup_v1_4 b
where b.notification_id = n.id
  and (n.title is distinct from b.corrected_title or n.body is distinct from b.corrected_body);

do $$
declare
  v_name text;
  v_oid oid;
  v_definition text;
  v_corrected text;
begin
  foreach v_name in array array['notify_fortal_follow', 'notify_fortal_post_comment'] loop
    v_oid := case v_name
      when 'notify_fortal_follow' then to_regprocedure('private.notify_fortal_follow()')
      else to_regprocedure('private.notify_fortal_post_comment()')
    end;
    v_definition := pg_get_functiondef(v_oid);
    v_corrected := case v_name
      when 'notify_fortal_follow' then replace(v_definition,
        ''' começou a seguir você''', ''' começou a seguir você.''')
      else replace(v_definition,
        ''' comentou na sua publicação''', ''' comentou na sua publicação.''')
    end;
    if v_corrected is distinct from v_definition then
      execute v_corrected;
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
