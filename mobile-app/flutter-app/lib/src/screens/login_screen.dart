import 'package:flutter/material.dart';

import '../api_service.dart';
import 'map_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _api = ApiService();
  final _nameController = TextEditingController(text: 'Citizen User');
  final _emailController = TextEditingController(text: 'citizen@example.com');
  final _passwordController = TextEditingController(text: 'password123');
  bool _loading = false;
  bool _signup = false;

  Future<void> _authenticate() async {
    setState(() => _loading = true);
    try {
      final data = _signup
          ? await _api.signup(
              _nameController.text.trim(),
              _emailController.text.trim(),
              _passwordController.text.trim(),
            )
          : await _api.login(
              _emailController.text.trim(),
              _passwordController.text.trim(),
            );

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => MapScreen(
            userId: data['user_id'] as int,
            userName: data['name'] as String,
          ),
        ),
      );
    } catch (error) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Authentication failed: $error')),
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Card(
            margin: const EdgeInsets.all(24),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Smart Pothole',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 12),
                  Text(_signup ? 'Create a citizen account' : 'Login to report road hazards'),
                  if (_signup) ...[
                    const SizedBox(height: 16),
                    TextField(
                      controller: _nameController,
                      decoration: const InputDecoration(labelText: 'Name'),
                    ),
                  ],
                  const SizedBox(height: 16),
                  TextField(
                    controller: _emailController,
                    decoration: const InputDecoration(labelText: 'Email'),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _passwordController,
                    decoration: const InputDecoration(labelText: 'Password'),
                    obscureText: true,
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _loading ? null : _authenticate,
                    child: Text(_loading ? 'Please wait...' : (_signup ? 'Sign up' : 'Login')),
                  ),
                  TextButton(
                    onPressed: () => setState(() => _signup = !_signup),
                    child: Text(_signup ? 'Already have an account?' : 'Need an account? Sign up'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
