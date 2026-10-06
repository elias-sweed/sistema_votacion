import 'package:elecciones_jp/domain/entities/votante_entity.dart';

class VotanteMapper {
  VotanteMapper._();

  static VotanteEntity fromMap(Map<String, dynamic> map) {
    return VotanteEntity(
      id: map['id'] as int,
      rne: map['rne'] as String?,
      nombre: map['nombre'] as String,
      voto: map['voto'] == 1,
    );
  }

  static Map<String, dynamic> toMap(VotanteEntity votante) {
    return {
      'id': votante.id,
      'rne': votante.rne,
      'nombre': votante.nombre,
      'voto': votante.voto ? 1 : 0,
    };
  }
}



