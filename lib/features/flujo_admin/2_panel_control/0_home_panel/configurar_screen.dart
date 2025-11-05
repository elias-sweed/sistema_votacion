import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'configurar_provider.dart'; 
import 'package:elecciones_jp/features/flujo_votante/3_resultados_screen.dart';

class ConfigurarScreen extends StatefulWidget {
  const ConfigurarScreen({super.key});

  @override
  State<ConfigurarScreen> createState() => _ConfigurarScreenState();
}

class _ConfigurarScreenState extends State<ConfigurarScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ConfigurarProvider>().initConfig();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ConfigurarProvider>();

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, dynamic result) {
        if (!didPop) {
          Navigator.of(context).pop(provider.huboCambiosEnSubpantalla);
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text("Configuración del Sistema"),
        ),
        body: ListView(
          padding: const EdgeInsets.all(12.0),
          children: [
            _ConfigListTile(
              title: "Ver Resultados",
              subtitle: "Monitorea los resultados de la votación.",
              icon: Icons.bar_chart,
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const VerResultadosScreen()),
                );
              },
            ).animate().fadeIn(duration: 400.ms, delay: 100.ms).move(
                begin: const Offset(0, 20)),
                
            const SizedBox(height: 16),

            const _SectionHeader(title: "CONFIGURACIÓN GENERAL")
                .animate()
                .fadeIn(duration: 400.ms, delay: 200.ms)
                .move(begin: const Offset(0, 20)),

            _ConfigListTile(
              title: "Configurar Centro",
              subtitle: "Define el nombre y logo de la institución.",
              icon: Icons.business,
              onPressed: () => provider.navegarAConfigurarCentro(context),
            )
                .animate()
                .fadeIn(duration: 400.ms, delay: 300.ms)
                .move(begin: const Offset(0, 20)),

            const SizedBox(height: 16),
            const _SectionHeader(title: "PADRÓN ELECTORAL")
                .animate()
                .fadeIn(duration: 400.ms, delay: 400.ms)
                .move(begin: const Offset(0, 20)),

            _ConfigListTile(
              title: "Importar Votantes",
              subtitle: "Carga el padrón electoral desde un archivo.",
              icon: Icons.upload_file,
              onPressed: () => provider.navegarAAgregarVotantes(context),
            )
                .animate()
                .fadeIn(duration: 400.ms, delay: 500.ms)
                .move(begin: const Offset(0, 20)),

            _ConfigListTile(
              title: "Agregar Votante",
              subtitle: "Añade un votante manualmente.",
              icon: Icons.person_add_alt,
              onPressed: () => provider.navegarAAgregarUnVotante(context),
            )
                .animate()
                .fadeIn(duration: 400.ms, delay: 600.ms)
                .move(begin: const Offset(0, 20)),
            
            _ConfigListTile(
              title: "Administrar Votantes",
              subtitle: "Edita o elimina votantes del padrón.",
              icon: Icons.people_alt_outlined,
              onPressed: () => provider.navegarAAdminVotantes(context),
            )
                .animate()
                .fadeIn(duration: 400.ms, delay: 700.ms)
                .move(begin: const Offset(0, 20)),

            const SizedBox(height: 16),
            const _SectionHeader(title: "CÉDULA DE VOTACIÓN")
                .animate()
                .fadeIn(duration: 400.ms, delay: 800.ms)
                .move(begin: const Offset(0, 20)),

            _ConfigListTile(
              title: "Configurar Candidatos",
              subtitle: "Añade, edita o elimina listas y candidatos.",
              icon: Icons.how_to_vote,
              onPressed: () => provider.navegarAConfigurarCandidatos(context),
            )
                .animate()
                .fadeIn(duration: 400.ms, delay: 900.ms)
                .move(begin: const Offset(0, 20)),

            _ConfigListTile(
              title: "Configurar Voto Blanco",
              subtitle: "Habilita o deshabilita el voto en blanco.",
              icon: Icons.check_box_outline_blank,
              onPressed: () => provider.navegarAConfigurarVotoBlanco(context),
            )
                .animate()
                .fadeIn(duration: 400.ms, delay: 1000.ms)
                .move(begin: const Offset(0, 20)),

            const SizedBox(height: 16),
            const _SectionHeader(title: "MANTENIMIENTO")
                .animate()
                .fadeIn(duration: 400.ms, delay: 1100.ms)
                .move(begin: const Offset(0, 20)),

            _ConfigListTile(
              title: "Borrar Datos",
              subtitle: "Reinicia la base de datos (votantes, votos, etc).",
              icon: Icons.delete_sweep,
              onPressed: () => provider.navegarABorrarDatos(context),
              isDanger: true,
            )
                .animate()
                .fadeIn(duration: 400.ms, delay: 1200.ms)
                .move(begin: const Offset(0, 20)),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16.0, 8.0, 16.0, 4.0),
      child: Text(
        title,
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: Theme.of(context).colorScheme.primary,
          fontSize: 13,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class _ConfigListTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onPressed;
  final bool isDanger;

  const _ConfigListTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onPressed,
    this.isDanger = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final Color color =
        isDanger ? theme.colorScheme.error : theme.colorScheme.primary;

    return Card(
      elevation: 2,
      margin: const EdgeInsets.symmetric(vertical: 6.0),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Icon(icon, color: color, size: 30),
        title: Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            color: isDanger ? color : theme.colorScheme.onSurface,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        trailing: Icon(Icons.chevron_right,
            color: theme.colorScheme.onSurfaceVariant),
        onTap: onPressed,
      ),
    );
  }
}