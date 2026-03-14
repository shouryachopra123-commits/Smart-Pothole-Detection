import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';

import '../api_service.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key, required this.userId, required this.userName});

  final int userId;
  final String userName;

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final _api = ApiService();
  final _picker = ImagePicker();
  final _descriptionController = TextEditingController();
  final _mapController = MapController();
  List<dynamic> _potholes = [];
  Position? _position;
  String? _driverAlert;
  File? _selectedImage;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    await _resolveLocation();
    await _loadPotholes();
    await _loadAlerts();
  }

  Future<void> _resolveLocation() async {
    await Geolocator.requestPermission();
    final position = await Geolocator.getCurrentPosition();
    setState(() => _position = position);
  }

  Future<void> _loadPotholes() async {
    final data = await _api.getPotholes();
    setState(() => _potholes = data);
  }

  Future<void> _loadAlerts() async {
    if (_position == null) return;
    final response = await _api.getNearbyAlerts(_position!.latitude, _position!.longitude);
    final alerts = List<dynamic>.from(response['alerts'] ?? []);
    if (alerts.isNotEmpty) {
      setState(() => _driverAlert = alerts.first['message'] as String);
    }
  }

  Future<void> _pickImage() async {
    final file = await _picker.pickImage(source: ImageSource.camera);
    if (file != null) {
      setState(() => _selectedImage = File(file.path));
    }
  }

  Future<void> _submitReport() async {
    if (_position == null || _submitting) return;
    setState(() => _submitting = true);
    try {
      await _api.submitReport(
        latitude: _position!.latitude,
        longitude: _position!.longitude,
        userId: widget.userId,
        description: _descriptionController.text.trim(),
        imageFile: _selectedImage,
      );
      _descriptionController.clear();
      setState(() => _selectedImage = null);
      await _loadPotholes();
      await _loadAlerts();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pothole report submitted successfully')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Submission failed: $error')),
      );
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Color _markerColor(String severity) {
    switch (severity) {
      case 'Dangerous':
        return Colors.red;
      case 'Medium':
        return Colors.orange;
      default:
        return Colors.yellow.shade700;
    }
  }

  @override
  Widget build(BuildContext context) {
    final center = _position == null
        ? const LatLng(12.9716, 77.5946)
        : LatLng(_position!.latitude, _position!.longitude);

    return Scaffold(
      appBar: AppBar(
        title: Text('Welcome, ${widget.userName}'),
      ),
      body: Column(
        children: [
          if (_driverAlert != null)
            MaterialBanner(
              backgroundColor: Colors.amber.shade100,
              content: Text(_driverAlert!),
              actions: [
                TextButton(
                  onPressed: () => setState(() => _driverAlert = null),
                  child: const Text('Dismiss'),
                ),
              ],
            ),
          Expanded(
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(initialCenter: center, initialZoom: 15),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'smart_pothole_mobile',
                ),
                MarkerLayer(
                  markers: _potholes.map((item) {
                    return Marker(
                      point: LatLng(item['latitude'], item['longitude']),
                      width: 40,
                      height: 40,
                      child: Icon(Icons.location_on, color: _markerColor(item['severity']), size: 36),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 12)],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Report Pothole', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 10),
                TextField(
                  controller: _descriptionController,
                  decoration: const InputDecoration(
                    labelText: 'Optional description',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    OutlinedButton.icon(
                      onPressed: _pickImage,
                      icon: const Icon(Icons.camera_alt_outlined),
                      label: Text(_selectedImage == null ? 'Capture Photo' : 'Retake Photo'),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: _submitReport,
                        child: Text(_submitting ? 'Submitting...' : 'Submit Report'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  _selectedImage == null ? 'No image selected yet.' : _selectedImage!.path.split('\\').last,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 84,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: _potholes.take(10).map((item) {
                      return Container(
                        width: 180,
                        margin: const EdgeInsets.only(right: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.blueGrey.shade50,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Status: ${item['status']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                            Text('${item['severity']} - ${item['diameter']} cm'),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
