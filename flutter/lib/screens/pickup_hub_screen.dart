import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:voltium_rider/widgets/dashed_border_painter.dart';
import '../models/hub_model.dart';
import '../services/api_service.dart';
import '../services/image_compression_service.dart';
import '../providers/app_provider.dart';
import '../utils/phone_validator.dart';
import '../theme/app_theme.dart';

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

  final List<String> _teamLeaders = [
    'Rajesh Kumar (TL-01)',
    'Amit Sharma (TL-02)',
    'Sanjay Singh (TL-03)',
  ];

  final _vehicleIdController = TextEditingController();
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

  // Optional 5th Photo
  bool _showWithVehicleSlot = false;
  String? _withVehicleImagePath;
  String? _withVehiclePhotoUrl;
  bool _isUploadingWithVehicle = false;

  // Styling Constants (from HTML/Tailwind mockup)
  static const Color kPrimaryColor = Color(0xFF0053C1);
  static const Color kSurfaceColor = Color(0xFFF9F9FF);
  static const Color kSurfaceContainer = Color(0xFFFFFFFF);
  static const Color kOnSurfaceColor = Color(0xFF141B2B);
  static const Color kOutlineColor = Color(0xFF737785);
  static const Color kOutlineVariantColor = Color(0xFFC2C6D6);
  static const Color kSuccessColor = Color(0xFF10B981);

  @override
  void dispose() {
    _vehicleIdController.dispose();
    _emergencyContactController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _fetchHubs();
    if (_vehicleIdController.text.isEmpty) {
      _vehicleIdController.text = 'DL-1SV-0000';
    }
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

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: const Color(0xFFEF4444)),
    );
  }

  Future<void> _sendEmergencyOtp() async {
    final phone = _emergencyContactController.text;
    final digits = phone.replaceAll(RegExp(r'\D'), '');

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
        _showError('OTP sent to emergency contact');
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
        _emergencyContactController.text.replaceAll(RegExp(r'\D'), '');
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
        _showError('Phone verified successfully');
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

  void _showImageSourceDialog(String type) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return SafeArea(
          child: Wrap(
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt, color: kPrimaryColor),
                title: const Text('Take a Photo'),
                onTap: () {
                  Navigator.pop(context);
                  _uploadImage(type, true);
                },
              ),
              ListTile(
                leading:
                    const Icon(Icons.photo_library, color: kPrimaryColor),
                title: const Text('Choose from Gallery'),
                onTap: () {
                  Navigator.pop(context);
                  _uploadImage(type, false);
                },
              ),
            ],
          ),
        );
      },
    );
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
    } catch (e) {
      if (mounted) {
        setState(() {
          switch (type) {
            case 'front':
              _isUploadingFront = false;
              break;
            case 'back':
              _isUploadingBack = false;
              break;
            case 'left':
              _isUploadingLeft = false;
              break;
            case 'right':
              _isUploadingRight = false;
              break;
            case 'with_vehicle':
              _isUploadingWithVehicle = false;
              break;
          }
        });
        _showError('Upload failed. Please try again.');
      }
    }
  }

  bool get _isFormValid {
    return _selectedHubId != null &&
        _selectedTeamLeader != null &&
        _vehicleIdController.text.isNotEmpty &&
        _isOtpVerified &&
        _frontPhotoUrl != null &&
        _backPhotoUrl != null &&
        _leftPhotoUrl != null &&
        _rightPhotoUrl != null;
  }

  void _submitForm() {
    if (!_isFormValid) return;
    widget.onNext(
      _selectedHubId!,
      _vehicleIdController.text.toUpperCase(),
      _selectedTeamLeader,
      _emergencyContactController.text.replaceAll(RegExp(r'\D'), ''),
      _frontPhotoUrl,
      _backPhotoUrl,
      _leftPhotoUrl,
      _rightPhotoUrl,
      _withVehiclePhotoUrl,
    );
  }

  Widget _buildCurtainHeader() {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: kPrimaryColor,
      ),
      padding: const EdgeInsets.only(top: 60, bottom: 80, left: 24, right: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () => widget.onBack?.call(),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white.withOpacity(0.15),
                  ),
                  child: const Icon(
                    Icons.arrow_back,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            'Pickup Verification',
            style: GoogleFonts.inter(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Complete the verification steps to assign and pick up your vehicle',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w400,
              color: Colors.white.withOpacity(0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputLabel(String text) {
    return Text(
      text,
      style: GoogleFonts.inter(
        fontSize: 10,
        fontWeight: FontWeight.w800,
        color: kOutlineColor,
        letterSpacing: 1.0,
      ),
    );
  }

  Widget _buildHubDropdown() {
    return DropdownButtonFormField<String>(
      key: const Key('hubDropdown'),
      value: _selectedHubId,
      style: GoogleFonts.inter(
        color: kOnSurfaceColor,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      icon: const Icon(Icons.keyboard_arrow_down, color: kOutlineColor),
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.location_on_outlined, color: kPrimaryColor, size: 20),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kPrimaryColor, width: 1.5),
        ),
        hintText: 'Select Hub',
        hintStyle: GoogleFonts.inter(
          color: kOutlineColor.withOpacity(0.7),
          fontSize: 14,
        ),
      ),
      items: _hubs.map((hub) {
        return DropdownMenuItem<String>(
          value: hub.id,
          child: Text(hub.name, overflow: TextOverflow.ellipsis),
        );
      }).toList(),
      onChanged: (val) => setState(() => _selectedHubId = val),
    );
  }

  Widget _buildTeamLeaderDropdown() {
    return DropdownButtonFormField<String>(
      key: const Key('teamLeaderDropdown'),
      value: _selectedTeamLeader,
      style: GoogleFonts.inter(
        color: kOnSurfaceColor,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      icon: const Icon(Icons.keyboard_arrow_down, color: kOutlineColor),
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.person_outline, color: kPrimaryColor, size: 20),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kPrimaryColor, width: 1.5),
        ),
        hintText: 'Select Team Leader',
        hintStyle: GoogleFonts.inter(
          color: kOutlineColor.withOpacity(0.7),
          fontSize: 14,
        ),
      ),
      items: _teamLeaders.map((tl) {
        return DropdownMenuItem<String>(
          value: tl,
          child: Text(tl),
        );
      }).toList(),
      onChanged: (val) => setState(() => _selectedTeamLeader = val),
    );
  }

  Widget _buildVehicleNumberField() {
    return TextFormField(
      key: const Key('vehicleNumberField'),
      controller: _vehicleIdController,
      style: GoogleFonts.inter(
        color: kOnSurfaceColor,
        fontSize: 15,
        fontWeight: FontWeight.w800,
        letterSpacing: 2.0,
      ),
      textCapitalization: TextCapitalization.characters,
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.electric_moped_outlined, color: kPrimaryColor, size: 20),
        suffixIcon: Container(
          margin: const EdgeInsets.only(right: 12),
          child: const Icon(Icons.check_circle, color: kSuccessColor, size: 20),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        filled: true,
        fillColor: const Color(0xFFF9F9FF),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kPrimaryColor, width: 1.5),
        ),
      ),
      onChanged: (_) => setState(() {}),
    );
  }

  Widget _buildEmergencyContactField() {
    return TextFormField(
      key: const Key('emergencyContactField'),
      controller: _emergencyContactController,
      keyboardType: TextInputType.phone,
      enabled: !_isOtpVerified,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(10)
      ],
      style: GoogleFonts.inter(
        color: kOnSurfaceColor,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.phone_outlined, color: kPrimaryColor, size: 20),
        suffixIcon: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _isSendingOtp
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          color: kPrimaryColor, strokeWidth: 2),
                    )
                  : TextButton(
                      onPressed: _isOtpVerified ? null : _sendEmergencyOtp,
                      style: TextButton.styleFrom(
                        backgroundColor: _isOtpVerified
                            ? Colors.transparent
                            : kPrimaryColor.withOpacity(0.1),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                      child: Text(
                        _isOtpVerified
                            ? 'VERIFIED'
                            : _isOtpSent
                                ? 'RESEND'
                                : 'SEND OTP',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: _isOtpVerified ? kSuccessColor : kPrimaryColor,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
            ),
          ],
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kPrimaryColor, width: 1.5),
        ),
        hintText: '10-digit number',
        hintStyle: GoogleFonts.inter(
          color: kOutlineColor.withOpacity(0.5),
          fontSize: 14,
        ),
      ),
      onChanged: (val) {
        if (_isOtpSent) setState(() => _isOtpSent = false);
        if (_isOtpVerified) setState(() => _isOtpVerified = false);
      },
    );
  }

  Widget _buildCustomOtpGrid() {
    return Stack(
      children: [
        Opacity(
          opacity: 0.0,
          child: SizedBox(
            height: 50,
            child: TextFormField(
              key: const Key('otpInputField'),
              controller: _otpController,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6)
              ],
              onChanged: (val) {
                setState(() {});
              },
            ),
          ),
        ),
        IgnorePointer(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(6, (index) {
              final text = _otpController.text;
              final char = text.length > index ? text[index] : '';
              final isFocused = text.length == index;

              return Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isFocused ? kPrimaryColor : kOutlineVariantColor,
                    width: isFocused ? 2.0 : 1.0,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  char,
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: kOnSurfaceColor,
                  ),
                ),
              );
            }),
          ),
        ),
      ],
    );
  }

  Widget _buildVerifyOtpButton() {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        key: const Key('verifyOtpButton'),
        onPressed: _isVerifyingOtp ? null : _verifyEmergencyOtp,
        style: ElevatedButton.styleFrom(
          backgroundColor: kPrimaryColor,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: _isVerifyingOtp
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
              )
            : Text(
                'VERIFY',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
      ),
    );
  }

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
          _buildInputLabel('SELECT HUB'),
          const SizedBox(height: 8),
          _buildHubDropdown(),
          const SizedBox(height: 20),
          _buildInputLabel('TEAM LEADER'),
          const SizedBox(height: 8),
          _buildTeamLeaderDropdown(),
          const SizedBox(height: 20),
          _buildInputLabel('VEHICLE NUMBER'),
          const SizedBox(height: 8),
          _buildVehicleNumberField(),
          const SizedBox(height: 20),
          _buildInputLabel('EMERGENCY CONTACT'),
          const SizedBox(height: 8),
          _buildEmergencyContactField(),
          if (_isOtpSent && !_isOtpVerified) ...[
            const SizedBox(height: 20),
            _buildInputLabel('ENTER 6-DIGIT OTP'),
            const SizedBox(height: 8),
            _buildCustomOtpGrid(),
            const SizedBox(height: 16),
            _buildVerifyOtpButton(),
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

  Widget _buildVisualPhotoCard(
    String type,
    String label,
    String? imagePath,
    String? photoUrl,
    bool isUploading,
  ) {
    final hasImage = imagePath != null;
    final isDone = photoUrl != null;

    return GestureDetector(
      key: Key('photoSlot_$type'),
      onTap: isUploading ? null : () => _showImageSourceDialog(type),
      child: Container(
        height: 120,
        decoration: BoxDecoration(
          color: const Color(0xFFF9F9FF),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Stack(
          children: [
            if (!hasImage)
              CustomPaint(
                painter: DashedBorderPainter(
                  color: kOutlineVariantColor,
                  borderRadius: 16,
                ),
                child: Container(),
              ),
            if (hasImage)
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image.file(
                  File(imagePath),
                  width: double.infinity,
                  height: double.infinity,
                  fit: BoxFit.cover,
                ),
              ),
            if (!hasImage && !isUploading)
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white,
                      ),
                      child: const Icon(
                        Icons.camera_alt_outlined,
                        size: 18,
                        color: kPrimaryColor,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      label,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: kOnSurfaceColor,
                      ),
                    ),
                  ],
                ),
              ),
            if (isUploading)
              Center(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white,
                  ),
                  child: const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: kPrimaryColor,
                      strokeWidth: 2,
                    ),
                  ),
                ),
              ),
            if (isDone)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: kSuccessColor,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check,
                    color: Colors.white,
                    size: 12,
                  ),
                ),
              ),
            if (hasImage && !isUploading)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.black.withOpacity(0.8), Colors.transparent],
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                    ),
                    borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildVisualPhotoGrid() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildVisualPhotoCard(
                'front',
                'Front Profile',
                _frontImagePath,
                _frontPhotoUrl,
                _isUploadingFront,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildVisualPhotoCard(
                'back',
                'Back Profile',
                _backImagePath,
                _backPhotoUrl,
                _isUploadingBack,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildVisualPhotoCard(
                'left',
                'Left Profile',
                _leftImagePath,
                _leftPhotoUrl,
                _isUploadingLeft,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildVisualPhotoCard(
                'right',
                'Right Profile',
                _rightImagePath,
                _rightPhotoUrl,
                _isUploadingRight,
              ),
            ),
          ],
        ),
      ],
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
          _buildVisualPhotoGrid(),
          if (!_showWithVehicleSlot) ...[
            const SizedBox(height: 20),
            GestureDetector(
              key: const Key('addOptionalPhotoField'),
              onTap: () => setState(() => _showWithVehicleSlot = true),
              child: CustomPaint(
                painter: DashedBorderPainter(
                  color: kOutlineVariantColor,
                  borderRadius: 12,
                ),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  alignment: Alignment.center,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.add, color: kPrimaryColor, size: 18),
                      const SizedBox(width: 8),
                      Text(
                        'Add Photo with Vehicle (Optional)',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: kPrimaryColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
          if (_showWithVehicleSlot) ...[
            const SizedBox(height: 20),
            Text(
              'Photo with Vehicle (Optional)',
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: kOnSurfaceColor,
              ),
            ),
            const SizedBox(height: 8),
            _buildVisualPhotoCard(
              'with_vehicle',
              'Photo with Vehicle',
              _withVehicleImagePath,
              _withVehiclePhotoUrl,
              _isUploadingWithVehicle,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStickyBottomBar() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: const Border(
            top: BorderSide(color: Color(0xFFF3F4F6), width: 1),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        padding: const EdgeInsets.only(
          left: 24,
          right: 24,
          top: 16,
          bottom: 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                key: const Key('confirmHubButton'),
                onPressed: _isFormValid ? _submitForm : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimaryColor,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xFFE2E8F0),
                  disabledForegroundColor: const Color(0xFF94A3B8),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(
                  'Next: Final Confirmation',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'ENSURE ALL DETAILS ARE ACCURATE BEFORE PROCEEDING',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 9,
                fontWeight: FontWeight.w800,
                color: kOutlineColor.withOpacity(0.7),
                letterSpacing: 1.0,
              ),
            ),
          ],
        ),
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
                  _buildCurtainHeader(),
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
          _buildStickyBottomBar(),
        ],
      ),
    );
  }
}
