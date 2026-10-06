import 'package:elecciones_jp/domain/entities/centro_entity.dart';

abstract class CentroRepository {
  Future<CentroEntity?> findOne();
  Future<void> update(CentroEntity centro);
}
