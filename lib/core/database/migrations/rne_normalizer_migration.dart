import 'package:elecciones_jp/shared/utils/rne.dart';
import 'package:elecciones_jp/core/database/tables/votantes_table.dart';
import 'package:elecciones_jp/core/database/tables/votos_table.dart';
import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';

class RneNormalizerMigration {
  static const String prefijoLegado = '__legado_';

  static Future<void> execute(Database db) async {
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
      if (original.startsWith(prefijoLegado)) {
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

}
