import 'package:flutter/material.dart';

class ConfigMenuButton extends StatelessWidget {
  final String texto;
  final IconData icono;
  final VoidCallback? onPressed;

  const ConfigMenuButton({
    super.key,
    required this.texto,
    required this.icono,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {

    final ButtonStyle? temaGlobal = Theme.of(context).elevatedButtonTheme.style;
    final ButtonStyle estiloLocal = ElevatedButton.styleFrom(
      // 1. Usamos los colores del tema
      backgroundColor: Theme.of(context).colorScheme.primary,
      foregroundColor: Theme.of(context).colorScheme.onPrimary,
      
      minimumSize: const Size(double.infinity, 60),
      alignment: Alignment.centerLeft,
      padding: const EdgeInsets.symmetric(horizontal: 24),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 32.0),
      child: ElevatedButton.icon(
        style: temaGlobal?.merge(estiloLocal),
        
        onPressed: onPressed,
        icon: Icon(icono, size: 24),
        label: Text(texto),
      ),
    );
  }
}