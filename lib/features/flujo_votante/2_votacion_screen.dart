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

          // *** INICIO DEL CAMBIO (PopScope) ***
          return PopScope(
            // 1. Bloqueamos siempre el botón de retroceso
            canPop: false, 
            onPopInvokedWithResult: (bool didPop, dynamic _) {
              if (didPop) return; // No debería pasar, pero por si acaso

              // 2. Si el voto está confirmado, no hacemos nada (el timer nos sacará)
              if (provider.votoConfirmado) return;

              // 3. Si no ha votado, mostramos el mensaje amigable
              ScaffoldMessenger.of(context).hideCurrentSnackBar();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Text(
                    '¡Un momento! Para salir, primero debes marcar tu voto. ¡Elige tu favorito!',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  backgroundColor: theme.colorScheme.primary,
                  duration: const Duration(seconds: 2),
                ),
              );
            },
            // *** FIN DEL CAMBIO (PopScope) ***
            child: Scaffold(
              appBar: AppBar(
                title: Text('Votando: $nombreAlumno'),
                // 4. Ocultamos la flecha de "atrás" del AppBar
                automaticallyImplyLeading: false, 
              ),
              body: Stack(
                children: [
                  if (provider.isLoading)
                    const Center(child: CircularProgressIndicator()),
                  if (!provider.isLoading)
                    _buildSideBySideLayout(context, provider), // (Tu layout de dos columnas)

                  if (provider.votoConfirmado)
                    _buildVotoConfirmadoOverlay(context, provider),
                ],
              ),
              floatingActionButton: (!provider.votoConfirmado &&
                      !provider.isLoading &&
                      provider.candidatoSeleccionado != null)
                  ? FloatingActionButton.extended(
                      onPressed: () => provider.confirmarVoto(context, rne),
                      label: const Text(
                        'Confirmar Voto',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      icon: const Icon(Icons.how_to_vote),
                      backgroundColor: theme.colorScheme.primary,
                      foregroundColor: theme.colorScheme.onPrimary,
                    ).animate().fadeIn(duration: 300.ms)
                  : null,
              floatingActionButtonLocation:
                  FloatingActionButtonLocation.centerFloat,
            ),
          );
        },
      ),
    );
  }

  // (Aquí va tu método _buildSideBySideLayout ... )
  // ...
  // (Aquí va tu método _buildVotoConfirmadoOverlay ... )
  // ...
  // (Aquí va tu método _buildCandidatoCard ... )
  // ...

  // (Pego tus métodos aquí por si acaso, no tienen cambios)

  Widget _buildSideBySideLayout(BuildContext context, VotacionProvider provider) {
    
    Widget buildCard(Candidato candidato) {
      final isSelected = provider.candidatoSeleccionado == candidato;
      return _buildCandidatoCard(
        context,
        candidato,
        isSelected,
        () => provider.seleccionarCandidato(candidato),
      ).animate().fadeIn(delay: (100 * (provider.candidatos.indexOf(candidato))).ms);
    }

    final candidatosReales =
        provider.candidatos.where((c) => c.numero != 0).toList();
    
    Candidato? votoEnBlanco;
    try {
      votoEnBlanco = provider.candidatos.firstWhere((c) => c.numero == 0);
    } catch (e) {
      votoEnBlanco = null; 
    }

    const cardWidth = 180.0; 

    return Row(
      children: [
        Expanded(
          flex: 1, 
          child: Center( 
            child: Padding(
              padding: const EdgeInsets.all(12.0), 
              child: (votoEnBlanco != null)
                  ? buildCard(votoEnBlanco) 
                  : const SizedBox(width: cardWidth), 
            ),
          ),
        ),
        Expanded(
          flex: 2, 
          child: Center( 
            child: Padding(
              padding: const EdgeInsets.all(12.0), 
              child: Wrap(
                alignment: WrapAlignment.center,
                runAlignment: WrapAlignment.center,
                spacing: 12.0, 
                runSpacing: 12.0, 
                children: candidatosReales.map((c) => buildCard(c)).toList(),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildVotoConfirmadoOverlay(
      BuildContext context, VotacionProvider provider) {
    final theme = Theme.of(context);
    return Container(
      color: theme.colorScheme.surface.withAlpha(242),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle,
                color: Colors.green[600], size: 120),
            const SizedBox(height: 24),
            Text(
              '¡Voto Registrado!',
              style: theme.textTheme.headlineLarge
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            Text(
              'Gracias por participar, ${provider.nombreVotante}.',
              style: theme.textTheme.titleLarge,
            ),
            const SizedBox(height: 32),
            Text(
              'Saliendo en ${provider.segundosRestantes} segundos...',
              style: theme.textTheme.titleMedium
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 300.ms);
  }

  Widget _buildCandidatoCard(
    BuildContext context,
    Candidato candidato,
    bool isSelected,
    VoidCallback onSelect,
  ) {
    final theme = Theme.of(context);
    const cardWidth = 180.0; 
    const imageHeight = 120.0;

    return SizedBox(
      width: cardWidth,
      child: Card(
        elevation: isSelected ? 8.0 : 2.0,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12.0), 
          side: BorderSide(
            color: isSelected
                ? theme.colorScheme.primary
                : theme.colorScheme.outline.withAlpha(77),
            width: isSelected ? 3.0 : 1.0,
          ),
        ),
        child: InkWell(
          onTap: onSelect,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min, 
            children: [
              Container(
                color: theme.colorScheme.surfaceContainerHighest,
                padding:
                    const EdgeInsets.symmetric(horizontal: 8.0, vertical: 6.0),
                child: Text(
                  candidato.numero == 0
                      ? 'VOTO EN BLANCO'
                      : 'N° ${candidato.numero}',
                  style: theme.textTheme.titleMedium?.copyWith( 
                    fontWeight: FontWeight.bold,
                    color: isSelected
                        ? theme.colorScheme.primary
                        : theme.colorScheme.onSurface,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              SizedBox(
                height: imageHeight, 
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
                              size: 40, 
                              color: theme.colorScheme.onSurfaceVariant)),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(8.0, 4.0, 8.0, 10.0), 
                child: Text(
                  candidato.nombre,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    fontWeight:
                        isSelected ? FontWeight.bold : FontWeight.normal,
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