import 'package:elecciones_jp/domain/entities/centro_entity.dart';

class CentroMapper {
  CentroMapper._();

  static CentroEntity fromMap(Map<String, dynamic> map) {
    return CentroEntity(
      id: map['id'] as int,
      nombre: map['nombre'] as String?,
      logoPath: map['logoPath'] as String?,
    );
  }

  static Map<String, dynamic> toMap(CentroEntity centro) {
    return {
      'id': centro.id,
      'nombre': centro.nombre,
      'logoPath': centro.logoPath,
    };
  }
}



