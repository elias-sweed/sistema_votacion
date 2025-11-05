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
import 'package:elecciones_jp/shared/services/database_service.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/2_padron_electoral/providers/admin_votantes_provider.dart';
import 'package:elecciones_jp/features/flujo_admin/1_admin_login_provider.dart';
// --- FIN DE LA REFACTORIZACIÓN ---
import 'package:elecciones_jp/shared/providers/theme_provider.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'dart:io';
import 'package:intl/date_symbol_data_local.dart';

const Color colorSemilla = Colors.deepPurple;

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
    final ThemeData temaClaro = ThemeData(
      useMaterial3: true,
      fontFamily: 'Poppins',
      colorScheme: ColorScheme.fromSeed(
        seedColor: colorSemilla,
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: const Color(0xFFF7F8FA),
      appBarTheme: AppBarTheme(
        backgroundColor: ColorScheme.fromSeed(
          seedColor: colorSemilla,
          brightness: Brightness.light,
        ).primary,
        foregroundColor: ColorScheme.fromSeed(
          seedColor: colorSemilla,
          brightness: Brightness.light,
        ).onPrimary,
        elevation: 2,
        titleTextStyle: const TextStyle(
          fontWeight: FontWeight.bold,
          fontSize: 22,
          letterSpacing: 0.5,
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: ColorScheme.fromSeed(
            seedColor: colorSemilla,
            brightness: Brightness.light,
          ).primary,
          foregroundColor: ColorScheme.fromSeed(
            seedColor: colorSemilla,
            brightness: Brightness.light,
          ).onPrimary,
          elevation: 3,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 18),
          textStyle: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.grey),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: ColorScheme.fromSeed(
              seedColor: colorSemilla,
              brightness: Brightness.light,
            ).primary,
            width: 2,
          ),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );

    final ThemeData temaOscuro = ThemeData(
      useMaterial3: true,
      fontFamily: 'Poppins',
      colorScheme: ColorScheme.fromSeed(
        seedColor: colorSemilla,
        brightness: Brightness.dark,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: ColorScheme.fromSeed(
          seedColor: colorSemilla,
          brightness: Brightness.dark,
        ).primary,
        foregroundColor: ColorScheme.fromSeed(
          seedColor: colorSemilla,
          brightness: Brightness.dark,
        ).onPrimary,
        elevation: 2,
        titleTextStyle: const TextStyle(
          fontWeight: FontWeight.bold,
          fontSize: 22,
          letterSpacing: 0.5,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: ColorScheme.fromSeed(
            seedColor: colorSemilla,
            brightness: Brightness.dark,
          ).primary,
          foregroundColor: ColorScheme.fromSeed(
            seedColor: colorSemilla,
            brightness: Brightness.dark,
          ).onPrimary,
          elevation: 3,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 18),
          textStyle: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.grey),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: ColorScheme.fromSeed(
              seedColor: colorSemilla,
              brightness: Brightness.dark,
            ).primary,
            width: 2,
          ),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );

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