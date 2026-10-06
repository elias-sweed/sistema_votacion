import 'package:flutter/material.dart';

/// Paleta y temas de la aplicacion.
///
/// El tema no se deriva de una semilla (`ColorScheme.fromSeed`) porque eso
/// genera colores saturados y "plasticos". Aqui se declaran los colores
/// exactos de cada esquema para que ambos modos se vean deliberados: un
/// azul tinta sobrio con acento champan en claro, y el mismo azul Geldrado
/// sobre fondo casi negro en oscuro.
class AppTheme {
  AppTheme._();

  // --- Claro ---
  static const Color _seedLight = Color(0xFF1F3A68);
  static const Color _acentoLight = Color(0xFFB08D57);
  static const Color _fondoLight = Color(0xFFF5F6FA);
  static const Color _superficieLight = Color(0xFFFFFFFF);
  static const Color _bordeLight = Color(0xFFE2E6F0);

  // --- Oscuro ---
  static const Color _fondoDark = Color(0xFF0A0E1A);
  static const Color _superficieDark = Color(0xFF141A2B);
  static const Color _superficieAltaDark = Color(0xFF1C2438);
  static const Color _acentoDark = Color(0xFFD9B87C);

  static const String _fontFamily = 'Poppins';

  /// Degradado de cabecera, compartido por ambos modos.
  static LinearGradient get gradienteCabecera => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [_seedLight, Color(0xFF2E4F86)],
      );

  static ThemeData get claro {
    const ColorScheme scheme = ColorScheme.light(
      primary: _seedLight,
      onPrimary: Colors.white,
      primaryContainer: Color(0xFFDCE5F5),
      onPrimaryContainer: Color(0xFF11203C),
      secondary: _acentoLight,
      onSecondary: Colors.white,
      secondaryContainer: Color(0xFFF4E9D8),
      onSecondaryContainer: Color(0xFF4A361A),
      surface: _superficieLight,
      onSurface: Color(0xFF131824),
      surfaceContainerHighest: _bordeLight,
      error: Color(0xFFB3261E),
      onError: Colors.white,
      outline: Color(0xFFC3CAD9),
    );

    return _base(scheme).copyWith(
      scaffoldBackgroundColor: _fondoLight,
      cardColor: _superficieLight,
    );
  }

  static ThemeData get oscuro {
    const ColorScheme scheme = ColorScheme.dark(
      primary: Color(0xFF9DBCF0),
      onPrimary: Color(0xFF0B1A33),
      primaryContainer: Color(0xFF25395C),
      onPrimaryContainer: Color(0xFFDCE7F8),
      secondary: _acentoDark,
      onSecondary: Color(0xFF241A08),
      secondaryContainer: Color(0xFF40331C),
      onSecondaryContainer: Color(0xFFF2E2C4),
      surface: _superficieDark,
      onSurface: Color(0xFFE8ECF5),
      surfaceContainerHighest: _superficieAltaDark,
      error: Color(0xFFF2B8B5),
      onError: Color(0xFF601410),
      outline: Color(0xFF3A4459),
    );

    return _base(scheme).copyWith(
      scaffoldBackgroundColor: _fondoDark,
      cardColor: _superficieDark,
    );
  }

  /// Piezas tipograficas y de forma comunes a los dos modos.
  static ThemeData _base(ColorScheme scheme) {
    final TextTheme texto = Typography.material2021().black.apply(
          fontFamily: _fontFamily,
          bodyColor: scheme.onSurface,
          displayColor: scheme.onSurface,
        );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      fontFamily: _fontFamily,
      textTheme: texto,
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 1,
        centerTitle: false,
        titleTextStyle: texto.titleLarge?.copyWith(
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
          color: scheme.onSurface,
        ),
      ),
      cardTheme: CardThemeData(
        color: scheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(color: scheme.outline.withAlpha(102)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
          disabledBackgroundColor: scheme.primary.withAlpha(64),
          disabledForegroundColor: scheme.onPrimary.withAlpha(128),
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 16),
          textStyle: const TextStyle(
            fontFamily: _fontFamily,
            fontSize: 15,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: scheme.primary,
          foregroundColor: scheme.onPrimary,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 16),
          textStyle: const TextStyle(
            fontFamily: _fontFamily,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: scheme.primary,
          side: BorderSide(color: scheme.outline),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          textStyle: const TextStyle(
            fontFamily: _fontFamily,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: scheme.primary),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        hintStyle: TextStyle(color: scheme.onSurface.withAlpha(102)),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.primary, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.error, width: 1.6),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: scheme.primary,
        foregroundColor: scheme.onPrimary,
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      dividerTheme: DividerThemeData(
        color: scheme.outline.withAlpha(102),
        thickness: 1,
        space: 1,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: scheme.surface,
        contentTextStyle: TextStyle(
          fontFamily: _fontFamily,
          color: scheme.onSurface,
        ),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: scheme.primary,
        linearTrackColor: scheme.surfaceContainerHighest,
      ),
      listTileTheme: ListTileThemeData(
        iconColor: scheme.onSurface.withAlpha(153),
        textColor: scheme.onSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}