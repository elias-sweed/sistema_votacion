import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/agregar_votante_provider.dart';

class AgregarVotanteScreen extends StatelessWidget {
  final String? dni;
  const AgregarVotanteScreen({super.key, this.dni});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AgregarVotanteProvider(dniInicial: dni),
      child: Consumer<AgregarVotanteProvider>(
        builder: (context, provider, _) {
          final theme = Theme.of(context);

          return Scaffold(
            appBar: AppBar(
              title: const Text("Agregar Votante"),
            ),
            body: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                children: [
                  TextField(
                    controller: provider.dniController,
                    decoration: const InputDecoration(
                      labelText: "DNI / RNE",
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                  )
                      .animate()
                      .fadeIn(duration: 400.ms)
                      .move(begin: const Offset(0, 20)),
                  const SizedBox(height: 16),
                  TextField(
                    controller: provider.nombreController,
                    decoration: const InputDecoration(
                      labelText: "Nombre Completo",
                      border: OutlineInputBorder(),
                    ),
                    textCapitalization: TextCapitalization.words,
                  )
                      .animate()
                      .fadeIn(duration: 400.ms, delay: 100.ms)
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
                      onPressed: provider.isAceptarEnabled
                          ? () => provider.guardarVotante(context)
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