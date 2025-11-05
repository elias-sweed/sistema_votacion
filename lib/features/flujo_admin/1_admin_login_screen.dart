import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'package:elecciones_jp/features/flujo_admin/1_admin_login_provider.dart';
import 'package:elecciones_jp/features/flujo_admin/2_panel_control/0_home_panel/configurar_screen.dart';

class AdminLoginScreen extends StatefulWidget {
  const AdminLoginScreen({super.key});

  @override
  State<AdminLoginScreen> createState() => _AdminLoginScreenState();
}

class _AdminLoginScreenState extends State<AdminLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AdminLoginProvider>().checkAdminUserExists();
    });
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submitRegister(AdminLoginProvider provider) async {
    if (_formKey.currentState!.validate()) {
      final username = _usernameController.text.trim();
      final password = _passwordController.text.trim();

      final success = await provider.createAdminUser(username, password);
      if (success && mounted) {
        final bool? huboCambiosEnAdmin = await Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const ConfigurarScreen()),
        );

        if ((huboCambiosEnAdmin ?? false) && mounted) {
          Navigator.of(context).pop(true);
        } else if (mounted) {
          Navigator.of(context).pop(false);
        }
      }
    }
  }

  Future<void> _submitLogin(AdminLoginProvider provider) async {
    if (_formKey.currentState!.validate()) {
      final username = _usernameController.text.trim();
      final password = _passwordController.text.trim();

      final success = await provider.loginAdmin(username, password);
      if (success && mounted) {
        final bool? huboCambiosEnAdmin = await Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const ConfigurarScreen()),
        );

        if ((huboCambiosEnAdmin ?? false) && mounted) {
          Navigator.of(context).pop(true);
        } else if (mounted) {
          Navigator.of(context).pop(false);
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AdminLoginProvider>();
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(provider.adminExists ? "Login Admin" : "Crear Superusuario"),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: provider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : Form(
                    key: _formKey,
                    child: provider.adminExists
                        ? _buildLoginForm(provider, theme)
                        : _buildRegisterForm(provider, theme),
                  ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoginForm(AdminLoginProvider provider, ThemeData theme) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.shield_rounded, size: 60, color: theme.colorScheme.primary)
            .animate()
            .fadeIn(duration: 400.ms)
            .scale(begin: const Offset(0.8, 0.8)),
        const SizedBox(height: 24),
        TextFormField(
          controller: _usernameController,
          decoration: const InputDecoration(
            labelText: "Usuario",
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.person_outline),
          ),
          validator: (value) =>
              (value == null || value.isEmpty) ? "Ingrese su usuario" : null,
        ).animate().fadeIn(duration: 400.ms).move(begin: const Offset(0, 10)),
        const SizedBox(height: 16),
        TextFormField(
          controller: _passwordController,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: "Contraseña",
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.lock_outline),
          ),
          validator: (value) =>
              (value == null || value.isEmpty) ? "Ingrese su contraseña" : null,
          onFieldSubmitted: (_) => _submitLogin(provider),
        ).animate().fadeIn(duration: 400.ms).move(begin: const Offset(0, 10)),
        const SizedBox(height: 24),
        if (provider.errorMessage.isNotEmpty)
          Text(
            provider.errorMessage,
            style: TextStyle(color: theme.colorScheme.error),
          ).animate().fadeIn(duration: 300.ms),
        const SizedBox(height: 8),
        ElevatedButton.icon(
          onPressed: () => _submitLogin(provider),
          icon: const Icon(Icons.login),
          label: const Text("Iniciar Sesión"),
          style: theme.elevatedButtonTheme.style?.merge(
            ElevatedButton.styleFrom(
              minimumSize: const Size(double.infinity, 50),
            ),
          ),
        ).animate().fadeIn(duration: 500.ms).move(begin: const Offset(0, 20)),
      ],
    );
  }

  Widget _buildRegisterForm(AdminLoginProvider provider, ThemeData theme) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.person_add_alt_1_rounded,
                size: 60, color: theme.colorScheme.tertiary)
            .animate()
            .fadeIn(duration: 400.ms)
            .scale(begin: const Offset(0.8, 0.8)),
        const SizedBox(height: 16),
        Text(
          "No existe un superusuario. Por favor, cree uno para continuar.",
          style: theme.textTheme.titleMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        TextFormField(
          controller: _usernameController,
          decoration: const InputDecoration(
            labelText: "Nuevo Usuario",
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.person_outline),
          ),
          validator: (value) =>
              (value == null || value.isEmpty) ? "El usuario es requerido" : null,
        ).animate().fadeIn(duration: 400.ms).move(begin: const Offset(0, 10)),
        const SizedBox(height: 16),
        TextFormField(
          controller: _passwordController,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: "Nueva Contraseña",
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.lock_outline),
          ),
          validator: (value) =>
              (value == null || value.isEmpty) ? "La contraseña es requerida" : null,
        ).animate().fadeIn(duration: 400.ms).move(begin: const Offset(0, 10)),
        const SizedBox(height: 16),
        TextFormField(
          controller: _confirmPasswordController,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: "Confirmar Contraseña",
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.check_circle_outline),
          ),
          validator: (value) {
            if (value != _passwordController.text) return "Las contraseñas no coinciden";
            return null;
          },
        ).animate().fadeIn(duration: 400.ms).move(begin: const Offset(0, 10)),
        const SizedBox(height: 24),
        if (provider.errorMessage.isNotEmpty)
          Text(
            provider.errorMessage,
            style: TextStyle(color: theme.colorScheme.error),
          ).animate().fadeIn(duration: 300.ms),
        const SizedBox(height: 8),
        ElevatedButton.icon(
          onPressed: () => _submitRegister(provider),
          icon: const Icon(Icons.add_circle_outline),
          label: const Text("Crear y Entrar"),
          style: theme.elevatedButtonTheme.style?.merge(
            ElevatedButton.styleFrom(
              minimumSize: const Size(double.infinity, 50),
              backgroundColor: theme.colorScheme.tertiary,
              foregroundColor: theme.colorScheme.onTertiary,
            ),
          ),
        ).animate().fadeIn(duration: 500.ms).move(begin: const Offset(0, 20)),
      ],
    );
  }
}