#!/usr/bin/env python3
"""Genera un SQL para marcar como votados los alumnos de un padrón .xlsx.

SOLO PARA ENSAYO / REPARACIÓN AUTORIZADA. No lo uses para modificar una
elección real: crea votos en nombre de los estudiantes.

Uso:
  pip install openpyxl
  python supabase/scripts/generar_marcado_ensayo.py "ruta/al/padron.xlsx" \
    -o supabase/scripts/marcar_votos_ensayo.sql

El SQL resultante se pega en Supabase -> SQL Editor -> Run.
"""

from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from pathlib import Path

try:
    import openpyxl
except ImportError:  # pragma: no cover
    sys.exit("Falta openpyxl. Instálalo con: pip install openpyxl")


PREDETERMINADO = r"C:\Users\elias\Downloads\Plantilla Excel Votacion\plantilla-padron.xlsx"
SALIDA = Path(__file__).with_name("marcar_votos_ensayo.sql")

# Orden del kiosco: los tres candidatos reales y el voto en blanco al final.
CANDIDATOS = [
    ("56c5c897-f345-4683-84d3-3febf05a2cd4", "Brian Jael Isuiza Cachique"),
    ("9a627fba-d6de-41a3-b377-78234814f42f", "Dylan Mathws Adriano Satalaya"),
    ("9df15d45-cf1e-4cbb-bbd8-0b5f0750857f", "Abyleny Jahel Java Yzquierdo"),
    ("b1a0c4d2-6f1e-4c8a-9d3f-7e2a5c8b1f04", "Voto en blanco"),
]

ALIAS_DNI = {"dni", "documento", "numerodedocumento", "numdoc", "cedula"}


def normalizar(texto: object) -> str:
    limpio = unicodedata.normalize("NFKD", str(texto or ""))
    limpio = "".join(c for c in limpio if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", limpio.lower())


def normalizar_dni(valor: object) -> str:
    texto = str(valor or "").strip()
    if re.fullmatch(r"\d+(?:\.\d+)?[eE][+-]?\d+", texto):
        numero = float(texto)
        if numero.is_integer():
            texto = str(int(numero))
    texto = re.sub(r"\.0+$", "", texto)
    digitos = re.sub(r"\D", "", texto)
    if 0 < len(digitos) < 8:
        digitos = digitos.zfill(8)
    return digitos


def leer_dnis(ruta: Path) -> tuple[list[str], list[str]]:
    libro = openpyxl.load_workbook(ruta, data_only=True, read_only=True)
    filas = libro.active.iter_rows(values_only=True)
    cabecera = next(filas, ())
    indices = [i for i, valor in enumerate(cabecera) if normalizar(valor) in ALIAS_DNI]
    if not indices:
        sys.exit("No encontré la columna DNI en la primera fila.")
    indice = indices[0]

    validos: set[str] = set()
    omitidos: set[str] = set()
    for fila in filas:
        if indice >= len(fila):
            continue
        dni = normalizar_dni(fila[indice])
        if not dni:
            continue
        if re.fullmatch(r"\d{8}", dni):
            validos.add(dni)
        else:
            omitidos.add(dni)
    return sorted(validos), sorted(omitidos)


def bloque_values(dnis: list[str]) -> str:
    lineas: list[str] = []
    for inicio in range(0, len(dnis), 8):
        grupo = dnis[inicio : inicio + 8]
        lineas.append("    " + ", ".join(f"('{dni}')" for dni in grupo))
    return ",\n".join(lineas) + ";"


def generar_sql(ruta: Path, dnis: list[str], omitidos: list[str]) -> str:
    reparto = ", ".join(
        f"{len(dnis) // len(CANDIDATOS) + (1 if i < len(dnis) % len(CANDIDATOS) else 0)}"
        for i in range(len(CANDIDATOS))
    )
    candidatos_sql = "\n".join(
        f"      when {i} then '{uuid}'::uuid  -- {nombre}"
        for i, (uuid, nombre) in enumerate(CANDIDATOS)
    )
    omitidos_sql = ", ".join(f"'{d}'" for d in omitidos) or "ninguno"

    return f"""-- ============================================================
-- MARCADO MASIVO PARA ENSAYO — generado desde {ruta.name}
-- SOLO PARA PRUEBAS O REPARACIÓN AUTORIZADA.
-- Crea un voto por DNI y lo reparte entre los 4 candidatos.
-- Es idempotente: si se ejecuta dos veces, la segunda no agrega votos.
-- DNI válidos: {len(dnis)} | Reparto: {reparto}
-- Omitidos (no tienen 8 dígitos): {omitidos_sql}
-- CÓMO APLICARLO: Supabase -> SQL Editor -> pegar -> Run.
-- ============================================================

do $$
declare
  v_mesa_id uuid;
  v_marcados int;
  r record;
begin
  select id into v_mesa_id
  from public.mesas
  where activo = true
  order by nombre
  limit 1;

  if v_mesa_id is null then
    raise exception 'No hay una mesa activa. Créala en el panel antes de ejecutar este script.';
  end if;

  create temp table datos_ensayo (dni text);
  insert into datos_ensayo (dni) values
{bloque_values(dnis)}

  create temp table marcados (dni text primary key, candidato_id uuid);

  with validos as (
    select distinct regexp_replace(dni, '\\D', '', 'g') as dni
    from datos_ensayo
    where regexp_replace(dni, '\\D', '', 'g') ~ '^[0-9]{{8}}$'
  ), asignados as (
    select
      dni,
      case (row_number() over (order by dni) - 1) % 4
{candidatos_sql}
      end as candidato_id
    from validos
  ), actualizados as (
    update public.votantes v
       set ha_votado = true
      from asignados a
     where v.dni = a.dni
       and v.ha_votado = false
    returning v.dni
  )
  insert into marcados (dni, candidato_id)
  select act.dni, asg.candidato_id
  from actualizados act
  join asignados asg on asg.dni = act.dni;

  insert into public.votos (candidato_id, mesa_id)
  select m.candidato_id, v_mesa_id
  from marcados m;

  get diagnostics v_marcados = row_count;

  insert into public.auditoria_operador
    (actor_email, rol, accion, entidad, entidad_id, detalle)
  select
    'script-ensayo@local',
    'admin',
    'editar',
    'votante',
    'masivo',
    jsonb_build_object(
      'motivo', 'Marcado masivo para ensayo desde {ruta.name}',
      'total', v_marcados,
      'omitidos', (select count(*) from datos_ensayo
                   where regexp_replace(dni, '\\D', '', 'g') !~ '^[0-9]{{8}}$')
    )
  where v_marcados > 0;

  raise notice 'Marcados % estudiantes como votados (ensayo).', v_marcados;
  for r in
    select c.nombre, count(*) as total
    from marcados m
    join public.candidatos c on c.id = m.candidato_id
    group by c.id, c.nombre
    order by c.nombre
  loop
    raise notice '  %: % voto(s)', r.nombre, r.total;
  end loop;

  drop table marcados;
  drop table datos_ensayo;
end $$;

-- Conteo final que debe coincidir con el panel de Resultados.
select c.nombre, count(v.id) as votos
from public.candidatos c
left join public.votos v on v.candidato_id = c.id
group by c.id, c.nombre
order by votos desc;
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("excel", nargs="?", default=PREDETERMINADO, help="ruta del .xlsx")
    parser.add_argument("-o", "--salida", type=Path, default=SALIDA, help="archivo .sql a generar")
    args = parser.parse_args()

    ruta = Path(args.excel)
    if not ruta.is_file():
        sys.exit(f"No existe el archivo: {ruta}")

    dnis, omitidos = leer_dnis(ruta)
    if not dnis:
        sys.exit("El Excel no tiene DNIs válidos de 8 dígitos.")

    sql = generar_sql(ruta, dnis, omitidos)
    args.salida.write_text(sql, encoding="utf-8")
    print(f"DNIs válidos: {len(dnis)} | Omitidos: {len(omitidos)} -> {args.salida}")


if __name__ == "__main__":
    main()
