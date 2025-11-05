import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
// --- INICIO DEL ARREGLO ---
// La ruta antigua estaba mal.
// Como movimos ambos archivos a la misma carpeta '3_cedula_votacion',
// ahora solo necesitas un import local.
import 'config_candidatos_provider.dart';
// --- FIN DEL ARREGLO ---
import 'package:flutter_animate/flutter_animate.dart';

class ConfigCandidatosScreen extends StatefulWidget {
  const ConfigCandidatosScreen({super.key});

  @override
  State<ConfigCandidatosScreen> createState() => _ConfigCandidatosScreenState();
}

class _ConfigCandidatosScreenState extends State<ConfigCandidatosScreen> {
  final TextEditingController _nombreController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ConfigCandidatosProvider>().initCandidatos();
    });
  }

  @override
  void dispose() {
    _nombreController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ConfigCandidatosProvider>();
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Configuración de Candidatos"),
        centerTitle: false,
      ),
      body: Row(
        children: [
          Expanded(
            flex: 2,
            child: Container(
              color: theme.colorScheme.surfaceContainerHighest,
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  Text(
                    "Candidatos Agregados",
                    style: theme.textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  Expanded(
                    child: ListView.builder(
                      itemCount: provider.listaCandidatos.length,
                      itemBuilder: (context, index) {
                        final candidato = provider.listaCandidatos[index];
                        return Card(
                          margin: const EdgeInsets.symmetric(vertical: 6.0),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundImage: FileImage(candidato.imagen),
                            ),
                            title: Text(candidato.nombre),
                            subtitle: Text("Número: ${candidato.numero}"),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete_outline,
                                  color: Colors.red),
                              onPressed: () =>
                                  provider.eliminarCandidato(candidato, context),
                            ),
                          ),
                        )
                            .animate()
                            .fadeIn(duration: 400.ms, delay: (index * 50).ms)
                            .move(begin: const Offset(-20, 0));
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: SingleChildScrollView(
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
                            child: provider.imagenSeleccionada != null
                                ? Image.file(
                                    provider.imagenSeleccionada!,
                                    fit: BoxFit.contain,
                                  )
                                : Icon(
                                    Icons.person_search,
                                    size: 80,
                                    color: theme.colorScheme.onSurfaceVariant,
                                  ),
                          ),
                        ),
                        IconButton.filled(
                          icon: const Icon(Icons.image_search),
                          onPressed: () => provider.seleccionarImagen(),
                        ),
                      ],
                    ),
                  ).animate().fadeIn(duration: 400.ms),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _nombreController,
                    decoration: const InputDecoration(
                      labelText: "Nombre del Candidato",
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.person_add_alt_1),
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.add),
                    label: const Text("Agregar Candidato"),
                    style: theme.elevatedButtonTheme.style?.merge(
                      ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                    ),
                    onPressed: () {
                      provider.agregarCandidato(
                          _nombreController.text, context);
                      _nombreController.clear();
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: BottomAppBar(
        elevation: 10,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton.icon(
                onPressed: () => Navigator.of(context).pop(),
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
  }
}