import 'package:elecciones_jp/domain/entities/votante_entity.dart';
import 'package:elecciones_jp/domain/repositories/votante_repository.dart';
import 'package:elecciones_jp/shared/utils/rne.dart';

class AgregarVotanteResult {
  final bool exito;
  final String mensaje;
  final VotanteEntity? votante;

  const AgregarVotanteResult({
    required this.exito,
    required this.mensaje,
    this.votante,
  });
}

class AgregarVotanteUseCase {
  final VotanteRepository _votantes;

  AgregarVotanteUseCase(this._votantes);

  Future<AgregarVotanteResult> execute({
    required String dni,
    required String nombre,
  }) async {
    final String? rneNormalizado = Rne.normalizar(dni);
    final String nombreLimpio = nombre.trim().toUpperCase();

    if (rneNormalizado == null) {
      return const AgregarVotanteResult(
        exito: false,
        mensaje: 'El DNI ingresado no tiene un formato válido.',
      );
    }

    if (nombreLimpio.isEmpty) {
      return const AgregarVotanteResult(
        exito: false,
        mensaje: 'El nombre del votante no puede estar vacío.',
      );
    }

    final VotanteEntity? existente = await _votantes.findByRne(rneNormalizado);
    if (existente != null) {
      return const AgregarVotanteResult(
        exito: false,
        mensaje: 'Ya existe un votante con ese DNI.',
      );
    }

    final VotanteEntity votante = VotanteEntity(
      id: 0,
      rne: rneNormalizado,
      nombre: nombreLimpio,
      voto: false,
    );
    await _votantes.insert(votante);

    return AgregarVotanteResult(
      exito: true,
      mensaje: 'Votante guardado.',
      votante: votante,
    );
  }
}
