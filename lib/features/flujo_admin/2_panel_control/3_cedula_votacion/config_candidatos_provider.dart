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
  int get numeroSiguiente => _numeroSiguiente;

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
    // Si hay candidatos, el siguiente número es el último + 1
    if (_listaCandidatos.isNotEmpty) {
      _numeroSiguiente = _listaCandidatos.last.numero + 1;
    } else {
      _numeroSiguiente = 1; // Si no hay, es 1
    }
    notifyListeners();
  }

  Future<void> seleccionarImagen() async {
    final XFile? pickedFile =
        await _picker.pickImage(source: ImageSource.gallery);
    if (pickedFile != null) {
      _imagenSeleccionada = File(pickedFile.path);
      notifyListeners();
    }
  }

  Future<void> agregarCandidato(
      String nombre, BuildContext context) async {
    if (nombre.isEmpty) {
      _mostrarAlerta(context, "Error", "El nombre no puede estar vacío.");
      return;
    }
    if (_imagenSeleccionada == null) {
      _mostrarAlerta(context, "Error", "Debe seleccionar una imagen.");
      return;
    }
    if (nombre == "VOTO EN BLANCO") {
      _mostrarAlerta(
          context, "Error", "Nombre reservado. Use el botón 'Voto en Blanco'.");
      return;
    }

    final File imagenParaGuardar = _imagenSeleccionada!;
    final int numeroCandidato = _numeroSiguiente; // Se usa el número actual

    final String? pathDestino = await _copiarImagen(imagenParaGuardar);

    if (pathDestino != null) {
      try {
        final db = await DatabaseService.instance.database;
        await db.insert(
          'candidatos',
          {
            'numero': numeroCandidato, // Se guarda el N°
            'nombre': nombre,
            'imagen': pathDestino,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );

        // Limpiar para el siguiente
        _imagenSeleccionada = null;
        await _mostrarCandidatos(); // Recarga la lista (y actualiza _numeroSiguiente)
      } catch (e) {
        if (!context.mounted) return;
        _mostrarAlerta(
            context, "Error", "No se pudo guardar el candidato en la BD: $e");
      }
    } else {
      if (!context.mounted) return;
      _mostrarAlerta(context, "Error", "No se pudo copiar la imagen.");
    }
  }

  Future<String?> _copiarImagen(File imagen) async {
    try {
      final Directory appDir = await getApplicationDocumentsDirectory();
      final String nombreArchivo = path.basename(imagen.path);
      final String pathDestino = path.join(appDir.path, nombreArchivo);

      await imagen.copy(pathDestino);
      return pathDestino;
    } catch (e) {
      return null;
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