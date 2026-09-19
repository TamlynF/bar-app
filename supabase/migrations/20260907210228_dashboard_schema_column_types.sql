create or replace function public.dashboard_schema()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object('tables', jsonb_object_agg(t.table_name, jsonb_build_object(
    'kind', t.table_type,
    'columns', (select jsonb_agg(c.column_name order by c.ordinal_position)
                from information_schema.columns c
                where c.table_schema = 'public' and c.table_name = t.table_name),
    'types', (select jsonb_object_agg(c.column_name, c.udt_name)
              from information_schema.columns c
              where c.table_schema = 'public' and c.table_name = t.table_name),
    'pk', (select kcu.column_name
           from information_schema.table_constraints tc
           join information_schema.key_column_usage kcu
             on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
           where tc.table_schema = 'public' and tc.table_name = t.table_name and tc.constraint_type = 'PRIMARY KEY'
           order by kcu.ordinal_position limit 1),
    'fks', coalesce((select jsonb_object_agg(kcu.column_name, ccu.table_name)
                     from information_schema.table_constraints tc
                     join information_schema.key_column_usage kcu
                       on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
                     join information_schema.constraint_column_usage ccu
                       on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
                     where tc.table_schema = 'public' and tc.table_name = t.table_name
                       and tc.constraint_type = 'FOREIGN KEY' and ccu.table_schema = 'public'), '{}'::jsonb)
  )))
  from information_schema.tables t
  where t.table_schema = 'public' and t.table_type in ('BASE TABLE', 'VIEW');
$function$;
