import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseService {
  static final DatabaseService instance = DatabaseService._init();
  static Database? _database;
  DatabaseService._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('elecciones.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    // ----- CAMBIO AQUÍ -----
    // 1. Cambiamos la versión a 2
    // 2. Añadimos la función onUpgrade
    return await openDatabase(
      path,
      version: 2, // <-- CAMBIADO DE 1 A 2
      onCreate: _createDB,
      onUpgrade: _onUpgrade, // <-- FUNCIÓN NUEVA AÑADIDA
    );
  }

  // Esta función se ejecuta si la BD no existe (la primera vez)
  Future _createDB(Database db, int version) async {
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

    // También lo dejamos aquí por si es una instalación 100% nueva
    await db.execute('''
    CREATE TABLE admin (
      id INTEGER PRIMARY KEY DEFAULT 1,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
    ''');
  }

  // ----- FUNCIÓN NUEVA AÑADIDA -----
  // Esta función se ejecuta si la BD ya existe pero la versión es antigua
  Future _onUpgrade(Database db, int oldVersion, int newVersion) async {
    // Si la versión antigua es 1, significa que no tiene la tabla 'admin'.
    if (oldVersion < 2) {
      await db.execute('''
      CREATE TABLE admin (
        id INTEGER PRIMARY KEY DEFAULT 1,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      )
      ''');
    }
  }
  // ---------------------------------

  Future close() async {
    final db = await instance.database;
    db.close();
  }
}