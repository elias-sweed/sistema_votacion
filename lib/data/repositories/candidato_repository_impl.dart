import 'package:elecciones_jp/data/models/mappers/candidato_mapper.dart';
import 'package:elecciones_jp/domain/entities/candidato_entity.dart';
import 'package:elecciones_jp/domain/repositories/candidato_repository.dart';
import 'package:elecciones_jp/shared/services/database_service.dart';
import 'package:sqflite/sqflite.dart';

class CandidatoRepositoryImpl implements CandidatoRepository {
  Future<Database> get _db => DatabaseService.instance.database;

  @override
  Future<List<CandidatoEntity>> findAll() async {
    final db = await _db;
    final maps = await db.query('candidatos', orderBy: 'numero ASC');
    return maps.map(CandidatoMapper.fromMap).toList();
  }

  @override
  Future<CandidatoEntity?> findByName(String nombre) async {
    final db = await _db;
    final maps = await db.query(
      'candidatos',
      where: 'nombre = ?',
      whereArgs: [nombre],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return CandidatoMapper.fromMap(maps.first);
  }

  @override
  Future<List<CandidatoEntity>> findAllWithVotes() async {
    final db = await _db;
    final maps = await db.rawQuery('''
      SELECT c.codigo, c.numero, c.nombre, c.imagen,
             (SELECT COUNT(*) FROM votos v
               WHERE v.codigo_candidato = c.codigo) AS votos
      FROM candidatos c
      ORDER BY c.numero
    ''');
    return maps.map(CandidatoMapper.fromMap).toList();
  }

  @override
  Future<void> insert(CandidatoEntity candidato) async {
    final db = await _db;
    final map = CandidatoMapper.toMap(candidato)..remove('codigo');
    await db.insert('candidatos', map);
  }

  @override
  Future<void> update(CandidatoEntity candidato) async {
    final db = await _db;
    final map = CandidatoMapper.toMap(candidato)..remove('codigo');
    await db.update(
      'candidatos',
      map,
      where: 'codigo = ?',
      whereArgs: [candidato.codigo],
    );
  }

  @override
  Future<void> delete(int codigo) async {
    final db = await _db;
    await db.delete('candidatos', where: 'codigo = ?', whereArgs: [codigo]);
  }
}
