import 'package:elecciones_jp/data/models/mappers/centro_mapper.dart';
import 'package:elecciones_jp/domain/entities/centro_entity.dart';
import 'package:elecciones_jp/domain/repositories/centro_repository.dart';
import 'package:elecciones_jp/shared/services/database_service.dart';
import 'package:sqflite/sqflite.dart';

class CentroRepositoryImpl implements CentroRepository {
  Future<Database> get _db => DatabaseService.instance.database;

  @override
  Future<CentroEntity?> findOne() async {
    final db = await _db;
    final maps = await db.query('centro', limit: 1);
    if (maps.isEmpty) return null;
    return CentroMapper.fromMap(maps.first);
  }

  @override
  Future<void> update(CentroEntity centro) async {
    final db = await _db;
    final map = CentroMapper.toMap(centro)..remove('id');
    final int affected = await db.update(
      'centro',
      map,
      where: 'id = ?',
      whereArgs: [centro.id],
    );
    if (affected == 0) {
      await db.insert('centro', CentroMapper.toMap(centro));
    }
  }
}
