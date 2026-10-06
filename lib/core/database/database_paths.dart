import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

class DatabasePaths {
  DatabasePaths._();

  static String? debugLegacyDirectory;

  static Future<String> resolverRuta(String filePath) async {
    final Directory dirSoporte = await getApplicationSupportDirectory();
    final String rutaNueva = p.join(dirSoporte.path, filePath);

    if (await File(rutaNueva).exists()) {
      return rutaNueva;
    }

    await dirSoporte.create(recursive: true);

    final String rutaLegacy = p.join(await directorioLegacy(), filePath);
    final File archivoLegacy = File(rutaLegacy);
    try {
      if (await archivoLegacy.exists()) {
        await archivoLegacy.copy(rutaNueva);
      }
    } catch (_) {}

    return rutaNueva;
  }

  static Future<String> directorioLegacy() async {
    final String? override = debugLegacyDirectory;
    if (override != null) return override;
    try {
      return await getDatabasesPath();
    } catch (_) {
      return p.join(Directory.current.path, '.dart_tool',
          'sqflite_common_ffi', 'databases');
    }
  }
}



