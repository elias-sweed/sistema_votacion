import 'package:elecciones_jp/domain/entities/votante_entity.dart';

abstract class VotanteRepository {
  Future<List<VotanteEntity>> findAll();
  Future<VotanteEntity?> findByRne(String rne);
  Future<int> countValid();
  Future<void> insert(VotanteEntity votante);
  Future<void> update(VotanteEntity votante);
  Future<void> delete(int id);
  Future<void> deleteMany(List<int> ids);
  Future<int> insertMany(List<VotanteEntity> votantes);
}
