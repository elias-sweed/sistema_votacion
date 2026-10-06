import 'package:elecciones_jp/domain/repositories/mantenimiento_repository.dart';
import 'package:elecciones_jp/shared/services/database_service.dart';
import 'package:sqflite/sqflite.dart';

class MantenimientoRepositoryImpl implements MantenimientoRepository {
  Future<Database> get _db => DatabaseService.instance.database;

  @override
  Future<Map<String, int>> counts() async {
    final db = await _db;
    final centro = Sqflite.firstIntValue(
            await db.rawQuery('SELECT COUNT(*) FROM centro')) ??
        0;
    final candidatos = Sqflite.firstIntValue(
            await db.rawQuery('SELECT COUNT(*) FROM candidatos')) ??
        0;
    final votantes = Sqflite.firstIntValue(
            await db.rawQuery('SELECT COUNT(*) FROM votantes')) ??
        0;
    final votos = Sqflite.firstIntValue(
            await db.rawQuery('SELECT COUNT(*) FROM votos')) ??
        0;
    return {
      'centro': centro,
      'candidatos': candidatos,
      'votantes': votantes,
      'votos': votos,
    };
  }

  @override
  Future<void> borrarCentro() async {
    final db = await _db;
    await db.delete('centro');
  }

  @override
  Future<bool> borrarCandidatos() async {
    final db = await _db;
    final int conVotos = Sqflite.firstIntValue(await db.rawQuery(
            'SELECT COUNT(DISTINCT codigo_candidato) FROM votos WHERE codigo_candidato IS NOT NULL')) ??
        0;
    if (conVotos > 0) {
      return false;
    }
    await db.delete('candidatos');
    return true;
  }

  @override
  Future<void> borrarElectores() async {
    final db = await _db;
    await db.delete('votantes');
  }

  @override
  Future<void> borrarResultados() async {
    final db = await _db;
    final batch = db.batch();
    batch.delete('votos');
    batch.update('votantes', {'voto': 0}, where: 'voto = 1');
    batch.update('candidatos', {'votos': 0}, where: 'votos > 0');
    await batch.commit(noResult: true);
  }

  @override
  Future<void> borrarTodo() async {
    final db = await _db;
    final batch = db.batch();
    batch.delete('votos');
    batch.delete('candidatos');
    batch.delete('votantes');
    batch.delete('centro');
    await batch.commit(noResult: true);
  }
}
