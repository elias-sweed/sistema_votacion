import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'config_voto_blanco_provider.dart';

class ConfigVotoBlancoScreen extends StatefulWidget {
  const ConfigVotoBlancoScreen({super.key});

  @override
  State<ConfigVotoBlancoScreen> createState() => _ConfigVotoBlancoScreenState();
}

class _ConfigVotoBlancoScreenState extends State<ConfigVotoBlancoScreen> {
  late final TextEditingController _nombreController;

  @override
  void initState() {
    super.initState();
    final provider = ConfigVotoBlancoProvider();
    _nombreController = TextEditingController(text: provider.nombreFijo);
  }

  @override
  void dispose() {
    _nombreController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ConfigVotoBlancoProvider(),
      child: Consumer<ConfigVotoBlancoProvider>(
        builder: (context, provider, _) {
          final theme = Theme.of(context);

          return Scaffold(
            appBar: AppBar(
              title: const Text("Configurar Voto en Blanco"),
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
                          child: Stack(
                            alignment: Alignment.bottomRight,
                            children: [
                              Container(
                                height: 150,
                                width: 150,
                                decoration: BoxDecoration(
                                  border: Border.all(
                                    color: theme.colorScheme.outline,
                                    width: 2,
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(10),
                                  child: provider.imagenSeleccionada != null &&
                                          provider.imagenSeleccionada!
                                              .existsSync()
                                      ? Image.file(
                                          provider.imagenSeleccionada!,
                                          fit: BoxFit.contain,
                                        )
                                      : (provider.imagenSeleccionada != null &&
                                              provider.imagenSeleccionada!.path
                                                  .startsWith('assets/'))
                                          ? Image.asset(
                                              provider.imagenSeleccionada!.path,
                                              fit: BoxFit.contain,
                                            )
                                          : Icon(
                                              Icons
                                                  .check_box_outline_blank_outlined,
                                              size: 80,
                                              color: theme
                                                  .colorScheme.onSurfaceVariant,
                                            ),
                                ),
                              ),
                              IconButton.filled(
                                icon: const Icon(Icons.edit),
                                onPressed: () => provider.seleccionarImagen(),
                              ),
                            ],
                          ),
                        ).animate().fadeIn(duration: 400.ms),
                        const SizedBox(height: 24),
                        TextField(
                          controller: _nombreController,
                          readOnly: true,
                          decoration: const InputDecoration(
                            labelText: "Nombre Fijo",
                            border: OutlineInputBorder(),
                          ),
                          style: TextStyle(
                            color: theme.colorScheme.onSurfaceVariant,
                            fontWeight: FontWeight.bold,
                          ),
                        )
                            .animate()
                            .fadeIn(duration: 400.ms, delay: 150.ms)
                            .move(begin: const Offset(0, 20)),
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
                      onPressed: provider.imagenSeleccionada != null
                          ? () => provider.aceptar(context)
                          : null,
                      icon: const Icon(Icons.check),
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
          );
        },
      ),
    );
  }
}