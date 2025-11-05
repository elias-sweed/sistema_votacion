import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
// --- INICIO DEL ARREGLO ---
// Ruta antigua incorrecta.
// Apuntamos al provider que está en la misma carpeta.
import 'borrar_datos_provider.dart';
// --- FIN DEL ARREGLO ---

class BorrarDatosScreen extends StatelessWidget {
  const BorrarDatosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => BorrarDatosProvider(),
      child: Consumer<BorrarDatosProvider>(
        builder: (context, provider, _) {
          final theme = Theme.of(context);

          return Scaffold(
            appBar: AppBar(
              title: const Text("Borrar Datos del Sistema"),
              centerTitle: false,
            ),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _BotonBorrar(
                        texto: "Eliminar Resultados",
                        icono: Icons.bar_chart,
                        onPressed: provider.puedeBorrarResultados
                            ? () => provider.eliminarResultados(context)
                            : null,
                        color: theme.colorScheme.tertiary,
                      )
                          .animate()
                          .fadeIn(duration: 400.ms)
                          .move(begin: const Offset(0, 20)),
                      const SizedBox(height: 16),
                      _BotonBorrar(
                        texto: "Eliminar Padrón Electoral",
                        icono: Icons.group_remove,
                        onPressed: provider.puedeBorrarElectores
                            ? () => provider.eliminarElectores(context)
                            : null,
                        color: theme.colorScheme.tertiary,
                      )
                          .animate()
                          .fadeIn(duration: 400.ms, delay: 100.ms)
                          .move(begin: const Offset(0, 20)),
                      const SizedBox(height: 16),
                      _BotonBorrar(
                        texto: "Eliminar Candidatos",
                        icono: Icons.delete_forever,
                        onPressed: provider.puedeBorrarCandidatos
                            ? () => provider.eliminarCandidatos(context)
                            : null,
                        color: theme.colorScheme.tertiary,
                      )
                          .animate()
                          .fadeIn(duration: 400.ms, delay: 200.ms)
                          .move(begin: const Offset(0, 20)),
                      const SizedBox(height: 16),
                      _BotonBorrar(
                        texto: "Eliminar Centro",
                        icono: Icons.school,
                        onPressed: provider.puedeBorrarCentro
                            ? () => provider.eliminarCentro(context)
                            : null,
                        color: theme.colorScheme.tertiary,
                      )
                          .animate()
                          .fadeIn(duration: 400.ms, delay: 300.ms)
                          .move(begin: const Offset(0, 20)),
                      const SizedBox(height: 32),
                      const Divider(),
                      const SizedBox(height: 16),
                      _BotonBorrar(
                        texto: "Eliminar TODO",
                        icono: Icons.delete_sweep,
                        onPressed: provider.puedeBorrarTodo
                            ? () => provider.eliminarTodo(context)
                            : null,
                        color: theme.colorScheme.error,
                      )
                          .animate()
                          .fadeIn(duration: 400.ms, delay: 400.ms)
                          .move(begin: const Offset(0, 20)),
                    ],
                  ),
                ),
              ),
            ),
            bottomNavigationBar: BottomAppBar(
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton.icon(
                      onPressed: () => provider.salir(context),
                      icon: const Icon(Icons.exit_to_app),
                      label: const Text("Salir"),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _BotonBorrar extends StatelessWidget {
  final String texto;
  final IconData icono;
  final VoidCallback? onPressed;
  final Color color;

  const _BotonBorrar({
    required this.texto,
    required this.icono,
    required this.onPressed,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ElevatedButton.icon(
      icon: Icon(icono, size: 24),
      label: Text(texto, style: const TextStyle(fontWeight: FontWeight.w600)),
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        disabledBackgroundColor: theme.colorScheme.surfaceContainerHighest,
        disabledForegroundColor: theme.colorScheme.onSurfaceVariant,
        minimumSize: const Size(double.infinity, 55),
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
      ),
      onPressed: onPressed,
    );
  }
}