import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'dart:io';
import 'package:elecciones_jp/shared/services/database_service.dart';
import 'package:sqflite/sqflite.dart';

class CentroProvider with ChangeNotifier {
  final TextEditingController nombreController = TextEditingController();
  File? _imagenSeleccionada;
  File? _imagenOriginal;
  String _rutaImagenOriginalDB = "";
  bool _huboCambios = false;

  File? get imagenSeleccionada => _imagenSeleccionada;
  bool _isLoading = true;
  bool get isLoading => _isLoading;
  bool get huboCambios => _huboCambios;
  final ImagePicker _picker = ImagePicker();

  CentroProvider() {
    _cargarDatosCentro();
  }

  Future<void> _cargarDatosCentro() async {
    _isLoading = true;
    notifyListeners();

    try {
      final db = await DatabaseService.instance.database;
      final List<Map<String, dynamic>> results =
          await db.query('centro', limit: 1);

      if (results.isNotEmpty) {
        final centro = results.first;
        nombreController.text = centro['nombre'] as String;
        _rutaImagenOriginalDB = centro['logoPath'] as String;
        _imagenOriginal = File(_rutaImagenOriginalDB);
        _imagenSeleccionada = File(_rutaImagenOriginalDB);
      } else {
        nombreController.text = "Centro de Votación";
        _rutaImagenOriginalDB = "";
        _imagenOriginal = null;
        _imagenSeleccionada = null;
      }
    } catch (e) {
      // Manejar el caso donde el archivo de imagen no se encuentra
      if (e is PathNotFoundException || e.toString().contains('No such file')) {
        nombreController.text = "Centro de Votación (Error de logo)";
        _rutaImagenOriginalDB = "";
        _imagenOriginal = null;
        _imagenSeleccionada = null;
      } else {
        rethrow;
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> seleccionarImagen() async {
    final XFile? xFile = await _picker.pickImage(source: ImageSource.gallery);
    if (xFile != null) {
      _imagenSeleccionada = File(xFile.path);
      notifyListeners();
    }
  }

  Future<void> aceptar(BuildContext context) async {
    final String nombre = nombreController.text;
    String rutaImagenAGuardar = _rutaImagenOriginalDB;

    if (_imagenSeleccionada == null) {
      _mostrarAlerta(context, "Error", "Debe seleccionar una imagen de logo.");
      return;
    }

    if (_imagenSeleccionada != _imagenOriginal) {
      final String directory = (await getApplicationDocumentsDirectory()).path;
      final String fileName =
          'logo_${DateTime.now().millisecondsSinceEpoch}.png';
      final String newPath = path.join(directory, fileName);
      final File newImage = await _imagenSeleccionada!.copy(newPath);
      rutaImagenAGuardar = newImage.path;
    }

    final Map<String, dynamic> centroData = {
      'id': 1,
      'nombre': nombre,
      'logoPath': rutaImagenAGuardar,
    };

    try {
      final db = await DatabaseService.instance.database;
      await db.insert(
        'centro',
        centroData,
        conflictAlgorithm: ConflictAlgorithm.replace,
      );

      if (_imagenSeleccionada != _imagenOriginal &&
          _rutaImagenOriginalDB.isNotEmpty &&
          !_rutaImagenOriginalDB.startsWith('assets/')) {
        final File imgAntigua = File(_rutaImagenOriginalDB);
        if (await imgAntigua.exists()) {
          await imgAntigua.delete();
        }
      }

      _imagenOriginal = File(rutaImagenAGuardar);
      _rutaImagenOriginalDB = rutaImagenAGuardar;
      _huboCambios = true;

      if (!context.mounted) return;
      _mostrarAlerta(context, "Actualizado", "Se actualizó la configuración del Centro.");
    } catch (e) {
      if (!context.mounted) return;
      _mostrarAlerta(
          context, "Error", "No se pudo guardar en la base de datos: $e");
    }
  }

  void cancelar() {
    _imagenSeleccionada = _imagenOriginal;
    _cargarDatosCentro();
  }

  void salir(BuildContext context) {
    Navigator.of(context).pop(_huboCambios);
  }

  void _mostrarAlerta(BuildContext context, String titulo, String contenido,
      {VoidCallback? onAceptar}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(titulo),
          content: Text(contenido),
          actions: [
            TextButton(
              onPressed: onAceptar ?? () => Navigator.of(context).pop(),
              child: const Text("Aceptar"),
            ),
          ],
        );
      },
    );
  }
}