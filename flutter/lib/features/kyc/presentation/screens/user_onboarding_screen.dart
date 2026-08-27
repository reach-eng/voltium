import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:universal_io/io.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/services/document_local_cache.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/features/kyc/presentation/widgets/user_onboarding_widgets.dart';
import 'package:voltium_rider/features/pickup/widgets/pickup_hub_widgets.dart';
import 'package:voltium_rider/features/kyc/data/kyc_repository.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/signature_pad_screen.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/utils/form_validators.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/file_category.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import '../../../../utils/app_logger.dart';

/// State for UserOnboardingScreen managed via Riverpod Notifier.
class UserOnboardingState {
  final int currentStep;
  final bool isUploading;
  final String uploadProgressText;

  final bool aadhaarFrontUploaded;
  final String? aadhaarFrontPath;
  final bool aadhaarBackUploaded;
  final String? aadhaarBackPath;
  final bool panUploaded;
  final String? panPath;
  final bool selfieUploaded;
  final String? selfiePath;
  final bool signatureUploaded;
  final String? signaturePath;

  const UserOnboardingState({
    this.currentStep = 1,
    this.isUploading = false,
    this.uploadProgressText = '',
    this.aadhaarFrontUploaded = false,
    this.aadhaarFrontPath,
    this.aadhaarBackUploaded = false,
    this.aadhaarBackPath,
    this.panUploaded = false,
    this.panPath,
    this.selfieUploaded = false,
    this.selfiePath,
    this.signatureUploaded = false,
    this.signaturePath,
  });

  UserOnboardingState copyWith({
    int? currentStep,
    bool? isUploading,
    String? uploadProgressText,
    bool? aadhaarFrontUploaded,
    String? aadhaarFrontPath,
    bool? aadhaarBackUploaded,
    String? aadhaarBackPath,
    bool? panUploaded,
    String? panPath,
    bool? selfieUploaded,
    String? selfiePath,
    bool? signatureUploaded,
    String? signaturePath,
  }) {
    return UserOnboardingState(
      currentStep: currentStep ?? this.currentStep,
      isUploading: isUploading ?? this.isUploading,
      uploadProgressText: uploadProgressText ?? this.uploadProgressText,
      aadhaarFrontUploaded: aadhaarFrontUploaded ?? this.aadhaarFrontUploaded,
      aadhaarFrontPath: aadhaarFrontPath ?? this.aadhaarFrontPath,
      aadhaarBackUploaded: aadhaarBackUploaded ?? this.aadhaarBackUploaded,
      aadhaarBackPath: aadhaarBackPath ?? this.aadhaarBackPath,
      panUploaded: panUploaded ?? this.panUploaded,
      panPath: panPath ?? this.panPath,
      selfieUploaded: selfieUploaded ?? this.selfieUploaded,
      selfiePath: selfiePath ?? this.selfiePath,
      signatureUploaded: signatureUploaded ?? this.signatureUploaded,
      signaturePath: signaturePath ?? this.signaturePath,
    );
  }
}

class UserOnboardingNotifier extends Notifier<UserOnboardingState> {
  @override
  UserOnboardingState build() => const UserOnboardingState();

  void reset() => state = const UserOnboardingState();

  void setStep(int step) =>
      state = state.copyWith(currentStep: step.clamp(1, 3));
  void nextStep() =>
      state = state.copyWith(currentStep: (state.currentStep + 1).clamp(1, 3));
  void prevStep() =>
      state = state.copyWith(currentStep: (state.currentStep - 1).clamp(1, 3));

  void setUploading(bool isUploading, [String progressText = '']) {
    state = state.copyWith(
        isUploading: isUploading, uploadProgressText: progressText);
  }

  void updateDocument(String type, String path) {
    switch (type) {
      case 'aadhaar_front':
        state =
            state.copyWith(aadhaarFrontUploaded: true, aadhaarFrontPath: path);
        break;
      case 'aadhaar_back':
        state =
            state.copyWith(aadhaarBackUploaded: true, aadhaarBackPath: path);
        break;
      case 'pan':
        state = state.copyWith(panUploaded: true, panPath: path);
        break;
      case 'selfie':
        state = state.copyWith(selfieUploaded: true, selfiePath: path);
        break;
      case 'signature':
        state = state.copyWith(signatureUploaded: true, signaturePath: path);
        break;
    }
  }

  void populateFromCache(Map<String, dynamic> cacheData) {
    final afPath = cacheData['aadhaarFrontPath'] as String?;
    final abPath = cacheData['aadhaarBackPath'] as String?;
    final panP = cacheData['panPath'] as String?;
    final selfieP = cacheData['selfiePath'] as String?;
    final sigP = cacheData['signaturePath'] as String?;

    state = state.copyWith(
      aadhaarFrontPath: afPath,
      aadhaarFrontUploaded: afPath != null && afPath.isNotEmpty,
      aadhaarBackPath: abPath,
      aadhaarBackUploaded: abPath != null && abPath.isNotEmpty,
      panPath: panP,
      panUploaded: panP != null && panP.isNotEmpty,
      selfiePath: selfieP,
      selfieUploaded: selfieP != null && selfieP.isNotEmpty,
      signaturePath: sigP,
      signatureUploaded: sigP != null && sigP.isNotEmpty,
    );
  }
}

final userOnboardingNotifierProvider =
    NotifierProvider<UserOnboardingNotifier, UserOnboardingState>(
  UserOnboardingNotifier.new,
);

class UserOnboardingScreen extends ConsumerStatefulWidget {
  final VoidCallback? onNext;
  final VoidCallback? onBack;

  const UserOnboardingScreen({super.key, this.onNext, this.onBack});

  @override
  ConsumerState<UserOnboardingScreen> createState() =>
      _UserOnboardingScreenState();
}

class _UserOnboardingScreenState extends ConsumerState<UserOnboardingScreen> {
  final ImageCompressionService _compressionService = ImageCompressionService();
  KycRepository? _kycRepository;
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _addressController = TextEditingController();
  final _dobController = TextEditingController();
  final _fatherNameController = TextEditingController();
  final _motherNameController = TextEditingController();
  final _bankNameController = TextEditingController();
  final _bankAccountController = TextEditingController();
  final _bankIfscController = TextEditingController();

  void _onFieldChanged() {
    _saveCache();
    if (mounted) setState(() {});
  }

  void _saveCache() {
    final riderId = ref.read(riderProvider).riderId;
    if (riderId == null) return;
    final state = ref.read(userOnboardingNotifierProvider);
    final cacheData = {
      'name': _nameController.text,
      'email': _emailController.text,
      'address': _addressController.text,
      'dob': _dobController.text,
      'fatherName': _fatherNameController.text,
      'motherName': _motherNameController.text,
      'bankName': _bankNameController.text,
      'bankAccount': _bankAccountController.text,
      'bankIfsc': _bankIfscController.text,
      'aadhaarFrontPath': state.aadhaarFrontPath,
      'aadhaarBackPath': state.aadhaarBackPath,
      'panPath': state.panPath,
      'selfiePath': state.selfiePath,
      'signaturePath': state.signaturePath,
    };
    KycRepository.saveFormCache(riderId: riderId, data: cacheData);
  }

  void _loadCache() {
    final riderId = ref.read(riderProvider).riderId;
    if (riderId == null) return;
    KycRepository.loadFormCache(riderId: riderId).then((cacheData) {
      if (cacheData == null) return;
      _nameController.text = cacheData['name'] ?? '';
      _emailController.text = cacheData['email'] ?? '';
      _addressController.text = cacheData['address'] ?? '';
      _dobController.text = cacheData['dob'] ?? '';
      _fatherNameController.text = cacheData['fatherName'] ?? '';
      _motherNameController.text = cacheData['motherName'] ?? '';
      _bankNameController.text = cacheData['bankName'] ?? '';
      _bankAccountController.text = cacheData['bankAccount'] ?? '';
      _bankIfscController.text = cacheData['bankIfsc'] ?? '';

      ref
          .read(userOnboardingNotifierProvider.notifier)
          .populateFromCache(cacheData);
    });
  }

  @override
  void initState() {
    super.initState();
    _loadCache();

    _nameController.addListener(_onFieldChanged);
    _emailController.addListener(_onFieldChanged);
    _addressController.addListener(_onFieldChanged);
    _dobController.addListener(_onFieldChanged);
    _fatherNameController.addListener(_onFieldChanged);
    _motherNameController.addListener(_onFieldChanged);
    _bankNameController.addListener(_onFieldChanged);
    _bankAccountController.addListener(_onFieldChanged);
    _bankIfscController.addListener(_onFieldChanged);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (kDebugMode && AppConstants.isTestMode) {
        if (_dobController.text.isEmpty) _dobController.text = '2000-01-01';
        if (_nameController.text.isEmpty) _nameController.text = 'Test Rider';
        if (_emailController.text.isEmpty) {
          _emailController.text = 'test@example.com';
        }
        if (_fatherNameController.text.isEmpty) {
          _fatherNameController.text = 'Father Name';
        }
        if (_motherNameController.text.isEmpty) {
          _motherNameController.text = 'Mother Name';
        }
        if (_addressController.text.isEmpty) {
          _addressController.text = '123 Test Street';
        }
        if (_bankNameController.text.isEmpty) {
          _bankNameController.text = 'Test Bank';
        }
        if (_bankAccountController.text.isEmpty) {
          _bankAccountController.text = '1234567890';
        }
        if (_bankIfscController.text.isEmpty) {
          _bankIfscController.text = 'TEST0001234';
        }
      }
      final rider = ref.read(riderProvider).rider;
      if (rider != null) {
        if (_nameController.text.isEmpty) {
          _nameController.text = rider.name;
        }
        if (_emailController.text.isEmpty) {
          _emailController.text = rider.email ?? '';
        }
      }
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _nameController.removeListener(_onFieldChanged);
    _emailController.removeListener(_onFieldChanged);
    _addressController.removeListener(_onFieldChanged);
    _dobController.removeListener(_onFieldChanged);
    _fatherNameController.removeListener(_onFieldChanged);
    _motherNameController.removeListener(_onFieldChanged);
    _bankNameController.removeListener(_onFieldChanged);
    _bankAccountController.removeListener(_onFieldChanged);
    _bankIfscController.removeListener(_onFieldChanged);

    _nameController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    _dobController.dispose();
    _fatherNameController.dispose();
    _motherNameController.dispose();
    _bankNameController.dispose();
    _bankAccountController.dispose();
    _bankIfscController.dispose();
    super.dispose();
  }

  Future<void> _selectDob() async {
    final now = DateTime.now();
    DateTime initialDate =
        DateTime(now.year - 25, now.month, now.day).isAfter(now)
            ? DateTime(now.year - 25, 1, 1)
            : DateTime(now.year - 25, now.month, now.day);
    if (_dobController.text.trim().isNotEmpty) {
      final parsed = DateTime.tryParse(_dobController.text.trim());
      if (parsed != null &&
          parsed.isAfter(DateTime(1940)) &&
          parsed.isBefore(now)) {
        initialDate = parsed;
      }
    }
    final date = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(1940),
      lastDate: now,
    );
    if (date != null && mounted) {
      _dobController.text =
          '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    }
  }

  Future<void> _pickDocument(String type, bool useCamera) async {
    try {
      final source = useCamera ? ImageSource.camera : ImageSource.gallery;
      final compressedFile = await _compressionService.pickAndCompress(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 80,
      );

      if (compressedFile != null && mounted) {
        ref
            .read(userOnboardingNotifierProvider.notifier)
            .updateDocument(type, compressedFile.path);
        _saveCache();
      }
    } catch (e) {
      if (mounted) _showError('Failed to capture document. Please try again.');
    }
  }

  void _showDocumentSourceDialog(String type) {
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    showModalBottomSheet(
      context: context,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return SafeArea(
          child: Wrap(
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt, color: AppColors.primary),
                title: Text(
                  l10n?.txttakeAPhoto ?? 'Take a Photo',
                  style: AppTypography.bodyMedium
                      .copyWith(color: colors.onSurface),
                ),
                onTap: () {
                  Navigator.pop(context);
                  _pickDocument(type, true);
                },
              ),
              ListTile(
                leading:
                    const Icon(Icons.photo_library, color: AppColors.primary),
                title: Text(
                  l10n?.txtchooseFromGallery ?? 'Choose from Gallery',
                  style: AppTypography.bodyMedium
                      .copyWith(color: colors.onSurface),
                ),
                onTap: () {
                  Navigator.pop(context);
                  _pickDocument(type, false);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _openSignaturePad() async {
    final result = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const SignaturePadScreen()),
    );
    if (result != null && mounted) {
      ref
          .read(userOnboardingNotifierProvider.notifier)
          .updateDocument('signature', result);
      _saveCache();
    }
  }

  bool get _isFormComplete {
    final state = ref.read(userOnboardingNotifierProvider);
    return _nameController.text.trim().isNotEmpty &&
        _dobController.text.trim().isNotEmpty &&
        FormValidators.email(_emailController.text.trim()) == null &&
        _fatherNameController.text.trim().isNotEmpty &&
        _motherNameController.text.trim().isNotEmpty &&
        _addressController.text.trim().isNotEmpty &&
        state.aadhaarFrontUploaded &&
        state.aadhaarBackUploaded &&
        state.panUploaded &&
        state.selfieUploaded &&
        state.signatureUploaded &&
        _bankNameController.text.trim().isNotEmpty &&
        FormValidators.bankAccount(_bankAccountController.text) == null &&
        FormValidators.ifsc(_bankIfscController.text) == null;
  }

  void _showBankDetailsDialog() {
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    final formKey = GlobalKey<FormState>();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        ),
        title: Text(
          l10n?.txtbankDetails ?? 'Bank Details',
          style: AppTypography.titleSmall.copyWith(color: colors.onSurface),
        ),
        content: SingleChildScrollView(
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: _bankNameController,
                  style: AppTypography.bodyMedium
                      .copyWith(color: colors.onSurface),
                  decoration: InputDecoration(
                    labelText: l10n?.txtbankName ?? 'Bank Name',
                    labelStyle: GoogleFonts.plusJakartaSans(
                        color: colors.onSurfaceMuted),
                    hintStyle: GoogleFonts.plusJakartaSans(
                      color: colors.onSurfaceMuted.withValues(alpha: 0.7),
                    ),
                    filled: true,
                    fillColor: colors.iconBackground,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide:
                          const BorderSide(color: AppColors.primary, width: 2),
                    ),
                  ),
                  textCapitalization: TextCapitalization.words,
                  validator: (v) => FormValidators.required(v, 'Bank name'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _bankAccountController,
                  style: AppTypography.bodyMedium
                      .copyWith(color: colors.onSurface),
                  decoration: InputDecoration(
                    labelText: l10n?.txtaccountNumber ?? 'Account Number',
                    labelStyle: GoogleFonts.plusJakartaSans(
                        color: colors.onSurfaceMuted),
                    hintStyle: GoogleFonts.plusJakartaSans(
                      color: colors.onSurfaceMuted.withValues(alpha: 0.7),
                    ),
                    filled: true,
                    fillColor: colors.iconBackground,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide:
                          const BorderSide(color: AppColors.primary, width: 2),
                    ),
                  ),
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  validator: FormValidators.bankAccount,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _bankIfscController,
                  style: AppTypography.bodyMedium
                      .copyWith(color: colors.onSurface),
                  decoration: InputDecoration(
                    labelText: l10n?.txtifscCode ?? 'IFSC Code',
                    labelStyle: GoogleFonts.plusJakartaSans(
                        color: colors.onSurfaceMuted),
                    hintStyle: GoogleFonts.plusJakartaSans(
                      color: colors.onSurfaceMuted.withValues(alpha: 0.7),
                    ),
                    filled: true,
                    fillColor: colors.iconBackground,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide: BorderSide.none,
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      borderSide:
                          const BorderSide(color: AppColors.primary, width: 2),
                    ),
                  ),
                  textCapitalization: TextCapitalization.characters,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9]')),
                  ],
                  validator: FormValidators.ifsc,
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              l10n?.txtclose ?? 'Close',
              style: AppTypography.labelLarge
                  .copyWith(color: colors.onSurfaceVariant),
            ),
          ),
          TextButton(
            onPressed: () {
              if (formKey.currentState?.validate() ?? false) {
                Navigator.pop(ctx);
                _bankIfscController.text =
                    _bankIfscController.text.trim().toUpperCase();
                _saveCache();
                if (mounted) setState(() {});
              }
            },
            child: Text(
              l10n?.txtsave ?? 'Save',
              style: AppTypography.labelLarge.copyWith(
                color: AppColors.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showError(String msg) {
    if (!mounted) return;
    Toast.error(context, msg);
  }

  Future<void> _handleNext() async {
    final state = ref.read(userOnboardingNotifierProvider);
    if (state.isUploading) return;
    final isTestMode = AppConstants.isTestMode;
    if (!isTestMode && !_isFormComplete) {
      final missing = <String>[];
      if (_nameController.text.trim().isEmpty) missing.add('Name');
      if (_dobController.text.trim().isEmpty) missing.add('DOB');
      if (FormValidators.email(_emailController.text.trim()) != null) {
        missing.add('Valid Email');
      }
      if (_fatherNameController.text.trim().isEmpty) {
        missing.add('Father\'s Name');
      }
      if (_motherNameController.text.trim().isEmpty) {
        missing.add('Mother\'s Name');
      }
      if (_addressController.text.trim().isEmpty) missing.add('Address');
      if (!state.aadhaarFrontUploaded) missing.add('Aadhaar Front');
      if (!state.aadhaarBackUploaded) missing.add('Aadhaar Back');
      if (!state.panUploaded) missing.add('PAN');
      if (!state.selfieUploaded) missing.add('Selfie');
      if (!state.signatureUploaded) missing.add('Signature');
      if (_bankNameController.text.trim().isEmpty ||
          FormValidators.bankAccount(_bankAccountController.text) != null ||
          FormValidators.ifsc(_bankIfscController.text) != null) {
        missing.add('Bank Details');
      }

      _showError('Please complete: ${missing.join(', ')}');
      return;
    }

    final riderId = ref.read(riderProvider).riderId;
    if (riderId == null) {
      _showError('Session invalid. Please login again.');
      return;
    }

    final client = ApiClient();
    final voltiumClient = VoltiumApiClient(client);
    _kycRepository ??= KycRepository(
      voltiumClient,
      FilesRepository(client, voltiumClient),
    );

    ref.read(userOnboardingNotifierProvider.notifier).setUploading(true);

    try {
      String aadhaarFrontUrl = '';
      String aadhaarBackUrl = '';
      String panUrl = '';
      String selfieUrl = '';
      String signatureUrl = '';

      if (isTestMode) {
        aadhaarFrontUrl = 'mock_url_front.png';
        aadhaarBackUrl = 'mock_url_back.png';
        panUrl = 'mock_url_pan.png';
        selfieUrl = 'mock_url_selfie.png';
        signatureUrl = 'mock_url_signature.png';
      } else {
        final Map<String, dynamic> tasks = {};
        if (state.aadhaarFrontPath != null) {
          tasks['Aadhaar Front'] = () => _kycRepository!.uploadDocument(
              File(state.aadhaarFrontPath!), FileCategory.kycDocument);
        }
        if (state.aadhaarBackPath != null) {
          tasks['Aadhaar Back'] = () => _kycRepository!.uploadDocument(
              File(state.aadhaarBackPath!), FileCategory.kycDocument);
        }
        if (state.panPath != null) {
          tasks['PAN'] = () => _kycRepository!
              .uploadDocument(File(state.panPath!), FileCategory.kycDocument);
        }
        if (state.selfiePath != null) {
          tasks['Selfie'] = () => _kycRepository!.uploadDocument(
              File(state.selfiePath!), FileCategory.profilePhoto);
        }
        if (state.signaturePath != null) {
          tasks['Signature'] = () => _kycRepository!.uploadDocument(
              File(state.signaturePath!), FileCategory.kycDocument);
        }

        int completed = 0;
        final results = <String, String>{};

        final uploadTasks = tasks.entries.map((entry) async {
          try {
            final url = await entry.value();
            completed++;
            ref.read(userOnboardingNotifierProvider.notifier).setUploading(
                  true,
                  'Uploaded $completed of ${tasks.length}',
                );
            return MapEntry(entry.key, url);
          } catch (e) {
            throw Exception(
                'Failed to upload ${entry.key}: ${_formatKycError(e)}');
          }
        });
        final pairs = await Future.wait(uploadTasks);
        for (final p in pairs) {
          results[p.key] = p.value;
        }

        aadhaarFrontUrl = results['Aadhaar Front'] ?? '';
        aadhaarBackUrl = results['Aadhaar Back'] ?? '';
        panUrl = results['PAN'] ?? '';
        selfieUrl = results['Selfie'] ?? '';
        signatureUrl = results['Signature'] ?? '';

        // Cache documents locally so they can be viewed offline.
        if (state.aadhaarFrontPath != null) {
          DocumentLocalCache.save('aadhaarFront', state.aadhaarFrontPath!);
        }
        if (state.aadhaarBackPath != null) {
          DocumentLocalCache.save('aadhaarBack', state.aadhaarBackPath!);
        }
        if (state.panPath != null) {
          DocumentLocalCache.save('panCard', state.panPath!);
        }
        if (state.signaturePath != null) {
          DocumentLocalCache.save('signature', state.signaturePath!);
        }
      }

      ref
          .read(userOnboardingNotifierProvider.notifier)
          .setUploading(true, 'Saving profile...');

      try {
        await _kycRepository!.updateProfile(
          riderId: riderId,
          name: _nameController.text.trim(),
          email: _emailController.text.trim(),
          address: _addressController.text.trim(),
          dob: _dobController.text.trim(),
          fatherName: _fatherNameController.text.trim(),
          motherName: _motherNameController.text.trim(),
          bankName: _bankNameController.text.trim(),
          accountNumber: _bankAccountController.text.trim(),
          ifscCode: _bankIfscController.text.trim().toUpperCase(),
          aadhaarFrontUrl: aadhaarFrontUrl,
          aadhaarBackUrl: aadhaarBackUrl,
          panUrl: panUrl,
          selfieUrl: selfieUrl,
          signatureUrl: signatureUrl,
        );
        await KycRepository.clearFormCache(riderId: riderId);

        // F4 fix: Clean up local temporary document files from disk on success
        final tempPaths = [
          state.aadhaarFrontPath,
          state.aadhaarBackPath,
          state.panPath,
          state.selfiePath,
          state.signaturePath,
        ];
        for (final p in tempPaths) {
          if (p != null && p.isNotEmpty) {
            try {
              final f = File(p);
              if (f.existsSync()) {
                f.deleteSync();
              }
            } catch (_) {}
          }
        }
      } catch (e) {
        if (!mounted) return;
        _showError(_formatKycError(e));
        return;
      }

      try {
        await ref.read(riderProvider.notifier).refresh();
      } catch (e) {
        if (!mounted) return;
        appDebug('KYC submit: refresh failed after upload success: $e');
        _showError(
          'Profile saved, but we couldn\'t refresh your session. '
          'Pull to retry, or restart the app.',
        );
        return;
      }

      PostHogService.capture('kyc_submitted', properties: {
        'has_aadhaar': (state.aadhaarFrontUploaded && state.aadhaarBackUploaded)
            .toString(),
        'has_pan': state.panUploaded.toString(),
        'has_selfie': state.selfieUploaded.toString(),
        'has_signature': state.signatureUploaded.toString(),
      });

      if (mounted) {
        widget.onNext?.call();
      }
    } catch (e) {
      if (mounted) {
        _showError(_formatKycError(e));
      }
    } finally {
      ref.read(userOnboardingNotifierProvider.notifier).setUploading(false);
    }
  }

  /// F14: Typed ApiException error handling
  String _formatKycError(Object e) {
    appDebug('KYC submit error: $e');
    if (e is ApiException) {
      switch (e.statusCode) {
        case 422:
          return e.message.isNotEmpty
              ? e.message
              : 'Please check your documents and try uploading again.';
        case 401:
          return 'Session expired. Please log in again.';
        case 403:
          return 'Access denied. Please check your verification status.';
        case 408:
        case 504:
          return 'Upload timed out. Please check your connection and retry.';
        case 500:
        case 502:
        case 503:
          return 'Server temporarily unavailable. Please try again later.';
        default:
          return e.message.isNotEmpty
              ? e.message
              : 'Something went wrong. Please try again.';
      }
    }
    final msg = e.toString().toLowerCase();
    if (msg.contains('network') ||
        msg.contains('timeout') ||
        msg.contains('socketexception') ||
        msg.contains('connection')) {
      return 'No internet connection. Please check and retry.';
    }
    return 'Something went wrong. Please try again.';
  }

  int _completedFieldCount() {
    int count = 0;
    if (_nameController.text.trim().isNotEmpty) count++;
    if (_fatherNameController.text.trim().isNotEmpty) count++;
    if (_motherNameController.text.trim().isNotEmpty) count++;
    if (_dobController.text.trim().isNotEmpty) count++;
    if (_emailController.text.trim().isNotEmpty &&
        FormValidators.email(_emailController.text.trim()) == null) {
      count++;
    }
    // Phone number is pre-filled from rider profile (always complete)
    count++;
    if (_addressController.text.trim().isNotEmpty) count++;
    return count;
  }

  Widget _buildFieldCountChip(int completed, int total) {
    final colors = AppColors.of(context);
    final isDone = completed == total;
    return Container(
      key: const Key('fieldCountChip'),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isDone ? AppColors.successLight : colors.iconBackground,
        borderRadius: BorderRadius.circular(AppRadius.full),
        border: Border.all(
          color: isDone ? AppColors.success : colors.outlineVariant,
          width: 1,
        ),
      ),
      child: Text(
        '$completed/$total',
        style: AppTypography.labelSmall.copyWith(
          color: isDone ? AppColors.successDark : colors.onSurfaceVariant,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _buildStepIndicator() {
    final currentStep = ref.watch(
      userOnboardingNotifierProvider.select((s) => s.currentStep),
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 20, top: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildDot(1, currentStep),
          _buildLine(),
          _buildDot(2, currentStep),
          _buildLine(),
          _buildDot(3, currentStep),
          if (currentStep == 1) ...[
            const SizedBox(width: 12),
            _buildFieldCountChip(_completedFieldCount(), 7),
          ],
        ],
      ),
    );
  }

  Widget _buildDot(int step, int currentStep) {
    final isActive = currentStep >= step;
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color:
            isActive ? AppColors.primary : AppColors.of(context).surfaceSubtle,
        border: isActive
            ? null
            : Border.all(color: AppColors.of(context).borderSubtle),
      ),
      alignment: Alignment.center,
      child: Text(
        '$step',
        style: AppTypography.bodySmall.copyWith(
          fontWeight: FontWeight.w600,
          color:
              isActive ? Colors.white : AppColors.of(context).onSurfaceVariant,
        ),
      ),
    );
  }

  Widget _buildLine() {
    return Container(
      width: 40,
      height: 2,
      color: AppColors.of(context).borderSubtle,
    );
  }

  void _onBottomButtonPressed() {
    final currentStep = ref.read(userOnboardingNotifierProvider).currentStep;
    if (currentStep < 3) {
      ref.read(userOnboardingNotifierProvider.notifier).nextStep();
    } else {
      _handleNext();
    }
  }

  bool get _canProceedCurrentStep {
    if (AppConstants.isTestMode) return true;
    final state = ref.read(userOnboardingNotifierProvider);
    switch (state.currentStep) {
      case 1:
        return _nameController.text.trim().isNotEmpty &&
            _dobController.text.trim().isNotEmpty &&
            _fatherNameController.text.trim().isNotEmpty &&
            _motherNameController.text.trim().isNotEmpty &&
            _addressController.text.trim().isNotEmpty &&
            FormValidators.email(_emailController.text.trim()) == null;
      case 2:
        return state.aadhaarFrontUploaded &&
            state.aadhaarBackUploaded &&
            state.panUploaded &&
            _bankNameController.text.trim().isNotEmpty &&
            FormValidators.bankAccount(_bankAccountController.text) == null &&
            FormValidators.ifsc(_bankIfscController.text) == null;
      case 3:
        return state.selfieUploaded && state.signatureUploaded;
      default:
        return false;
    }
  }

  bool _isFieldEditable(String fieldName) {
    final rider = ref.read(riderProvider).rider;
    if (rider?.kycStatus != KycStatus.rejected ||
        rider?.kycEditableFields == null ||
        rider!.kycEditableFields!.isEmpty) {
      return true;
    }
    return rider.kycEditableFields!.contains(fieldName);
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final onboardingState = ref.watch(userOnboardingNotifierProvider);
    final isOnline = ref.watch(connectivityProvider.select((p) => p.isOnline));

    // Compute inline bank summary for tile (F8)
    String? bankSummary;
    final bankName = _bankNameController.text.trim();
    final bankAcc = _bankAccountController.text.trim();
    if (bankName.isNotEmpty && bankAcc.length >= 4) {
      final last4 = bankAcc.substring(bankAcc.length - 4);
      bankSummary = '✓ $bankName •••• $last4';
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        HapticFeedback.lightImpact(); // F15 haptic feedback
        if (onboardingState.currentStep > 1) {
          ref.read(userOnboardingNotifierProvider.notifier).prevStep();
        } else {
          widget.onBack?.call();
        }
      },
      child: Scaffold(
        backgroundColor: colors.surface,
        body: Column(
          children: [
            if (!isOnline)
              Container(
                width: double.infinity,
                color: AppColors.warning.withValues(alpha: 0.15),
                padding:
                    const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                child: Row(
                  children: [
                    const Icon(Icons.cloud_off,
                        size: 16, color: AppColors.warning),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        l10n?.txtofflineDraftBanner ??
                            "You're offline — your draft is saved locally. Connect to internet to submit.",
                        style: AppTypography.bodySmall.copyWith(
                          color: colors.onSurface,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    buildCurtainHeader(
                      context: context,
                      title: l10n?.txtriderProfile ?? 'Rider Profile',
                      subtitle: l10n?.txtcompleteDetailsSubtitle ??
                          'Complete your details to finish onboarding',
                      onBack: () {
                        HapticFeedback.lightImpact();
                        if (onboardingState.currentStep > 1) {
                          ref
                              .read(userOnboardingNotifierProvider.notifier)
                              .prevStep();
                        } else {
                          widget.onBack?.call();
                        }
                      },
                    ),
                    Transform.translate(
                      offset: const Offset(0, -32),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          children: [
                            _buildStepIndicator(),
                            if (onboardingState.currentStep == 1)
                              PersonalDetailsCard(
                                nameController: _nameController,
                                nameEnabled: _isFieldEditable('fullName'),
                                dobController: _dobController,
                                dobEnabled: _isFieldEditable('dob'),
                                emailController: _emailController,
                                emailEnabled: _isFieldEditable('email'),
                                fatherNameController: _fatherNameController,
                                fatherNameEnabled:
                                    _isFieldEditable('fatherName'),
                                motherNameController: _motherNameController,
                                motherNameEnabled:
                                    _isFieldEditable('motherName'),
                                addressController: _addressController,
                                addressEnabled:
                                    _isFieldEditable('currentAddress'),
                                phone:
                                    ref.read(riderProvider).rider?.phone ?? '',
                                onSelectDob: _selectDob,
                              ),
                            if (onboardingState.currentStep == 2)
                              IdentityVerificationCard(
                                aadhaarFrontUploaded:
                                    onboardingState.aadhaarFrontUploaded,
                                aadhaarFrontPath:
                                    onboardingState.aadhaarFrontPath,
                                aadhaarFrontEnabled:
                                    _isFieldEditable('aadhaarFront'),
                                aadhaarBackUploaded:
                                    onboardingState.aadhaarBackUploaded,
                                aadhaarBackPath:
                                    onboardingState.aadhaarBackPath,
                                aadhaarBackEnabled:
                                    _isFieldEditable('aadhaarBack'),
                                panUploaded: onboardingState.panUploaded,
                                panPath: onboardingState.panPath,
                                panEnabled: _isFieldEditable('panCard'),
                                bankDetailsDone: _bankNameController.text
                                        .trim()
                                        .isNotEmpty &&
                                    FormValidators.bankAccount(
                                            _bankAccountController.text) ==
                                        null &&
                                    FormValidators.ifsc(
                                            _bankIfscController.text) ==
                                        null,
                                bankSummary: bankSummary,
                                bankEnabled:
                                    _isFieldEditable('accountNumber') ||
                                        _isFieldEditable('bankName') ||
                                        _isFieldEditable('ifscCode'),
                                onPickAadhaarFront: () =>
                                    _showDocumentSourceDialog('aadhaar_front'),
                                onPickAadhaarBack: () =>
                                    _showDocumentSourceDialog('aadhaar_back'),
                                onPickPan: () =>
                                    _showDocumentSourceDialog('pan'),
                                onShowBankDialog: () =>
                                    _showBankDetailsDialog(),
                              ),
                            if (onboardingState.currentStep == 3) ...[
                              SelfieCard(
                                selfieUploaded: onboardingState.selfieUploaded,
                                selfiePath: onboardingState.selfiePath,
                                enabled: _isFieldEditable('profilePhoto'),
                                onTap: () => _pickDocument('selfie', true),
                              ),
                              const SizedBox(height: 24),
                              SignatureCard(
                                signatureUploaded:
                                    onboardingState.signatureUploaded,
                                enabled: _isFieldEditable('signature'),
                                onTap: _openSignaturePad,
                              ),
                            ],
                            const SizedBox(height: 120),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            UserOnboardingBottomButton(
              canProceed: _canProceedCurrentStep,
              isUploading: onboardingState.isUploading,
              uploadProgressText: onboardingState.uploadProgressText,
              onNext: _onBottomButtonPressed,
            ),
          ],
        ),
      ),
    );
  }
}
