import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:excel/excel.dart';
import 'dart:io';
import 'package:elecciones_jp/data/models/votante_excel_row.dart';
import 'package:elecciones_jp/shared/utils/rne.dart';
import 'package:flutter/foundation.dart';
import 'package:elecciones_jp/data/repositories/votante_repository_impl.dart';
import 'package:elecciones_jp/domain/entities/votante_entity.dart';
import 'package:elecciones_jp/domain/usecases/importar_votantes_use_case.dart';

class ImportarVotantesProvider with ChangeNotifier {
  List<VotanteExcelRow> _votantes = [];
  String _rutaArchivo = "";
  bool _archivoCargado = false;
  bool _isLoading = false;
int _totalFilasExcel = 0;
  int _votantesValidos = 0;
  int _votantesGuardados = 0;
  int _votantesSinDocumento = 0;

  final ImportarVotantesUseCase _importar =
      ImportarVotantesUseCase(VotanteRepositoryImpl());

  String get rutaArchivo => _rutaArchivo;
  bool get archivoCargado => _archivoCargado;
  bool get isLoading => _isLoading;
  int get totalFilasExcel => _totalFilasExcel;
  int get votantesValidos => _votantesValidos;
  int get votantesGuardados => _votantesGuardados;
  int get votantesSinDocumento => _votantesSinDocumento;

  void _resetState() {
    _votantes.clear();
    _rutaArchivo = "";
    _archivoCargado = false;
    _isLoading = false;
    _totalFilasExcel = 0;
    _votantesValidos = 0;
    _votantesGuardados = 0;
    _votantesSinDocumento = 0;
    notifyListeners();
  }

  Future<void> buscarArchivo(BuildContext context) async {
    _resetState();
    FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx'],
    );

    if (result != null) {
      _isLoading = true;
      _rutaArchivo = result.files.single.path ?? "Error al leer la ruta";
      notifyListeners();

      try {
        var file = File(_rutaArchivo);
        var bytes = await file.readAsBytes();
        var excel = Excel.decodeBytes(bytes);

        final Map<String, dynamic> parsedData =
            await compute(_parseExcelInBackground, excel);

        _votantes = parsedData['votantes'];
        _totalFilasExcel = parsedData['sheet'].rows.length - 1;
        _votantesValidos = _votantes.length;
        _archivoCargado = true;
      } catch (e) {
        if (!context.mounted) return;
        _mostrarAlerta(context, "Error al leer",
            "No se pudo procesar el archivo Excel. Error: $e");
        _resetState();
      }

      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> importarVotantes(BuildContext context) async {
    if (_votantes.isEmpty) {
      _mostrarAlerta(context, "Sin Votantes",
          "No hay votantes válidos para importar.");
      return;
    }

    _isLoading = true;
    notifyListeners();

    try {
      _votantesGuardados = await _guardarVotantes();

      if (!context.mounted) return;
      final int duplicados = _votantesValidos -
          _votantesGuardados -
          _votantesSinDocumento;

      String detalle = "Se guardaron $_votantesGuardados votantes nuevos.";
      if (duplicados > 0) {
        detalle += "\n\n$duplicados votantes duplicados fueron ignorados.";
      }
      if (_votantesSinDocumento > 0) {
        detalle +=
            "\n\n$_votantesSinDocumento filas fueron descartadas por no tener un documento valido"
                " (no podran votar).";
      }

      _mostrarAlerta(
        context,
        "Importación Completa",
        detalle,
        onAceptar: () {
          Navigator.of(context).pop();
          Navigator.of(context).pop(true);
        },
      );
    } catch (e) {
      if (!context.mounted) return;
      _mostrarAlerta(context, "Error al Guardar",
          "No se pudieron guardar los votantes. Error: $e");
    }

    _isLoading = false;
    notifyListeners();
  }

  void salir(BuildContext context) {
    Navigator.of(context).pop();
  }

void limpiarImportacion() {
    _resetState();
  }

  Future<int> _guardarVotantes() async {
    final List<VotanteEntity> entidades = [];

    for (final votante in _votantes) {
      final String nombreCompleto =
          '${votante.nombres} ${votante.apellidos}'.trim();

      final String? rne = Rne.normalizar(votante.dni);
      if (rne == null) {
        _votantesSinDocumento++;
        continue;
      }

      if (nombreCompleto.isEmpty) continue;

      entidades.add(VotanteEntity(
        id: 0,
        rne: rne,
        nombre: nombreCompleto,
        voto: false,
      ));
    }

    return _importar.execute(entidades);
  }

  void _mostrarAlerta(BuildContext context, String titulo, String contenido,
      {VoidCallback? onAceptar}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(titulo),
          content: Text(contenido),
          actions: [
            TextButton(
              onPressed: onAceptar ?? () => Navigator.of(context).pop(),
              child: const Text("Aceptar"),
            ),
          ],
        );
      },
    );
  }
}

Map<String, dynamic> _parseExcelInBackground(Excel excel) {
  final List<VotanteExcelRow> tempVotantes = [];
  var sheet = excel.tables[excel.tables.keys.first];
  if (sheet == null) {
    return {'sheet': null, 'votantes': []};
  }

  for (var i = 1; i < sheet.rows.length; i++) {
    final row = sheet.rows[i];
    final String dni = row.isNotEmpty ? (row[0]?.value?.toString() ?? "") : "";
    final String nombres =
        row.length > 1 ? (row[1]?.value?.toString() ?? "") : "";
    final String apellidos =
        row.length > 2 ? (row[2]?.value?.toString() ?? "") : "";
    final String nombreCompleto = '$nombres $apellidos'.trim();

    if (dni.isNotEmpty || nombreCompleto.isNotEmpty) {
      tempVotantes.add(VotanteExcelRow(
        dni: dni,
        nombres: nombres,
        apellidos: apellidos,
      ));
    }
  }
  return {'sheet': sheet, 'votantes': tempVotantes};
}
