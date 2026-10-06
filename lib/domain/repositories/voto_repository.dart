import 'package:elecciones_jp/domain/entities/voto_entity.dart';

abstract class VotoRepository {
  Future<List<VotoEntity>> findAll();
  Future<int> countByRne(String rne);
  Future<void> insert(VotoEntity voto);
}
