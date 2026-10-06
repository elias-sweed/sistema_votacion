import 'package:elecciones_jp/domain/entities/voto_entity.dart';

class VotoMapper {
  VotoMapper._();

  static VotoEntity fromMap(Map<String, dynamic> map) {
    return VotoEntity(
      id: map['id'] as int,
      rne: map['rne'] as String,
      codigoCandidato: map['codigo_candidato'] as int?,
      fecha: map['fecha'] as String,
    );
  }

  static Map<String, dynamic> toMap(VotoEntity voto) {
    return {
      'id': voto.id,
      'rne': voto.rne,
      'codigo_candidato': voto.codigoCandidato,
      'fecha': voto.fecha,
    };
  }
}

