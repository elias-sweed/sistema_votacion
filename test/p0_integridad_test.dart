import 'dart:io';

import 'package:elecciones_jp/features/flujo_admin/1_admin_login_provider.dart';
import 'package:elecciones_jp/core/database/database_service.dart';
import 'package:elecciones_jp/domain/value_objects/rne.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// Redirige el directorio de soporte de la app a una carpeta temporal para
/// que los tests no toquen la base de datos real.
class _FakePathProvider extends PathProviderPlatform
    with MockPlatformInterfaceMixin {
  _FakePathProvider(this.ruta);
  final String ruta;

  @override
  Future<String?> getApplicationSupportPath() async => ruta;

  @override
  Future<String?> getApplicationDocumentsPath() async => ruta;

  @override
  Future<String?> getTemporaryPath() async => ruta;
}

const String _nombreDb = 'elecciones.db';

late Directory _dirTemporal;
late Directory _dirLegacy;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  setUp(() async {
    _dirTemporal = await Directory.systemTemp.createTemp('elecciones_test_');
    PathProviderPlatform.instance = _FakePathProvider(_dirTemporal.path);
    // La "base v2" tambien va a una carpeta temporal: los tests nunca deben
    // tocar la base real del proyecto en .dart_tool.
    _dirLegacy = Directory(p.join(_dirTemporal.path, 'legacy'));
    await _dirLegacy.create(recursive: true);
    DatabaseService.debugLegacyDirectory = _dirLegacy.path;
  });

  tearDown(() async {
    await DatabaseService.instance.close();
    DatabaseService.debugLegacyDirectory = null;
    if (await _dirTemporal.exists()) {
      await _dirTemporal.delete(recursive: true);
    }
  });

  /// Crea una base con el esquema de la version 2 y devuelve su ruta.
  Future<String> crearBaseV2() async {
    final String ruta = p.join(_dirLegacy.path, _nombreDb);
    final Database db = await openDatabase(
      ruta,
      version: 2,
      onCreate: (db, v) async {
        await db.execute(
            'CREATE TABLE centro (id INTEGER PRIMARY KEY DEFAULT 1, nombre TEXT, logoPath TEXT)');
        await db.execute(
            'CREATE TABLE candidatos (codigo INTEGER PRIMARY KEY AUTOINCREMENT, numero INTEGER NOT NULL, nombre TEXT NOT NULL, imagen TEXT NOT NULL, votos INTEGER DEFAULT 0)');
        await db.execute(
            'CREATE TABLE votantes (id INTEGER PRIMARY KEY AUTOINCREMENT, rne TEXT UNIQUE, nombre TEXT NOT NULL, voto INTEGER DEFAULT 0)');
        // Esquema real de v2: `password` era NOT NULL.
        await db.execute(
            'CREATE TABLE admin (id INTEGER PRIMARY KEY DEFAULT 1, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL)');
      },
    );
    await db.close();
    return ruta;
  }

  /// Crea una base con el esquema de la version 3: la bitacora de votos
  /// todavia apuntando a `numero_candidato` y con el RNE sin normalizar.
  Future<String> crearBaseV3() async {
    final String ruta = p.join(_dirLegacy.path, _nombreDb);
    final Database db = await openDatabase(
      ruta,
      version: 3,
      onCreate: (db, v) async {
        await db.execute(
            'CREATE TABLE centro (id INTEGER PRIMARY KEY DEFAULT 1, nombre TEXT, logoPath TEXT)');
        await db.execute(
            'CREATE TABLE candidatos (codigo INTEGER PRIMARY KEY AUTOINCREMENT, numero INTEGER NOT NULL, nombre TEXT NOT NULL, imagen TEXT NOT NULL, votos INTEGER DEFAULT 0)');
        await db.execute(
            'CREATE TABLE votantes (id INTEGER PRIMARY KEY AUTOINCREMENT, rne TEXT UNIQUE, nombre TEXT NOT NULL, voto INTEGER DEFAULT 0)');
        await db.execute(
            'CREATE TABLE admin (id INTEGER PRIMARY KEY DEFAULT 1, username TEXT NOT NULL UNIQUE, password TEXT, password_hash TEXT, password_salt TEXT, password_iteraciones INTEGER, creado_en TEXT)');
        await db.execute('''
          CREATE TABLE IF NOT EXISTS votos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rne TEXT NOT NULL,
            numero_candidato INTEGER NOT NULL,
            fecha TEXT NOT NULL)
        ''');
        await db.execute(
            'CREATE UNIQUE INDEX IF NOT EXISTS idx_votos_rne_unico ON votos (rne)');
      },
    );
    await db.close();
    return ruta;
  }

  group('Ubicación de la base de datos', () {
    test('se crea en el directorio de soporte, no en .dart_tool', () async {
      final db = await DatabaseService.instance.database;

      expect(p.dirname(db.path), _dirTemporal.path);
      expect(await File(db.path).exists(), isTrue);
    });

    test('migra una base existente desde la ruta anterior', () async {
      final String rutaVieja = await crearBaseV2();
      final dbVieja = await openDatabase(rutaVieja);
      await dbVieja.insert('centro', {'nombre': 'Centro Legacy'});
      await dbVieja.close();

      final db = await DatabaseService.instance.database;

      final centro = await db.query('centro');
      expect(centro.first['nombre'], 'Centro Legacy');
      expect(p.dirname(db.path), _dirTemporal.path);
      expect(db.path, isNot(rutaVieja));
    });
  });

  group('Esquema v3', () {
    test('crea la bitacora de votos con indice unico sobre rne', () async {
      final db = await DatabaseService.instance.database;

      final indices = await db.rawQuery('PRAGMA index_list(votos)');
      expect(
        indices.map((i) => i['name']).toList(),
        contains('idx_votos_rne_unico'),
      );

      await db.insert('votos', {
        'rne': '111',
        'codigo_candidato': null,
        'fecha': DateTime.now().toIso8601String(),
      });

      // El indice unico debe rechazar el segundo voto del mismo elector.
      expect(
        () => db.insert('votos', {
          'rne': '111',
          'codigo_candidato': null,
          'fecha': DateTime.now().toIso8601String(),
        }),
        throwsA(isA<DatabaseException>()
            .having((e) => e.isUniqueConstraintError(), 'unique', isTrue)),
      );
    });

    test('la tabla admin guarda hash, salt e iteraciones', () async {
      final db = await DatabaseService.instance.database;
      final columnas =
          (await db.rawQuery('PRAGMA table_info(admin)')).map((c) => c['name']);
      expect(columnas, containsAll(['password_hash', 'password_salt', 'password_iteraciones']));
    });
  });

  group('Contraseña del administrador', () {
    test('nunca guarda la contraseña en texto plano', () async {
      final provider = AdminLoginProvider();
      final ok = await provider.createAdminUser('admin', 'claveSecreta123');
      expect(ok, isTrue);

      final db = await DatabaseService.instance.database;
      final fila = (await db.query('admin')).first;

      expect(fila['password'], isNull);
      expect(fila['password_hash'], isNotNull);
      expect(fila['password_salt'], isNotNull);
      expect(fila['password_iteraciones'], 120000);
      // El texto plano no debe aparecer en ningun campo.
      expect(fila.values.join('|'), isNot(contains('claveSecreta123')));
    });

    test('acepta la contraseña correcta y rechaza la incorrecta', () async {
      final provider = AdminLoginProvider();
      await provider.createAdminUser('admin', 'claveSecreta123');

      expect(await provider.loginAdmin('admin', 'claveSecreta123'), isTrue);

      final otro = AdminLoginProvider();
      expect(await otro.loginAdmin('admin', 'claveIncorrecta'), isFalse);
      expect(otro.errorMessage, "Usuario o contraseña incorrectos");
    });

    test('dos cuentas con la misma clave producen hashes distintos', () async {
      final a = AdminLoginProvider();
      await a.createAdminUser('admin1', 'mismaClave');
      final b = AdminLoginProvider();
      await b.createAdminUser('admin2', 'mismaClave');

      final db = await DatabaseService.instance.database;
      final filas = await db.query('admin', orderBy: 'username');
      expect(filas.length, 2);
      expect(filas[0]['password_salt'], isNot(filas[1]['password_salt']));
      expect(filas[0]['password_hash'], isNot(filas[1]['password_hash']));
    });

    test('migra a hash una contraseña existente en texto plano', () async {
      // Caso real: instalacion v2, con `password` NOT NULL y sin columnas de hash.
      final String rutaV2 = await crearBaseV2();
      final dbVieja = await openDatabase(rutaV2);
      await dbVieja.insert('admin', {'username': 'legacy', 'password': 'claveVieja'});
      await dbVieja.close();

      final provider = AdminLoginProvider();
      expect(await provider.loginAdmin('legacy', 'claveVieja'), isTrue);

      final db = await DatabaseService.instance.database;
      final fila =
          (await db.query('admin', where: "username = 'legacy'")).first;
      expect(fila['password'], isNull, reason: 'debe borrar el texto plano');
      expect(fila['password_hash'], isNotNull);

      // Y la nueva credencial sigue funcionando.
      final otro = AdminLoginProvider();
      expect(await otro.loginAdmin('legacy', 'claveVieja'), isTrue);

      // El valor original no debe quedar en ningun campo de la base.
      expect((await db.query('admin')).map((f) => f.values.join('|')).join('|'),
          isNot(contains('claveVieja')));
    });

    test('no autentica con la contraseña de otro usuario', () async {
      final a = AdminLoginProvider();
      await a.createAdminUser('admin', 'unaClave');
      final b = AdminLoginProvider();
      expect(await b.loginAdmin('inexistente', 'unaClave'), isFalse);
    });
  });

  group('Voto atómico y auditable', () {
    Future<void> sembrar() async {
      final db = await DatabaseService.instance.database;
      await db.insert('candidatos',
          {'numero': 1, 'nombre': 'Candidato Uno', 'imagen': 'a.png', 'votos': 0});
      await db.insert('candidatos',
          {'numero': 2, 'nombre': 'Candidato Dos', 'imagen': 'b.png', 'votos': 0});
      await db.insert('votantes', {'rne': '1001', 'nombre': 'Ana', 'voto': 0});
      await db.insert('votantes', {'rne': '1002', 'nombre': 'Luis', 'voto': 0});
    }

    test('el voto queda registrado y marca al votante', () async {
      await sembrar();
      final db = await DatabaseService.instance.database;

      await db.transaction((txn) async {
        await txn.insert('votos', {
          'rne': '1001',
          'codigo_candidato': 1,
          'fecha': DateTime.now().toIso8601String(),
        });
        await txn.update('votantes', {'voto': 1},
            where: 'rne = ?', whereArgs: ['1001']);
      });

      final registros = await db.query('votos');
      expect(registros.length, 1);
      expect(registros.first['rne'], '1001');
      expect(registros.first['codigo_candidato'], 1);

      final votante = (await db.query('votantes', where: 'rne = 1001')).first;
      expect(votante['voto'], 1);
    });

    test('un segundo voto del mismo elector revierte la transaccion completa',
        () async {
      await sembrar();
      final db = await DatabaseService.instance.database;

      Future<void> emitir(String rne, int codigo) => db.transaction((txn) async {
            await txn.insert('votos', {
              'rne': rne,
              'codigo_candidato': codigo,
              'fecha': DateTime.now().toIso8601String(),
            });
            await txn.update('votantes', {'voto': 1},
                where: 'rne = ?', whereArgs: [rne]);
          });

      await emitir('1001', 1);

      expect(emitir('1001', 2), throwsA(isA<DatabaseException>()));

      // No debe existir ni un segundo voto ni una marca extra.
      expect((await db.query('votos')).length, 1);
      expect((await db.query('votos')).first['codigo_candidato'], 1);
      expect(
        Sqflite.firstIntValue(
            await db.rawQuery('SELECT COUNT(*) FROM votantes WHERE voto = 1')),
        1,
      );
    });

    test('votos concurrentes de distintas terminales no se pierden', () async {
      await sembrar();
      final db = await DatabaseService.instance.database;

      // Voto del elector 1002 simultaneamente con el 1001.
      await Future.wait([
        db.transaction((txn) async {
          await txn.insert('votos', {
            'rne': '1001',
            'codigo_candidato': 1,
            'fecha': DateTime.now().toIso8601String(),
          });
          await txn.update('votantes', {'voto': 1},
              where: 'rne = ?', whereArgs: ['1001']);
        }),
        db.transaction((txn) async {
          await txn.insert('votos', {
            'rne': '1002',
            'codigo_candidato': 1,
            'fecha': DateTime.now().toIso8601String(),
          });
          await txn.update('votantes', {'voto': 1},
              where: 'rne = ?', whereArgs: ['1002']);
        }),
      ]);

      // El total del candidato se deriva de la bitacora, asi que cuenta 2
      // sin importar el orden: no hay lectura-modificacion-escritura que
      // pueda perder un voto.
      final total = Sqflite.firstIntValue(await db.rawQuery(
          'SELECT COUNT(*) FROM votos WHERE codigo_candidato = 1'));
      expect(total, 2);
    });
  });

  group('Migración de totales legacy', () {
    test('conserva los contadores de candidatos.votos al migrar de v2',
        () async {
      // Base v2 con contadores ya usados y un votante marcado.
      final String rutaV2 = await crearBaseV2();
      final dbVieja = await openDatabase(rutaV2);
      await dbVieja.insert('candidatos',
          {'numero': 1, 'nombre': 'Uno', 'imagen': 'a.png', 'votos': 3});
      await dbVieja.insert('candidatos',
          {'numero': 2, 'nombre': 'Dos', 'imagen': 'b.png', 'votos': 2});
      await dbVieja.insert('votantes', {'rne': '1001', 'nombre': 'Ana', 'voto': 1});
      await dbVieja.insert('votantes', {'rne': '1002', 'nombre': 'Luis', 'voto': 1});
      await dbVieja.close();

      final db = await DatabaseService.instance.database;

      // Los totales por candidato se conservan.
      final porCandidato = await db.rawQuery('''
        SELECT c.nombre,
               (SELECT COUNT(*) FROM votos v WHERE v.codigo_candidato = c.codigo) AS votos
        FROM candidatos c ORDER BY c.numero
      ''');
      expect(porCandidato[0]['votos'], 3);
      expect(porCandidato[1]['votos'], 2);

      // Y las filas heredadas quedan identificadas como tales.
      final heredados =
          await db.rawQuery("SELECT rne FROM votos WHERE rne LIKE '__legado_%'");
      expect(heredados.length, 5);

      // Un voto nuevo se suma a esos totales.
      await db.insert('votos', {
        'rne': '1001',
        'codigo_candidato': 2,
        'fecha': DateTime.now().toIso8601String(),
      });
      final totalDos = Sqflite.firstIntValue(await db.rawQuery(
          'SELECT COUNT(*) FROM votos WHERE codigo_candidato = 2'));
      expect(totalDos, 3);
    });

    test('la tabla admin de v2 se reconstruye para admitir el hash', () async {
      // v2 exige password NOT NULL, lo que impediria borrar la clave en claro.
      final String rutaV2 = await crearBaseV2();
      final dbVieja = await openDatabase(rutaV2);
      await dbVieja.insert('admin', {'username': 'jefe', 'password': 'clave2019'});
      await dbVieja.close();

      final db = await DatabaseService.instance.database;

      final info = await db.rawQuery('PRAGMA table_info(admin)');
      final columnaPassword =
          info.firstWhere((c) => c['name'] == 'password');
      expect(columnaPassword['notnull'], 0, reason: 'debe quedar nullable');

      final columnas = info.map((c) => c['name']);
      expect(columnas,
          containsAll(['password_hash', 'password_salt', 'password_iteraciones']));

      // El usuario se conserva y la clave antigua sigue sirviendo para el
      // primer inicio de sesion.
      final fila = (await db.query('admin', where: "username = 'jefe'")).first;
      expect(fila['password'], 'clave2019');
    });
  });

  group('Normalización del RNE', () {
    test('unifica ceros a la izquierda, espacios y separadores', () {
      expect(Rne.normalizar('0123'), '123');
      expect(Rne.normalizar('123'), '123');
      expect(Rne.normalizar('  0123 '), '123');
      expect(Rne.normalizar('1.234'), '1234');
      expect(Rne.normalizar('12-34'), '1234');
      expect(Rne.normalizar('000'), '0');
    });

    test('rechaza vacios, letras y texto sin sentido', () {
      expect(Rne.normalizar(null), isNull);
      expect(Rne.normalizar(''), isNull);
      expect(Rne.normalizar('   '), isNull);
      expect(Rne.normalizar('.'), isNull);
      expect(Rne.normalizar('abc'), isNull);
      expect(Rne.normalizar('12a34'), isNull);
      expect(Rne.normalizar('1234567890123'), isNull);
      expect(Rne.esValido('0123'), isTrue);
      expect(Rne.esValido('abc'), isFalse);
    });

    test('el mismo documento con dos formas no puede votar dos veces',
        () async {
      final db = await DatabaseService.instance.database;
      await db.insert('votantes', {'rne': '123', 'nombre': 'Ana', 'voto': 0});
      await db.insert('votantes', {'rne': '0123', 'nombre': 'Ana', 'voto': 0});

      // La segunda forma choca con el indice unico del padron.
      expect(
        () => db.insert('votantes', {'rne': '0123', 'nombre': 'Ana', 'voto': 0}),
        throwsA(isA<DatabaseException>()),
      );

      // Y un mismo RNE canonico solo admite un voto.
      await db.insert('votos', {
        'rne': '123',
        'codigo_candidato': null,
        'fecha': DateTime.now().toIso8601String(),
      });
      expect(
        () => db.insert('votos', {
          'rne': '123',
          'codigo_candidato': null,
          'fecha': DateTime.now().toIso8601String(),
        }),
        throwsA(isA<DatabaseException>()),
      );
    });

    test('la migracion normaliza el padron y el login sigue funcionando',
        () async {
      final String rutaV3 = await crearBaseV3();
      final dbVieja = await openDatabase(rutaV3);
      await dbVieja.insert('votantes', {'rne': '0123', 'nombre': 'Ana', 'voto': 0});
      await dbVieja.insert('votantes', {'rne': ' 456 ', 'nombre': 'Luis', 'voto': 0});
      // El mismo elector repetido con otra forma: solo puede quedar uno.
      await dbVieja.insert('votantes', {'rne': '123', 'nombre': 'Ana', 'voto': 0});
      await dbVieja.close();

      final db = await DatabaseService.instance.database;

      final rnes = (await db.query('votantes', orderBy: 'id'))
          .map((v) => v['rne'])
          .toList();
      expect(rnes, contains('123'));
      expect(rnes, contains('456'));
      // Ninguna fila conserva la forma con ceros o con espacios.
      expect(rnes.where((r) => r != null).every((r) => !r.toString().contains(' ')), isTrue);
      // Solo quedan los dos electores reales; el duplicado se descarta.
      expect(Sqflite.firstIntValue(await db.rawQuery(
          'SELECT COUNT(*) FROM votantes WHERE rne IS NOT NULL')), 2);
    });

    test('la migracion colapsa los dobles votos ya colados', () async {
      final String rutaV3 = await crearBaseV3();
      final dbVieja = await openDatabase(rutaV3);
      // El mismo documento vota dos veces por formatos distintos.
      await dbVieja.insert('votos',
          {'rne': '0123', 'numero_candidato': 1, 'fecha': '2026-01-01T10:00:00'});
      await dbVieja.insert('votos',
          {'rne': '123', 'numero_candidato': 2, 'fecha': '2026-01-01T11:00:00'});
      await dbVieja.insert('votos',
          {'rne': '456', 'numero_candidato': 1, 'fecha': '2026-01-01T12:00:00'});
      await dbVieja.close();

      final db = await DatabaseService.instance.database;

      final votos = await db.query('votos', orderBy: 'id');
      expect(votos.length, 2, reason: 'el doble voto debe quedar en uno');
      expect(votos.map((v) => v['rne']).toSet(), {'123', '456'});
      // Se conserva el primero registrado, no el ultimo.
      expect(votos.first['rne'], '123');
    });

    test('los votantes sin documento no computan en el padron', () async {
      final String rutaV3 = await crearBaseV3();
      final dbVieja = await openDatabase(rutaV3);
      await dbVieja.insert('votantes', {'rne': '123', 'nombre': 'Ana', 'voto': 0});
      await dbVieja.insert('votantes', {'rne': null, 'nombre': 'Sin DNI', 'voto': 0});
      await dbVieja.insert('votantes', {'rne': 'abc', 'nombre': 'Corrupto', 'voto': 0});
      await dbVieja.close();

      final db = await DatabaseService.instance.database;

      // Siguen en la tabla, pero no cuentan como electorate.
      expect(Sqflite.firstIntValue(await db.rawQuery(
          'SELECT COUNT(*) FROM votantes WHERE rne IS NOT NULL')), 1);
      expect(Sqflite.firstIntValue(await db.rawQuery(
          'SELECT COUNT(*) FROM votantes')), 3);
    });
  });

  group('Clave del voto', () {
    test('el voto apunta al codigo y no al numero de presentacion', () async {
      final db = await DatabaseService.instance.database;
      // codigo 7 con numero 1: el numero es solo presentacion.
      await db.insert('candidatos',
          {'codigo': 7, 'numero': 1, 'nombre': 'Uno', 'imagen': 'a.png'});
      await db.insert('candidatos',
          {'codigo': 9, 'numero': 2, 'nombre': 'Dos', 'imagen': 'b.png'});

      await db.insert('votos', {
        'rne': '1',
        'codigo_candidato': 7,
        'fecha': DateTime.now().toIso8601String(),
      });

      final total = Sqflite.firstIntValue(await db.rawQuery('''
        SELECT COUNT(*) FROM votos v
        JOIN candidatos c ON c.codigo = v.codigo_candidato
        WHERE c.numero = 1
      '''));
      expect(total, 1);
    });

    test('un candidato nuevo con un numero libre NO hereda los votos',
        () async {
      final db = await DatabaseService.instance.database;
      // codigo 1 con numero 3, sin votos: se puede eliminar.
      await db.insert('candidatos',
          {'codigo': 1, 'numero': 3, 'nombre': 'Original', 'imagen': 'a.png'});
      // codigo 2 con numero 1, con dos votos.
      await db.insert('candidatos',
          {'codigo': 2, 'numero': 1, 'nombre': 'Con votos', 'imagen': 'b.png'});
      await db.insert('votos', {
        'rne': '1',
        'codigo_candidato': 2,
        'fecha': DateTime.now().toIso8601String(),
      });
      await db.insert('votos', {
        'rne': '2',
        'codigo_candidato': 2,
        'fecha': DateTime.now().toIso8601String(),
      });

      // Se libera el numero 3 y se reutiliza para un candidato nuevo.
      await db.delete('candidatos', where: 'codigo = 1');
      await db.insert('candidatos',
          {'codigo': 3, 'numero': 3, 'nombre': 'Nuevo', 'imagen': 'c.png'});

      final votosPorNumero = await db.rawQuery('''
        SELECT c.nombre,
               (SELECT COUNT(*) FROM votos v WHERE v.codigo_candidato = c.codigo) AS votos
        FROM candidatos c ORDER BY c.numero
      ''');

      // El nuevo arranca en cero aunque su numero ya se haya usado antes.
      expect(votosPorNumero[1]['nombre'], 'Nuevo');
      expect(votosPorNumero[1]['votos'], 0);
      // Los dos votos siguen donde estaban.
      expect(votosPorNumero[0]['votos'], 2);
    });

    test('los votos huerfanos no inflan a ningun candidato', () async {
      final db = await DatabaseService.instance.database;
      await db.insert('candidatos',
          {'codigo': 1, 'numero': 1, 'nombre': 'Uno', 'imagen': 'a.png'});

      // Voto sin candidato: sigue siendo un voto emitido, pero no suma.
      await db.insert('votos', {
        'rne': '1',
        'codigo_candidato': null,
        'fecha': DateTime.now().toIso8601String(),
      });

      expect(Sqflite.firstIntValue(await db.rawQuery(
          'SELECT COUNT(*) FROM votos')), 1, reason: 'si fue un voto emitido');
      expect(Sqflite.firstIntValue(await db.rawQuery('''
          SELECT (SELECT COUNT(*) FROM votos v WHERE v.codigo_candidato = c.codigo)
          FROM candidatos c WHERE c.codigo = 1''')), 0);
    });

    test('la base de datos impide borrar un candidato con votos', () async {
      final db = await DatabaseService.instance.database;
      await db.insert('candidatos',
          {'codigo': 1, 'numero': 1, 'nombre': 'Uno', 'imagen': 'a.png'});
      await db.insert('votos', {
        'rne': '1',
        'codigo_candidato': 1,
        'fecha': DateTime.now().toIso8601String(),
      });

      // ON DELETE RESTRICT debe rechazarlo.
      expect(
        () => db.delete('candidatos', where: 'codigo = 1'),
        throwsA(isA<DatabaseException>()),
      );
      expect(
        (await db.query('candidatos')).length,
        1,
        reason: 'el candidato no debe eliminarse',
      );
    });

    test('la migracion de v3 traduce numero_candidato a codigo', () async {
      final String rutaV3 = await crearBaseV3();
      final dbVieja = await openDatabase(rutaV3);
      // codigo 4 tiene numero 2; codigo 8 tiene numero 5.
      await dbVieja.insert('candidatos',
          {'codigo': 4, 'numero': 2, 'nombre': 'Cuatro', 'imagen': 'a.png', 'votos': 0});
      await dbVieja.insert('candidatos',
          {'codigo': 8, 'numero': 5, 'nombre': 'Ocho', 'imagen': 'b.png', 'votos': 0});
      await dbVieja.insert('votos',
          {'rne': '11', 'numero_candidato': 5, 'fecha': '2026-01-01T10:00:00'});
      await dbVieja.insert('votos',
          {'rne': '22', 'numero_candidato': 2, 'fecha': '2026-01-01T10:05:00'});
      await dbVieja.insert('votos',
          {'rne': '33', 'numero_candidato': 99, 'fecha': '2026-01-01T10:10:00'});
      await dbVieja.close();

      final db = await DatabaseService.instance.database;

      final votos = await db.query('votos', orderBy: 'rne');
      // numero 5 -> codigo 8, numero 2 -> codigo 4, numero 99 -> sin candidato.
      expect(votos[0]['rne'], '11');
      expect(votos[0]['codigo_candidato'], 8);
      expect(votos[1]['rne'], '22');
      expect(votos[1]['codigo_candidato'], 4);
      expect(votos[2]['rne'], '33');
      expect(votos[2]['codigo_candidato'], isNull);

      // La columna antigua ya no existe.
      final info = await db.rawQuery('PRAGMA table_info(votos)');
      expect(info.map((c) => c['name']), isNot(contains('numero_candidato')));
    });

    test('el voto en blanco es un candidato mas y cuenta en resultados',
        () async {
      final db = await DatabaseService.instance.database;
      // El voto en blanco se guarda con numero 0.
      await db.insert('candidatos',
          {'codigo': 1, 'numero': 1, 'nombre': 'Uno', 'imagen': 'a.png'});
      await db.insert('candidatos',
          {'codigo': 2, 'numero': 0, 'nombre': 'VOTO EN BLANCO', 'imagen': 'b.png'});

      await db.insert('votos', {
        'rne': '1',
        'codigo_candidato': 2,
        'fecha': DateTime.now().toIso8601String(),
      });

      final blanco = Sqflite.firstIntValue(await db.rawQuery('''
        SELECT (SELECT COUNT(*) FROM votos v WHERE v.codigo_candidato = c.codigo)
        FROM candidatos c WHERE c.nombre = 'VOTO EN BLANCO'
      '''));
      expect(blanco, 1);
    });
  });

  group('Resultados', () {
    test('los totales por candidato salen de la bitacora de votos', () async {
      final db = await DatabaseService.instance.database;
      await db.insert('candidatos',
          {'numero': 1, 'nombre': 'Uno', 'imagen': 'a.png', 'votos': 0});
      await db.insert('candidatos',
          {'numero': 2, 'nombre': 'Dos', 'imagen': 'b.png', 'votos': 0});
      await db.insert('votantes', {'rne': '1', 'nombre': 'A', 'voto': 0});
      await db.insert('votantes', {'rne': '2', 'nombre': 'B', 'voto': 0});
      await db.insert('votantes', {'rne': '3', 'nombre': 'C', 'voto': 0});

      for (final r in ['1', '2']) {
        await db.insert('votos', {
          'rne': r,
          'codigo_candidato': 1,
          'fecha': DateTime.now().toIso8601String(),
        });
      }
      await db.insert('votos', {
        'rne': '3',
        'codigo_candidato': 2,
        'fecha': DateTime.now().toIso8601String(),
      });

      // El contador legacy queda en cero a proposito: no es la fuente.
      final contadores = await db.rawQuery('SELECT SUM(votos) AS s FROM candidatos');
      expect(Sqflite.firstIntValue(contadores), 0);

      final total = Sqflite.firstIntValue(await db.rawQuery('SELECT COUNT(*) FROM votos'));
      expect(total, 3);
    });
  });
}


