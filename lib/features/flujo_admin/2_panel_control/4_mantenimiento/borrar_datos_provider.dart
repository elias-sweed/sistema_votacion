import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'dart:io';
import 'package:elecciones_jp/shared/services/database_service.dart';
import 'package:sqflite/sqflite.dart';

class BorrarDatosProvider with ChangeNotifier {
  bool _puedeBorrarCentro = false;
  bool _puedeBorrarCandidatos = false;
  bool _puedeBorrarElectores = false;
  bool _puedeBorrarResultados = false;
  bool _puedeBorrarTodo = false;

  bool get puedeBorrarCentro => _puedeBorrarCentro;
  bool get puedeBorrarCandidatos => _puedeBorrarCandidatos;
  bool get puedeBorrarElectores => _puedeBorrarElectores;
  bool get puedeBorrarResultados => _puedeBorrarResultados;
  bool get puedeBorrarTodo => _puedeBorrarTodo;

  BorrarDatosProvider() {
    _verificarDatosExistentes();
  }

  Future<void> _verificarDatosExistentes() async {
    try {
      final db = await DatabaseService.instance.database;

      final int? centroCount = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM centro'));
      _puedeBorrarCentro = (centroCount ?? 0) > 0;

      final int? candidatosCount = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM candidatos'));
      _puedeBorrarCandidatos = (candidatosCount ?? 0) > 0;

      final int? electoresCount = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM votantes'));
      _puedeBorrarElectores = (electoresCount ?? 0) > 0;

      final int? resultadosCount = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM votantes WHERE voto = 1'));
      _puedeBorrarResultados = (resultadosCount ?? 0) > 0;

      _puedeBorrarTodo = _puedeBorrarCentro ||
          _puedeBorrarCandidatos ||
          _puedeBorrarElectores ||
          _puedeBorrarResultados;
    } catch (e) {
      debugPrint("Error verificando datos: $e");
    }

    notifyListeners();
  }

  Future<void> _ejecutarBorrado(BuildContext context, String tipo,
      Future<bool> Function() accionBorrado) async {
    final bool confirmar = await _mostrarDialogoConfirmacion(context, tipo);
    if (!context.mounted) return;
    if (confirmar) {
      bool exito = await accionBorrado();
      if (!context.mounted) return;
      if (exito) {
        _mostrarAlerta(
            context, "Datos Eliminados", "Se han eliminado los datos de $tipo.");
        await _verificarDatosExistentes();
      } else {
        _mostrarAlerta(
            context, "Error", "No se pudieron eliminar los datos de $tipo.");
      }
    }
  }

  Future<void> eliminarCentro(BuildContext context) async {
    await _ejecutarBorrado(context, "Centro", _borrarCentroEnBD);
  }

  Future<bool> _borrarCentroEnBD() async {
    try {
      final db = await DatabaseService.instance.database;
      await db.delete('centro');
      return true;
    } catch (e) {
      debugPrint("Error al borrar centro: $e");
      return false;
    }
  }

  Future<void> eliminarCandidatos(BuildContext context) async {
    await _ejecutarBorrado(context, "Candidatos", _borrarCandidatosEnBD);
  }

  Future<bool> _borrarCandidatosEnBD() async {
    try {
      final db = await DatabaseService.instance.database;
      await db.delete('candidatos');
      await _eliminarImagenes();
      return true;
    } catch (e) {
      debugPrint("Error al borrar candidatos: $e");
      return false;
    }
  }

  Future<void> eliminarElectores(BuildContext context) async {
    await _ejecutarBorrado(context, "Electores", _borrarElectoresEnBD);
  }

  Future<bool> _borrarElectoresEnBD() async {
    try {
      final db = await DatabaseService.instance.database;
      await db.delete('votantes');
      return true;
    } catch (e) {
      debugPrint("Error al borrar electores: $e");
      return false;
    }
  }

  Future<void> eliminarResultados(BuildContext context) async {
    await _ejecutarBorrado(context, "Resultados", _borrarResultadosEnBD);
  }

  Future<bool> _borrarResultadosEnBD() async {
    try {
      final db = await DatabaseService.instance.database;
      final batch = db.batch();

      batch.update('votantes', {'voto': 0}, where: 'voto = 1');
      batch.update('candidatos', {'votos': 0}, where: 'votos > 0');

      await batch.commit(noResult: true);
      return true;
    } catch (e) {
      debugPrint("Error al borrar resultados: $e");
      return false;
    }
  }

  Future<void> eliminarTodo(BuildContext context) async {
    final bool confirmar =
        await _mostrarDialogoConfirmacion(context, "TODO el sistema");
    if (!context.mounted) return;
    if (confirmar) {
      bool exitoBD = await _borrarTodoEnBD();
      bool exitoImagenes = await _eliminarImagenes();

      if (!context.mounted) return;
      if (exitoBD && exitoImagenes) {
        _mostrarAlerta(context, "Sistema Reiniciado",
            "Se han eliminado todos los datos y las imágenes.");
        await _verificarDatosExistentes();
      } else {
        _mostrarAlerta(
            context, "Error", "Ocurrió un error al intentar borrar todos los datos.");
      }
    }
  }

  Future<bool> _borrarTodoEnBD() async {
    try {
      final db = await DatabaseService.instance.database;
      final batch = db.batch();
      batch.delete('candidatos');
      batch.delete('votantes');
      batch.delete('centro');
      await batch.commit(noResult: true);
      return true;
    } catch (e) {
      debugPrint("Error al borrar todo: $e");
      return false;
    }
  }

  Future<bool> _eliminarImagenes() async {
    try {
      final Directory appDir = await getApplicationDocumentsDirectory();
      final String carpetaImagenes =
          path.join(appDir.path, 'imagenes_candidatos');
      final Directory dir = Directory(carpetaImagenes);

      if (await dir.exists()) {
        await dir.delete(recursive: true);
        debugPrint("Carpeta de imágenes eliminada: $carpetaImagenes");
      } else {
        debugPrint("La carpeta de imágenes no existe: $carpetaImagenes");
      }
      return true;
    } catch (e) {
      debugPrint("Error al eliminar la carpeta de imágenes: $e");
      return false;
    }
  }

  void salir(BuildContext context) {
    Navigator.of(context).pop();
  }

  Future<bool> _mostrarDialogoConfirmacion(
      BuildContext context, String tipo) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          title: const Text('Confirmar Eliminación'),
          content: Text(
              '¿Está seguro de que desea eliminar los datos de $tipo?\n\n¡Esta acción no se puede deshacer!'),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.error),
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Eliminar'),
            ),
          ],
        );
      },
    );
    return result ?? false;
  }

  void _mostrarAlerta(BuildContext context, String titulo, String contenido) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(titulo),
          content: Text(contenido),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text("Aceptar"),
            ),
          ],
        );
      },
    );
  }
}