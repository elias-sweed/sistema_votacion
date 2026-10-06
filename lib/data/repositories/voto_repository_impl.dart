import 'package:elecciones_jp/data/models/mappers/voto_mapper.dart';
import 'package:elecciones_jp/domain/entities/voto_entity.dart';
import 'package:elecciones_jp/domain/repositories/voto_repository.dart';
import 'package:elecciones_jp/core/database/database_service.dart';
import 'package:elecciones_jp/shared/utils/rne.dart';
import 'package:sqflite/sqflite.dart';

class VotoRepositoryImpl implements VotoRepository {
  Future<Database> get _db => DatabaseService.instance.database;

  @override
  Future<List<VotoEntity>> findAll() async {
    final db = await _db;
    final maps = await db.query('votos', orderBy: 'id ASC');
    return maps.map(VotoMapper.fromMap).toList();
  }

  @override
  Future<int> countByRne(String rne) async {
    final String? rneNormalizado = Rne.normalizar(rne);
    if (rneNormalizado == null) return 0;
    final db = await _db;
    final maps = await db.rawQuery(
      'SELECT COUNT(*) AS total FROM votos WHERE rne = ?',
      [rneNormalizado],
    );
    return (maps.first['total'] as int?) ?? 0;
  }

  @override
  Future<int> countByCodigoCandidato(int codigoCandidato) async {
    final db = await _db;
    final maps = await db.rawQuery(
      'SELECT COUNT(*) AS total FROM votos WHERE codigo_candidato = ?',
      [codigoCandidato],
    );
    return (maps.first['total'] as int?) ?? 0;
  }

  @override
  Future<int> countAll() async {
    final db = await _db;
    final maps = await db.rawQuery('SELECT COUNT(*) AS total FROM votos');
    return (maps.first['total'] as int?) ?? 0;
  }

  @override
  Future<void> registrarVoto({
    required String rne,
    required int? codigoCandidato,
    required DateTime fecha,
  }) async {
    final db = await _db;
    await db.transaction((txn) async {
      await txn.insert('votos', {
        'rne': rne,
        'codigo_candidato': codigoCandidato,
        'fecha': fecha.toIso8601String(),
      });

      await txn.update(
        'votantes',
        {'voto': 1},
        where: 'rne = ?',
        whereArgs: [rne],
      );
    });
  }

  @override
  Future<void> insert(VotoEntity voto) async {
    final db = await _db;
    final map = VotoMapper.toMap(voto)..remove('id');
    await db.insert('votos', map);
  }
}
