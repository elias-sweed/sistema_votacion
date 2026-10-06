import 'package:flutter/material.dart';
import 'package:elecciones_jp/features/flujo_votante/1_votante_login_screen.dart';
import 'package:provider/provider.dart';
// --- INICIO DE LA REFACTORIZACIÓN (IMPORTS) ---
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/0_home_panel/configurar_provider.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/3_cedula_votacion/config_candidatos_provider.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/2_padron_electoral/providers/importar_votantes_provider.dart';
import 'package:elecciones_jp/features/flujo_votante/1_votante_login_provider.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/3_cedula_votacion/config_voto_blanco_provider.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/4_mantenimiento/borrar_datos_provider.dart';
import 'package:elecciones_jp/features/flujo_votante/3_resultados_provider.dart';
import 'package:elecciones_jp/core/database/database_service.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/2_padron_electoral/providers/admin_votantes_provider.dart';
import 'package:elecciones_jp/features/flujo_admin/1_admin_login_provider.dart';
// --- FIN DE LA REFACTORIZACIÓN ---
import 'package:elecciones_jp/presentation/providers/theme_provider.dart';
import 'package:elecciones_jp/presentation/theme/app_theme.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'dart:io';
import 'package:intl/date_symbol_data_local.dart';



Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (Platform.isLinux || Platform.isWindows || Platform.isMacOS) {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  }
  await initializeDateFormatting('es_ES', null);
  await DatabaseService.instance.database;

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => ConfigurarProvider()),
        ChangeNotifierProvider(create: (_) => ConfigCandidatosProvider()),
        ChangeNotifierProvider(create: (_) => ConfigVotoBlancoProvider()),
        ChangeNotifierProvider(create: (_) => ImportarVotantesProvider()),
        ChangeNotifierProvider(create: (_) => AdminVotantesProvider()),
        ChangeNotifierProvider(create: (_) => BorrarDatosProvider()),
        ChangeNotifierProvider(create: (_) => VotanteLoginProvider()),
        ChangeNotifierProvider(create: (_) => VerResultadosProvider()),
        ChangeNotifierProvider(create: (_) => AdminLoginProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final ThemeData temaClaro = AppTheme.claro;
    final ThemeData temaOscuro = AppTheme.oscuro;

    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, _) {
        return MaterialApp(
          title: 'Sistema de Votaciones',
          debugShowCheckedModeBanner: false,
          theme: temaClaro,
          darkTheme: temaOscuro,
          themeMode: themeProvider.themeMode,
          home: const VotanteLoginScreen(),
        );
      },
    );
  }
}



