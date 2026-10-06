import 'package:elecciones_jp/domain/entities/voto_entity.dart';

abstract class VotoRepository {
  Future<List<VotoEntity>> findAll();
  Future<int> countByRne(String rne);
  Future<int> countByCodigoCandidato(int codigoCandidato);
  Future<int> countAll();
  Future<void> registrarVoto({
    required String rne,
    required int? codigoCandidato,
    required DateTime fecha,
  });
  Future<void> insert(VotoEntity voto);
}
