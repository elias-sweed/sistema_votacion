import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'dart:io';
import 'package:elecciones_jp/data/repositories/candidato_repository_impl.dart';
import 'package:elecciones_jp/data/repositories/voto_repository_impl.dart';
import 'package:elecciones_jp/domain/entities/candidato_entity.dart';

class ConfigCandidatosProvider with ChangeNotifier {
  final List<CandidatoEntity> _listaCandidatos = [];
  File? _imagenSeleccionada;
  int _numeroSiguiente = 1;

  List<CandidatoEntity> get listaCandidatos => _listaCandidatos;
  File? get imagenSeleccionada => _imagenSeleccionada;
  int get numeroSiguiente => _numeroSiguiente;

  final ImagePicker _picker = ImagePicker();
  final CandidatoRepositoryImpl _candidatoRepo = CandidatoRepositoryImpl();
  final VotoRepositoryImpl _votoRepo = VotoRepositoryImpl();

  Future<void> initCandidatos() async {
    _numeroSiguiente = 1;
    _listaCandidatos.clear();
    _imagenSeleccionada = null;
    await _mostrarCandidatos();
  }

  Future<void> _mostrarCandidatos() async {
    final candidatos = await _candidatoRepo.findAll();

    _listaCandidatos.clear();
    for (final candidato in candidatos) {
      _listaCandidatos.add(candidato);
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
        await _candidatoRepo.insert(CandidatoEntity(
          numero: numeroCandidato,
          nombre: nombre,
          imagen: pathDestino,
        ));

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
      CandidatoEntity candidato, BuildContext context) async {
    try {
      // Un candidato que ya recibio votos no se puede borrar. El voto apunta
      // a candidatos.codigo justamente para que esto sea una garantia de la
      // base de datos, y no una convencion que el operador tenga que
      // recordar: permitirlo dejaria el total de votos emitidos sin listas que
      // lo respalden.
      final int? codigo = candidato.codigo;
      if (codigo == null) {
        if (!context.mounted) return;
        _mostrarAlerta(context, "Error",
            "No se pudo identificar el candidato en la base de datos.");
        return;
      }

      final int votosRecibidos =
          await _votoRepo.countByCodigoCandidato(codigo);

      if (votosRecibidos > 0) {
        if (!context.mounted) return;
        _mostrarAlerta(context, "No se puede eliminar",
            '"${candidato.nombre}" ya recibió $votosRecibidos votos. '
                'Un candidato con votos emitidos no puede eliminarse.');
        return;
      }

      await _candidatoRepo.delete(codigo);

      final File imagen = File(candidato.imagen);
      if (await imagen.exists()) {
        await imagen.delete();
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

