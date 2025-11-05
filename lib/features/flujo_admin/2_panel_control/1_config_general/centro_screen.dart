import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'centro_provider.dart';

class CentroScreen extends StatelessWidget {
  const CentroScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => CentroProvider(),
      child: Consumer<CentroProvider>(
        builder: (context, provider, _) {
          final theme = Theme.of(context);

          return PopScope(
            canPop: false,
            onPopInvokedWithResult: (bool didPop, dynamic result) {
              if (!didPop) {
                final bool cambios = context.read<CentroProvider>().huboCambios;
                Navigator.of(context).pop(cambios);
              }
            },
            child: Scaffold(
              appBar: AppBar(
                title: const Text("Configurar Centro"),
                centerTitle: false,
              ),
              body: provider.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Center(
                            child: InkWell(
                              borderRadius: BorderRadius.circular(12),
                              splashColor: theme.colorScheme.primaryContainer.withValues(alpha: 0.5),
                              onTap: provider.seleccionarImagen,
                              child: Card(
                                elevation: 4,
                                surfaceTintColor: theme.colorScheme.surface,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                clipBehavior: Clip.antiAlias,
                                child: Container(
                                  height: 180,
                                  width: 200,
                                  decoration: BoxDecoration(
                                    border: Border.all(
                                      color:
                                          theme.colorScheme.outlineVariant,
                                      width: 1,
                                    ),
                                    borderRadius:
                                        BorderRadius.circular(12),
                                  ),
                                  child: provider.imagenSeleccionada != null &&
                                          provider.imagenSeleccionada!
                                              .existsSync()
                                      ? Image.file(
                                          provider.imagenSeleccionada!,
                                          fit: BoxFit.contain,
                                          errorBuilder: (context, error,
                                                  stackTrace) =>
                                              _buildPlaceholder(
                                                  theme, "Error al cargar logo"),
                                        )
                                      : _buildPlaceholder(theme,
                                          "Toca para seleccionar logo"),
                                ),
                              ),
                            ),
                          ).animate().fadeIn(duration: 300.ms).scale(begin: const Offset(0.9, 0.9)),
                          const SizedBox(height: 30),
                          TextFormField(
                            controller: provider.nombreController,
                            decoration: const InputDecoration(
                              labelText: "Nombre del Centro",
                              prefixIcon: Icon(Icons.school_outlined),
                            ),
                            style: const TextStyle(fontSize: 18),
                          ).animate().fadeIn(delay: 200.ms),
                        ],
                      ),
                    ),
              bottomNavigationBar: BottomAppBar(
                elevation: 10,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      ElevatedButton.icon(
                        onPressed: () => provider.aceptar(context),
                        icon: const Icon(Icons.check_circle_outline),
                        label: const Text("Aceptar"),
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size(120, 45),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: () => provider.salir(context),
                        icon: const Icon(Icons.exit_to_app),
                        label: const Text("Salir"),
                        style: TextButton.styleFrom(
                          foregroundColor: theme.colorScheme.error,
                          minimumSize: const Size(120, 45),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildPlaceholder(ThemeData theme, String text) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          Icons.image_search,
          size: 60,
          color: theme.colorScheme.onSurfaceVariant,
        ),
        const SizedBox(height: 12),
        Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: theme.colorScheme.onSurfaceVariant,
            fontSize: 14,
          ),
        ),
      ],
    );
  }
}