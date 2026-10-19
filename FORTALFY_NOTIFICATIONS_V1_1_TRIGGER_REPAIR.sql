-- Fortalfy notifications: repair only the two existing order status triggers.
-- Safe to re-run. Preserves all rows and other triggers/functions.
-- Run after FORTALFY_NOTIFICATIONS_V1.sql.

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
    if v_table is null then
      raise exception 'Required table public.% is missing; no trigger was changed', r.table_name;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.table_name and column_name = 'status'
    ) then
      raise exception 'Required column public.%.status is missing; no trigger was changed', r.table_name;
    end if;

    v_function := to_regprocedure(format('private.%I()', r.function_name));
    if v_function is null then
      raise exception 'Required function private.%() is missing; no trigger was changed', r.function_name;
    end if;

    v_trigger_name := format('fortalfy_notify_%s_status', replace(r.table_name, '_orders', '_order'));
    select t.oid, lower(pg_get_triggerdef(t.oid))
      into v_trigger_oid, v_definition
    from pg_trigger t
    where t.tgrelid = v_table and t.tgname = v_trigger_name and not t.tgisinternal;

    if v_trigger_oid is not null
       and v_definition like '%when (old.status is distinct from new.status)%'
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
