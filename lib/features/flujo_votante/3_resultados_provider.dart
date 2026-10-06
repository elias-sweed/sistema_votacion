import 'package:flutter/material.dart';
import 'package:elecciones_jp/shared/models/resultado_candidato.dart';
import 'package:elecciones_jp/data/repositories/candidato_repository_impl.dart';
import 'package:elecciones_jp/data/repositories/votante_repository_impl.dart';
import 'package:elecciones_jp/data/repositories/voto_repository_impl.dart';

class VerResultadosProvider with ChangeNotifier {
  bool _isLoading = true;
  int _votosEmitidos = 0;
  int _padronTotal = 0;
  int _votosPendientes = 0;
  double _participacion = 0.0;
  List<ResultadoCandidato> _resultados = [];

  bool get isLoading => _isLoading;
  int get votosEmitidos => _votosEmitidos;
  int get padronTotal => _padronTotal;
  int get votosPendientes => _votosPendientes;
  double get participacion => _participacion;
  List<ResultadoCandidato> get resultados => _resultados;

  final CandidatoRepositoryImpl _candidatoRepo = CandidatoRepositoryImpl();
  final VotanteRepositoryImpl _votanteRepo = VotanteRepositoryImpl();
  final VotoRepositoryImpl _votoRepo = VotoRepositoryImpl();

  Future<void> cargarResultados() async {
    _isLoading = true;
    _resultados = [];
    notifyListeners();

    try {
      _padronTotal = await _votanteRepo.countValid();
      _votosEmitidos = await _votoRepo.countAll();

      if (_padronTotal > 0) {
        _participacion = (_votosEmitidos / _padronTotal);
      } else {
        _participacion = 0.0;
      }

      _votosPendientes = _padronTotal - _votosEmitidos;
      if (_votosPendientes < 0) _votosPendientes = 0;

      final candidatos = await _candidatoRepo.findAllWithVotes();
      candidatos.sort((a, b) {
        final voteCompare = b.votos.compareTo(a.votos);
        if (voteCompare != 0) return voteCompare;
        return a.numero.compareTo(b.numero);
      });

      final List<ResultadoCandidato> tempResultados = [];
      int contador = 0;

      for (final candidato in candidatos) {
        contador++;
        final int votosCandidato = candidato.votos;
        final String nombreCandidato = candidato.nombre;

        double progreso = 0.0;
        double porciento = 0.0;

        if (_votosEmitidos > 0) {
          progreso = (votosCandidato / _votosEmitidos).clamp(0.0, 1.0);
          porciento = progreso * 100;
        }

        String porcientoFormateado = "${porciento.toStringAsFixed(2)} %";

        tempResultados.add(ResultadoCandidato(
          correlativo: contador.toString(),
          nombre: nombreCandidato,
          progreso: progreso,
          votos: votosCandidato.toString(),
          porcentaje: porcientoFormateado,
        ));
      }
      _resultados = tempResultados;
    } catch (e) {
      // Manejo de error
    }

    _isLoading = false;
    notifyListeners();
  }
}
