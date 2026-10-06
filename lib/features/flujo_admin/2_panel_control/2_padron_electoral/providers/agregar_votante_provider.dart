import 'package:flutter/material.dart';
import 'package:elecciones_jp/data/repositories/votante_repository_impl.dart';
import 'package:elecciones_jp/domain/usecases/agregar_votante_use_case.dart';

class AgregarVotanteProvider with ChangeNotifier {
  final TextEditingController dniController = TextEditingController();
  final TextEditingController nombreController = TextEditingController();
  bool _isAceptarEnabled = false;

  bool get isAceptarEnabled => _isAceptarEnabled;
  final String? dniInicial;

  final AgregarVotanteUseCase _agregarVotante =
      AgregarVotanteUseCase(VotanteRepositoryImpl());

  AgregarVotanteProvider({this.dniInicial}) {
    dniController.text = dniInicial ?? '';
    dniController.addListener(_updateAceptarButtonState);
    nombreController.addListener(_updateAceptarButtonState);
    _updateAceptarButtonState();
  }

  @override
  void dispose() {
    dniController.removeListener(_updateAceptarButtonState);
    nombreController.removeListener(_updateAceptarButtonState);
    dniController.dispose();
    nombreController.dispose();
    super.dispose();
  }

  void _updateAceptarButtonState() {
    final bool newState =
        dniController.text.isNotEmpty && nombreController.text.isNotEmpty;
    if (_isAceptarEnabled != newState) {
      _isAceptarEnabled = newState;
      notifyListeners();
    }
  }

  Future<void> guardarVotante(BuildContext context) async {
    final String dni = dniController.text.trim();
    final String nombre = nombreController.text.trim().toUpperCase();

    try {
      final resultado = await _agregarVotante.execute(dni: dni, nombre: nombre);
      if (!context.mounted) return;

      if (!resultado.exito) {
        _mostrarAlerta(context, "Error al guardar", resultado.mensaje);
        return;
      }

      _mostrarAlerta(
        context,
        "Votante guardado",
        "Se ha agregado al sistema el votante ${resultado.votante?.nombre ?? nombre} con el registro ${resultado.votante?.rne ?? dni}",
        onAceptar: () {
          Navigator.of(context).pop();
          Navigator.of(context).pop(true);
        },
      );
      dniController.clear();
      nombreController.clear();
    } catch (e) {
      if (!context.mounted) return;
      _mostrarAlerta(
        context,
        "Error al guardar",
        "No se pudo agregar el nuevo votante. Error: ${e.toString()}",
      );
    }
  }

  void salir(BuildContext context) {
    Navigator.of(context).pop();
  }

  void _mostrarAlerta(BuildContext context, String titulo, String contenido,
      {VoidCallback? onAceptar}) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(titulo),
          content: Text(contenido),
          actions: [
            TextButton(
              onPressed: onAceptar ?? () => Navigator.of(context).pop(),
              child: const Text("Aceptar"),
            ),
          ],
        );
      },
    );
  }
}
