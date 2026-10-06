import 'dart:convert';
import 'dart:math';

import 'package:cryptography/cryptography.dart';
import 'package:elecciones_jp/data/repositories/admin_repository_impl.dart';
import 'package:flutter/material.dart';

class AdminLoginProvider with ChangeNotifier {
  static const int _iteraciones = 120000;
  static const int _bytesSalt = 16;

  bool _isLoading = false;
  bool _adminExists = false;
  bool _isAuthenticated = false;
  String _errorMessage = "";

  bool get isLoading => _isLoading;
  bool get adminExists => _adminExists;
  bool get isAuthenticated => _isAuthenticated;
  String get errorMessage => _errorMessage;

  final AdminRepositoryImpl _adminRepo = AdminRepositoryImpl();

  final Pbkdf2 _kdf = Pbkdf2(
    macAlgorithm: Hmac.sha256(),
    iterations: _iteraciones,
    bits: 256,
  );

  String _generarSalt() {
    final Random aleatorio = Random.secure();
    final List<int> bytes =
        List<int>.generate(_bytesSalt, (_) => aleatorio.nextInt(256));
    return base64Encode(bytes);
  }

  Future<String> _derivarHash(String password, String saltBase64) async {
    final SecretKey clave = await _kdf.deriveKey(
      secretKey: SecretKey(utf8.encode(password)),
      nonce: base64Decode(saltBase64),
    );
    return base64Encode(await clave.extractBytes());
  }

  /// Comparacion en tiempo constante para no filtrar informacion por el
  /// tiempo de respuesta.
  bool _comparacionSegura(String a, String b) {
    final List<int> ba = utf8.encode(a);
    final List<int> bb = utf8.encode(b);
    if (ba.length != bb.length) return false;
    int diferencia = 0;
    for (int i = 0; i < ba.length; i++) {
      diferencia |= ba[i] ^ bb[i];
    }
    return diferencia == 0;
  }

  Future<void> checkAdminUserExists() async {
    _isLoading = true;
    _errorMessage = "";
    notifyListeners();

    try {
      final int count = await _adminRepo.count();
      _adminExists = count > 0;
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
      final String salt = _generarSalt();
      final String hash = await _derivarHash(password, salt);

      await _adminRepo.insert({
        'username': username,
        'password': null,
        'password_hash': hash,
        'password_salt': salt,
        'password_iteraciones': _iteraciones,
        'creado_en': DateTime.now().toIso8601String(),
      });

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
      final Map<String, dynamic>? admin = await _adminRepo.findByUsername(username);

      if (admin == null) {
        _isLoading = false;
        _isAuthenticated = false;
        _errorMessage = "Usuario o contraseña incorrectos";
        notifyListeners();
        return false;
      }

      final String? hashAlmacenado = admin['password_hash'] as String?;
      final String? saltAlmacenado = admin['password_salt'] as String?;
      final String? passwordPlano = admin['password'] as String?;

      bool valido = false;

      if (hashAlmacenado != null && saltAlmacenado != null) {
        final String hashCalculado = await _derivarHash(password, saltAlmacenado);
        valido = _comparacionSegura(hashCalculado, hashAlmacenado);
      } else if (passwordPlano != null) {
        // Instalacion anterior a v3: la contraseña estaba en texto plano.
        // Se valida y se migra al hash en el mismo paso.
        valido = _comparacionSegura(passwordPlano, password);
        if (valido) {
          await _migrarPasswordPlaintext(admin['id'] as int?, password);
        }
      }

      _isAuthenticated = valido;
      _isLoading = false;
      _errorMessage = valido ? "" : "Usuario o contraseña incorrectos";
      notifyListeners();
      return valido;
    } catch (e) {
      _errorMessage = "Error al iniciar sesión: ${e.toString()}";
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Reemplaza la contraseña en texto plano por su derivacion PBKDF2 y
  /// borra el valor plano de la base de datos.
  Future<void> _migrarPasswordPlaintext(
      int? id, String password) async {
    if (id == null) return;
    try {
      final String salt = _generarSalt();
      final String hash = await _derivarHash(password, salt);
      await _adminRepo.updatePassword(id, {
        'password': null,
        'password_hash': hash,
        'password_salt': salt,
        'password_iteraciones': _iteraciones,
      });
    } catch (_) {
      // Si la migracion falla, el acceso ya fue validado: no se interrumpe.
    }
  }

  void logout() {
    _isAuthenticated = false;
    notifyListeners();
  }
}



