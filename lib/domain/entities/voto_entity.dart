class VotoEntity {
  final int id;
  final String rne;
  final int? codigoCandidato;
  final String fecha;

  const VotoEntity({
    required this.id,
    required this.rne,
    required this.codigoCandidato,
    required this.fecha,
  });
}

