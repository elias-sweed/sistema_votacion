import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:excel/excel.dart';
import 'dart:io';
import 'package:elecciones_jp/shared/models/votante.dart';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

class ImportarVotantesProvider with ChangeNotifier {
  List<Votante> _votantes = [];
  String _rutaArchivo = "";
  bool _archivoCargado = false;
  bool _isLoading = false;
  int _totalFilasExcel = 0;
  int _votantesValidos = 0;
  int _votantesGuardados = 0;

  String get rutaArchivo => _rutaArchivo;
  bool get archivoCargado => _archivoCargado;
  bool get isLoading => _isLoading;
  int get totalFilasExcel => _totalFilasExcel;
  int get votantesValidos => _votantesValidos;
  int get votantesGuardados => _votantesGuardados;

  void _resetState() {
    _votantes.clear();
    _rutaArchivo = "";
    _archivoCargado = false;
    _isLoading = false;
    _totalFilasExcel = 0;
    _votantesValidos = 0;
    _votantesGuardados = 0;
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
      final Map<String, int> result =
          await compute(_saveVotantesInBackground, _votantes);
      _votantesGuardados = result['votantesGuardados'] ?? 0;

      if (!context.mounted) return;
      _mostrarAlerta(
        context,
        "Importación Completa",
        "Se guardaron $_votantesGuardados votantes nuevos.\n\n${(_votantesValidos - _votantesGuardados)} votantes duplicados fueron ignorados.",
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
  final List<Votante> tempVotantes = [];
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
      tempVotantes.add(Votante(
        dni: dni,
        nombres: nombres,
        apellidos: apellidos,
      ));
    }
  }
  return {'sheet': sheet, 'votantes': tempVotantes};
}

Future<Map<String, int>> _saveVotantesInBackground(
    List<Votante> votantes) async {
  sqfliteFfiInit();
  databaseFactory = databaseFactoryFfi;

  final dbPath = await getDatabasesPath();
  final path = join(dbPath, 'elecciones.db');
  Database db = await openDatabase(path);

  var batch = db.batch();
  int votantesValidos = 0;

  try {
    for (var votante in votantes) {
      final String nombreCompleto =
          '${votante.nombres} ${votante.apellidos}'.trim();

      if (votante.dni.isNotEmpty || nombreCompleto.isNotEmpty) {
        votantesValidos++;
        batch.insert(
          'votantes',
          {
            'rne': votante.dni.isEmpty ? null : votante.dni,
            'nombre': nombreCompleto,
            'voto': 0
          },
          conflictAlgorithm: ConflictAlgorithm.ignore,
        );
      }
    }

    final results = await batch.commit();
    await db.close();

    final int votantesGuardados =
        results.where((r) => (r as int? ?? 0) > 0).length;

    return {
      'votantesValidos': votantesValidos,
      'votantesGuardados': votantesGuardados
    };
  } catch (e) {
    await db.close();
    return {'votantesValidos': 0, 'votantesGuardados': 0};
  }
}