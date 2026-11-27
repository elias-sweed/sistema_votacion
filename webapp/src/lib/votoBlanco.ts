import imagenVotoBlanco from '../assets/boto_blanco.png'

/**
 * Opción reservada "Voto en blanco". Se crea en la migración 019 con este ID
 * fijo para que siempre esté disponible en el kiosco sin tener que darla de
 * alta a mano. El panel la oculta: no se puede editar ni eliminar desde ahí.
 */
export const ID_VOTO_BLANCO = 'b1a0c4d2-6f1e-4c8a-9d3f-7e2a5c8b1f04'
export const NOMBRE_VOTO_BLANCO = 'Voto en blanco'
export const IMAGEN_VOTO_BLANCO = imagenVotoBlanco

export function esVotoBlanco(id: string | null | undefined): boolean {
  return id === ID_VOTO_BLANCO
}

/** Coloca el voto en blanco al final, después de los candidatos reales. */
export function ordenarOpciones<T extends { id: string }>(opciones: T[]): T[] {
  return [...opciones].sort((a, b) => {
    if (esVotoBlanco(a.id)) return esVotoBlanco(b.id) ? 0 : 1
    if (esVotoBlanco(b.id)) return -1
    return 0
  })
}
