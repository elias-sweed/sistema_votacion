abstract class MantenimientoRepository {
  Future<Map<String, int>> counts();
  Future<void> borrarCentro();
  Future<bool> borrarCandidatos();
  Future<void> borrarElectores();
  Future<void> borrarResultados();
  Future<void> borrarTodo();
}
