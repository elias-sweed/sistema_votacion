/// Fila de un Excel de padron, tal como llega de la hoja de calculo.
///
/// No es la entidad de dominio: conserva las tres columnas tal cual vienen
/// (`DNI`, `nombres`, `apellidos`) para que el parseo sea puro y la
/// normalizacion a `VotanteEntity` ocurra despues, en un unico sitio.
class VotanteExcelRow {
  final String dni;
  final String nombres;
  final String apellidos;

  VotanteExcelRow({
    required this.dni,
    required this.nombres,
    required this.apellidos,
  });
}
