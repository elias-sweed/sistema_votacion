import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/importar_votantes_provider.dart';

class ImportarVotantesScreen extends StatelessWidget {
  const ImportarVotantesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ImportarVotantesProvider>();
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Importar Votantes desde Excel"),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            const _BuildInstructionCard()
                .animate()
                .fadeIn(duration: 400.ms)
                .move(begin: const Offset(0, 20)),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: TextEditingController(text: provider.rutaArchivo),
                    readOnly: true,
                    decoration: InputDecoration(
                      labelText: "Ruta del archivo",
                      border: const OutlineInputBorder(),
                      suffixIcon: provider.archivoCargado
                          ? IconButton(
                              icon: const Icon(Icons.close),
                              onPressed: () => provider.limpiarImportacion(),
                              tooltip: "Limpiar",
                            )
                          : null,
                    ),
                  )
                      .animate()
                      .fadeIn(duration: 400.ms, delay: 100.ms)
                      .move(begin: const Offset(0, 20)),
                ),
                const SizedBox(width: 16),
                IconButton.filled(
                  icon: const Icon(Icons.search),
                  iconSize: 30,
                  onPressed: () => provider.buscarArchivo(context),
                  style: IconButton.styleFrom(
                    padding: const EdgeInsets.all(16),
                  ),
                )
                    .animate()
                    .fadeIn(duration: 400.ms, delay: 200.ms)
                    .move(begin: const Offset(0, 20)),
              ],
            ),
            const SizedBox(height: 24),
            if (provider.isLoading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(32.0),
                  child: Column(
                    children: [
                      CircularProgressIndicator(),
                      SizedBox(height: 16),
                      Text("Procesando archivo, por favor espere..."),
                    ],
                  ),
                ),
              ),
            if (provider.archivoCargado)
              _BuildResultCard(
                totalFilasExcel: provider.totalFilasExcel,
                votantesGuardados: provider.votantesGuardados,
                votantesValidos: provider.votantesValidos,
                theme: theme,
              )
                  .animate()
                  .fadeIn(duration: 500.ms)
                  .scale(begin: const Offset(0.9, 0.9)),
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
                onPressed: provider.archivoCargado && !provider.isLoading
                    ? () => provider.importarVotantes(context)
                    : null,
                icon: const Icon(Icons.cloud_upload_outlined),
                label: const Text("Importar"),
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
  }
}

class _BuildResultCard extends StatelessWidget {
  const _BuildResultCard({
    required this.totalFilasExcel,
    required this.votantesGuardados,
    required this.votantesValidos,
    required this.theme,
  });

  final int totalFilasExcel;
  final int votantesGuardados;
  final int votantesValidos;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    final int filasInvalidas = totalFilasExcel - votantesValidos;
    final int duplicados = votantesValidos - votantesGuardados;

    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            const Text(
              "Resultados del Archivo",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const Divider(height: 24),
            _BuildResultRow(
              "Total de filas leídas en Excel:",
              totalFilasExcel.toString(),
              Icons.format_list_numbered,
              theme.colorScheme.onSurface,
            ),
            _BuildResultRow(
              "Filas con datos inválidos:",
              filasInvalidas.toString(),
              Icons.error_outline,
              filasInvalidas > 0
                  ? theme.colorScheme.error
                  : theme.colorScheme.onSurface,
            ),
            const Divider(height: 24),
            _BuildResultRow(
              "Votantes válidos encontrados:",
              votantesValidos.toString(),
              Icons.check,
              theme.colorScheme.onSurface,
            ),
            _BuildResultRow(
              "Votantes duplicados (ignorados):",
              duplicados.toString(),
              Icons.copy_all_outlined,
              duplicados > 0
                  ? theme.colorScheme.tertiary
                  : theme.colorScheme.onSurface,
            ),
            const Divider(height: 24),
            _BuildResultRow(
              "Votantes nuevos guardados:",
              votantesGuardados.toString(),
              Icons.save,
              theme.colorScheme.primary,
            ),
          ],
        ),
      ),
    );
  }
}

class _BuildResultRow extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  const _BuildResultRow(this.title, this.subtitle, this.icon, this.color);

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: color, size: 30),
      title: Text(title,
          style: TextStyle(fontWeight: FontWeight.bold, color: color)),
      subtitle: Text(subtitle),
      contentPadding: const EdgeInsets.symmetric(vertical: 4),
    );
  }
}

class _BuildInstructionCard extends StatelessWidget {
  const _BuildInstructionCard();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      color: theme.colorScheme.secondaryContainer
          .withAlpha((255 * 0.7).round()),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            Icon(Icons.info_outline, color: theme.colorScheme.secondary),
            const SizedBox(width: 16),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Formato de Excel Correcto:",
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  SizedBox(height: 8),
                  Text(
                      "• La Fila 1 debe tener los encabezados: DNI, NOMBRES, APELLIDOS."),
                  Text("• Los datos deben comenzar en la Fila 2."),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}