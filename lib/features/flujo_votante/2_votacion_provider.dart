import 'dart:async';
import 'package:flutter/material.dart';
import 'package:elecciones_jp/shared/models/candidato.dart';
import 'package:elecciones_jp/shared/services/database_service.dart';

class VotacionProvider with ChangeNotifier {
  final String rneVotante;
  final String nombreVotante;
  List<Candidato> _candidatos = [];
  Candidato? _candidatoSeleccionado;
  bool _votoConfirmado = false;
  Timer? _timer;
  int _segundosRestantes = 5;
  bool _isLoading = true;

  List<Candidato> get candidatos => _candidatos;
  Candidato? get candidatoSeleccionado => _candidatoSeleccionado;
  bool get votoConfirmado => _votoConfirmado;
  int get segundosRestantes => _segundosRestantes;
  bool get isLoading => _isLoading;

  VotacionProvider({required this.rneVotante, required this.nombreVotante}) {
    _cargarCandidatos();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _cargarCandidatos() async {
    _isLoading = true;
    notifyListeners();
    try {
      final db = await DatabaseService.instance.database;
      final List<Map<String, dynamic>> maps =
          await db.query('candidatos', orderBy: 'numero');

      // --- AQUÍ ESTÁ EL ARREGLO (fromMap) ---
      _candidatos = List.generate(maps.length, (i) {
        final map = maps[i];
        return Candidato(
          codigo: map['codigo'] as int,
          numero: map['numero'] as int,
          nombre: map['nombre'] as String,
          imagen: map['imagen'] as String,
          votos: map['votos'] as int,
        );
      });
      // --- FIN DEL ARREGLO ---

    } catch (e) {
      _candidatos = [];
    }
    _isLoading = false;
    notifyListeners();
  }

  void seleccionarCandidato(Candidato candidato) {
    if (_votoConfirmado) return;
    _candidatoSeleccionado = candidato;
    notifyListeners();
  }

  Future<void> confirmarVoto(BuildContext context, String rne) async {
    if (_candidatoSeleccionado == null) {
      _mostrarAlerta(
          context, "Error", "Debe seleccionar un candidato primero.");
      return;
    }

    final bool confirmado = await _mostrarDialogoConfirmacion(context);
    if (!confirmado) return;

    try {
      final db = await DatabaseService.instance.database;
      await db.transaction((txn) async {
        await txn.rawUpdate(
          'UPDATE candidatos SET votos = votos + 1 WHERE codigo = ?',
          [_candidatoSeleccionado!.codigo],
        );
        await txn.rawUpdate(
          'UPDATE votantes SET voto = 1 WHERE rne = ?',
          [rne],
        );
      });

      _votoConfirmado = true;
      _iniciarTimer();
      notifyListeners();
    } catch (e) {
      // --- AQUÍ ESTÁ EL ARREGLO (async gap) ---
      if (context.mounted) {
        _mostrarAlerta(context, "Error al Votar",
            "No se pudo registrar el voto: ${e.toString()}");
      }
      // --- FIN DEL ARREGLO ---
    }
  }

  Future<bool> _mostrarDialogoConfirmacion(BuildContext context) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          title: const Text('Confirmar Voto'),
          content: Text(
              '¿Está seguro de votar por "${_candidatoSeleccionado?.nombre}"?'),
          actions: <Widget>[
            TextButton(
              onPressed: () {
                Navigator.of(dialogContext).pop(false);
              },
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.of(dialogContext).pop(true);
              },
              child: const Text('Confirmar'),
            ),
          ],
        );
      },
    );
    return result ?? false;
  }

  void _iniciarTimer() {
    _segundosRestantes = 5;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      _segundosRestantes--;
      notifyListeners();
      if (_segundosRestantes <= 0) {
        timer.cancel();
      }
    });
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
              onPressed: () => Navigator.of(context).pop(),
              child: const Text("Aceptar"),
            ),
          ],
        );
      },
    );
  }
}