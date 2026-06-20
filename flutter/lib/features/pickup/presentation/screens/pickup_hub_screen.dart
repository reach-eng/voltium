import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';

import 'package:voltium_rider/models/hub_model.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/widgets/pickup_hub_widgets.dart';
import 'package:voltium_rider/widgets/pickup_vehicle_search_sheet.dart';
import 'package:voltium_rider/features/pickup/presentation/widgets/pickup_widgets.dart';
import '../../../../theme/app_theme.dart';

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
  final Map<String, PhotoUploadEntry> _photos = {
    'front': PhotoUploadEntry(),
    'back': PhotoUploadEntry(),
    'left': PhotoUploadEntry(),
    'right': PhotoUploadEntry(),
    'with_vehicle': PhotoUploadEntry(),
  };

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
      final response = await VoltiumApiService().fetchHubs();
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
      final response = await VoltiumApiService().fetchVehicles(hubId);
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
                color: Colors.white, size: 18,),
            const SizedBox(width: 10),
            Expanded(
              child: Text(msg,
                  style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,),),
            ),
          ],
        ),
        backgroundColor: AppColors.error,
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
                color: Colors.white, size: 18,),
            const SizedBox(width: 10),
            Expanded(
              child: Text(msg,
                  style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,),),
            ),
          ],
        ),
        backgroundColor: AppColors.success,
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
          'Emergency contact cannot be the same as guarantor phone number',);
      return;
    }

    setState(() {
      _isSendingOtp = true;
    });

    try {
      final response = await VoltiumApiService().sendOtp(phone: digits);
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
      final response = await VoltiumApiService().verifyOtp(phone: phone, otp: otp);
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

      final entry = _photos[type]!;
      setState(() {
        entry.imagePath = compressed.path;
        entry.isUploading = true;
      });

      final url = await VoltiumApiService()
          .uploadFile(File(compressed.path), 'pickup_verification');
      if (!mounted) return;

      setState(() {
        entry.photoUrl = url;
        entry.isUploading = false;
      });
      _showSuccess('Photo uploaded successfully');
    } catch (e) {
      if (mounted) {
        final entry = _photos[type]!;
        setState(() {
          entry.imagePath = null;
          entry.isUploading = false;
        });
        _showError(
            'Upload failed. Please check your connection and try again.',);
      }
    }
  }

  bool get _isFormValid {
    return _selectedHubId != null &&
        _selectedTeamLeader != null &&
        _selectedVehicleId != null &&
        _isOtpVerified &&
        _photos.values.every((p) => p.photoUrl != null);
  }

  void _submitForm() {
    if (!_isFormValid) return;
    widget.onNext(
      _selectedHubId!,
      _selectedVehicleId!,
      _selectedTeamLeader,
      _emergencyContactController.text.replaceAll(RegExp(r'\\D'), ''),
      _photos['front']!.photoUrl,
      _photos['back']!.photoUrl,
      _photos['left']!.photoUrl,
      _photos['right']!.photoUrl,
      _photos['with_vehicle']!.photoUrl,
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
              const Icon(Icons.error_outline_rounded,
                  color: AppColors.error, size: 48,),
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
                  child: Text('Retry',
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
                          AssignmentDetailsCard(
                            selectedHubId: _selectedHubId,
                            hubs: _hubs,
                            onHubChanged: (val) {
                              setState(() {
                                _selectedHubId = val;
                                _selectedVehicleId = null;
                                _selectedVehicleLabel = null;
                              });
                              if (val != null) _fetchVehicles(val);
                            },
                            selectedTeamLeader: _selectedTeamLeader,
                            onTeamLeaderChanged: (val) =>
                                setState(() => _selectedTeamLeader = val),
                            isHubSelected: _selectedHubId != null,
                            selectedVehicleId: _selectedVehicleId,
                            selectedVehicleLabel: _selectedVehicleLabel,
                            isLoadingVehicles: _isLoadingVehicles,
                            vehicleCount: _vehicles.length,
                            onVehicleTap: _showVehicleSearchSheet,
                            emergencyContactController:
                                _emergencyContactController,
                            isOtpSent: _isOtpSent,
                            isOtpVerified: _isOtpVerified,
                            isSendingOtp: _isSendingOtp,
                            onSendOtp: _sendEmergencyOtp,
                            onEmergencyContactChanged: (val) {
                              if (_isOtpSent) {
                                setState(() => _isOtpSent = false);
                              }
                              if (_isOtpVerified) {
                                setState(() => _isOtpVerified = false);
                              }
                            },
                            otpController: _otpController,
                            isVerifyingOtp: _isVerifyingOtp,
                            onVerifyOtp: _verifyEmergencyOtp,
                          ),
                          const SizedBox(height: 24),
                          VehicleConditionCard(
                            frontImagePath: _photos['front']!.imagePath,
                            frontPhotoUrl: _photos['front']!.photoUrl,
                            isUploadingFront: _photos['front']!.isUploading,
                            backImagePath: _photos['back']!.imagePath,
                            backPhotoUrl: _photos['back']!.photoUrl,
                            isUploadingBack: _photos['back']!.isUploading,
                            leftImagePath: _photos['left']!.imagePath,
                            leftPhotoUrl: _photos['left']!.photoUrl,
                            isUploadingLeft: _photos['left']!.isUploading,
                            rightImagePath: _photos['right']!.imagePath,
                            rightPhotoUrl: _photos['right']!.photoUrl,
                            isUploadingRight: _photos['right']!.isUploading,
                            withVehicleImagePath:
                                _photos['with_vehicle']!.imagePath,
                            withVehiclePhotoUrl:
                                _photos['with_vehicle']!.photoUrl,
                            isUploadingWithVehicle:
                                _photos['with_vehicle']!.isUploading,
                            onUploadImage: _uploadImage,
                          ),
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
