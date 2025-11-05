import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'dart:io';
import 'package:elecciones_jp/shared/models/candidato.dart';
import 'package:elecciones_jp/shared/services/database_service.dart';
import 'package:sqflite/sqflite.dart';

class ConfigCandidatosProvider with ChangeNotifier {
  final List<CandidatoParaMostrar> _listaCandidatos = [];
  File? _imagenSeleccionada;
  int _numeroSiguiente = 1;

  List<CandidatoParaMostrar> get listaCandidatos => _listaCandidatos;
  File? get imagenSeleccionada => _imagenSeleccionada;

  final ImagePicker _picker = ImagePicker();

  Future<void> initCandidatos() async {
    _numeroSiguiente = 1;
    _listaCandidatos.clear();
    _imagenSeleccionada = null;
    await _mostrarCandidatos();
  }

  Future<void> _mostrarCandidatos() async {
    final db = await DatabaseService.instance.database;
    final List<Map<String, dynamic>> maps =
        await db.query('candidatos', orderBy: 'numero');

    _listaCandidatos.clear();
    for (var map in maps) {
      _listaCandidatos.add(CandidatoParaMostrar(
        numero: map['numero'],
        nombre: map['nombre'],
        imagen: File(map['imagen']),
      ));
    }

    if (_listaCandidatos.isNotEmpty) {
      _numeroSiguiente = _listaCandidatos.last.numero + 1;
    } else {
      _numeroSiguiente = 1;
    }

    notifyListeners();
  }

  Future<void> seleccionarImagen() async {
    final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      _imagenSeleccionada = File(image.path);
      notifyListeners();
    }
  }

  Future<String?> _copiarImagen(File imagenOriginal) async {
    try {
      final Directory appDir = await getApplicationDocumentsDirectory();
      final String destinoDir = path.join(appDir.path, 'imagenes_candidatos');
      final Directory dir = Directory(destinoDir);

      if (!await dir.exists()) {
        await dir.create(recursive: true);
      }

      final String nombreArchivo =
          "${DateTime.now().millisecondsSinceEpoch}${path.extension(imagenOriginal.path)}";
      final String rutaDestino = path.join(destinoDir, nombreArchivo);

      await imagenOriginal.copy(rutaDestino);

      return rutaDestino;
    } catch (e) {
      debugPrint("Error al copiar imagen: $e");
      return null;
    }
  }

  Future<void> agregarCandidato(String nombre, BuildContext context) async {
    if (_imagenSeleccionada == null || nombre.isEmpty) {
      _mostrarAlerta(
          context, "Datos incompletos", "Debe seleccionar una imagen y escribir un nombre.");
      return;
    }

    final String? rutaImagenCopiada = await _copiarImagen(_imagenSeleccionada!);

    if (rutaImagenCopiada != null) {
      try {
        final db = await DatabaseService.instance.database;
        Map<String, dynamic> row = {
          'numero': _numeroSiguiente,
          'nombre': nombre.toUpperCase(),
          'imagen': rutaImagenCopiada,
          'votos': 0
        };
        await db.insert(
          'candidatos',
          row,
          conflictAlgorithm: ConflictAlgorithm.fail,
        );

        _listaCandidatos.add(CandidatoParaMostrar(
          numero: _numeroSiguiente,
          nombre: nombre.toUpperCase(),
          imagen: File(rutaImagenCopiada),
        ));

        _numeroSiguiente++;
        _imagenSeleccionada = null;
        notifyListeners();
      } catch (e) {
        if (!context.mounted) return;
        _mostrarAlerta(context, "Error", "No se pudo guardar el candidato en la BD: $e");
      }
    } else {
      if (!context.mounted) return;
      _mostrarAlerta(context, "Error", "No se pudo copiar la imagen.");
    }
  }

  Future<void> eliminarCandidato(
      CandidatoParaMostrar candidato, BuildContext context) async {
    try {
      final db = await DatabaseService.instance.database;
      await db
          .delete('candidatos', where: 'numero = ?', whereArgs: [candidato.numero]);

      if (await candidato.imagen.exists()) {
        await candidato.imagen.delete();
      }

      await _mostrarCandidatos();
    } catch (e) {
      if (!context.mounted) return;
      _mostrarAlerta(context, "Error", "No se pudo eliminar el candidato: $e");
    }
  }

  void aceptar(BuildContext context) {
    if (_listaCandidatos.isEmpty) {
      _mostrarAlerta(context, "Error", "Debe agregar al menos un candidato.");
      return;
    }

    Navigator.of(context).pop();
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