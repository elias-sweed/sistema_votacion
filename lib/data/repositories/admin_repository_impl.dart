import 'package:elecciones_jp/domain/repositories/admin_repository.dart';
import 'package:elecciones_jp/core/database/database_service.dart';
import 'package:sqflite/sqflite.dart';

class AdminRepositoryImpl implements AdminRepository {
  Future<Database> get _db => DatabaseService.instance.database;

  @override
  Future<int> count() async {
    final db = await _db;
    final maps = await db.rawQuery('SELECT COUNT(*) AS count FROM admin');
    return (maps.first['count'] as int?) ?? 0;
  }

  @override
  Future<Map<String, dynamic>?> findByUsername(String username) async {
    final db = await _db;
    final maps = await db.query(
      'admin',
      where: 'username = ?',
      whereArgs: [username],
      limit: 1,
    );
    if (maps.isEmpty) return null;
    return maps.first;
  }

  @override
  Future<void> insert(Map<String, dynamic> data) async {
    final db = await _db;
    await db.insert('admin', data, conflictAlgorithm: ConflictAlgorithm.fail);
  }

  @override
  Future<void> updatePassword(int id, Map<String, dynamic> data) async {
    final db = await _db;
    await db.update('admin', data, where: 'id = ?', whereArgs: [id]);
  }
}
