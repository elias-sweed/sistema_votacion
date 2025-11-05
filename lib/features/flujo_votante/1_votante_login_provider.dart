import 'package:flutter/material.dart';
import 'package:elecciones_jp/features/flujo_votante/2_votacion_screen.dart';
import 'package:elecciones_jp/shared/services/database_service.dart';
import 'dart:io';

class VotanteLoginProvider with ChangeNotifier {
  String _nombreVotante = "";
  String _mensajeEstado = "Esperando DNI...";
  bool _puedeVotar = false;
  bool _autenticacionOk = false;
  bool _isLoading = false;

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
      final db = await DatabaseService.instance.database;
      final centroData = await db.query('centro', limit: 1);

      if (centroData.isNotEmpty) {
        final centro = centroData.first;
        _centroNombre =
            (centro['nombre'] as String?) ?? "Sistema de Votación";
        final logoPath = centro['logoPath'] as String?;

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
      final db = await DatabaseService.instance.database;
      final List<Map<String, dynamic>> votantes = await db.query(
        'votantes',
        where: 'rne = ?',
        whereArgs: [rne],
      );

      if (votantes.isNotEmpty) {
        final votante = votantes.first;
        _nombreVotante = votante['nombre'] as String;
        
        final haVotado = (votante['voto'] as int) == 1;

        if (haVotado) {
          _mensajeEstado = "Este votante ya ha emitido su voto.";
          _autenticacionOk = false;
          _puedeVotar = false;
        } else {
          _mensajeEstado = "Votante habilitado.";
          _autenticacionOk = true;
          _puedeVotar = true;
        }
      } else {
        _mensajeEstado = "DNI no encontrado en el padrón.";
        _autenticacionOk = false;
        _puedeVotar = false;
      }
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

    limpiarCampos();

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => VotacionScreen(rne: rne, nombreAlumno: nombre),
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