import 'package:elecciones_jp/domain/entities/votante_entity.dart';
import 'package:elecciones_jp/domain/repositories/votante_repository.dart';
import 'package:elecciones_jp/domain/repositories/voto_repository.dart';
import 'package:elecciones_jp/domain/value_objects/rne.dart';

class VerificarVotanteResult {
  final bool encontrado;
  final bool habilitado;
  final bool haVotado;
  final String nombreVotante;
  final String mensaje;

  const VerificarVotanteResult({
    required this.encontrado,
    required this.habilitado,
    required this.haVotado,
    required this.nombreVotante,
    required this.mensaje,
  });
}

class VerificarVotanteUseCase {
  final VotanteRepository _votantes;
  final VotoRepository _votos;

  VerificarVotanteUseCase(this._votantes, this._votos);

  Future<VerificarVotanteResult> execute(String rne) async {
    final String? rneNormalizado = Rne.normalizar(rne);
    if (rneNormalizado == null) {
      return const VerificarVotanteResult(
        encontrado: false,
        habilitado: false,
        haVotado: false,
        nombreVotante: '',
        mensaje: 'El DNI no tiene un formato valido.',
      );
    }

    final VotanteEntity? votante = await _votantes.findByRne(rneNormalizado);
    if (votante == null) {
      return const VerificarVotanteResult(
        encontrado: false,
        habilitado: false,
        haVotado: false,
        nombreVotante: '',
        mensaje: 'DNI no encontrado en el padrón.',
      );
    }

    final int totalVotos = await _votos.countByRne(rneNormalizado);
    final bool haVotado = votante.voto || totalVotos > 0;
    return VerificarVotanteResult(
      encontrado: true,
      habilitado: !haVotado,
      haVotado: haVotado,
      nombreVotante: votante.nombre,
      mensaje: haVotado ? 'Este votante ya ha emitido su voto.' : 'Votante habilitado.',
    );
  }
}



