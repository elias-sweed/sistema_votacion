import 'package:flutter/material.dart';
import 'package:elecciones_jp/shared/models/votante_admin.dart';
import 'package:elecciones_jp/shared/services/database_service.dart';
import 'package:sqflite/sqflite.dart';

enum FiltroVoto { todos, pendientes, emitidos }

class AdminVotantesProvider with ChangeNotifier {
  List<VotanteAdmin> _votantes = [];
  List<VotanteAdmin> _votantesFiltrados = [];
  bool _isLoading = true;
  String _terminoBusqueda = "";
  bool _filtroIncompletos = false;
  FiltroVoto _filtroVoto = FiltroVoto.todos;

  final Set<int> _votantesSeleccionados = {};
  bool _modoSeleccion = false;

  Set<int> get votantesSeleccionados => _votantesSeleccionados;
  bool get modoSeleccion => _modoSeleccion;

  List<VotanteAdmin> get votantesFiltrados => _votantesFiltrados;
  bool get isLoading => _isLoading;
  bool get filtroIncompletos => _filtroIncompletos;
  FiltroVoto get filtroVoto => _filtroVoto;

  Future<void> cargarVotantes() async {
    _isLoading = true;
    notifyListeners();

    try {
      final db = await DatabaseService.instance.database;
      final List<Map<String, dynamic>> maps =
          await db.query('votantes', orderBy: 'nombre');
      _votantes = maps.map((map) => VotanteAdmin.fromMap(map)).toList();
      _filtrarVotantes();
    } catch (e) {
      debugPrint("Error cargando votantes: $e");
    }

    _isLoading = false;
    notifyListeners();
  }

  void buscarVotantes(String query) {
    _terminoBusqueda = query.toLowerCase();
    _filtrarVotantes();
    notifyListeners();
  }

  void toggleFiltroIncompletos(bool newValue) {
    _filtroIncompletos = newValue;
    _filtrarVotantes();
    notifyListeners();
  }

  void setFiltroVoto(FiltroVoto filtro) {
    _filtroVoto = filtro;
    _filtrarVotantes();
    notifyListeners();
  }

  void _filtrarVotantes() {
    List<VotanteAdmin> temp = List.from(_votantes);

    if (_terminoBusqueda.isNotEmpty) {
      temp = temp.where((votante) {
        return votante.nombre.toLowerCase().contains(_terminoBusqueda) ||
            votante.rne.toLowerCase().contains(_terminoBusqueda);
      }).toList();
    }

    // --- LÓGICA DE FILTRO DE VOTO CORREGIDA (bool en vez de int) ---
    if (_filtroVoto == FiltroVoto.pendientes) {
      temp = temp.where((v) => v.voto == false).toList();
    } else if (_filtroVoto == FiltroVoto.emitidos) {
      temp = temp.where((v) => v.voto == true).toList();
    }
    // ---------------------------------------------------------------

    if (_filtroIncompletos) {
      temp = temp.where((v) => v.rne.isEmpty || v.nombre.trim().isEmpty).toList();
    }
    
    _votantesFiltrados = temp;
  }

  Future<void> guardarCambios(
      BuildContext context, int id, String rne, String nombre) async {
    if (nombre.trim().isEmpty) {
      _mostrarAlerta(context, "Error", "El nombre no puede estar vacío.");
      return;
    }

    try {
      final db = await DatabaseService.instance.database;
      await db.update(
        'votantes',
        {'rne': rne.trim().isEmpty ? null : rne.trim(), 'nombre': nombre.trim()},
        where: 'id = ?',
        whereArgs: [id],
      );

      final index = _votantes.indexWhere((v) => v.id == id);
      if (index != -1) {
        _votantes[index].rne = rne.trim();
        _votantes[index].nombre = nombre.trim();
      }
      _filtrarVotantes();
      notifyListeners();

      if (!context.mounted) return;
      Navigator.of(context).pop();
    } on DatabaseException catch (e) {
      if (!context.mounted) return;
      if (e.isUniqueConstraintError()) {
        _mostrarAlerta(context, "Error", "El DNI/RNE '$rne' ya existe.");
      } else {
        _mostrarAlerta(context, "Error", "No se pudo guardar: $e");
      }
    }
  }

  Future<void> eliminarVotante(
      BuildContext context, VotanteAdmin votante) async {
    bool confirmar = await _mostrarDialogoConfirmacion(context, "Eliminar Votante",
        "¿Estás seguro de que quieres eliminar a ${votante.nombre}?\nEsta acción no se puede deshacer.");
    
    if (!confirmar || !context.mounted) return;

    try {
      final db = await DatabaseService.instance.database;
      await db.delete(
        'votantes',
        where: 'id = ?',
        whereArgs: [votante.id],
      );

      _votantes.removeWhere((v) => v.id == votante.id);
      _filtrarVotantes();
      notifyListeners();
    } catch (e) {
      if (!context.mounted) return;
      _mostrarAlerta(context, "Error", "No se pudo eliminar: $e");
    }
  }

  void toggleSeleccion(int id) {
    if (_votantesSeleccionados.contains(id)) {
      _votantesSeleccionados.remove(id);
    } else {
      _votantesSeleccionados.add(id);
    }
    
    if (_votantesSeleccionados.isEmpty) {
      _modoSeleccion = false;
    } else if (!_modoSeleccion) {
      _modoSeleccion = true;
    }
    
    notifyListeners();
  }

  void cancelarSeleccion() {
    _votantesSeleccionados.clear();
    _modoSeleccion = false;
    notifyListeners();
  }

  void seleccionarTodos() {
    _votantesSeleccionados.clear();
    _votantesSeleccionados.addAll(_votantesFiltrados.map((v) => v.id));
    _modoSeleccion = true;
    notifyListeners();
  }

  Future<void> eliminarSeleccionados(BuildContext context) async {
    if (_votantesSeleccionados.isEmpty) return;

    final cantidad = _votantesSeleccionados.length;
    bool confirmar = await _mostrarDialogoConfirmacion(
      context,
      "Eliminar Votantes",
      "¿Estás seguro de que quieres eliminar $cantidad votante${cantidad > 1 ? 's' : ''}?\nEsta acción no se puede deshacer.",
    );

    if (!confirmar || !context.mounted) return;

    try {
      final db = await DatabaseService.instance.database;
      final batch = db.batch();
      
      for (final id in _votantesSeleccionados) {
        batch.delete('votantes', where: 'id = ?', whereArgs: [id]);
      }
      
      await batch.commit(noResult: true);

      _votantes.removeWhere((v) => _votantesSeleccionados.contains(v.id));
      _votantesSeleccionados.clear();
      _modoSeleccion = false;
      _filtrarVotantes();
      notifyListeners();
    } catch (e) {
      if (!context.mounted) return;
      _mostrarAlerta(context, "Error", "No se pudo eliminar: $e");
    }
  }

  void mostrarDialogoEditar(BuildContext context, VotanteAdmin votante) {
    final rneController = TextEditingController(text: votante.rne);
    final nombreController = TextEditingController(text: votante.nombre);

    showDialog(
      context: context,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          title: const Text("Editar Votante"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: rneController,
                decoration: const InputDecoration(
                  labelText: "DNI",
                  hintText: "(Puede estar vacío)",
                ),
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nombreController,
                decoration: const InputDecoration(
                  labelText: "Nombre Completo",
                ),
                textCapitalization: TextCapitalization.words,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text("Cancelar"),
            ),
            FilledButton(
              onPressed: () {
                guardarCambios(
                  dialogContext,
                  votante.id,
                  rneController.text.trim(),
                  nombreController.text.trim(),
                );
              },
              child: const Text("Guardar"),
            ),
          ],
        );
      },
    );
  }

  void _mostrarAlerta(BuildContext context, String titulo, String contenido) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(titulo),
          content: Text(contenido),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text("Aceptar"),
            ),
          ],
        );
      },
    );
  }

  Future<bool> _mostrarDialogoConfirmacion(
      BuildContext context, String titulo, String contenido) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          title: Text(titulo),
          content: Text(contenido),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.error),
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Eliminar'),
            ),
          ],
        );
      },
    );
    return result ?? false;
  }
}