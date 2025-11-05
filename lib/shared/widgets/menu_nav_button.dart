import 'package:flutter/material.dart';

class MenuNavButton extends StatelessWidget {
  final String texto;
  final IconData icono;
  final VoidCallback onPressed;

  const MenuNavButton({
    super.key,
    required this.texto,
    required this.icono,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    // Usamos el estilo 'ElevatedButton' que definimos en el tema global
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10.0),
      child: SizedBox(
        width: 280, // Ancho fijo para los botones
        child: ElevatedButton.icon(
          onPressed: onPressed,
          icon: Icon(icono, size: 28),
          label: Text(texto),
        ),
      ),
    );
  }
}