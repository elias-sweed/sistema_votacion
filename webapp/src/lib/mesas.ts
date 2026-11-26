/** Genera los nombres de mesa para una combinación de grados y secciones. */
export function nombresMesasGrupo(
  grados: readonly string[],
  secciones: readonly string[]
): string[] {
  const gradosUnicos = [...new Set(grados.map((valor) => valor.trim()).filter(Boolean))]
  const seccionesUnicas = [...new Set(secciones.map((valor) => valor.trim()).filter(Boolean))]

  return gradosUnicos.flatMap((grado) =>
    seccionesUnicas.map((seccion) => `${grado} ${seccion}`)
  )
}
