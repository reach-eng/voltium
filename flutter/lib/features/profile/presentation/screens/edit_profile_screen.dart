import 'dart:async';
import 'package:universal_io/io.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/widgets/image_source_sheet.dart';
import '../widgets/edit_profile_widgets.dart';
import '../../../../theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/date_formatters.dart';
import 'package:voltium_rider/utils/toast.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  late TextEditingController _fatherNameController;
  late TextEditingController _motherNameController;
  late TextEditingController _dobController;
  late TextEditingController _addressController;
  late TextEditingController _emergencyContactController;

  late TextEditingController _gNameController;
  late TextEditingController _gPhoneController;
  late TextEditingController _gAddressController;
  late TextEditingController _gOtpController;

  // Initial field tracking for dirty check (P0-2 / P1-3)
  String _initialName = '';
  String _initialEmail = '';
  String _initialFatherName = '';
  String _initialMotherName = '';
  String _initialDob = '';
  String _initialAddress = '';
  String _initialEmergencyContact = '';
  String _initialGName = '';
  String _initialGPhone = '';
  String _initialGAddress = '';

  XFile? _profileImage;

  // Guarantor OTP state
  bool _isSendingGOtp = false;
  bool _isVerifyingGOtp = false;
  bool _isGOtpSent = false;
  bool _isGPhoneVerified = false;
  bool _isSaving = false;
  bool _isSaved = false;
  String? _originalGPhone;

  // OTP Resend Cooldown (P1-5)
  int _resendCooldown = 0;
  Timer? _cooldownTimer;

  bool get _isDirty {
    if (_profileImage != null) return true;
    if (_nameController.text != _initialName) return true;
    if (_emailController.text != _initialEmail) return true;
    if (_fatherNameController.text != _initialFatherName) return true;
    if (_motherNameController.text != _initialMotherName) return true;
    if (_dobController.text != _initialDob) return true;
    if (_addressController.text != _initialAddress) return true;
    if (_emergencyContactController.text != _initialEmergencyContact)
      return true;
    if (_gNameController.text != _initialGName) return true;
    if (_gPhoneController.text != _initialGPhone) return true;
    if (_gAddressController.text != _initialGAddress) return true;
    return false;
  }

  Future<void> _pickImage() async {
    try {
      final source = await ImageSourceBottomSheet.show(context: context);
      if (source == null) return;
      final picker = ImagePicker();
      final image = await picker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
        requestFullMetadata: false,
      );
      if (image != null && mounted) {
        setState(() => _profileImage = image);
      }
    } catch (e) {
      if (mounted) {
        Toast.error(
          context,
          AppLocalizations.of(context)!.txtfailedToCapturePhoto,
        );
      }
    }
  }

  void _onFieldChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void initState() {
    super.initState();
    final rider = ref.read(riderProvider).rider;

    _initialName = rider?.name ?? '';
    _initialEmail = rider?.email ?? '';
    _initialFatherName = rider?.fatherName ?? '';
    _initialMotherName = rider?.motherName ?? '';
    _initialDob = rider?.dob?.toIso8601String() ?? '';
    _initialAddress = rider?.currentAddress ?? '';
    _initialEmergencyContact = rider?.emergencyContact ?? '';
    _initialGName = rider?.guarantorName ?? '';
    _initialGPhone = rider?.guarantorPhone ?? '';
    _initialGAddress = rider?.guarantorAddress ?? '';

    _nameController = TextEditingController(text: _initialName);
    _emailController = TextEditingController(text: _initialEmail);
    _fatherNameController = TextEditingController(text: _initialFatherName);
    _motherNameController = TextEditingController(text: _initialMotherName);
    _dobController = TextEditingController(
      text: _initialDob,
    );
    _addressController = TextEditingController(text: _initialAddress);
    _emergencyContactController =
        TextEditingController(text: _initialEmergencyContact);
    _gNameController = TextEditingController(text: _initialGName);
    _gPhoneController = TextEditingController(text: _initialGPhone);
    _gAddressController = TextEditingController(text: _initialGAddress);
    _gOtpController = TextEditingController();

    _isGPhoneVerified = _initialGPhone.isNotEmpty;

    // PR-AUDIT-2026-08-16 §4.1: register listener on all controllers so
    // that `_isDirty` recalculates immediately on any keystroke and the
    // top-app-bar Save action button enables / disables dynamically.
    final controllers = <TextEditingController>[
      _nameController,
      _emailController,
      _fatherNameController,
      _motherNameController,
      _dobController,
      _addressController,
      _emergencyContactController,
      _gNameController,
      _gPhoneController,
      _gAddressController,
      _gOtpController,
    ];
    for (final c in controllers) {
      c.addListener(_onFieldChanged);
    }
  }

  String _twoDigits(int n) => n.toString().padLeft(2, '0');

  void _startCooldown() {
    _resendCooldown = 30;
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_resendCooldown > 0) {
          _resendCooldown--;
        } else {
          timer.cancel();
        }
      });
    });
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    for (var controller in [
      _nameController,
      _emailController,
      _phoneController,
      _fatherNameController,
      _motherNameController,
      _dobController,
      _addressController,
      _emergencyContactController,
      _gNameController,
      _gPhoneController,
      _gAddressController,
      _gOtpController,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _sendGuarantorOtp() async {
    if (_resendCooldown > 0) return;
    final phone = _gPhoneController.text.replaceAll(RegExp(r'\D'), '');
    if (phone.length < 10) {
      Toast.error(
        context,
        AppLocalizations.of(context)!.txtenterAValid10DigitNumber,
      );
      return;
    }
    final rider = ref.read(riderProvider).rider;
    if (phone == rider?.phone) {
      Toast.error(
        context,
        AppLocalizations.of(context)!
            .txtguarantorPhoneCannotBeTheSameAsYourPhone,
      );
      return;
    }
    setState(() => _isSendingGOtp = true);
    try {
      final client = ApiClient();
      final res = await VoltiumApiClient(client)
          .postAuthSendOtp(SendOtpRequest(phone: phone));
      final result = res.toJson();
      if (mounted) {
        setState(() {
          _isSendingGOtp = false;
          _isGOtpSent = true;
        });
        _startCooldown();
        Toast.success(
          context,
          AppLocalizations.of(context)!.txtotpSentToGuarantorPhone,
        );
        // Dev / test mode only: autofill echoed OTP
        if (kDebugMode && const String.fromEnvironment('TEST_MODE') == 'true') {
          final devOtp = result['data']?['otp']?.toString();
          if (devOtp != null && devOtp.length == 6) {
            _gOtpController.text = devOtp;
          }
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSendingGOtp = false);
        Toast.error(
          context,
          AppLocalizations.of(context)!.txtfailedToSendOtp,
        );
      }
    }
  }

  Future<void> _verifyGuarantorOtp() async {
    if (_gOtpController.text.length != 6) {
      Toast.error(
        context,
        AppLocalizations.of(context)!.txtenterThe6DigitOtp,
      );
      return;
    }
    final phone = _gPhoneController.text.replaceAll(RegExp(r'\D'), '');
    setState(() => _isVerifyingGOtp = true);
    try {
      final response = await VoltiumApiService()
          .verifyPhone(phone: phone, otp: _gOtpController.text);
      final verified =
          response['data']?['verified'] == true || response['verified'] == true;
      if (!verified) {
        if (mounted) {
          setState(() => _isVerifyingGOtp = false);
          Toast.error(
            context,
            response['data']?['message']?.toString() ??
                AppLocalizations.of(context)!.txtinvalidOtp,
          );
        }
        return;
      }
      if (mounted) {
        setState(() {
          _isVerifyingGOtp = false;
          _isGPhoneVerified = true;
          _isGOtpSent = false;
        });
        Toast.success(
          context,
          AppLocalizations.of(context)!.txtguarantorPhoneVerified,
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isVerifyingGOtp = false);
        Toast.error(
          context,
          AppLocalizations.of(context)!.txtinvalidOtp,
        );
      }
    }
  }

  Future<void> _saveProfile() async {
    final provider = ref.read(riderProvider.notifier);
    final rider = ref.watch(riderProvider).rider;
    if (rider == null || rider.riderId.isEmpty) return;

    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_gPhoneController.text.trim().isNotEmpty && !_isGPhoneVerified) {
      Toast.error(
        context,
        'Please verify the new guarantor phone number before saving.',
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      String? uploadedPhotoUrl;
      if (_profileImage != null) {
        uploadedPhotoUrl = await VoltiumApiService().uploadFile(
          File(_profileImage!.path),
          'profile_photo',
        );
      }

      await VoltiumApiService().updateProfile(
        riderId: rider.riderId,
        data: {
          'fullName': _nameController.text.trim(),
          'email': _emailController.text.trim(),
          'fatherName': _fatherNameController.text.trim(),
          'motherName': _motherNameController.text.trim(),
          'dob': _dobController.text.isNotEmpty ? _dobController.text : null,
          'currentAddress': _addressController.text.trim(),
          'emergencyContact': _emergencyContactController.text.trim(),
          'guarantorName': _gNameController.text.trim(),
          'guarantorPhone': _gPhoneController.text.trim(),
          'guarantorAddress': _gAddressController.text.trim(),
          // Backend alias: riderPhoto mirrors profilePhoto for legacy admin views (P1-4)
          if (uploadedPhotoUrl != null) 'profilePhoto': uploadedPhotoUrl,
          if (uploadedPhotoUrl != null) 'riderPhoto': uploadedPhotoUrl,
        },
      );

      await provider.refreshFromApi();

      if (mounted) {
        _isSaved = true;
        setState(() => _isSaving = false);
        Toast.success(
          context,
          AppLocalizations.of(context)!.txtprofileUpdatedSuccessfully,
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        final rawMsg =
            e.toString().replaceAll(RegExp(r'^(Exception:\s*|Error:\s*)'), '');
        Toast.error(
          context,
          rawMsg.isNotEmpty && !rawMsg.contains('XMLHttpRequest')
              ? rawMsg
              : 'Failed to update profile. Please try again.',
        );
      }
    }
  }

  Future<bool> _showDiscardDialog(BuildContext ctx) async {
    final colors = AppColors.of(ctx);
    final discard = await showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        ),
        title: Text(
          'Discard changes?',
          style: AppTypography.titleMedium.copyWith(color: colors.onSurface),
        ),
        content: Text(
          'You have unsaved changes. Are you sure you want to discard them and exit?',
          style:
              AppTypography.bodyMedium.copyWith(color: colors.onSurfaceMuted),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx, false),
            child: Text(
              'Keep Editing',
              style: TextStyle(color: colors.onSurfaceVariant),
            ),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogCtx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.error),
            // T-66: hardcoded English button label. Localised
            // via the new `txtdiscard` ARB key.
            child: Text(AppLocalizations.of(context)!.txtdiscard),
          ),
        ],
      ),
    );
    if (discard == true && ctx.mounted) {
      _isSaved = true;
      Navigator.pop(ctx);
      return true;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;

    return PopScope(
      canPop: !_isDirty || _isSaved,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        await _showDiscardDialog(context);
      },
      child: Scaffold(
        backgroundColor: colors.surface,
        appBar: AppBar(
          backgroundColor: colors.surface,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          leading: IconButton(
            icon: Icon(Icons.arrow_back, color: colors.onSurface),
            onPressed: () async {
              if (!_isDirty || _isSaved) {
                Navigator.maybePop(context);
              } else {
                await _showDiscardDialog(context);
              }
            },
          ),
          title: Text(
            l10n.txteditProfile,
            style: AppTypography.headingSmall.copyWith(color: colors.onSurface),
          ),
        ),
        body: Stack(
          children: [
            _buildMeshBackground(),
            SafeArea(
              child: Form(
                key: _formKey,
                child: Column(
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 16,
                        ),
                        child: Column(
                          children: [
                            FadeUpWidget(
                                delay: 0, child: _buildAvatarSection()),
                            const SizedBox(height: 32),
                            FadeUpWidget(
                              delay: 100,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  const EditProfileSectionHeader(
                                    title: 'PERSONAL INFORMATION',
                                  ),
                                  EditProfileTextField(
                                    key: const Key('editFullNameField'),
                                    label: 'Full Name',
                                    controller: _nameController,
                                    icon: Icons.person_outline,
                                    validator: (v) {
                                      if (v == null || v.trim().length < 2) {
                                        return 'Enter a valid name (at least 2 characters)';
                                      }
                                      return null;
                                    },
                                  ),
                                  const SizedBox(height: 16),
                                  EditProfileTextField(
                                    key: const Key('editPhoneField'),
                                    label: 'Phone Number',
                                    controller: _phoneController,
                                    icon: Icons.phone_outlined,
                                    keyboardType: TextInputType.phone,
                                    readOnly: true,
                                    suffixIcon: Icon(
                                      Icons.lock_outline,
                                      size: 16,
                                      color: colors.outlineVariant,
                                    ),
                                    helperText:
                                        'Primary phone is verified and cannot be edited directly.',
                                  ),
                                  const SizedBox(height: 16),
                                  EditProfileTextField(
                                    key: const Key('editEmailField'),
                                    label: 'Email Address',
                                    controller: _emailController,
                                    icon: Icons.email_outlined,
                                    keyboardType: TextInputType.emailAddress,
                                    validator: (v) {
                                      if (v != null &&
                                          v.trim().isNotEmpty &&
                                          !RegExp(r'^[\w.+-]+@[\w-]+\.[\w.-]+$')
                                              .hasMatch(v.trim())) {
                                        return 'Enter a valid email address';
                                      }
                                      return null;
                                    },
                                  ),
                                  const SizedBox(height: 16),
                                  EditProfileTextField(
                                    key: const Key('editFatherNameField'),
                                    label: 'Father\'s Name',
                                    controller: _fatherNameController,
                                    icon: Icons.family_restroom_outlined,
                                  ),
                                  const SizedBox(height: 16),
                                  EditProfileTextField(
                                    key: const Key('editMotherNameField'),
                                    label: 'Mother\'s Name',
                                    controller: _motherNameController,
                                    icon: Icons.family_restroom_outlined,
                                  ),
                                  const SizedBox(height: 16),
                                  EditProfileDateField(
                                    key: const Key('editDobField'),
                                    label: 'Date of Birth',
                                    controller: _dobController,
                                    onTap: () async {
                                      final firstDate = DateTime(1940);
                                      final lastDate = DateTime.now().subtract(
                                        const Duration(days: 18 * 365),
                                      );
                                      final parsed =
                                          (_dobController.text.isNotEmpty
                                                  ? DateTime.tryParse(
                                                      _dobController.text)
                                                  : null) ??
                                              DateTime(2000, 1, 1);
                                      final initialDate =
                                          parsed.isBefore(firstDate)
                                              ? firstDate
                                              : (parsed.isAfter(lastDate)
                                                  ? lastDate
                                                  : parsed);

                                      final picked = await showDatePicker(
                                        context: context,
                                        initialDate: initialDate,
                                        firstDate: firstDate,
                                        lastDate: lastDate,
                                      );
                                      if (picked != null) {
                                        setState(() {
                                          _dobController.text =
                                              '${picked.year}-${_twoDigits(picked.month)}-${_twoDigits(picked.day)}';
                                        });
                                      }
                                    },
                                  ),
                                  const SizedBox(height: 16),
                                  EditProfileTextField(
                                    key: const Key('editAddressField'),
                                    label: 'Current Address',
                                    controller: _addressController,
                                    icon: Icons.home_outlined,
                                  ),
                                  const SizedBox(height: 16),
                                  EditProfileTextField(
                                    key: const Key('editEmergencyContactField'),
                                    label: 'Emergency Contact Number',
                                    controller: _emergencyContactController,
                                    icon: Icons.emergency_outlined,
                                    keyboardType: TextInputType.phone,
                                    validator: (v) {
                                      final clean =
                                          v?.replaceAll(RegExp(r'\D'), '') ??
                                              '';
                                      if (clean.isNotEmpty &&
                                          clean.length != 10) {
                                        return 'Emergency contact must be 10 digits';
                                      }
                                      final rider =
                                          ref.read(riderProvider).rider;
                                      final riderPhone = rider != null
                                          ? rider.phone
                                              .replaceAll(RegExp(r'\D'), '')
                                          : '';
                                      if (clean.isNotEmpty &&
                                          clean == riderPhone) {
                                        return 'Emergency contact cannot be your own number';
                                      }
                                      return null;
                                    },
                                  ),
                                  Padding(
                                    padding:
                                        const EdgeInsets.only(left: 4, top: 4),
                                    child: Text(
                                      'Used to contact you in case of an emergency.',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 12,
                                        color: AppColors.of(context)
                                            .onSurfaceVariant,
                                        fontStyle: FontStyle.italic,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 32),
                            FadeUpWidget(
                              delay: 300,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  const EditProfileSectionHeader(
                                    title: 'GUARANTOR DETAILS',
                                  ),
                                  EditProfileTextField(
                                    key: const Key('editGuarantorNameField'),
                                    label: 'Guarantor Name',
                                    controller: _gNameController,
                                    icon: Icons.shield_outlined,
                                  ),
                                  const SizedBox(height: 16),
                                  _buildGuarantorPhoneField(),
                                  const SizedBox(height: 16),
                                  EditProfileTextField(
                                    key: const Key('editGuarantorAddressField'),
                                    label: 'Guarantor Address',
                                    controller: _gAddressController,
                                    icon: Icons.home_outlined,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 32),
                            const FadeUpWidget(
                              delay: 500,
                              child: EditProfileAdminNote(),
                            ),
                            const SizedBox(height: 32),
                            FadeUpWidget(
                              delay: 600,
                              child: ElevatedButton(
                                key: const Key('submitProfileButton'),
                                onPressed: (_isSaving || !_isDirty)
                                    ? null
                                    : _saveProfile,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: Colors.white,
                                  disabledBackgroundColor:
                                      AppColors.primary.withValues(alpha: 0.4),
                                  disabledForegroundColor:
                                      Colors.white.withValues(alpha: 0.6),
                                  minimumSize: const Size(double.infinity, 56),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(
                                        AppRadius.radiusModal),
                                  ),
                                  elevation: _isDirty ? 8 : 0,
                                  shadowColor:
                                      AppColors.primary.withValues(alpha: 0.4),
                                ),
                                child: _isSaving
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          color: Colors.white,
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : Text(
                                        'SUBMIT FOR APPROVAL',
                                        style: GoogleFonts.plusJakartaSans(
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: 1.2,
                                        ),
                                      ),
                              ),
                            ),
                            const SizedBox(height: 48),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMeshBackground() {
    return Positioned.fill(
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.of(context).iconBackground,
              AppColors.of(context).surfaceBright
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAvatarSection() {
    final colors = AppColors.of(context);
    final rider = ref.watch(riderProvider).rider;
    String? getAvatarUrl() {
      final photo = rider?.profilePhoto;
      if (photo == null || photo.isEmpty) {
        return null;
      }
      if (photo.startsWith('http')) return photo;
      final baseUrl = ApiClient().baseUrl;
      return '$baseUrl/api/files/${photo.replaceFirst(RegExp(r'^/+'), '')}';
    }

    final avatarUrl = getAvatarUrl();

    return Center(
      child: Stack(
        children: [
          Container(
            padding: Spacing.paddingXs,
            decoration: BoxDecoration(
              color: colors.card,
              shape: BoxShape.circle,
              border: Border.all(
                color: colors.outlineVariant.withValues(alpha: 0.5),
              ),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black12,
                  blurRadius: 20,
                  offset: Offset(0, 10),
                ),
              ],
            ),
            child: CircleAvatar(
              radius: 54,
              backgroundColor: colors.iconBackground,
              child: _profileImage != null
                  ? ClipOval(
                      child: Image.file(
                        File(_profileImage!.path),
                        width: 108,
                        height: 108,
                        fit: BoxFit.cover,
                      ),
                    )
                  : avatarUrl != null
                      ? ClipOval(
                          child: CachedNetworkImage(
                            imageUrl: avatarUrl,
                            width: 108,
                            height: 108,
                            fit: BoxFit.cover,
                            placeholder: (_, __) =>
                                const CircularProgressIndicator(),
                            errorWidget: (_, __, ___) => const Icon(
                              Icons.person,
                              size: 54,
                              color: AppColors.slate400,
                            ),
                          ),
                        )
                      : const Icon(
                          Icons.person,
                          size: 54,
                          color: AppColors.slate400,
                        ),
            ),
          ),
          Positioned(
            right: 0,
            bottom: 0,
            child: GestureDetector(
              onTap: _pickImage,
              child: Container(
                padding: Spacing.paddingSm,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child:
                    const Icon(Icons.camera_alt, color: Colors.white, size: 20),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGuarantorPhoneField() {
    final colors = AppColors.of(context);
    final cleanCurrent = _gPhoneController.text.replaceAll(RegExp(r'\D'), '');
    final cleanOrig = _originalGPhone?.replaceAll(RegExp(r'\D'), '') ?? '';
    final phoneChanged = cleanCurrent != cleanOrig && cleanCurrent.isNotEmpty;
    final needsVerification = phoneChanged && !_isGPhoneVerified;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Text(
            'Guarantor Phone',
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w800)
                .copyWith(color: colors.onSurfaceMuted),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(
                    color: colors.outlineVariant.withValues(alpha: 0.5),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: TextFormField(
                  key: const Key('editGuarantorPhoneField'),
                  controller: _gPhoneController,
                  keyboardType: TextInputType.phone,
                  onChanged: (_) {
                    final curr =
                        _gPhoneController.text.replaceAll(RegExp(r'\D'), '');
                    final orig =
                        _originalGPhone?.replaceAll(RegExp(r'\D'), '') ?? '';
                    setState(() {
                      _isGPhoneVerified = curr == orig && (orig.isNotEmpty);
                      _isGOtpSent = false;
                      _gOtpController.clear();
                    });
                  },
                  style: AppTypography.bodyLarge
                      .copyWith(fontWeight: FontWeight.w600)
                      .copyWith(color: colors.onSurface),
                  decoration: InputDecoration(
                    prefixIcon: Icon(
                      Icons.phone_android_outlined,
                      color: colors.onSurfaceVariant,
                      size: 18,
                    ),
                    suffixIcon: _isGPhoneVerified
                        ? const Icon(
                            Icons.check_circle,
                            color: AppColors.success,
                            size: 20,
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 16,
                    ),
                  ),
                ),
              ),
            ),
            if (needsVerification) ...[
              const SizedBox(width: 8),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: (_isSendingGOtp || _resendCooldown > 0)
                      ? null
                      : _sendGuarantorOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    disabledBackgroundColor: AppColors.primaryLightBlue,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                  ),
                  child: _isSendingGOtp
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(
                          _resendCooldown > 0
                              ? '${_resendCooldown}s'
                              : (_isGOtpSent ? 'Resend' : 'Send OTP'),
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
            ],
          ],
        ),
        // OTP input section
        if (_isGOtpSent && !_isGPhoneVerified) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: colors.card,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    border: Border.all(
                      color: colors.outlineVariant.withValues(alpha: 0.5),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: TextFormField(
                    controller: _gOtpController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    style: AppTypography.bodyLarge
                        .copyWith(fontWeight: FontWeight.w600)
                        .copyWith(color: colors.onSurface, letterSpacing: 8),
                    decoration: InputDecoration(
                      prefixIcon: Icon(
                        Icons.lock_outline,
                        color: colors.onSurfaceVariant,
                        size: 18,
                      ),
                      hintText: '••••••',
                      hintStyle: TextStyle(color: colors.onSurfaceMuted),
                      counterText: '',
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 16,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: _isVerifyingGOtp ? null : _verifyGuarantorOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                    disabledBackgroundColor: AppColors.of(context).successLight,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                  ),
                  child: _isVerifyingGOtp
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(
                          'Verify',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ],
        // Verified badge
        if (_isGPhoneVerified && phoneChanged) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.of(context).successLight,
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle,
                    color: AppColors.success, size: 14),
                const SizedBox(width: 6),
                Text(
                  'Phone verified',
                  style: AppTypography.labelSmall
                      .copyWith(color: AppColors.onSurface),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
