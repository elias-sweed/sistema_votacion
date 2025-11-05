import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'dart:io';
import 'package:elecciones_jp/shared/services/database_service.dart';

class ConfigVotoBlancoProvider with ChangeNotifier {
  File? _imagenSeleccionada;
  File? _imagenOriginal;
  final String _nombreFijo = "VOTO EN BLANCO";
  final int _numeroFijo = 0;

  File? get imagenSeleccionada => _imagenSeleccionada;
  String get nombreFijo => _nombreFijo;

  final ImagePicker _picker = ImagePicker();
  bool _isLoading = true;
  bool get isLoading => _isLoading;

  ConfigVotoBlancoProvider() {
    _cargarImagenActual();
  }

  Future<void> _cargarImagenActual() async {
    _isLoading = true;
    notifyListeners();
    String rutaImagenActual;

    try {
      final db = await DatabaseService.instance.database;
      final List<Map<String, dynamic>> results = await db.query(
        'candidatos',
        where: 'nombre = ?',
        whereArgs: [_nombreFijo],
      );

      if (results.isNotEmpty) {
        rutaImagenActual = results.first['imagen'] as String;
      } else {
        rutaImagenActual = 'assets/imagenes/blanco_placeholder.png';
      }

      _imagenOriginal = File(rutaImagenActual);
      _imagenSeleccionada = File(rutaImagenActual);
    } catch (e) {
      debugPrint("Error al cargar imagen de Voto en Blanco: $e");
      rutaImagenActual = 'assets/imagenes/blanco_placeholder.png';
      _imagenOriginal = File(rutaImagenActual);
      _imagenSeleccionada = File(rutaImagenActual);
    }

    _isLoading = false;
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
          "voto_en_blanco${path.extension(imagenOriginal.path)}";
      final String rutaDestino = path.join(destinoDir, nombreArchivo);

      await imagenOriginal.copy(rutaDestino);

      return rutaDestino;
    } catch (e) {
      debugPrint("Error al copiar imagen: $e");
      return null;
    }
  }

  Future<void> aceptar(BuildContext context) async {
    if (_imagenSeleccionada == null) return;
    if (_imagenSeleccionada!.path == _imagenOriginal?.path) {
      Navigator.of(context).pop();
      return;
    }

    final String? rutaImagenCopiada = await _copiarImagen(_imagenSeleccionada!);
    if (!context.mounted) return;

    if (rutaImagenCopiada != null) {
      try {
        final db = await DatabaseService.instance.database;
        final List<Map<String, dynamic>> results = await db.query(
          'candidatos',
          where: 'nombre = ?',
          whereArgs: [_nombreFijo],
        );

        if (results.isNotEmpty) {
          String rutaAntigua = results.first['imagen'] as String;
          await db.update(
            'candidatos',
            {'imagen': rutaImagenCopiada},
            where: 'nombre = ?',
            whereArgs: [_nombreFijo],
          );
          if (rutaAntigua != 'assets/imagenes/blanco_placeholder.png' &&
              rutaAntigua != rutaImagenCopiada) {
            final File imgAntigua = File(rutaAntigua);
            if (await imgAntigua.exists()) {
              await imgAntigua.delete();
            }
          }
        } else {
          Map<String, dynamic> row = {
            'numero': _numeroFijo,
            'nombre': _nombreFijo,
            'imagen': rutaImagenCopiada,
            'votos': 0
          };
          await db.insert('candidatos', row);
        }

        if (!context.mounted) return;
        _mostrarAlerta(
            context, "Guardado", "Se ha configurado la opción de Voto en Blanco.",
            onAceptar: () {
          Navigator.of(context).pop();
          Navigator.of(context).pop();
        });
        _imagenOriginal = File(rutaImagenCopiada);
        notifyListeners();
      } catch (e) {
        if (!context.mounted) return;
        _mostrarAlerta(context, "Error", "No se pudo guardar la configuración: $e");
      }
    } else {
      _mostrarAlerta(
          context, "Error", "No se pudo copiar la imagen seleccionada.");
    }
  }

  void cancelar() {
    _imagenSeleccionada = _imagenOriginal;
    notifyListeners();
  }

  void salir(BuildContext context) {
    Navigator.of(context).pop();
  }

  void _mostrarAlerta(BuildContext context, String titulo, String contenido,
      {VoidCallback? onAceptar}) {
    showDialog(
      context: context,
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