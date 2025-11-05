import 'dart:io';

class Candidato {
  final int? codigo;
  final int numero;
  final String nombre;
  final String imagen;
  final int votos;

  Candidato({
    this.codigo,
    required this.numero,
    required this.nombre,
    required this.imagen,
    this.votos = 0,
  });
}

class CandidatoParaMostrar {
  final int numero;
  final String nombre;
  final File imagen;

  CandidatoParaMostrar({
    required this.numero,
    required this.nombre,
    required this.imagen,
  });
}