import 'dart:io';

import 'package:dio/dio.dart';

class ApiService {
  ApiService()
      : _dio = Dio(
          BaseOptions(
            baseUrl: const String.fromEnvironment(
              'API_BASE_URL',
              defaultValue: 'http://10.0.2.2:8000/api',
            ),
          ),
        );

  final Dio _dio;

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    return Map<String, dynamic>.from(response.data);
  }

  Future<Map<String, dynamic>> signup(String name, String email, String password) async {
    final response = await _dio.post('/auth/signup', data: {
      'name': name,
      'email': email,
      'password': password,
    });
    return Map<String, dynamic>.from(response.data);
  }

  Future<List<dynamic>> getPotholes() async {
    final response = await _dio.get('/potholes');
    return List<dynamic>.from(response.data);
  }

  Future<Map<String, dynamic>> submitReport({
    required double latitude,
    required double longitude,
    required int userId,
    required String description,
    File? imageFile,
  }) async {
    final formData = FormData.fromMap({
      'latitude': latitude,
      'longitude': longitude,
      'reporter_id': userId,
      'description': description,
      if (imageFile != null)
        'image': await MultipartFile.fromFile(
          imageFile.path,
          filename: imageFile.uri.pathSegments.last,
        ),
    });

    final response = await _dio.post('/report', data: formData);
    return Map<String, dynamic>.from(response.data);
  }

  Future<Map<String, dynamic>> getNearbyAlerts(double latitude, double longitude) async {
    final response = await _dio.get(
      '/nearby-potholes',
      queryParameters: {'latitude': latitude, 'longitude': longitude, 'radius': 50},
    );
    return Map<String, dynamic>.from(response.data);
  }
}
