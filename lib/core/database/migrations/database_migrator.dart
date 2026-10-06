import 'package:elecciones_jp/shared/utils/rne.dart';
import 'package:elecciones_jp/core/database/tables/admin_table.dart';
import 'package:elecciones_jp/core/database/tables/candidatos_table.dart';
import 'package:elecciones_jp/core/database/tables/votantes_table.dart';
import 'package:elecciones_jp/core/database/tables/votos_table.dart';
import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';

class DatabaseMigrator {
  DatabaseMigrator._();

  static const String _prefijoLegado = '__legado_';

  static Future<void> upgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await crearTablaAdmin(db);
    }

    if (oldVersion < 3) {
      await crearTablaAdmin(db);
      await _migrarEsquemaAdmin(db);
      await crearTablaVotos(db);
      await _migrarContadoresLegacy(db);
    }

    if (oldVersion < 4) {
      await _normalizarRnesExistentes(db);
      await _migrarVotosACodigoCandidato(db);
    }
  }

/// Normaliza el RNE de todo lo ya guardado.
  ///
  /// Mientras el padron guarde el RNE tal como venía del Excel, "0123" y
  /// "123" son dos electores distintos y el indice unico sobre `votos.rne`
  /// no los detecta: el mismo documento podría votar dos veces. Ademas
  /// corrige los dobles votos que ya se hayan colado por esa vía.
  static Future<void> _normalizarRnesExistentes(Database db) async {
    await _normalizarVotos(db);
    await _normalizarVotantes(db);
  }

  static Future<void> _normalizarVotos(Database db) async {
    final List<Map<String, dynamic>> votos =
        await db.query(VotosTable.tableName, orderBy: 'id');
    if (votos.isEmpty) return;

    final Set<String> yaAsignados = <String>{};
    // Se conservan los primeros y se anotan los que hay que eliminar. No se
    // puede dejar rne a null porque la columna es NOT NULL.
    final List<Map<String, dynamic>> aConservar = [];
    final List<Object?> aEliminar = [];

    for (final Map<String, dynamic> voto in votos) {
      final String original = voto['rne'] as String? ?? '';

      // Las filas sinteticas de la migracion v3 no son un documento real: son
      // el marcador `__legado_` que preserva los totales que solo existian
      // como contador. No se normalizan ni se descartan.
      if (original.startsWith(_prefijoLegado)) {
        yaAsignados.add(original);
        aConservar.add({'id': voto['id'], 'original': original, 'rne': original});
        continue;
      }

      final String normalizado = Rne.normalizar(original) ?? '';
      if (normalizado.isEmpty || !yaAsignados.add(normalizado)) {
        // RNE inutilizable, o segundo voto del mismo elector: se descarta
        // para que la bitacora no conserve un doble voto.
        aEliminar.add(voto['id']);
        continue;
      }
      aConservar.add({'id': voto['id'], 'original': original, 'rne': normalizado});
    }

    // Los duplicados salen primero: asi ningun RNE canonico esta ocupado por
    // una fila que todavia debe transformarse, y las actualizaciones que
    // siguen no chocan con el indice unico.
    for (final Object? id in aEliminar) {
      await db.delete(VotosTable.tableName, where: 'id = ?', whereArgs: [id]);
    }

    for (final Map<String, dynamic> voto in aConservar) {
      if (voto['original'] == voto['rne']) continue;
      await db.update(VotosTable.tableName, {'rne': voto['rne']},
          where: 'id = ?', whereArgs: [voto['id']]);
    }

    if (aEliminar.isNotEmpty) {
      debugPrint(
          'BD: se descartaron ${aEliminar.length} votos con RNE inutilizable o duplicado.');
    }
  }

  static Future<void> _normalizarVotantes(Database db) async {
    final List<Map<String, dynamic>> votantes =
        await db.query(VotantesTable.tableName, orderBy: 'voto DESC, id ASC');
    if (votantes.isEmpty) return;

    await db.update(VotantesTable.tableName, {'rne': null}, where: 'rne IS NOT NULL');

    final Set<String> yaAsignados = <String>{};
    int normalizados = 0;
    int sinDocumento = 0;

    for (final Map<String, dynamic> votante in votantes) {
      final String normalizado = Rne.normalizar(votante['rne'] as String?) ?? '';

      if (normalizado.isEmpty || !yaAsignados.add(normalizado)) {
        // Sin documento valido, o duplicado del mismo elector. Se deja con
        // rne nulo: no podra votar y tampoco contara en el padron.
        sinDocumento++;
        continue;
      }

      await db.update(VotantesTable.tableName, {'rne': normalizado},
          where: 'id = ?', whereArgs: [votante['id']]);
      normalizados++;
    }

    if (sinDocumento > 0) {
      debugPrint(
          'BD: $normalizados votantes normalizados; $sinDocumento quedaron '
          'sin RNE utilizable y no computan en el padron.');
    }
  }

  /// Reconstruye `votos` para que apunte a `candidatos.codigo`.
  ///
  /// Se traduce el `numero_candidato` de la version 3 al codigo del
  /// candidato. Los votos cuyo candidato ya no existe quedan con el codigo
  /// nulo: son votos reales pero no imputables a nadie, y se cuentan como
  /// emitidos aunque no sumen en ninguna lista.
  static Future<void> _migrarVotosACodigoCandidato(Database db) async {
    final List<Map<String, dynamic>> info =
        await db.rawQuery('PRAGMA table_info(${VotosTable.tableName})');
    if (info.any((c) => c['name'] == VotosTable.codigoCandidato)) return;

    await db.execute('DROP INDEX IF EXISTS ${VotosTable.indexRneUnico}');
    await db.execute('ALTER TABLE ${VotosTable.tableName} RENAME TO ${VotosTable.tableName}_v3');

    await db.execute('''
    CREATE TABLE IF NOT EXISTS ${VotosTable.tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ${VotosTable.rne} TEXT NOT NULL,
      ${VotosTable.codigoCandidato} INTEGER,
      ${VotosTable.fecha} TEXT NOT NULL,
      FOREIGN KEY (${VotosTable.codigoCandidato}) REFERENCES ${CandidatosTable.tableName} (${CandidatosTable.codigo})
        ON DELETE RESTRICT
    )
    ''');

    await db.execute('''
      INSERT INTO ${VotosTable.tableName} (id, ${VotosTable.rne}, ${VotosTable.codigoCandidato}, ${VotosTable.fecha})
      SELECT v3.id,
             v3.${VotosTable.rne},
             (SELECT c.${CandidatosTable.codigo} FROM ${CandidatosTable.tableName} c WHERE c.${CandidatosTable.numero} = v3.numero_candidato),
             v3.${VotosTable.fecha}
      FROM ${VotosTable.tableName}_v3 v3
      ORDER BY v3.id
    ''');

    await db.execute('DROP TABLE ${VotosTable.tableName}_v3');

    await db.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS ${VotosTable.indexRneUnico} ON ${VotosTable.tableName} (${VotosTable.rne})');

    final int? sinCandidato = Sqflite.firstIntValue(await db.rawQuery(
        'SELECT COUNT(*) FROM ${VotosTable.tableName} WHERE ${VotosTable.codigoCandidato} IS NULL'));
    if ((sinCandidato ?? 0) > 0) {
      debugPrint(
          'BD: $sinCandidato votos quedaron sin candidato asociado y no se imputan a ninguna lista.');
    }
  }

  /// Ajusta la tabla `admin` de una instalacion existente al esquema v3.
  ///
  /// Hace falta porque en v2 la tabla ya existe y `CREATE TABLE IF NOT
  /// EXISTS` no la modifica: sin esto, las columnas del hash nunca se
  /// crearian y las credenciales seguirian en texto plano.
  static Future<void> _migrarEsquemaAdmin(Database db) async {
    List<Map<String, dynamic>> info = await db.rawQuery('PRAGMA table_info(${AdminTable.tableName})');

    // v2 declaraba `password TEXT NOT NULL`, lo que impide vaciar la
    // columna para eliminar la contraseña en claro. Se reconstruye la tabla
    // con el esquema v3, copiando el usuario y su contraseña actual para que
    // el inicio de sesión siga funcionando y pueda migrarse al hash.
    final bool passwordEsNotNull = info.any(
        (c) => c['name'] == 'password' && (c['notnull'] as int? ?? 0) == 1);

    if (passwordEsNotNull) {
      await db.execute('ALTER TABLE admin RENAME TO admin_v2');
      await crearTablaAdmin(db);
      await db.execute('''
        INSERT INTO admin (id, username, password)
        SELECT id, username, password FROM admin_v2
      ''');
      await db.execute('DROP TABLE admin_v2');
      info = await db.rawQuery('PRAGMA table_info(${AdminTable.tableName})');
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

  static Future<void> crearTablaAdmin(Database db) async {
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
  ///
  /// El voto apunta a `candidatos.codigo` y no a `numero`: `numero` es un
  /// valor de presentacion que el admin puede reutilizar al borrar y volver
  /// a crear un candidato, y un voto no puede mudarse de candidato solo
  /// porque el numero se recycle. La clave foranea con `ON DELETE RESTRICT`
  /// impide ademas eliminar un candidato que ya recibio votos.
  static Future<void> crearTablaVotos(Database db) async {
    await db.execute('''
    CREATE TABLE IF NOT EXISTS ${VotosTable.tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ${VotosTable.rne} TEXT NOT NULL,
      ${VotosTable.codigoCandidato} INTEGER,
      ${VotosTable.fecha} TEXT NOT NULL,
      FOREIGN KEY (${VotosTable.codigoCandidato}) REFERENCES ${CandidatosTable.tableName} (${CandidatosTable.codigo})
        ON DELETE RESTRICT
    )
    ''');

    await db.execute('''
    CREATE UNIQUE INDEX IF NOT EXISTS ${VotosTable.indexRneUnico} ON ${VotosTable.tableName} (${VotosTable.rne})
    ''');
  }

  /// Conserva los totales de la version 2.
  ///
  /// Antes los votos vivian solo como contador en `candidatos.votos`, sin
  /// registro de quien voto a quien. Ese historico no se puede reconstruir,
  /// asi que se preserva la cantidad como filas sinteticas identificadas
  /// con el prefijo `__legado_`. Los votos nuevos si quedan auditables.
  static Future<void> _migrarContadoresLegacy(Database db) async {
    final List<Map<String, dynamic>> existentes =
        await db.rawQuery('SELECT COUNT(*) AS total FROM ${VotosTable.tableName}');
    final int total = Sqflite.firstIntValue(existentes) ?? 0;
    if (total > 0) return;

    final List<Map<String, dynamic>> candidatos =
        await db.query(CandidatosTable.tableName, columns: [CandidatosTable.codigo, CandidatosTable.numero, CandidatosTable.votos]);

    final String fechaMigracion = DateTime.now().toIso8601String();
    final Batch batch = db.batch();
    int secuencia = 0;

    for (final Map<String, dynamic> candidato in candidatos) {
      final int votos = (candidato[CandidatosTable.votos] as int?) ?? 0;
      for (int i = 0; i < votos; i++) {
        batch.insert(VotosTable.tableName, {
          VotosTable.rne: '$_prefijoLegado${candidato[CandidatosTable.codigo]}_$secuencia',
          VotosTable.codigoCandidato: candidato[CandidatosTable.codigo],
          VotosTable.fecha: fechaMigracion,
        });
        secuencia++;
      }
    }

    if (secuencia > 0) {
      await batch.commit(noResult: true);
    }
  }
}
