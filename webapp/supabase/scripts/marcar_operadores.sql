-- Marca cuentas ya existentes de Supabase Auth como operador.
-- Se ejecuta en Supabase -> SQL Editor (o con aplicar_sql.mjs).
--
-- Edita solo la lista de correos. NO se usa user_metadata: el rol debe ir en
-- App Metadata firmada por Supabase.
-- Después de ejecutarlo, cada operador debe cerrar sesión y volver a ingresar
-- para que su JWT incluya el nuevo rol.

do $$
declare
  correos text[] := array[
    'saray@jimenezpimentel.edu.pe'
    'sergio@jimenezpimentel.edu.pe',
    'sofia@jimenezpimentel.edu.pe',
    'angel@jimenezpimentel.edu.pe'
  ];
  correo text;
begin
  foreach correo in array correos
  loop
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'operador')
    where lower(email) = lower(trim(correo));
  end loop;
end $$;

-- Verificación: debe mostrar role = operador para los cuatro correos.
select email, raw_app_meta_data ->> 'role' as rol, banned_until
from auth.users
where coalesce(raw_app_meta_data ->> 'role', '') = 'operador'
order by email;
