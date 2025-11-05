import 'package:flutter/material.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/3_cedula_votacion/config_candidatos_screen.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/2_padron_electoral/screens/importar_votantes_screen.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/2_padron_electoral/screens/agregar_votante_screen.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/3_cedula_votacion/config_voto_blanco_screen.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/4_mantenimiento/borrar_datos_screen.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/1_config_general/centro_screen.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/2_padron_electoral/screens/admin_votantes_screen.dart';


class ConfigurarProvider with ChangeNotifier {
  // ignore: prefer_final_fields
  bool _isCentroConfigurado = false;
  // ignore: prefer_final_fields
  bool _isCandidatosConfigurados = false;
  // ignore: prefer_final_fields
  bool _isVotoBlancoConfigurado = false;
  // ignore: prefer_final_fields
  bool _hayDatosParaBorrar = false;

  bool _huboCambiosEnSubpantalla = false;

  bool get isCentroConfigurado => _isCentroConfigurado;
  bool get isCandidatosConfigurados => _isCandidatosConfigurados;
  bool get isVotoBlancoConfigurado => _isVotoBlancoConfigurado;
  bool get hayDatosParaBorrar => _hayDatosParaBorrar;
  bool get huboCambiosEnSubpantalla => _huboCambiosEnSubpantalla;

  void initConfig() {
    _huboCambiosEnSubpantalla = false;
  }

  Future<void> navegarAConfigurarCentro(BuildContext context) async {
    final bool? result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const CentroScreen()),
    );
    if (result == true) {
      _huboCambiosEnSubpantalla = true;
    }
  }

  void navegarAAgregarVotantes(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const ImportarVotantesScreen()),
    );
  }

  void navegarAAgregarUnVotante(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const AgregarVotanteScreen()),
    );
  }

  void navegarAConfigurarCandidatos(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const ConfigCandidatosScreen()),
    );
  }

  void navegarAConfigurarVotoBlanco(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const ConfigVotoBlancoScreen()),
    );
  }

  void navegarAAdminVotantes(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const AdminVotantesScreen()),
    );
  }

  void navegarABorrarDatos(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const BorrarDatosScreen()),
    );
  }
}