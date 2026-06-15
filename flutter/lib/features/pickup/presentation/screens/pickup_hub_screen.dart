import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';

import 'package:voltium_rider/models/hub_model.dart';
import 'package:voltium_rider/services/api_service.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/widgets/pickup_hub_widgets.dart';
import 'package:voltium_rider/widgets/pickup_vehicle_search_sheet.dart';

class PickupHubScreen extends StatefulWidget {
  final Function(
    String hubId,
    String vehicleId,
    String? teamLeader,
    String emergencyContact,
    String? pickupPhotoFront,
    String? pickupPhotoBack,
    String? pickupPhotoLeft,
    String? pickupPhotoRight,
    String? pickupPhotoWithVehicle,
  ) onNext;
  final VoidCallback? onBack;

  const PickupHubScreen({super.key, required this.onNext, this.onBack});

  @override
  State<PickupHubScreen> createState() => _PickupHubScreenState();
}

class _PickupHubScreenState extends State<PickupHubScreen> {
  final ImageCompressionService _compressionService = ImageCompressionService();
  List<HubModel> _hubs = [];
  bool _isLoading = true;
  String? _error;
  String? _selectedHubId;
  String? _selectedTeamLeader;

  // Vehicle dropdown state
  List<Map<String, dynamic>> _vehicles = [];
  bool _isLoadingVehicles = false;
  String? _selectedVehicleId;
  String? _selectedVehicleLabel;

  final _emergencyContactController = TextEditingController();
  final _otpController = TextEditingController();

  bool _isOtpSent = false;
  bool _isOtpVerified = false;
  bool _isSendingOtp = false;
  bool _isVerifyingOtp = false;

  // Photo uploads
  String? _frontImagePath;
  String? _frontPhotoUrl;
  bool _isUploadingFront = false;

  String? _backImagePath;
  String? _backPhotoUrl;
  bool _isUploadingBack = false;

  String? _leftImagePath;
  String? _leftPhotoUrl;
  bool _isUploadingLeft = false;

  String? _rightImagePath;
  String? _rightPhotoUrl;
  bool _isUploadingRight = false;

  String? _withVehicleImagePath;
  String? _withVehiclePhotoUrl;
  bool _isUploadingWithVehicle = false;

  @override
  void dispose() {
    _emergencyContactController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _fetchHubs();
  }

  Future<void> _fetchHubs() async {
    try {
      final response = await ApiService().fetchHubs();
      if (!mounted) return;
      if (response['success'] == true) {
        final List<dynamic> data = response['data'] ?? [];
        setState(() {
          _hubs = data
              .map((e) => HubModel.fromJson(e as Map<String, dynamic>))
              .toList();
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = response['message'] ?? 'Failed to load hubs';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Connection error. Please try again.';
        _isLoading = false;
      });
    }
  }

  Future<void> _fetchVehicles(String hubId) async {
    setState(() {
      _isLoadingVehicles = true;
      _vehicles = [];
      _selectedVehicleId = null;
      _selectedVehicleLabel = null;
    });
    try {
      final response = await ApiService().fetchVehicles(hubId);
      if (!mounted) return;
      if (response['success'] == true) {
        final data = response['data'] as Map<String, dynamic>? ?? {};
        final list = data['vehicles'] as List<dynamic>? ?? [];
        setState(() {
          _vehicles = list
              .map((v) => v as Map<String, dynamic>)
              .where((v) => v['status'] == 'AVAILABLE')
              .toList();
        });
      }
    } catch (_) {
      // silently ignore; user can retry by changing hub
    } finally {
      if (mounted) setState(() => _isLoadingVehicles = false);
    }
  }

  void _showVehicleSearchSheet() {
    if (_vehicles.isEmpty) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => VehicleSearchSheet(
        vehicles: _vehicles,
        selectedId: _selectedVehicleId,
        onSelected: (id, label) {
          setState(() {
            _selectedVehicleId = id;
            _selectedVehicleLabel = label;
          });
        },
      ),
    );
  }

  // ── Toasts ─────────────────────────────────────────────────────────────────
  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.error_outline_rounded,
                color: Colors.white, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(msg,
                  style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white)),
            ),
          ],
        ),
        backgroundColor: const Color(0xFFEF4444),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _showSuccess(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_outline_rounded,
                color: Colors.white, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(msg,
                  style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white)),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF10B981),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  Future<void> _sendEmergencyOtp() async {
    final phone = _emergencyContactController.text;
    final digits = phone.replaceAll(RegExp(r'\\D'), '');

    if (digits.length != 10) {
      _showError('Enter a valid 10-digit number');
      return;
    }

    final provider = context.read<AppProvider>();
    final riderPhone = provider.rider?.phone ?? '';
    final guarantorPhone = provider.rider?.guarantorPhone ?? '';

    if (digits == riderPhone) {
      _showError('Emergency contact cannot be the same as your phone number');
      return;
    }
    if (digits == guarantorPhone) {
      _showError(
          'Emergency contact cannot be the same as guarantor phone number');
      return;
    }

    setState(() {
      _isSendingOtp = true;
    });

    try {
      final response = await ApiService().sendOtp(phone: digits);
      if (!mounted) return;
      if (response['success'] == true) {
        setState(() {
          _isOtpSent = true;
          _isOtpVerified = false;
        });
        _showSuccess('OTP sent to emergency contact');
        final testOtp = response['data']?['otp'];
        if (testOtp != null) {
          _otpController.text = testOtp.toString();
        }
      } else {
        _showError(response['message'] ?? 'Failed to send OTP');
      }
    } catch (e) {
      if (!mounted) return;
      _showError('Failed to send OTP. Please try again.');
    } finally {
      if (mounted) setState(() => _isSendingOtp = false);
    }
  }

  Future<void> _verifyEmergencyOtp() async {
    final phone =
        _emergencyContactController.text.replaceAll(RegExp(r'\\D'), '');
    final otp = _otpController.text;

    if (otp.length != 6) {
      _showError('Enter 6-digit OTP');
      return;
    }

    setState(() => _isVerifyingOtp = true);

    try {
      final response = await ApiService().verifyOtp(phone: phone, otp: otp);
      if (!mounted) return;
      if (response['success'] == true) {
        setState(() => _isOtpVerified = true);
        _showSuccess('Emergency contact verified successfully ✓');
      } else {
        _showError(response['message'] ?? 'Invalid OTP');
      }
    } catch (e) {
      if (!mounted) return;
      _showError('OTP verification failed. Please try again.');
    } finally {
      if (mounted) setState(() => _isVerifyingOtp = false);
    }
  }

  Future<void> _uploadImage(String type, bool useCamera) async {
    final source = useCamera ? ImageSource.camera : ImageSource.gallery;
    try {
      final compressed = await _compressionService.pickAndCompress(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 80,
      );

      if (compressed == null || !mounted) return;

      setState(() {
        switch (type) {
          case 'front':
            _frontImagePath = compressed.path;
            _isUploadingFront = true;
            break;
          case 'back':
            _backImagePath = compressed.path;
            _isUploadingBack = true;
            break;
          case 'left':
            _leftImagePath = compressed.path;
            _isUploadingLeft = true;
            break;
          case 'right':
            _rightImagePath = compressed.path;
            _isUploadingRight = true;
            break;
          case 'with_vehicle':
            _withVehicleImagePath = compressed.path;
            _isUploadingWithVehicle = true;
            break;
        }
      });

      final url = await ApiService()
          .uploadFile(File(compressed.path), 'pickup_verification');
      if (!mounted) return;

      if (url == null) {
        throw Exception('Upload returned null URL');
      }

      setState(() {
        switch (type) {
          case 'front':
            _frontPhotoUrl = url;
            _isUploadingFront = false;
            break;
          case 'back':
            _backPhotoUrl = url;
            _isUploadingBack = false;
            break;
          case 'left':
            _leftPhotoUrl = url;
            _isUploadingLeft = false;
            break;
          case 'right':
            _rightPhotoUrl = url;
            _isUploadingRight = false;
            break;
          case 'with_vehicle':
            _withVehiclePhotoUrl = url;
            _isUploadingWithVehicle = false;
            break;
        }
      });
      _showSuccess('Photo uploaded successfully');
    } catch (e) {
      if (mounted) {
        setState(() {
          switch (type) {
            case 'front':
              _frontImagePath = null;
              _isUploadingFront = false;
              break;
            case 'back':
              _backImagePath = null;
              _isUploadingBack = false;
              break;
            case 'left':
              _leftImagePath = null;
              _isUploadingLeft = false;
              break;
            case 'right':
              _rightImagePath = null;
              _isUploadingRight = false;
              break;
            case 'with_vehicle':
              _withVehicleImagePath = null;
              _isUploadingWithVehicle = false;
              break;
          }
        });
        _showError('Upload failed. Please check your connection and try again.');
      }
    }
  }

  bool get _isFormValid {
    return _selectedHubId != null &&
        _selectedTeamLeader != null &&
        _selectedVehicleId != null &&
        _isOtpVerified &&
        _frontPhotoUrl != null &&
        _backPhotoUrl != null &&
        _leftPhotoUrl != null &&
        _rightPhotoUrl != null &&
        _withVehiclePhotoUrl != null;
  }

  void _submitForm() {
    if (!_isFormValid) return;
    widget.onNext(
      _selectedHubId!,
      _selectedVehicleId!,
      _selectedTeamLeader,
      _emergencyContactController.text.replaceAll(RegExp(r'\\D'), ''),
      _frontPhotoUrl,
      _backPhotoUrl,
      _leftPhotoUrl,
      _rightPhotoUrl,
      _withVehiclePhotoUrl,
    );
  }

  // ── Card Wrappers ──────────────────────────────────────────────────────────

  Widget _buildCard1() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: kSurfaceContainer,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: const Color(0xFFF3F4F6), width: 1),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ASSIGNMENT DETAILS',
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: kOutlineColor,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 24),
          buildInputLabel('SELECT HUB'),
          const SizedBox(height: 8),
          buildHubDropdown(
            _selectedHubId,
            _hubs,
            (val) {
              setState(() {
                _selectedHubId = val;
                _selectedVehicleId = null;
                _selectedVehicleLabel = null;
              });
              if (val != null) _fetchVehicles(val);
            },
          ),
          const SizedBox(height: 20),
          buildInputLabel('TEAM LEADER'),
          const SizedBox(height: 8),
          buildTeamLeaderDropdown(
            _selectedTeamLeader,
            (val) => setState(() => _selectedTeamLeader = val),
          ),
          const SizedBox(height: 20),
          buildInputLabel('VEHICLE NUMBER'),
          const SizedBox(height: 8),
          buildVehicleDropdown(
            hubSelected: _selectedHubId != null,
            isLoadingVehicles: _isLoadingVehicles,
            vehicleSelected: _selectedVehicleId != null,
            selectedVehicleLabel: _selectedVehicleLabel,
            vehicleCount: _vehicles.length,
            onTap: _showVehicleSearchSheet,
          ),
          const SizedBox(height: 20),
          buildInputLabel('EMERGENCY CONTACT'),
          const SizedBox(height: 8),
          EmergencyContactField(
            controller: _emergencyContactController,
            isOtpVerified: _isOtpVerified,
            isOtpSent: _isOtpSent,
            isSendingOtp: _isSendingOtp,
            onSendOtp: _sendEmergencyOtp,
            onChanged: (val) {
              if (_isOtpSent) setState(() => _isOtpSent = false);
              if (_isOtpVerified) setState(() => _isOtpVerified = false);
            },
          ),
          if (_isOtpSent && !_isOtpVerified) ...[
            const SizedBox(height: 20),
            buildInputLabel('ENTER 6-DIGIT OTP'),
            const SizedBox(height: 8),
            OtpGrid(controller: _otpController),
            const SizedBox(height: 16),
            buildVerifyOtpButton(
              isVerifying: _isVerifyingOtp,
              onPressed: _verifyEmergencyOtp,
            ),
          ],
          if (_isOtpVerified) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: kSuccessColor.withOpacity(0.08),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle, color: kSuccessColor, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    'Emergency contact verified successfully',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: kSuccessColor,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCard2() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: kSurfaceContainer,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: const Color(0xFFF3F4F6), width: 1),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.camera_alt_outlined, color: kPrimaryColor, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Vehicle Condition',
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: kOnSurfaceColor,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'MANDATORY',
                  style: GoogleFonts.inter(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFFEF4444),
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Upload high-quality pictures from the requested angles',
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w400,
              color: kOutlineColor,
            ),
          ),
          const SizedBox(height: 24),
          // Photo grid: 2x2
          Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: PhotoUploadCard(
                      type: 'front',
                      label: 'Front Profile',
                      imagePath: _frontImagePath,
                      photoUrl: _frontPhotoUrl,
                      isUploading: _isUploadingFront,
                      onTap: () => showImageSourceDialog(
                          context, 'front', _uploadImage),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: PhotoUploadCard(
                      type: 'back',
                      label: 'Back Profile',
                      imagePath: _backImagePath,
                      photoUrl: _backPhotoUrl,
                      isUploading: _isUploadingBack,
                      onTap: () => showImageSourceDialog(
                          context, 'back', _uploadImage),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: PhotoUploadCard(
                      type: 'left',
                      label: 'Left Profile',
                      imagePath: _leftImagePath,
                      photoUrl: _leftPhotoUrl,
                      isUploading: _isUploadingLeft,
                      onTap: () => showImageSourceDialog(
                          context, 'left', _uploadImage),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: PhotoUploadCard(
                      type: 'right',
                      label: 'Right Profile',
                      imagePath: _rightImagePath,
                      photoUrl: _rightPhotoUrl,
                      isUploading: _isUploadingRight,
                      onTap: () => showImageSourceDialog(
                          context, 'right', _uploadImage),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            'Photo with Vehicle',
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: kOnSurfaceColor,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Take a selfie next to the vehicle before riding',
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w400,
              color: kOutlineColor,
            ),
          ),
          const SizedBox(height: 8),
          PhotoUploadCard(
            type: 'with_vehicle',
            label: 'Photo with Vehicle',
            imagePath: _withVehicleImagePath,
            photoUrl: _withVehiclePhotoUrl,
            isUploading: _isUploadingWithVehicle,
            onTap: () => showImageSourceDialog(
                context, 'with_vehicle', _uploadImage),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState() {
    return const Scaffold(
      backgroundColor: kSurfaceColor,
      body: Center(
        child: CircularProgressIndicator(
          color: kPrimaryColor,
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Scaffold(
      backgroundColor: kSurfaceColor,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 48),
              const SizedBox(height: 16),
              Text(
                _error ?? 'An unexpected error occurred',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: kOnSurfaceColor,
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: 140,
                height: 40,
                child: ElevatedButton(
                  onPressed: _fetchHubs,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimaryColor,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    'Retry',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return _buildLoadingState();
    }
    if (_error != null) {
      return _buildErrorState();
    }

    return Scaffold(
      backgroundColor: kSurfaceColor,
      body: Stack(
        children: [
          Positioned.fill(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  buildCurtainHeader(onBack: () => widget.onBack?.call()),
                  Transform.translate(
                    offset: const Offset(0, -32),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        children: [
                          _buildCard1(),
                          const SizedBox(height: 24),
                          _buildCard2(),
                          const SizedBox(height: 140),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          buildStickyBottomBar(
            isFormValid: _isFormValid,
            onSubmit: _submitForm,
          ),
        ],
      ),
    );
  }
}
