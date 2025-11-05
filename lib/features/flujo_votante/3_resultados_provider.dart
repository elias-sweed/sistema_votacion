import 'package:flutter/material.dart';
import 'package:elecciones_jp/shared/models/resultado_candidato.dart';
import 'package:elecciones_jp/shared/services/database_service.dart';
import 'package:sqflite/sqflite.dart';

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

  Future<void> cargarResultados() async {
    _isLoading = true;
    _resultados = [];
    notifyListeners();

    try {
      final db = await DatabaseService.instance.database;

      final int? totalVotantes = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM votantes'));
      _padronTotal = totalVotantes ?? 0;

      final int? totalEmitidos = Sqflite.firstIntValue(
          await db.rawQuery('SELECT COUNT(*) FROM votantes WHERE voto = 1'));
      _votosEmitidos = totalEmitidos ?? 0;

      if (_padronTotal > 0) {
        _participacion = (_votosEmitidos / _padronTotal);
      } else {
        _participacion = 0.0;
      }

      _votosPendientes = _padronTotal - _votosEmitidos;

      final List<Map<String, dynamic>> mapsCandidatos =
          await db.query('candidatos', orderBy: 'votos DESC');

      final List<ResultadoCandidato> tempResultados = [];
      int contador = 0;

      for (var map in mapsCandidatos) {
        contador++;
        final int votosCandidato = map['votos'] as int;
        final String nombreCandidato = map['nombre'] as String;

        double progreso = 0.0;
        double porciento = 0.0;

        if (_votosEmitidos > 0) {
          progreso = (votosCandidato / _votosEmitidos);
          porciento = progreso * 100;
        }

        String porcientoFormateado = "${porciento.toStringAsFixed(2)} %";

        tempResultados.add(ResultadoCandidato(
          correlativo: contador.toString(),
          nombre: nombreCandidato,
          progreso: progreso,
          votos: votosCandidato.toString(),
          porcentaje: porcientoFormateado,
          // El color se asigna en la pantalla, no aquí.
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