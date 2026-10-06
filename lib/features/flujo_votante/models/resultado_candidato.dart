/// Fila ya formateada para pintar la pantalla de resultados.
///
/// No es entidad ni DTO: el provider entrega aqui numeros ya calculados y
/// texto listo para mostrar (correlativo, barra y porcentaje con su " %"),
/// porque formatear es una decision de presentacion, no de dominio.
class ResultadoCandidato {
  final String correlativo;
  final String nombre;
  final double progreso;
  final String votos;
  final String porcentaje;

  ResultadoCandidato({
    required this.correlativo,
    required this.nombre,
    required this.progreso,
    required this.votos,
    required this.porcentaje,
  });
}


