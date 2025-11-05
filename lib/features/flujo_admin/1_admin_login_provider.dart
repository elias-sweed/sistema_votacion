import 'package:flutter/material.dart';
import 'package:elecciones_jp/shared/services/database_service.dart';
import 'package:sqflite/sqflite.dart';

class AdminLoginProvider with ChangeNotifier {
  bool _isLoading = false;
  bool _adminExists = false;
  bool _isAuthenticated = false;
  String _errorMessage = "";

  bool get isLoading => _isLoading;
  bool get adminExists => _adminExists;
  bool get isAuthenticated => _isAuthenticated;
  String get errorMessage => _errorMessage;

  Future<void> checkAdminUserExists() async {
    _isLoading = true;
    _errorMessage = "";
    notifyListeners();

    try {
      final db = await DatabaseService.instance.database;
      final result = await db.rawQuery("SELECT COUNT(*) as count FROM admin");
      
      final count = Sqflite.firstIntValue(result);
      _adminExists = (count ?? 0) > 0;

    } catch (e) {
      _errorMessage = "Error al verificar admin: ${e.toString()}";
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<bool> createAdminUser(String username, String password) async {
    if (username.isEmpty || password.isEmpty) {
      _errorMessage = "Usuario y contraseña no pueden estar vacíos";
      notifyListeners();
      return false;
    }
    
    _isLoading = true;
    _errorMessage = "";
    notifyListeners();

    try {
      final db = await DatabaseService.instance.database;
      await db.insert(
        'admin',
        {'username': username, 'password': password},
        conflictAlgorithm: ConflictAlgorithm.fail,
      );

      _adminExists = true;
      _isAuthenticated = true;
      _isLoading = false;
      notifyListeners();
      return true;

    } catch (e) {
      _errorMessage = "Error al crear usuario (quizás ya existe): ${e.toString()}";
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> loginAdmin(String username, String password) async {
    if (username.isEmpty || password.isEmpty) {
      _errorMessage = "Por favor ingrese usuario y contraseña";
      notifyListeners();
      return false;
    }

    _isLoading = true;
    _errorMessage = "";
    notifyListeners();

    try {
      final db = await DatabaseService.instance.database;
      final List<Map<String, dynamic>> result = await db.query(
        'admin',
        where: 'username = ? AND password = ?',
        whereArgs: [username, password],
      );

      if (result.isNotEmpty) {
        _isAuthenticated = true;
        _errorMessage = "";
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        _isAuthenticated = false;
        _errorMessage = "Usuario o contraseña incorrectos";
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = "Error al iniciar sesión: ${e.toString()}";
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  void logout() {
    _isAuthenticated = false;
    notifyListeners();
  }
}