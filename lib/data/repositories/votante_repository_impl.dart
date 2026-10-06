import 'package:elecciones_jp/data/models/mappers/votante_mapper.dart';
import 'package:elecciones_jp/domain/entities/votante_entity.dart';
import 'package:elecciones_jp/domain/repositories/votante_repository.dart';
import 'package:elecciones_jp/shared/services/database_service.dart';
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
}
