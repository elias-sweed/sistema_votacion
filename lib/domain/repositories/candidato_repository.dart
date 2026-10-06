import 'package:elecciones_jp/domain/entities/candidato_entity.dart';

abstract class CandidatoRepository {
  Future<List<CandidatoEntity>> findAll();
  Future<CandidatoEntity?> findByName(String nombre);
  Future<List<CandidatoEntity>> findAllWithVotes();
  Future<void> insert(CandidatoEntity candidato);
  Future<void> update(CandidatoEntity candidato);
  Future<void> delete(int codigo);
}
