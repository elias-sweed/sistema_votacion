import 'package:elecciones_jp/core/database/migrations/database_migrator.dart';
import 'package:elecciones_jp/core/database/database_paths.dart';
import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';

class DatabaseService {
  static final DatabaseService instance = DatabaseService._init();
  static Database? _database;
  DatabaseService._init();

  static const String _nombreArchivo = 'elecciones.db';
  static const int _version = 4;

  /// Marca de los votos sinteticos que preservan los totales anteriores a la
  /// bitacora, donde cada elector solo era un contador.
  @visibleForTesting
  static String? get debugLegacyDirectory => DatabasePaths.debugLegacyDirectory;
  static set debugLegacyDirectory(String? value) =>
      DatabasePaths.debugLegacyDirectory = value;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB(_nombreArchivo);
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final String ruta = await DatabasePaths.resolverRuta(filePath);
    return openDatabase(
      ruta,
      version: _version,
      onCreate: _createDB,
      onUpgrade: DatabaseMigrator.upgrade,
      onConfigure: (Database db) async {
        await db.execute('PRAGMA foreign_keys = ON');
      },
    );
  }

  /// Crea el esquema completo en una instalacion nueva.
  Future<void> _createDB(Database db, int version) async {
    await db.execute('''
    CREATE TABLE candidatos (
      codigo INTEGER PRIMARY KEY AUTOINCREMENT,
      numero INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      imagen TEXT NOT NULL,
      votos INTEGER DEFAULT 0
    )
    ''');

    await db.execute('''
    CREATE TABLE votantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rne TEXT UNIQUE,
      nombre TEXT NOT NULL,
      voto INTEGER DEFAULT 0
    )
    ''');

    await db.execute('''
    CREATE TABLE centro (
      id INTEGER PRIMARY KEY DEFAULT 1,
      nombre TEXT,
      logoPath TEXT
    )
    ''');

    await DatabaseMigrator.crearTablaAdmin(db);
    await DatabaseMigrator.crearTablaVotos(db);
  }

  Future<void> close() async {
    final Database? db = _database;
    if (db == null) return;
    await db.close();
    _database = null;
  }
}
