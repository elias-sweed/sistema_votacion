/*
 * Modelo para representar una fila en la tabla de resultados.
 */
class ResultadoCandidato {
  final String correlativo; // El "No"
  final String nombre;
  final double progreso; // El valor 0.0-1.0 para la barra de progreso
  final String votos;
  final String porcentaje; // El " %"

  ResultadoCandidato({
    required this.correlativo,
    required this.nombre,
    required this.progreso,
    required this.votos,
    required this.porcentaje,
  });
}