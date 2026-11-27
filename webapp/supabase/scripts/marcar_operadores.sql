-- Marca cuentas ya existentes de Supabase Auth como operador.
-- Se ejecuta en Supabase -> SQL Editor (o con aplicar_sql.mjs).
--
-- Edita solo la lista de correos. NO se usa user_metadata: el rol debe ir en
-- App Metadata firmada por Supabase.
-- Cada cuenta marcada genera un movimiento "alta de operador" en la auditoría.
-- El script es idempotente: volver a ejecutarlo no duplica esos movimientos.
-- Después de ejecutarlo, cada operador debe cerrar sesión y volver a ingresar
-- para que su JWT incluya el nuevo rol.

do $$
declare
  correos text[] := array[
    'angel@jimenezpimentel.edu.pe',
    'saray@jimenezpimentel.edu.pe',
    'sergio@jimenezpimentel.edu.pe',
    'sofia@jimenezpimentel.edu.pe'
  ];
  correo text;
  v_id uuid;
begin
  foreach correo in array correos
  loop
    select u.id into v_id
    from auth.users u
    where lower(u.email) = lower(trim(correo));

    if v_id is null then
      raise notice 'No se encontró la cuenta: %', correo;
      continue;
    end if;

    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'operador')
    where id = v_id;

    insert into public.auditoria_operador
      (actor_uuid, actor_email, rol, accion, entidad, entidad_id, detalle)
    select
      '1fbf5137-09fa-404f-8232-e21788a047f8'::uuid,
      'votacion@jimenezpimentel.edu.pe',
      'admin',
      'alta',
      'operador',
      v_id::text,
      jsonb_build_object('email', lower(trim(correo)))
    where not exists (
      select 1
      from public.auditoria_operador a
      where a.entidad = 'operador'
        and a.accion = 'alta'
        and a.entidad_id = v_id::text
    );
  end loop;
end $$;

-- Verificación 1: debe mostrar role = operador para los cuatro correos.
select email, raw_app_meta_data ->> 'role' as rol, banned_until
from auth.users
where coalesce(raw_app_meta_data ->> 'role', '') = 'operador'
order by email;

-- Verificación 2: debe devolver 4 (una alta por cada operador).
select count(*) as filas_auditoria
from public.auditoria_operador
where entidad = 'operador' and accion = 'alta';
