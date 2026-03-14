import 'package:flutter/material.dart';

import 'screens/login_screen.dart';

class SmartPotholeApp extends StatelessWidget {
  const SmartPotholeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Smart Pothole',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1D4ED8)),
        useMaterial3: true,
      ),
      home: const LoginScreen(),
    );
  }
}
