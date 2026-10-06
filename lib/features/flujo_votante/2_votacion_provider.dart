import 'dart:async';
import 'package:flutter/material.dart';
import 'package:elecciones_jp/shared/models/candidato.dart';
import 'package:elecciones_jp/data/repositories/candidato_repository_impl.dart';
import 'package:elecciones_jp/data/repositories/voto_repository_impl.dart';
import 'package:audioplayers/audioplayers.dart';

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
  final CandidatoRepositoryImpl _candidatoRepo = CandidatoRepositoryImpl();
  final VotoRepositoryImpl _votoRepo = VotoRepositoryImpl();

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
      final entidades = await _candidatoRepo.findAllWithVotes();
      _candidatos = entidades
          .map((e) => Candidato(
                codigo: e.codigo,
                numero: e.numero,
                nombre: e.nombre,
                imagen: e.imagen,
                votos: e.votos,
              ))
          .toList();
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
      await _votoRepo.registrarVoto(
        rne: rne,
        codigoCandidato: _candidatoSeleccionado!.codigo,
        fecha: DateTime.now(),
      );

      // *** CAMBIO 5: Reproducir el sonido ***
      try {
        await _audioPlayer.play(AssetSource('sound/aceptado_sound.mp3'));
      } catch (e) {
        debugPrint("Error al reproducir sonido: $e");
      }

      _votoConfirmado = true;
      _iniciarTimer();
      notifyListeners();
    } catch (e) {
      if (e.toString().contains('UNIQUE')) {
        _votoConfirmado = false;
        if (!context.mounted) return;
        _mostrarAlerta(context, "Voto ya registrado",
            "Este votante ya emitió su voto.");
        return;
      }
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
              'Â¿EstÃ¡s seguro de votar por "${_candidatoSeleccionado?.nombre}"?'),
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
