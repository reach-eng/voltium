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

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
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

  XFile? _profileImage;

  // Guarantor OTP state
  bool _isSendingGOtp = false;
  bool _isVerifyingGOtp = false;
  bool _isGOtpSent = false;
  bool _isGPhoneVerified = false;
  bool _isSaving = false;
  String? _originalGPhone;

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
        ScaffoldMessenger.of(context).showSnackBar(
          // LANGUAGE-AUDIT (2026-08-16) T-66: hardcoded
          // English SnackBar. Localised via
          // `txtfailedToCapturePhoto` ARB key.
          SnackBar(
            content:
                Text(AppLocalizations.of(context)!.txtfailedToCapturePhoto),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  void initState() {
    super.initState();
    final rider = ref.read(riderProvider).rider;
    _nameController = TextEditingController(text: rider?.name ?? '');
    _emailController = TextEditingController(text: rider?.email ?? '');
    final rawPhone = rider?.phone ?? '';
    final cleanPhoneDigits = rawPhone.replaceAll(RegExp(r'\D'), '');
    final tenDigitPhone = cleanPhoneDigits.length >= 10
        ? cleanPhoneDigits.substring(cleanPhoneDigits.length - 10)
        : cleanPhoneDigits;
    _phoneController = TextEditingController(text: tenDigitPhone);
    _fatherNameController =
        TextEditingController(text: rider?.fatherName ?? '');
    _motherNameController =
        TextEditingController(text: rider?.motherName ?? '');
    final dob = rider?.dob;
    // PR-A: the server expects ISO yyyy-MM-dd. The old dd-MM-yyyy here made
    // an untouched DOB fail validation on save (audit #5 P0-3).
    _dobController = TextEditingController(
      text: dob != null ? formatDobForApi(dob) : '',
    );
    _addressController =
        TextEditingController(text: rider?.currentAddress ?? '');
    _emergencyContactController =
        TextEditingController(text: rider?.emergencyContact ?? '');

    _gNameController = TextEditingController(text: rider?.guarantorName ?? '');
    _gPhoneController =
        TextEditingController(text: rider?.guarantorPhone ?? '');
    _gAddressController =
        TextEditingController(text: rider?.guarantorAddress ?? '');
    _gOtpController = TextEditingController();
    _originalGPhone = rider?.guarantorPhone ?? '';
    // If guarantor phone already exists, it's already verified
    _isGPhoneVerified = (rider?.guarantorPhone ?? '').isNotEmpty;

    _gPhoneController.addListener(() {
      final currentClean = _gPhoneController.text.replaceAll(RegExp(r'\D'), '');
      final origClean = _originalGPhone?.replaceAll(RegExp(r'\D'), '') ?? '';
      if (_isGPhoneVerified && currentClean != origClean) {
        setState(() {
          _isGPhoneVerified = false;
          _isGOtpSent = false;
        });
      }
    });
  }

  String _twoDigits(int n) => n.toString().padLeft(2, '0');

  @override
  void dispose() {
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
    final phone = _gPhoneController.text.replaceAll(RegExp(r'\D'), '');
    if (phone.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        // LANGUAGE-AUDIT (2026-08-16) T-66: hardcoded
        // English SnackBar. Localised via the new
        // `txtenterAValid10DigitNumber` ARB key.
        SnackBar(
          content:
              Text(AppLocalizations.of(context)!.txtenterAValid10DigitNumber),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }
    final rider = ref.read(riderProvider).rider;
    if (phone == rider?.phone) {
      ScaffoldMessenger.of(context).showSnackBar(
        // LANGUAGE-AUDIT (2026-08-16) T-66: hardcoded
        // English SnackBar. Localised via
        // `txtguarantorPhoneCannotBeTheSameAsYourPhone`.
        SnackBar(
          content: Text(AppLocalizations.of(context)!
              .txtguarantorPhoneCannotBeTheSameAsYourPhone),
          backgroundColor: AppColors.error,
        ),
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
        ScaffoldMessenger.of(context).showSnackBar(
          // LANGUAGE-AUDIT (2026-08-16) T-66: hardcoded
          // English SnackBar. Localised via
          // `txtotpSentToGuarantorPhone`.
          SnackBar(
            content:
                Text(AppLocalizations.of(context)!.txtotpSentToGuarantorPhone),
            backgroundColor: AppColors.success,
          ),
        );
        // Dev-mode only: never autofill an echoed OTP in production
        // builds even if the server leaks it (audit #7 P0-5).
        if (kDebugMode) {
          final devOtp = result['data']?['otp']?.toString();
          if (devOtp != null && devOtp.length == 6) {
            _gOtpController.text = devOtp;
          }
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSendingGOtp = false);
        ScaffoldMessenger.of(context).showSnackBar(
          // LANGUAGE-AUDIT (2026-08-16) T-66: hardcoded
          // English SnackBar. Localised via
          // `txtfailedToSendOtp`.
          SnackBar(
            content: Text(AppLocalizations.of(context)!.txtfailedToSendOtp),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _verifyGuarantorOtp() async {
    if (_gOtpController.text.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        // LANGUAGE-AUDIT (2026-08-16) T-66: hardcoded
        // English SnackBar. Localised via the new
        // `txtenterThe6DigitOtp` ARB key.
        SnackBar(
          content: Text(AppLocalizations.of(context)!.txtenterThe6DigitOtp),
          backgroundColor: AppColors.error,
        ),
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
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                  response['data']?['message']?.toString() ?? 'Invalid OTP'),
              backgroundColor: AppColors.error,
            ),
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
        ScaffoldMessenger.of(context).showSnackBar(
          // LANGUAGE-AUDIT (2026-08-16) T-66: hardcoded
          // English SnackBar. Localised via
          // `txtguarantorPhoneVerified`.
          SnackBar(
            content:
                Text(AppLocalizations.of(context)!.txtguarantorPhoneVerified),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isVerifyingGOtp = false);
        ScaffoldMessenger.of(context).showSnackBar(
          // LANGUAGE-AUDIT (2026-08-16) T-66: hardcoded
          // English SnackBar. Localised via `txtinvalidOtp`.
          SnackBar(
            content: Text(AppLocalizations.of(context)!.txtinvalidOtp),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _saveProfile() async {
    final provider = ref.read(riderProvider.notifier);
    final rider = ref.watch(riderProvider).rider;
    if (rider == null || rider.riderId.isEmpty) return;

    if (_gPhoneController.text.trim().isNotEmpty && !_isGPhoneVerified) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Please verify the new guarantor phone number before saving.'),
          backgroundColor: AppColors.error,
        ),
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
          'fullName': _nameController.text,
          'email': _emailController.text,
          'fatherName': _fatherNameController.text,
          'motherName': _motherNameController.text,
          'dob': _dobController.text.isNotEmpty ? _dobController.text : null,
          'currentAddress': _addressController.text,
          'emergencyContact': _emergencyContactController.text,
          'guarantorName': _gNameController.text,
          'guarantorPhone': _gPhoneController.text,
          'guarantorAddress': _gAddressController.text,
          if (uploadedPhotoUrl != null) 'profilePhoto': uploadedPhotoUrl,
          if (uploadedPhotoUrl != null) 'riderPhoto': uploadedPhotoUrl,
        },
      );

      await provider.refreshFromApi();

      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          // LANGUAGE-AUDIT (2026-08-16) T-66: hardcoded
          // English SnackBar. Localised via
          // `txtprofileUpdatedSuccessfully`.
          SnackBar(
            content: Text(
                AppLocalizations.of(context)!.txtprofileUpdatedSuccessfully),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        final rawMsg =
            e.toString().replaceAll(RegExp(r'^(Exception:\s*|Error:\s*)'), '');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              rawMsg.isNotEmpty && !rawMsg.contains('XMLHttpRequest')
                  ? rawMsg
                  : 'Failed to update profile. Please try again.',
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
      body: Stack(
        children: [
          _buildMeshBackground(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(context),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 16,
                    ),
                    child: Column(
                      children: [
                        FadeUpWidget(delay: 0, child: _buildAvatarSection()),
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
                                  final parsed = (_dobController.text.isNotEmpty
                                          ? DateTime.tryParse(
                                              _dobController.text)
                                          : null) ??
                                      DateTime(2000, 1, 1);
                                  final initialDate = parsed.isBefore(firstDate)
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
                              ),
                              Padding(
                                padding: const EdgeInsets.only(left: 4, top: 4),
                                child: Text(
                                  // PR-48 (PROFILE Pass3 #3): the audit
                                  // flagged this as misleading copy. The
                                  // emergency contact is part of the
                                  // standard profile update — it's saved
                                  // immediately via the same PUT as the
                                  // rest of the form (no separate admin
                                  // review). The hint now reflects the
                                  // actual behavior: "used to contact you
                                  // in case of an emergency" so riders
                                  // know what to put here.
                                  'Used to contact you in case of an emergency.',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 12,
                                    color:
                                        AppColors.of(context).onSurfaceVariant,
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
                        SizedBox(height: 32),
                        FadeUpWidget(
                          delay: 600,
                          child: ElevatedButton(
                            key: const Key('submitProfileButton'),
                            onPressed: _isSaving ? null : _saveProfile,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(double.infinity, 56),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(
                                    AppRadius.radiusModal),
                              ),
                              elevation: 8,
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
        ],
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

  Widget _buildHeader(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          InkWell(
            onTap: () => Navigator.maybePop(context),
            child: Container(
              padding: const EdgeInsets.all(Spacing.md2),
              decoration: BoxDecoration(
                color: colors.card,
                shape: BoxShape.circle,
                border: Border.all(
                  color: colors.outlineVariant.withValues(alpha: 0.5),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                  ),
                ],
              ),
              child: Icon(
                Icons.arrow_back,
                size: 18,
                color: colors.onSurface,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Text(
            'Edit Profile',
            style: AppTypography.headingSmall.copyWith(color: colors.onSurface),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarSection() {
    final colors = AppColors.of(context);
    final rider = ref.watch(riderProvider).rider;
    String? getAvatarUrl() {
      if (rider?.profilePhoto == null || rider!.profilePhoto!.isEmpty) {
        return null;
      }
      if (rider.profilePhoto!.startsWith('http')) return rider.profilePhoto;
      final baseUrl = ApiClient().baseUrl;
      return '$baseUrl/api/files/${rider.profilePhoto!.replaceFirst(RegExp(r'^/+'), '')}';
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
                  onPressed: _isSendingGOtp ? null : _sendGuarantorOtp,
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
                          _isGOtpSent ? 'Resend' : 'Send OTP',
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
