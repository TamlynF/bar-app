create or replace function public.dashboard_schema()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
with tbl as (
  select c.oid, c.relname as table_name,
         case c.relkind when 'v' then 'VIEW' when 'm' then 'VIEW' else 'BASE TABLE' end as kind,
         c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
         obj_description(c.oid, 'pg_class') as comment,
         (select n_live_tup from pg_stat_user_tables s where s.relid = c.oid) as live_rows,
         case when c.relkind in ('v','m') then pg_get_viewdef(c.oid, true) end as view_definition
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p','v','m')
),
mig as (
  select version, name, lower(array_to_string(statements, ' ')) as body
  from supabase_migrations.schema_migrations
  where statements is not null and array_length(statements, 1) > 0
),
pk as (
  select con.conrelid, unnest(con.conkey) as attnum from pg_constraint con where con.contype = 'p'
),
uq as (
  select con.conrelid, unnest(con.conkey) as attnum from pg_constraint con where con.contype = 'u'
),
fk as (
  select con.conrelid, con.conname, con.confrelid, ck.attnum, cf.attnum as ref_attnum,
         case con.confdeltype when 'a' then 'NO ACTION' when 'r' then 'RESTRICT' when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' end as on_delete,
         case con.confupdtype when 'a' then 'NO ACTION' when 'r' then 'RESTRICT' when 'c' then 'CASCADE' when 'n' then 'SET NULL' when 'd' then 'SET DEFAULT' end as on_update
  from pg_constraint con
  cross join lateral unnest(con.conkey) with ordinality as ck(attnum, ord)
  join lateral unnest(con.confkey) with ordinality as cf(attnum, ord) on cf.ord = ck.ord
  where con.contype = 'f'
),
chk as (
  select con.conrelid, unnest(con.conkey) as attnum, con.conname, pg_get_constraintdef(con.oid) as def
  from pg_constraint con where con.contype = 'c'
),
cols as (
  select a.attrelid, a.attnum, a.attname, t.table_name,
         format_type(a.atttypid, a.atttypmod) as data_type,
         (select typ.typname from pg_type typ where typ.oid = a.atttypid) as udt,
         not a.attnotnull as nullable,
         pg_get_expr(d.adbin, d.adrelid) as default_expr,
         case a.attidentity when 'a' then 'ALWAYS' when 'd' then 'BY DEFAULT' end as identity,
         case a.attgenerated when 's' then 'STORED' end as generated,
         col_description(a.attrelid, a.attnum) as comment,
         exists(select 1 from pk where pk.conrelid = a.attrelid and pk.attnum = a.attnum) as is_pk,
         exists(select 1 from uq where uq.conrelid = a.attrelid and uq.attnum = a.attnum) as is_unique
  from pg_attribute a
  join tbl t on t.oid = a.attrelid
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attnum > 0 and not a.attisdropped
)
select jsonb_build_object(
  'generated_at', now(),
  'roles', (select jsonb_agg(jsonb_build_object('name', r.rolname, 'login', r.rolcanlogin, 'superuser', r.rolsuper, 'bypass_rls', r.rolbypassrls, 'inherit', r.rolinherit,
              'member_of', (select coalesce(jsonb_agg(g.rolname), '[]'::jsonb) from pg_auth_members m join pg_roles g on g.oid = m.roleid where m.member = r.oid)) order by r.rolname)
            from pg_roles r where r.rolname in ('anon','authenticated','service_role','authenticator','postgres','supabase_admin','supabase_auth_admin','supabase_storage_admin','dashboard_user')),
  'migrations', (select jsonb_agg(jsonb_build_object('version', version, 'name', name, 'has_statements', statements is not null and array_length(statements,1) > 0) order by version) from supabase_migrations.schema_migrations),
  'tables', (select jsonb_object_agg(t.table_name, jsonb_build_object(
    'kind', t.kind,
    'comment', t.comment,
    'rls_enabled', t.rls_enabled,
    'rls_forced', t.rls_forced,
    'live_rows', t.live_rows,
    'view_definition', t.view_definition,
    'created_in', (select jsonb_build_object('version', m.version, 'name', m.name) from mig m
                   where m.body ~ ('create\s+(or\s+replace\s+)?(table|view|materialized\s+view)\s+(if\s+not\s+exists\s+)?("?public"?\.)?"?' || t.table_name || '"?[\s(]') order by m.version limit 1),
    'columns', (select jsonb_agg(jsonb_build_object(
        'name', c.attname, 'position', c.attnum, 'type', c.data_type, 'udt', c.udt, 'nullable', c.nullable, 'default', c.default_expr,
        'identity', c.identity, 'generated', c.generated, 'comment', c.comment, 'is_pk', c.is_pk, 'is_unique', c.is_unique,
        'fk', (select jsonb_build_object('constraint', f.conname, 'table', rt.relname, 'column', ra.attname, 'on_delete', f.on_delete, 'on_update', f.on_update)
               from fk f join pg_class rt on rt.oid = f.confrelid join pg_attribute ra on ra.attrelid = f.confrelid and ra.attnum = f.ref_attnum
               where f.conrelid = c.attrelid and f.attnum = c.attnum limit 1),
        'referenced_by', (select coalesce(jsonb_agg(jsonb_build_object('table', st.relname, 'column', sa.attname, 'constraint', f.conname) order by st.relname, sa.attname), '[]'::jsonb)
               from fk f join pg_class st on st.oid = f.conrelid join pg_attribute sa on sa.attrelid = f.conrelid and sa.attnum = f.attnum
               where f.confrelid = c.attrelid and f.ref_attnum = c.attnum),
        'checks', (select coalesce(jsonb_agg(jsonb_build_object('name', k.conname, 'definition', k.def)), '[]'::jsonb) from chk k where k.conrelid = c.attrelid and k.attnum = c.attnum),
        'created_in', (select jsonb_build_object('version', m.version, 'name', m.name) from mig m
                       where m.body ~ ('create\s+(or\s+replace\s+)?(table|view)\s+(if\s+not\s+exists\s+)?("?public"?\.)?"?' || t.table_name || '"?[\s(]')
                          or m.body ~ ('alter\s+table\s+(if\s+exists\s+)?(only\s+)?("?public"?\.)?"?' || t.table_name || '"?[^;]*add\s+(column\s+)?(if\s+not\s+exists\s+)?"?' || c.attname || '"?[\s,]')
                       order by m.version limit 1)
      ) order by c.attnum) from cols c where c.attrelid = t.oid),
    'constraints', (select coalesce(jsonb_agg(jsonb_build_object('name', con.conname, 'type', case con.contype when 'p' then 'PRIMARY KEY' when 'f' then 'FOREIGN KEY' when 'u' then 'UNIQUE' when 'c' then 'CHECK' when 'x' then 'EXCLUDE' end, 'definition', pg_get_constraintdef(con.oid)) order by con.contype, con.conname), '[]'::jsonb)
                    from pg_constraint con where con.conrelid = t.oid),
    'indexes', (select coalesce(jsonb_agg(jsonb_build_object('name', ic.relname, 'unique', ix.indisunique, 'primary', ix.indisprimary, 'definition', pg_get_indexdef(ix.indexrelid)) order by ic.relname), '[]'::jsonb)
                from pg_index ix join pg_class ic on ic.oid = ix.indexrelid where ix.indrelid = t.oid),
    'policies', (select coalesce(jsonb_agg(jsonb_build_object('name', p.policyname, 'command', p.cmd, 'permissive', p.permissive, 'roles', to_jsonb(p.roles), 'using', p.qual, 'with_check', p.with_check) order by p.policyname), '[]'::jsonb)
                 from pg_policies p where p.schemaname = 'public' and p.tablename = t.table_name),
    'grants', (select coalesce(jsonb_object_agg(g.grantee, g.privs), '{}'::jsonb) from (
                 select grantee, jsonb_agg(privilege_type order by privilege_type) as privs
                 from information_schema.role_table_grants
                 where table_schema = 'public' and table_name = t.table_name and grantee in ('anon','authenticated','service_role','postgres','authenticator')
                 group by grantee) g),
    'triggers', (select coalesce(jsonb_agg(jsonb_build_object('name', tg.tgname, 'definition', pg_get_triggerdef(tg.oid)) order by tg.tgname), '[]'::jsonb)
                 from pg_trigger tg where tg.tgrelid = t.oid and not tg.tgisinternal),
    'types', (select jsonb_object_agg(c.attname, c.udt) from cols c where c.attrelid = t.oid),
    'pk', (select c.attname from cols c where c.attrelid = t.oid and c.is_pk order by c.attnum limit 1),
    'fks', (select coalesce(jsonb_object_agg(sa.attname, rt.relname), '{}'::jsonb)
            from fk f join pg_attribute sa on sa.attrelid = f.conrelid and sa.attnum = f.attnum join pg_class rt on rt.oid = f.confrelid
            where f.conrelid = t.oid)
  )) from tbl t)
);
$function$;
