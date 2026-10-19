begin;

-- Dispatch queued pushes as soon as a notification is created. Keep pg_cron as
-- a retry mechanism for transient failures or missed HTTP dispatches.
create or replace function private.enqueue_fortal_notification_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.fortalfy_notification_queue(notification_id)
  values (new.id)
  on conflict (notification_id) do update
    set available_at = now(), claimed_at = null;

  perform private.dispatch_fortal_notification_queue();
  return new;
end;
$$;

-- Ensure Supabase Realtime publishes notification inserts and read-state updates.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'fortalfy_notifications'
     ) then
    alter publication supabase_realtime add table public.fortalfy_notifications;
  end if;
end $$;

commit;
