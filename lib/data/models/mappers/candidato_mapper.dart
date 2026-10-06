import 'package:elecciones_jp/domain/entities/candidato_entity.dart';

class CandidatoMapper {
  CandidatoMapper._();

  static CandidatoEntity fromMap(Map<String, dynamic> map) {
    return CandidatoEntity(
      codigo: map['codigo'] as int?,
      numero: map['numero'] as int,
      nombre: map['nombre'] as String,
      imagen: map['imagen'] as String,
      votos: map['votos'] as int? ?? 0,
    );
  }

  static Map<String, dynamic> toMap(CandidatoEntity candidato) {
    return {
      'codigo': candidato.codigo,
      'numero': candidato.numero,
      'nombre': candidato.nombre,
      'imagen': candidato.imagen,
      'votos': candidato.votos,
    };
  }
}

