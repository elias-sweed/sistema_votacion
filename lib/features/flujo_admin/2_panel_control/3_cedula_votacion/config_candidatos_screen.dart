import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config_candidatos_provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:elecciones_jp/shared/models/candidato.dart';

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
          // Lista de candidatos
          Expanded(
            flex: 2,
            child: Container(
              color: theme.colorScheme.surfaceContainerHighest.withAlpha(128),
              child: provider.listaCandidatos.isEmpty
                  ? Center(
                      child: Text(
                      "No hay candidatos agregados",
                      style: theme.textTheme.titleMedium,
                    ))
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: provider.listaCandidatos.length,
                      itemBuilder: (context, index) {
                        final candidato = provider.listaCandidatos[index];
                        return _buildCandidatoCard(context, candidato, provider)
                            .animate()
                            .fadeIn(delay: (100 * (index % 10)).ms);
                      },
                    ),
            ),
          ),

          // Panel para agregar
          Expanded(
            flex: 1,
            child: Container(
              padding: const EdgeInsets.all(24.0),
              color: theme.colorScheme.surface,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    "Agregar Candidato",
                    style: theme.textTheme.headlineSmall
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    "Agregando Candidato N°: ${provider.numeroSiguiente}",
                    style: theme.textTheme.titleLarge
                        ?.copyWith(color: theme.colorScheme.primary),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _nombreController,
                    decoration: const InputDecoration(
                      labelText: "Nombre del Candidato",
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  AspectRatio(
                    aspectRatio: 16 / 10,
                    child: InkWell(
                      onTap: () => provider.seleccionarImagen(),
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: theme.dividerColor),
                          borderRadius: BorderRadius.circular(8),
                          color: theme.colorScheme.surfaceContainerLowest,
                        ),
                        child: provider.imagenSeleccionada != null
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.file(
                                  provider.imagenSeleccionada!,
                                  fit: BoxFit.cover,
                                ),
                              )
                            : Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.add_a_photo_outlined,
                                      size: 40,
                                      color: theme.colorScheme.primary),
                                  const SizedBox(height: 8),
                                  const Text("Seleccionar Imagen"),
                                ],
                              ),
                      ),
                    ),
                  ),
                  const Spacer(), // Empuja el botón hacia abajo
                  const Divider(height: 24),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.add_circle_outline),
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

  Widget _buildCandidatoCard(BuildContext context,
      CandidatoParaMostrar candidato, ConfigCandidatosProvider provider) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8.0),
      elevation: 2,
      child: ListTile(
        leading: CircleAvatar(
          radius: 25,
          backgroundImage: FileImage(candidato.imagen),
          onBackgroundImageError: (e, s) =>
              const Icon(Icons.error), // Fallback por si la imagen se borra
        ),
        title: Text(
          "N° ${candidato.numero}: ${candidato.nombre}",
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        trailing: IconButton(
          icon: Icon(Icons.delete_outline, color: theme.colorScheme.error),
          onPressed: () => provider.eliminarCandidato(candidato, context),
        ),
      ),
    );
  }
}