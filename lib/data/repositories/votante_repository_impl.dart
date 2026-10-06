import 'package:elecciones_jp/data/models/mappers/votante_mapper.dart';
import 'package:elecciones_jp/domain/entities/votante_entity.dart';
import 'package:elecciones_jp/domain/repositories/votante_repository.dart';
import 'package:elecciones_jp/core/database/database_service.dart';
import 'package:elecciones_jp/shared/utils/rne.dart';
import 'package:sqflite/sqflite.dart';

class VotanteRepositoryImpl implements VotanteRepository {
  Future<Database> get _db => DatabaseService.instance.database;

  @override
  Future<List<VotanteEntity>> findAll() async {
    final db = await _db;
    final maps = await db.query('votantes', orderBy: 'nombre ASC');
    return maps.map(VotanteMapper.fromMap).toList();
  }

  @override
  Future<VotanteEntity?> findByRne(String rne) async {
    final String? rneNormalizado = Rne.normalizar(rne);
    if (rneNormalizado == null) return null;
    final db = await _db;
    final maps = await db.query(
      'votantes',
      where: 'rne = ?',
      whereArgs: [rneNormalizado],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return VotanteMapper.fromMap(maps.first);
  }

  @override
  Future<int> countValid() async {
    final db = await _db;
    final maps = await db.rawQuery(
      'SELECT COUNT(*) AS total FROM votantes WHERE rne IS NOT NULL',
    );
    return (maps.first['total'] as int?) ?? 0;
  }

  @override
  Future<void> insert(VotanteEntity votante) async {
    final db = await _db;
    final map = VotanteMapper.toMap(votante)..remove('id');
    await db.insert('votantes', map);
  }

  @override
  Future<void> update(VotanteEntity votante) async {
    final db = await _db;
    final map = VotanteMapper.toMap(votante)..remove('id');
    await db.update(
      'votantes',
      map,
      where: 'id = ?',
      whereArgs: [votante.id],
    );
  }

  @override
  Future<void> delete(int id) async {
    final db = await _db;
    await db.delete('votantes', where: 'id = ?', whereArgs: [id]);
  }

  @override
  Future<void> deleteMany(List<int> ids) async {
    final db = await _db;
    final batch = db.batch();
    for (final id in ids) {
      batch.delete('votantes', where: 'id = ?', whereArgs: [id]);
    }
    await batch.commit(noResult: true);
  }

  @override
  Future<int> insertMany(List<VotanteEntity> votantes) async {
    final db = await _db;
    final batch = db.batch();

    for (final votante in votantes) {
      batch.insert(
        'votantes',
        VotanteMapper.toMap(votante)..remove('id'),
        conflictAlgorithm: ConflictAlgorithm.ignore,
      );
    }

    final results = await batch.commit();
    return results.where((r) => (r as int? ?? 0) > 0).length;
  }
}
