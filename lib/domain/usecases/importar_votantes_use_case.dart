import 'package:elecciones_jp/domain/entities/votante_entity.dart';
import 'package:elecciones_jp/domain/repositories/votante_repository.dart';

class ImportarVotantesUseCase {
  final VotanteRepository _votantes;

  ImportarVotantesUseCase(this._votantes);

  Future<int> execute(List<VotanteEntity> votantes) {
    return _votantes.insertMany(votantes);
  }
}
