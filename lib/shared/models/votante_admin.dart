class VotanteAdmin {
  final int id;
  String rne;
  String nombre;
  final bool voto;

  VotanteAdmin({
    required this.id,
    required this.rne,
    required this.nombre,
    required this.voto,
  });

  factory VotanteAdmin.fromMap(Map<String, dynamic> map) {
    return VotanteAdmin(
      id: map['id'],
      rne: map['rne'] ?? '', // Convertir NULL de BD a String vacío
      nombre: map['nombre'],
      voto: map['voto'] == 1,
    );
  }
}