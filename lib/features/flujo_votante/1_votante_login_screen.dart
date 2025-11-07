import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:elecciones_jp/features/flujo_votante/1_votante_login_provider.dart';
import 'package:elecciones_jp/features/flujo_admin/1_admin_login_screen.dart';
import 'package:elecciones_jp/shared/providers/theme_provider.dart';
import 'package:flutter_animate/flutter_animate.dart';

class VotanteLoginScreen extends StatefulWidget {
  const VotanteLoginScreen({super.key});

  @override
  State<VotanteLoginScreen> createState() => _VotanteLoginScreenState();
}

class _VotanteLoginScreenState extends State<VotanteLoginScreen> {
  late final TextEditingController _rneController;

  @override
  void initState() {
    super.initState();
    _rneController = TextEditingController();
    final provider = context.read<VotanteLoginProvider>();
    _rneController.addListener(provider.resetStateOnTextChange);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      provider.limpiarCampos();
    });
  }

  @override
  void dispose() {
    final provider = Provider.of<VotanteLoginProvider>(context, listen: false);
    _rneController.removeListener(provider.resetStateOnTextChange);
    _rneController.dispose();
    super.dispose();
  }

@override
  Widget build(BuildContext context) {
    final provider = context.watch<VotanteLoginProvider>();
    final theme = Theme.of(context);
    final themeProvider = context.read<ThemeProvider>();
    final Widget logoHeader = Row(
      children: [
        provider.logoCentro != null
            ? Image(
                image: provider.logoCentro!,
                height: 56,
                width: 56,
                fit: BoxFit.contain,
              )
            : const Icon(Icons.school, size: 56),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            provider.centroNombre, 
            style: theme.textTheme.titleLarge
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
        ),
      ],
    );
    return Scaffold(
      appBar: AppBar(
        title: const Text("Bienvenido al Sistema de Votación"),
        centerTitle: false,
        actions: [
          IconButton(
            icon: Icon(
              themeProvider.themeMode == ThemeMode.dark
                  ? Icons.light_mode_outlined
                  : Icons.dark_mode_outlined,
            ),
            onPressed: () => themeProvider.toggleTheme(
              Theme.of(context).brightness == Brightness.dark
            ),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () async {
              final bool? huboCambios = await Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AdminLoginScreen()),
              );

              _rneController.clear();
              provider.limpiarCampos();
              
              if (huboCambios == true && mounted) {
                provider.refrescarDatosCentro();
              }
            },
          ),
          IconButton(
            icon: Icon(Icons.exit_to_app,
                color: theme.colorScheme.error.withAlpha(204)),
            onPressed: () => provider.salir(context),
          ),
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 450),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                logoHeader,
                const SizedBox(height: 32),
                TextField(
                  controller: _rneController,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                  ],
                  decoration: const InputDecoration(
                    labelText: "DNI del Votante",
                    prefixIcon: Icon(Icons.person_search_outlined),
                  ),
                  style: const TextStyle(fontSize: 18),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: provider.isLoading
                        ? null
                        : () => provider.verificarVotante(_rneController.text),
                    icon: provider.isLoading
                        ? Container(
                            width: 24,
                            height: 24,
                            padding: const EdgeInsets.all(2.0),
                            child: const CircularProgressIndicator(strokeWidth: 3),
                          )
                        : const Icon(Icons.check_circle_outline),
                    label: const Text("Comprobar"),
                    style: FilledButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      textStyle: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surfaceContainerHighest.withAlpha(128),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  height: 150,
                  width: double.infinity,
                  child: _buildEstadoVotante(context, provider),
                ),
                const SizedBox(height: 24),
                if (provider.puedeVotar)
                  ElevatedButton.icon(
                    onPressed: () {
                      final rne = _rneController.text;
                      provider.navegarAVotar(context, rne);
                      _rneController.clear();
                    },
                    icon: const Icon(Icons.how_to_vote_outlined),
                    label: const Text("IR A VOTAR"),
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 50),
                      backgroundColor: Colors.green[700],
                      foregroundColor: Colors.white,
                    ),
                  ).animate().fadeIn(duration: 300.ms),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEstadoVotante(BuildContext context, VotanteLoginProvider provider) {
    final theme = Theme.of(context);
    if (provider.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (provider.autenticacionOk) {
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.check_circle, color: Colors.green[700], size: 40),
          const SizedBox(height: 16),
          Text(
            provider.nombreVotante,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          Text(
            "¡HABILITADO PARA VOTAR!",
            style: TextStyle(
                fontSize: 16,
                color: Colors.green[700],
                fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
        ],
      ).animate().scale(duration: 300.ms, curve: Curves.elasticOut);
    }

    bool esEstadoInicial = provider.mensajeEstado == "Esperando DNI...";
    bool esError = !esEstadoInicial && !provider.autenticacionOk;

    String mensaje = provider.mensajeEstado;
    if (esError) {
      if (provider.nombreVotante.isNotEmpty) {
        mensaje = "YA VOTÓ: ${provider.nombreVotante}";
      } else if (mensaje != "El DNI no puede estar vacío.") {
        mensaje = "DNI NO ENCONTRADO EN PADRÓN";
      }
    }

    Color colorMensaje = esError
        ? theme.colorScheme.error
        : theme.textTheme.bodyMedium!.color!.withAlpha(179);

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          esEstadoInicial ? Icons.info_outline : Icons.error,
          color: colorMensaje,
          size: 40,
        ),
        const SizedBox(height: 16),
        Text(
          mensaje,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: colorMensaje,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    ).animate().fadeIn(duration: 300.ms);
  }
}