import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:elecciones_jp/features/flujo_votante/2_votacion_provider.dart';
import 'package:elecciones_jp/shared/models/candidato.dart';
import 'package:flutter_animate/flutter_animate.dart';

class VotacionScreen extends StatelessWidget {
  final String rne;
  final String nombreAlumno;

  const VotacionScreen({
    super.key,
    required this.rne,
    required this.nombreAlumno,
  });

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => VotacionProvider(
        rneVotante: rne,
        nombreVotante: nombreAlumno,
      ),
      child: Consumer<VotacionProvider>(
        builder: (context, provider, _) {
          final theme = Theme.of(context);

          if (provider.votoConfirmado && provider.segundosRestantes <= 0) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (Navigator.canPop(context)) {
                Navigator.of(context).pop();
              }
            });
          }

          return PopScope(
            canPop: !provider.votoConfirmado,
            child: Scaffold(
              appBar: AppBar(
                title: Text('Votando: $nombreAlumno'),
                automaticallyImplyLeading: !provider.votoConfirmado,
              ),
              body: Stack(
                children: [
                  if (provider.isLoading)
                    const Center(child: CircularProgressIndicator())
                  else
                    Column(
                      children: [
                        Expanded(
                          child: GridView.builder(
                            padding: const EdgeInsets.all(16.0),
                            gridDelegate:
                                const SliverGridDelegateWithMaxCrossAxisExtent(
                              maxCrossAxisExtent: 200.0,
                              childAspectRatio: 0.85,
                              crossAxisSpacing: 12.0,
                              mainAxisSpacing: 12.0,
                            ),
                            itemCount: provider.candidatos.length,
                            itemBuilder: (context, index) {
                              final candidato = provider.candidatos[index];
                              return _CandidatoCard(
                                candidato: candidato,
                                isSelected:
                                    provider.candidatoSeleccionado == candidato,
                                onSelect: () =>
                                    provider.seleccionarCandidato(candidato),
                              );
                            },
                          ),
                        ),
                        _buildBotonConfirmar(context, provider, theme),
                      ],
                    ),
                  if (provider.votoConfirmado)
                    _buildOverlayVotoConfirmado(context, provider, theme),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildBotonConfirmar(
      BuildContext context, VotacionProvider provider, ThemeData theme) {
    final candidato = provider.candidatoSeleccionado;
    final bool habilitado = candidato != null;

    return Container(
      padding: const EdgeInsets.all(16.0).copyWith(top: 8.0),
      width: double.infinity,
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        border: Border(
          top: BorderSide(color: theme.dividerColor, width: 1.0),
        ),
      ),
      child: FilledButton.icon(
        onPressed: habilitado
            ? () => provider.confirmarVoto(context, rne)
            : null,
        icon: const Icon(Icons.check_circle),
        label: Text(
          candidato != null
              ? 'CONFIRMAR VOTO POR "${candidato.nombre.toUpperCase()}"'
              : 'SELECCIONE UN CANDIDATO',
        ),
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 16),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          backgroundColor: habilitado ? Colors.green[700] : theme.disabledColor,
        ),
      ),
    );
  }

  Widget _buildOverlayVotoConfirmado(
      BuildContext context, VotacionProvider provider, ThemeData theme) {
    return Positioned.fill(
      child: Container(
        // --- ARREGLO DEPRECATED ---
        color: theme.scaffoldBackgroundColor.withAlpha(242), // 0.95
        // --- FIN DEL ARREGLO ---
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.check_circle, size: 120, color: Colors.green[600]),
              const SizedBox(height: 24),
              Text(
                "¡Voto Registrado!",
                style: theme.textTheme.headlineLarge
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              Text(
                "Gracias por participar, $nombreAlumno.",
                style: theme.textTheme.titleMedium,
              ),
              const SizedBox(height: 32),
              Text(
                "Volviendo al inicio en...",
                style: theme.textTheme.bodyMedium,
              ),
              Text(
                "${provider.segundosRestantes}",
                style: theme.textTheme.headlineMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
      ).animate().fadeIn(duration: 300.ms),
    );
  }
}

class _CandidatoCard extends StatelessWidget {
  final Candidato candidato;
  final bool isSelected;
  final VoidCallback onSelect;

  const _CandidatoCard({
    required this.candidato,
    required this.isSelected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final borderColor =
        isSelected ? theme.colorScheme.primary : theme.dividerColor;
    final borderWidth = isSelected ? 3.0 : 1.0;

    return Card(
      elevation: isSelected ? 8 : 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12.0),
        side: BorderSide(color: borderColor, width: borderWidth),
      ),
      child: InkWell(
        onTap: onSelect,
        borderRadius: BorderRadius.circular(12.0),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12.0),
            gradient: isSelected
                ? LinearGradient(
                    colors: [
                      // --- ARREGLO DEPRECATED ---
                      theme.colorScheme.primary.withAlpha(26), // 0.1
                      theme.colorScheme.primary.withAlpha(0), // 0.0
                      // --- FIN DEL ARREGLO ---
                    ],
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                  )
                : null,
          ),
          child: Column(
            children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8.0),
                    child: Image.file(
                      File(candidato.imagen),
                      fit: candidato.numero == 0
                          ? BoxFit.contain
                          : BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => Center(
                          child: Icon(Icons.person,
                              size: 50,
                              color: theme.colorScheme.onSurfaceVariant)),
                    ),
                  ),
                ),
              ),
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8.0, vertical: 12.0),
                child: Text(
                  candidato.nombre,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight:
                        isSelected ? FontWeight.bold : FontWeight.normal,
                    color: isSelected
                        ? theme.colorScheme.primary
                        : theme.textTheme.titleMedium?.color,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}