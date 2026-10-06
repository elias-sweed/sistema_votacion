import 'dart:async';
import 'package:flutter/material.dart';
import 'package:elecciones_jp/shared/models/candidato.dart';
import 'package:elecciones_jp/shared/services/database_service.dart';
// *** CAMBIO 1: Importar el paquete de audio ***
import 'package:audioplayers/audioplayers.dart';
import 'package:sqflite/sqflite.dart';

class VotacionProvider with ChangeNotifier {
  final String rneVotante;
  final String nombreVotante;
  List<Candidato> _candidatos = [];
  Candidato? _candidatoSeleccionado;
  bool _votoConfirmado = false;
  Timer? _timer;
  
  // *** CAMBIO 2: Cambiar el tiempo a 2 segundos ***
  int _segundosRestantes = 2; 
  
  bool _isLoading = true;

  // *** CAMBIO 3: Crear la instancia del reproductor de audio ***
  final AudioPlayer _audioPlayer = AudioPlayer();

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
    // *** CAMBIO 4: Limpiar el reproductor de audio ***
    _audioPlayer.dispose(); 
    super.dispose();
  }

  Future<void> _cargarCandidatos() async {
    _isLoading = true;
    notifyListeners();
    try {
      final db = await DatabaseService.instance.database;

      // El total se deriva de la bitacora de votos, no del contador legacy
      // `candidatos.votos`, para que ambos coincidan siempre.
      final List<Map<String, dynamic>> maps = await db.rawQuery('''
        SELECT c.codigo, c.numero, c.nombre, c.imagen,
               (SELECT COUNT(*) FROM votos v
                 WHERE v.codigo_candidato = c.codigo) AS votos
        FROM candidatos c
        ORDER BY c.numero
      ''');

      _candidatos = maps.map((map) {
        return Candidato(
          codigo: map['codigo'],
          numero: map['numero'],
          nombre: map['nombre'],
          imagen: map['imagen'],
          votos: map['votos'],
        );
      }).toList();
    } catch (e) {
      debugPrint("Error al cargar candidatos: $e");
    }
    _isLoading = false;
    notifyListeners();
  }

  void seleccionarCandidato(Candidato candidato) {
    _candidatoSeleccionado = candidato;
    notifyListeners();
  }

  Future<void> confirmarVoto(BuildContext context, String rne) async {
    if (_candidatoSeleccionado == null) {
      _mostrarAlerta(context, "Error", "Debe seleccionar un candidato.");
      return;
    }

    final bool confirmado = await _mostrarDialogoConfirmacion(context);
    if (!confirmado) return;

    try {
      final db = await DatabaseService.instance.database;

      // Voto atomico: el registro en `votos` y la marca en `votantes` se
      // escriben en la misma transaccion, o no se escribe ninguno.
      //
      // El indice unico sobre votos.rne es la garantia real de un solo voto
      // por elector: si dos terminals emiten a la vez, el segundo INSERT
      // falla y la transaccion se revierte.
      await db.transaction((txn) async {
        await txn.insert('votos', {
          'rne': rne,
          'codigo_candidato': _candidatoSeleccionado!.codigo,
          'fecha': DateTime.now().toIso8601String(),
        });

        await txn.update(
          'votantes',
          {'voto': 1},
          where: 'rne = ?',
          whereArgs: [rne],
        );
      });

      // *** CAMBIO 5: Reproducir el sonido ***
      try {
        await _audioPlayer.play(AssetSource('sound/aceptado_sound.mp3'));
      } catch (e) {
        debugPrint("Error al reproducir sonido: $e");
      }

      _votoConfirmado = true;
      _iniciarTimer();
      notifyListeners();

    } on DatabaseException catch (e) {
      // Indice unico violado: este elector ya tiene un voto registrado.
      if (e.isUniqueConstraintError()) {
        _votoConfirmado = false;
        if (!context.mounted) return;
        _mostrarAlerta(context, "Voto ya registrado",
            "Este votante ya emitió su voto.");
        return;
      }
      if (!context.mounted) return;
      _mostrarAlerta(context, "Error", "Error al registrar el voto: $e");
    } catch (e) {
      if (!context.mounted) return;
      _mostrarAlerta(context, "Error", "Error al registrar el voto: $e");
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
              '¿Estás seguro de votar por "${_candidatoSeleccionado?.nombre}"?'),
          actions: <Widget>[
            TextButton(
              onPressed: () {
                Navigator.of(dialogContext).pop(false);
              },
              child: const Text('Revisar'),
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
    // *** CAMBIO 6: Asegurarse que el tiempo inicie en 2 ***
    _segundosRestantes = 2; 
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