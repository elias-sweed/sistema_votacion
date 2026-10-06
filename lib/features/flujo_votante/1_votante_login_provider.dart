import 'package:flutter/material.dart';
import 'package:elecciones_jp/features/flujo_votante/2_votacion_screen.dart';
import 'package:elecciones_jp/shared/utils/rne.dart';
import 'package:elecciones_jp/data/repositories/centro_repository_impl.dart';
import 'package:elecciones_jp/data/repositories/votante_repository_impl.dart';
import 'package:elecciones_jp/data/repositories/voto_repository_impl.dart';
import 'package:elecciones_jp/domain/usecases/verificar_votante_use_case.dart';
import 'dart:io';

class VotanteLoginProvider with ChangeNotifier {
  String _nombreVotante = "";
  String _mensajeEstado = "Esperando DNI...";
  bool _puedeVotar = false;
  bool _autenticacionOk = false;
  bool _isLoading = false;

  final VerificarVotanteUseCase _verificarVotante =
      VerificarVotanteUseCase(VotanteRepositoryImpl(), VotoRepositoryImpl());

  final CentroRepositoryImpl _centroRepo = CentroRepositoryImpl();

  String _centroNombre = "Sistema de Votación";
  ImageProvider? _logoCentro;

  String get centroNombre => _centroNombre;
  ImageProvider? get logoCentro => _logoCentro;

  String get nombreVotante => _nombreVotante;
  String get mensajeEstado => _mensajeEstado;
  bool get puedeVotar => _puedeVotar;
  bool get autenticacionOk => _autenticacionOk;
  bool get isLoading => _isLoading;

  VotanteLoginProvider() {
    refrescarDatosCentro();
  }

  Future<void> refrescarDatosCentro() async {
    try {
      final centro = await _centroRepo.findOne();

      if (centro != null) {
        _centroNombre = centro.nombre ?? "Sistema de Votación";
        final logoPath = centro.logoPath;

        if (logoPath != null && logoPath.isNotEmpty) {
          final logoFile = File(logoPath);
          if (await logoFile.exists()) {
            _logoCentro = FileImage(logoFile);
          } else {
            _logoCentro = null;
          }
        } else {
          _logoCentro = null;
        }
      } else {
        _centroNombre = "Sistema de Votación";
        _logoCentro = null;
      }
    } catch (e) {
      _centroNombre = "Error al cargar";
      _logoCentro = null;
    }
    notifyListeners();
  }

  Future<void> verificarVotante(String rne) async {
    if (rne.isEmpty) {
      _mensajeEstado = "El DNI no puede estar vacío.";
      _autenticacionOk = false;
      notifyListeners();
      return;
    }
    _isLoading = true;
    _mensajeEstado = "Buscando...";
    _autenticacionOk = false;
    _nombreVotante = "";
    notifyListeners();

    await Future.delayed(const Duration(milliseconds: 300));

    try {
      final resultado = await _verificarVotante.execute(rne);
      _mensajeEstado = resultado.mensaje;
      _nombreVotante = resultado.nombreVotante;
      _autenticacionOk = resultado.encontrado && resultado.habilitado;
      _puedeVotar = resultado.habilitado;
    } catch (e) {
      _mensajeEstado = "Error al consultar la base de datos.";
      _autenticacionOk = false;
      _puedeVotar = false;
    }

    _isLoading = false;
    notifyListeners();
  }

  void navegarAVotar(BuildContext context, String rne) {
    if (!_autenticacionOk) return;
    final String nombre = _nombreVotante;

    // Se pasa la forma canonica: es la que queda registrada en la bitacora
    // de votos y la que el indice unico puede comparar.
    final String? rneNormalizado = Rne.normalizar(rne);
    if (rneNormalizado == null) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) =>
            VotacionScreen(rne: rneNormalizado, nombreAlumno: nombre),
      ),
    ).then((_) {
      limpiarCampos();
    });
  }

  void limpiarCampos() {
    _nombreVotante = "";
    _mensajeEstado = "Esperando DNI...";
    _puedeVotar = false;
    _autenticacionOk = false;
    notifyListeners();
  }

  void resetStateOnTextChange() {
    if (_autenticacionOk || _mensajeEstado != "Esperando DNI...") {
      limpiarCampos();
    }
  }

  void salir(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          title: const Text("Salir"),
          content: const Text("¿Quieres salir del sistema de votación?"),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(dialogContext).pop();
              },
              child: const Text("Cancelar"),
            ),
            TextButton(
              onPressed: () {
                exit(0);
              },
              child: Text(
                "Salir",
                style:
                    TextStyle(color: Theme.of(dialogContext).colorScheme.error),
              ),
            ),
          ],
        );
      },
    );
  }
}
