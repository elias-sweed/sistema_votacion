import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../providers/admin_votantes_provider.dart';

class AdminVotantesScreen extends StatefulWidget {
  final FiltroVoto? filtroInicial;

  const AdminVotantesScreen({super.key, this.filtroInicial});

  @override
  State<AdminVotantesScreen> createState() => _AdminVotantesScreenState();
}

class _AdminVotantesScreenState extends State<AdminVotantesScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<AdminVotantesProvider>();

      provider.setFiltroVoto(widget.filtroInicial ?? FiltroVoto.todos);
      provider.cargarVotantes();

      _searchController.addListener(() {
        provider.buscarVotantes(_searchController.text);
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AdminVotantesProvider>();
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Padrón Electoral"),
        actions: [
          if (provider.modoSeleccion)
            IconButton(
              icon: const Icon(Icons.select_all),
              onPressed: () => provider.seleccionarTodos(),
              tooltip: "Seleccionar todos",
            ),
          if (provider.modoSeleccion)
            IconButton(
              icon: const Icon(Icons.close),
              onPressed: () => provider.cancelarSeleccion(),
              tooltip: "Cancelar selección",
            ),
        ],
      ),
      body: Column(
        children: [
          _BuildFiltrosVoto(provider: provider),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Buscar por DNI o Nombre...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () => _searchController.clear(),
                      )
                    : null,
              ),
            ),
          ),
          _BuildFiltroSwitch(provider: provider),

          Expanded(
            child: provider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : provider.votantesFiltrados.isEmpty
                    ? Center(
                        child: Text(
                          "No se encontraron votantes.",
                          style: theme.textTheme.titleMedium,
                        ),
                      )
                    : ListView.builder(
                        itemCount: provider.votantesFiltrados.length,
                        itemBuilder: (context, index) {
                          final votante = provider.votantesFiltrados[index];
                          final bool isSelected = provider.votantesSeleccionados
                              .contains(votante.id);
                          final bool isIncompleto = votante.rne.trim().isEmpty ||
                              votante.nombre.trim().isEmpty;

                          return Card(
                            elevation: isSelected ? 4 : 1,
                            margin: const EdgeInsets.symmetric(
                                horizontal: 12.0, vertical: 5.0),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12.0),
                              side: BorderSide(
                                color: isSelected
                                    ? theme.colorScheme.primary
                                    : Colors.transparent,
                                width: 2,
                              ),
                            ),
                            child: ListTile(
                              onTap: () {
                                if (provider.modoSeleccion) {
                                  provider.toggleSeleccion(votante.id);
                                } else {
                                  provider.mostrarDialogoEditar(context, votante);
                                }
                              },
                              onLongPress: () {
                                provider.toggleSeleccion(votante.id);
                              },
                              leading: CircleAvatar(
                                backgroundColor: isSelected
                                    ? theme.colorScheme.primary
                                    : (votante.voto == true
                                        ? theme.colorScheme.tertiaryContainer
                                        : theme.colorScheme.surfaceContainerHighest),
                                child: Icon(
                                  votante.voto == true
                                      ? Icons.how_to_vote
                                      : Icons.person_outline,
                                  color: isSelected
                                      ? theme.colorScheme.onPrimary
                                      : (votante.voto == true
                                          ? theme.colorScheme.onTertiaryContainer
                                          : theme.colorScheme.onSurfaceVariant),
                                ),
                              ),
                              title: Text(
                                votante.nombre.isEmpty
                                    ? "(Nombre vacío)"
                                    : votante.nombre,
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: isIncompleto
                                      ? theme.colorScheme.error
                                      : null,
                                ),
                              ),
                              subtitle: Text(
                                votante.rne.isEmpty
                                    ? "(DNI vacío)"
                                    : "DNI: ${votante.rne}",
                                style: TextStyle(
                                  color: isIncompleto
                                      ? theme.colorScheme.error
                                      : null,
                                ),
                              ),
                              trailing: votante.voto == true
                                  ? const Icon(Icons.check_circle,
                                      color: Colors.green)
                                  : null,
                            ),
                          ).animate().fadeIn(duration: 300.ms);
                        },
                      ),
          ),
        ],
      ),
      bottomNavigationBar: provider.modoSeleccion
          ? BottomAppBar(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  Text(
                    "${provider.votantesSeleccionados.length} seleccionado${provider.votantesSeleccionados.length != 1 ? 's' : ''}",
                    style: theme.textTheme.titleMedium,
                  ),
                  FilledButton.icon(
                    onPressed: () => provider.eliminarSeleccionados(context),
                    icon: const Icon(Icons.delete),
                    label: const Text("Eliminar"),
                    style: FilledButton.styleFrom(
                      backgroundColor: theme.colorScheme.error,
                    ),
                  ),
                ],
              ),
            )
          : null,
    );
  }
}

class _BuildFiltroSwitch extends StatelessWidget {
  const _BuildFiltroSwitch({required this.provider});

  final AdminVotantesProvider provider;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text("Mostrar solo incompletos"),
          Switch(
            value: provider.filtroIncompletos,
            onChanged: (value) => provider.toggleFiltroIncompletos(value),
          ),
        ],
      ),
    );
  }
}

class _BuildFiltrosVoto extends StatelessWidget {
  const _BuildFiltrosVoto({required this.provider});

  final AdminVotantesProvider provider;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      child: SegmentedButton<FiltroVoto>(
        segments: const [
          ButtonSegment(
            value: FiltroVoto.todos,
            label: Text("Todos"),
            icon: Icon(Icons.people_alt_outlined),
          ),
          ButtonSegment(
            value: FiltroVoto.pendientes,
            label: Text("Pendientes"),
            icon: Icon(Icons.person_outline),
          ),
          ButtonSegment(
            value: FiltroVoto.emitidos,
            label: Text("Emitidos"),
            icon: Icon(Icons.how_to_vote_outlined),
          ),
        ],
        selected: {provider.filtroVoto},
        onSelectionChanged: (Set<FiltroVoto> newSelection) {
          provider.setFiltroVoto(newSelection.first);
        },
        showSelectedIcon: false,
        multiSelectionEnabled: false,
      ),
    );
  }
}