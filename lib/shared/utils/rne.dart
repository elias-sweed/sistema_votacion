/// Normalizacion y validacion del RNE (DNI) de un elector.
///
/// El padron puede venir de un Excel con separadores, espacios o ceros a la
/// izquierda ("0123", "1.234", " 1234 "). Si el mismo documento se guardara
/// con dos formas distintas, el elector existiria dos veces en el padron y
/// podria votar dos veces, porque la restriccion de unicidad solo compara
/// el texto guardado. Normalizar aqui hace que todas las comparaciones
/// usen siempre la misma forma canonica.
class Rne {
  Rne._();

  /// Caracteres admitidos en el padron: digitos y separadores habituales.
  static final RegExp _caracteresAdmitidos = RegExp(r'^[\d\s.\-]+$');
  static final RegExp _separadores = RegExp(r'[\s.\-]');

  /// Longitud maxima admitida, para descartar texto que no es un documento.
  static const int _longitudMaxima = 12;

  /// Devuelve la forma canonica del RNE, o `null` si no es un documento valido.
  ///
  /// Rechaza cualquier valor vacio o que contenga letras, en vez de
  /// convertirlo a medias: un dato corrupto debe verse, no deformarse.
  static String? normalizar(String? valor) {
    if (valor == null) return null;

    final String limpio = valor.trim();
    if (limpio.isEmpty) return null;
    if (!_caracteresAdmitidos.hasMatch(limpio)) return null;

    final String digitos = limpio.replaceAll(_separadores, '');
    if (digitos.isEmpty || digitos.length > _longitudMaxima) return null;

    // Se quitan los ceros a la izquierda: "0123" y "123" son el mismo elector.
    final String sinCeros = digitos.replaceFirst(RegExp(r'^0+'), '');
    return sinCeros.isEmpty ? '0' : sinCeros;
  }

  static bool esValido(String? valor) => normalizar(valor) != null;
}

