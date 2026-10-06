class CandidatoEntity {
  final int? codigo;
  final int numero;
  final String nombre;
  final String imagen;
  final int votos;

  const CandidatoEntity({
    this.codigo,
    required this.numero,
    required this.nombre,
    required this.imagen,
    this.votos = 0,
  });
}

