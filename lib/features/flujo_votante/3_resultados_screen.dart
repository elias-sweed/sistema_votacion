import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'package:elecciones_jp/features/flujo_votante/3_resultados_provider.dart';
import 'package:elecciones_jp/shared/models/resultado_candidato.dart';
import 'package:fl_chart/fl_chart.dart';

// --- NUEVOS IMPORTS ---
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/2_padron_electoral/screens/admin_votantes_screen.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/2_padron_electoral/providers/admin_votantes_provider.dart';
// ----------------------

class VerResultadosScreen extends StatefulWidget {
  const VerResultadosScreen({super.key});

  @override
  State<VerResultadosScreen> createState() => _VerResultadosScreenState();
}

class _VerResultadosScreenState extends State<VerResultadosScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<VerResultadosProvider>(context, listen: false)
          .cargarResultados();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Resultados Electorales'),
      ),
      body: Consumer<VerResultadosProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text("Cargando resultados..."),
                ],
              ),
            ).animate().fadeIn(duration: 300.ms);
          }

          if (provider.resultados.isEmpty) {
            return const Center(
              child: Text("Aún no hay votos registrados."),
            ).animate().fadeIn(duration: 300.ms);
          }

          return RefreshIndicator(
            onRefresh: provider.cargarResultados,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12.0, 12.0, 12.0, 80.0),
              children: [
                // Dashboard con métricas principales
                _buildDashboardMetricas(context, provider), // <-- SE PASA context
                const SizedBox(height: 24),
                
                // Barra de participación destacada
                _buildBarraParticipacion(context, provider),
                const SizedBox(height: 24),
                
                // Gráfico de pie
                _buildGraficoGeneral(context, provider),
                const SizedBox(height: 24),

                // --- NUEVO GRÁFICO DE BARRAS AÑADIDO ---
                const Text(
                  "Votos por Candidato",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ).animate().fadeIn(delay: 300.ms),
                const SizedBox(height: 16),
                _buildBarChart(theme, provider),
                // ------------------------------------
                
                const SizedBox(height: 24),
                
                // Título de resultados
                const Text(
                  "Resultados por Candidato",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                
                // Lista de candidatos
                ...provider.resultados
                    .mapIndexed((index, resultado) => _buildCardResultado(
                          context,
                          resultado,
                          index,
                        ))
                    .toList()
                    .animate(interval: 100.ms)
                    .fadeIn(duration: 400.ms)
                    .move(begin: const Offset(0, 20)),
              ],
            ),
          );
        },
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

  // --- WIDGET MODIFICADO (AHORA RECIBE CONTEXT) ---
  Widget _buildDashboardMetricas(
      BuildContext context, VerResultadosProvider provider) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 4.0, vertical: 8.0),
          child: Text(
            "RESUMEN GENERAL",
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        const SizedBox(height: 8),
        
        // Primera fila: Total Padrón y Votos Emitidos
        Row(
          children: [
            Expanded(
              child: _buildMetricCard(
                icon: Icons.people,
                titulo: "Total Padrón",
                valor: provider.padronTotal.toString(),
                color: Colors.blue,
              ).animate().fadeIn(duration: 400.ms, delay: 0.ms),
            ),
            const SizedBox(width: 12),
            // --- TARJETA EMITIDOS AHORA ES CLICABLE ---
            Expanded(
              child: InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const AdminVotantesScreen(
                          filtroInicial: FiltroVoto.emitidos),
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(12),
                child: _buildMetricCard(
                  icon: Icons.how_to_vote,
                  titulo: "Votos Emitidos",
                  valor: provider.votosEmitidos.toString(),
                  color: Colors.green,
                ).animate().fadeIn(duration: 400.ms, delay: 100.ms),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        
        // Segunda fila: Votos Pendientes y Participación
        Row(
          children: [
            // --- TARJETA PENDIENTES AHORA ES CLICABLE ---
            Expanded(
              child: InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const AdminVotantesScreen(
                          filtroInicial: FiltroVoto.pendientes),
                    ),
                  );
                },
                borderRadius: BorderRadius.circular(12),
                child: _buildMetricCard(
                  icon: Icons.pending_actions,
                  titulo: "Pendientes",
                  valor: provider.votosPendientes.toString(),
                  color: Colors.orange,
                ).animate().fadeIn(duration: 400.ms, delay: 200.ms),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMetricCard(
                icon: Icons.bar_chart,
                titulo: "Participación",
                valor: "${(provider.participacion * 100).toStringAsFixed(1)}%",
                color: Colors.purple,
              ).animate().fadeIn(duration: 400.ms, delay: 300.ms),
            ),
          ],
        ),
      ],
    );
  }

  // Tarjeta individual de métrica
  Widget _buildMetricCard({
    required IconData icon,
    required String titulo,
    required String valor,
    required Color color,
  }) {
    return Card(
      elevation: 3,
      child: Container(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Icon(
              icon,
              size: 40,
              color: color,
            ),
            const SizedBox(height: 12),
            Text(
              titulo,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              valor,
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Barra de participación destacada
  Widget _buildBarraParticipacion(
      BuildContext context, VerResultadosProvider provider) {
    final theme = Theme.of(context);
    
    return Card(
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  "Progreso de Votación",
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  "${(provider.participacion * 100).toStringAsFixed(2)}%",
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: theme.colorScheme.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: LinearProgressIndicator(
                value: provider.participacion,
                minHeight: 16,
                backgroundColor: theme.colorScheme.surfaceContainerHighest,
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "${provider.votosEmitidos} votos",
                  style: TextStyle(
                    fontSize: 14,
                    color: theme.textTheme.bodyMedium?.color?.withAlpha(179),
                  ),
                ),
                Text(
                  "${provider.padronTotal} total",
                  style: TextStyle(
                    fontSize: 14,
                    color: theme.textTheme.bodyMedium?.color?.withAlpha(179),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 400.ms, delay: 400.ms);
  }

  // Gráfico de pie
  Widget _buildGraficoGeneral(
      BuildContext context, VerResultadosProvider provider) {
    final theme = Theme.of(context);

    return Card(
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            const Text(
              "Distribución de Votos",
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 250,
              child: PieChart(
                PieChartData(
                  sections: provider.resultados.mapIndexed((index, resultado) {
                    final double radius = (index == 0) ? 80.0 : 60.0;
                    final Color color = (index < Colors.primaries.length)
                        ? Colors.primaries[index]
                        : Colors.grey;

                    return PieChartSectionData(
                      color: color,
                      value: resultado.progreso * 100,
                      title: resultado.porcentaje,
                      radius: radius,
                      titleStyle: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.onPrimary,
                      ),
                    );
                  }).toList(),
                  centerSpaceRadius: 40,
                ),
              ),
            ),
          ],
        ),
      ),
    ).animate().scale(duration: 500.ms, curve: Curves.elasticOut, delay: 500.ms);
  }

  // --- NUEVO WIDGET: GRÁFICO DE BARRAS ---
  Widget _buildBarChart(ThemeData theme, VerResultadosProvider provider) {
    final List<BarChartGroupData> barGroups = [];

    // Usamos los mismos colores que la lista de progreso
    final List<Color> colors = [
      theme.colorScheme.primary,
      theme.colorScheme.secondary,
      theme.colorScheme.tertiary,
      Colors.green,
      Colors.orange,
      Colors.purple,
      Colors.teal,
      Colors.pink,
    ];
    Color getColor(int index) => colors[index % colors.length];

    for (int i = 0; i < provider.resultados.length; i++) {
      final resultado = provider.resultados[i];
      barGroups.add(
        BarChartGroupData(
          x: i,
          barRods: [
            BarChartRodData(
              toY: double.tryParse(resultado.votos) ?? 0.0,
              color: getColor(i),
              width: 16,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(4),
                topRight: Radius.circular(4),
              ),
            ),
          ],
        ),
      );
    }

    return Card(
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: SizedBox(
          height: 250,
          child: BarChart(
            BarChartData(
              alignment: BarChartAlignment.spaceAround,
              barTouchData: BarTouchData(
                touchTooltipData: BarTouchTooltipData(
                  getTooltipItem: (group, groupIndex, rod, rodIndex) {
                    final candidato = provider.resultados[groupIndex];
                    return BarTooltipItem(
                      '${candidato.nombre}\n',
                      const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.bold),
                      children: [
                        TextSpan(
                          text: '${candidato.votos} votos (${candidato.porcentaje})',
                          style: const TextStyle(
                              color: Colors.white, fontWeight: FontWeight.normal),
                        ),
                      ],
                    );
                  },
                ),
              ),
              titlesData: FlTitlesData(
                show: true,
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    getTitlesWidget: (double value, TitleMeta meta) {
                      final index = value.toInt();
                      if (index < 0 || index >= provider.resultados.length) {
                        return const Text('');
                      }
                      final nombre = provider.resultados[index].nombre;
                      // Acorta el nombre para que quepa
                      final nombreCorto = nombre.length > 10
                          ? '${nombre.substring(0, 8)}...'
                          : nombre;
                      return SideTitleWidget(
                        axisSide: meta.axisSide,
                        space: 4.0,
                        child: Text(nombreCorto,
                            style: const TextStyle(fontSize: 10)),
                      );
                    },
                    reservedSize: 30,
                  ),
                ),
                leftTitles:
                    AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 30)),
                topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              borderData: FlBorderData(
                show: false,
              ),
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                horizontalInterval: provider.votosEmitidos > 10
                    ? (provider.votosEmitidos / 5).roundToDouble()
                    : 1,
              ),
              barGroups: barGroups,
            ),
          ).animate().fadeIn(duration: 500.ms),
        ),
      ),
    );
  }
  // ------------------------------------

  // Card de resultado individual por candidato
  Widget _buildCardResultado(
      BuildContext context, ResultadoCandidato resultado, int index) {
    final theme = Theme.of(context);
    final Color colorBarra = (index < Colors.primaries.length)
        ? Colors.primaries[index]
        : Colors.grey;

    return Card(
      elevation: 2,
      margin: const EdgeInsets.symmetric(vertical: 8.0),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    "${resultado.correlativo}. ${resultado.nombre}",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: colorBarra,
                    ),
                  ),
                ),
                Text(
                  resultado.votos,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: colorBarra,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: LinearProgressIndicator(
                value: resultado.progreso,
                minHeight: 12,
                backgroundColor: theme.colorScheme.surfaceContainerHighest,
                color: colorBarra,
              ),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                resultado.porcentaje,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

extension IterableX<E> on Iterable<E> {
  Iterable<T> mapIndexed<T>(T Function(int index, E e) f) {
    var index = 0;
    return map((e) => f(index++, e));
  }
}