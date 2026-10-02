import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

class DatabaseService {
  static final DatabaseService instance = DatabaseService._init();
  static Database? _database;
  DatabaseService._init();

  static const String _nombreArchivo = 'elecciones.db';
  static const int _version = 3;

  /// Directorio desde el que se intenta recuperar una base de la version 2.
  /// Los tests lo sustituyen por una carpeta temporal para no tocar la base
  /// real del proyecto.
  @visibleForTesting
  static String? debugLegacyDirectory;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB(_nombreArchivo);
    return _database!;
  }

  /// Ruta estable de la base de datos.
  ///
  /// Antes se usaba `getDatabasesPath()` de sqflite, que en escritorio
  /// resuelve a `.dart_tool/sqflite_common_ffi/databases` relativo al
  /// directorio de trabajo. Eso hacia que un `flutter clean` borrara el
  /// padron y todos los votos, y que ejecutar la app desde otro
  /// directorio creara una base vacia. Ahora vive en el directorio de
  /// soporte de la aplicacion.
  Future<String> _resolverRuta(String filePath) async {
    final Directory dirSoporte = await getApplicationSupportDirectory();
    final String rutaNueva = p.join(dirSoporte.path, filePath);

    if (await File(rutaNueva).exists()) {
      return rutaNueva;
    }

    await dirSoporte.create(recursive: true);

    // Migracion desde la ubicacion anterior (.dart_tool/...).
    final String rutaLegacy = p.join(await _directorioLegacy(), filePath);
    final File archivoLegacy = File(rutaLegacy);
    try {
      if (await archivoLegacy.exists()) {
        await archivoLegacy.copy(rutaNueva);
      }
    } catch (_) {
      // Si no se puede leer la ruta anterior, se crea la base nueva.
    }

    return rutaNueva;
  }

  Future<String> _directorioLegacy() async {
    final String? override = debugLegacyDirectory;
    if (override != null) return override;
    try {
      return await getDatabasesPath();
    } catch (_) {
      return p.join(Directory.current.path, '.dart_tool',
          'sqflite_common_ffi', 'databases');
    }
  }

  Future<Database> _initDB(String filePath) async {
    final String ruta = await _resolverRuta(filePath);
    return openDatabase(
      ruta,
      version: _version,
      onCreate: _createDB,
      onUpgrade: _onUpgrade,
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

    await _crearTablaAdmin(db);
    await _crearTablaVotos(db);
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await _crearTablaAdmin(db);
    }

    if (oldVersion < 3) {
      await _crearTablaAdmin(db);
      await _migrarEsquemaAdmin(db);
      await _crearTablaVotos(db);
      await _migrarContadoresLegacy(db);
    }
  }

  /// Ajusta la tabla `admin` de una instalacion existente al esquema v3.
  ///
  /// Hace falta porque en v2 la tabla ya existe y `CREATE TABLE IF NOT
  /// EXISTS` no la modifica: sin esto, las columnas del hash nunca se
  /// crearian y las credenciales seguirian en texto plano.
  Future<void> _migrarEsquemaAdmin(Database db) async {
    List<Map<String, dynamic>> info = await db.rawQuery('PRAGMA table_info(admin)');

    // v2 declaraba `password TEXT NOT NULL`, lo que impide vaciar la
    // columna para eliminar la contraseña en claro. Se reconstruye la tabla
    // con el esquema v3, copiando el usuario y su contraseña actual para que
    // el inicio de sesión siga funcionando y pueda migrarse al hash.
    final bool passwordEsNotNull = info.any(
        (c) => c['name'] == 'password' && (c['notnull'] as int? ?? 0) == 1);

    if (passwordEsNotNull) {
      await db.execute('ALTER TABLE admin RENAME TO admin_v2');
      await _crearTablaAdmin(db);
      await db.execute('''
        INSERT INTO admin (id, username, password)
        SELECT id, username, password FROM admin_v2
      ''');
      await db.execute('DROP TABLE admin_v2');
      info = await db.rawQuery('PRAGMA table_info(admin)');
    }

    final Set<String> existentes =
        info.map((c) => c['name'] as String).toSet();

    // Cualquier columna que todavia falte se agrega. SQLite no admite
    // `ADD COLUMN IF NOT EXISTS`, de ahi la comprobacion previa.
    for (final Map<String, String> columna in const [
      {'nombre': 'password', 'tipo': 'TEXT'},
      {'nombre': 'password_hash', 'tipo': 'TEXT'},
      {'nombre': 'password_salt', 'tipo': 'TEXT'},
      {'nombre': 'password_iteraciones', 'tipo': 'INTEGER'},
      {'nombre': 'creado_en', 'tipo': 'TEXT'},
    ]) {
      if (!existentes.contains(columna['nombre'])) {
        await db.execute(
            'ALTER TABLE admin ADD COLUMN ${columna['nombre']} ${columna['tipo']}');
      }
    }
  }

  Future<void> _crearTablaAdmin(Database db) async {
    await db.execute('''
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY DEFAULT 1,
      username TEXT NOT NULL UNIQUE,
      password TEXT,
      password_hash TEXT,
      password_salt TEXT,
      password_iteraciones INTEGER,
      creado_en TEXT
    )
    ''');
  }

  /// Bitacora de votos.
  ///
  /// Cada fila es un voto emitido. El indice unico sobre `rne` es lo que
  /// impide el doble voto a nivel de base de datos, y permite auditar
  /// quien voto a quien.
  Future<void> _crearTablaVotos(Database db) async {
    await db.execute('''
    CREATE TABLE IF NOT EXISTS votos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rne TEXT NOT NULL,
      numero_candidato INTEGER NOT NULL,
      fecha TEXT NOT NULL
    )
    ''');

    await db.execute('''
    CREATE UNIQUE INDEX IF NOT EXISTS idx_votos_rne_unico ON votos (rne)
    ''');
  }

  /// Conserva los totales de la version 2.
  ///
  /// Antes los votos vivian solo como contador en `candidatos.votos`, sin
  /// registro de quien voto a quien. Ese historico no se puede reconstruir,
  /// asi que se preserva la cantidad como filas sinteticas identificadas
  /// con el prefijo `__legado_`. Los votos nuevos si quedan auditables.
  Future<void> _migrarContadoresLegacy(Database db) async {
    final List<Map<String, dynamic>> existentes =
        await db.rawQuery('SELECT COUNT(*) AS total FROM votos');
    final int total = Sqflite.firstIntValue(existentes) ?? 0;
    if (total > 0) return;

    final List<Map<String, dynamic>> candidatos =
        await db.query('candidatos', columns: ['codigo', 'numero', 'votos']);

    final String fechaMigracion = DateTime.now().toIso8601String();
    final Batch batch = db.batch();
    int secuencia = 0;

    for (final Map<String, dynamic> candidato in candidatos) {
      final int votos = (candidato['votos'] as int?) ?? 0;
      for (int i = 0; i < votos; i++) {
        batch.insert('votos', {
          'rne': '__legado_${candidato['codigo']}_$secuencia',
          'numero_candidato': candidato['numero'],
          'fecha': fechaMigracion,
        });
        secuencia++;
      }
    }

    if (secuencia > 0) {
      await batch.commit(noResult: true);
    }
  }

  Future<void> close() async {
    final Database? db = _database;
    if (db == null) return;
    await db.close();
    _database = null;
  }
}