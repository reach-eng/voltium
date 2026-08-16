import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:universal_io/io.dart';
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

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
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

  void setStep(int step) => state = state.copyWith(currentStep: step);
  void nextStep() => state = state.copyWith(currentStep: state.currentStep + 1);
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

  // ONBOARDING-AUDIT 2026-08-14 P1-1: stable reference to the
  // listener attached to every text controller. The previous
  // implementation added an inline closure in `initState` and tried
  // to remove `_saveCache` in `dispose()` — but `_saveCache` was
  // never the listener (it was `onFieldChanged` calling
  // `_saveCache`), so the remove was a no-op and the actual closure
  // (and its closure-captured references) outlived the controller.
  // Storing the function reference here lets us add the same instance
  // we later remove.
  // ignore: prefer_function_declarations_over_variables
  late final VoidCallback _onFieldChanged = () {
    _saveCache();
    if (mounted) setState(() {});
  };

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

    // ONBOARDING-AUDIT 2026-08-14 P1-1: use the stable field
    // reference (see _onFieldChanged) so dispose() can remove the
    // exact same listener instance.
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
      if (AppConstants.isTestMode) {
        if (_dobController.text.isEmpty) _dobController.text = '01-01-2000';
        if (_nameController.text.isEmpty) _nameController.text = 'Test Rider';
        if (_emailController.text.isEmpty)
          _emailController.text = 'test@example.com';
        if (_fatherNameController.text.isEmpty)
          _fatherNameController.text = 'Father Name';
        if (_motherNameController.text.isEmpty)
          _motherNameController.text = 'Mother Name';
        if (_addressController.text.isEmpty)
          _addressController.text = '123 Test Street';
        if (_bankNameController.text.isEmpty)
          _bankNameController.text = 'Test Bank';
        if (_bankAccountController.text.isEmpty)
          _bankAccountController.text = '1234567890';
        if (_bankIfscController.text.isEmpty)
          _bankIfscController.text = 'TEST0001234';
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
    // ONBOARDING-AUDIT 2026-08-14 P1-1: remove the same instance
    // that was added in initState (was `_saveCache` — the wrong
    // reference, see field doc).
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
    final defaultInitial =
        DateTime(now.year - 25, now.month, now.day).isAfter(now)
            ? DateTime(now.year - 25, 1, 1)
            : DateTime(now.year - 25, now.month, now.day);
    final date = await showDatePicker(
      context: context,
      initialDate: defaultInitial,
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
                leading: const Icon(Icons.camera_alt, color: AppColors.primary),
                title: const Text('Take a Photo'),
                onTap: () {
                  Navigator.pop(context);
                  _pickDocument(type, true);
                },
              ),
              ListTile(
                leading:
                    const Icon(Icons.photo_library, color: AppColors.primary),
                title: const Text('Choose from Gallery'),
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
    final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    final emailText = _emailController.text.trim();
    final isEmailValid = emailText.isEmpty || emailRegex.hasMatch(emailText);
    return _nameController.text.trim().isNotEmpty &&
        _dobController.text.trim().isNotEmpty &&
        isEmailValid &&
        _fatherNameController.text.trim().isNotEmpty &&
        _motherNameController.text.trim().isNotEmpty &&
        _addressController.text.trim().isNotEmpty &&
        state.aadhaarFrontUploaded &&
        state.aadhaarBackUploaded &&
        state.panUploaded &&
        state.selfieUploaded &&
        state.signatureUploaded &&
        _bankNameController.text.trim().isNotEmpty &&
        _bankAccountController.text.trim().length >= 6 &&
        _bankIfscController.text.trim().length >= 8;
  }

  void _showBankDetailsDialog() {
    final formKey = GlobalKey<FormState>();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Bank Details'),
        content: SingleChildScrollView(
          child: Form(
            key: formKey,
            // PR-ONBOARDING-2026-08-11 (audit 2.4): the dialog previously
            // accepted any string for bank name, account number, and IFSC.
            // A rider could reach step 3 with an empty IFSC and only learn
            // at the 422 from the server. Now uses the canonical
            // FormValidators.bankAccount + FormValidators.ifsc helpers (used
            // by the guarantor and the post-save review screen) so the
            // dialog rejects bad input at the source.
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: _bankNameController,
                  decoration: const InputDecoration(labelText: 'Bank Name'),
                  textCapitalization: TextCapitalization.words,
                  validator: (v) => FormValidators.required(v, 'Bank name'),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _bankAccountController,
                  decoration:
                      const InputDecoration(labelText: 'Account Number'),
                  keyboardType: TextInputType.number,
                  validator: FormValidators.bankAccount,
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _bankIfscController,
                  decoration: const InputDecoration(labelText: 'IFSC Code'),
                  textCapitalization: TextCapitalization.characters,
                  validator: FormValidators.ifsc,
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
          TextButton(
            onPressed: () {
              if (formKey.currentState?.validate() ?? false) {
                Navigator.pop(ctx);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.error),
    );
  }

  Future<void> _handleNext() async {
    final state = ref.read(userOnboardingNotifierProvider);
    // ONBOARDING-AUDIT 2026-08-14 follow-up: double-tap guard at the
    // top of the handler. The bottom button is gated on
    // `!isUploading && canProceed` and `setUploading(true)` is set
    // below, but a rapid double-tap can land two onPressed callbacks
    // before the framework repaints — that would race two
    // `Future.wait(uploadTasks)` chains and double-POST
    // /api/rider/profile. Bail out before any work begins.
    if (state.isUploading) return;
    final isTestMode = AppConstants.isTestMode;
    if (!isTestMode && !_isFormComplete) {
      final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
      final emailText = _emailController.text.trim();
      final missing = <String>[];
      if (_nameController.text.trim().isEmpty) missing.add('Name');
      if (_dobController.text.trim().isEmpty) missing.add('DOB');
      if (emailText.isNotEmpty && !emailRegex.hasMatch(emailText)) {
        missing.add('Valid Email');
      }
      if (_fatherNameController.text.trim().isEmpty)
        missing.add('Father\'s Name');
      if (_motherNameController.text.trim().isEmpty)
        missing.add('Mother\'s Name');
      if (_addressController.text.trim().isEmpty) missing.add('Address');
      if (!state.aadhaarFrontUploaded) missing.add('Aadhaar Front');
      if (!state.aadhaarBackUploaded) missing.add('Aadhaar Back');
      if (!state.panUploaded) missing.add('PAN');
      if (!state.selfieUploaded) missing.add('Selfie');
      if (!state.signatureUploaded) missing.add('Signature');
      if (_bankNameController.text.trim().isEmpty ||
          _bankAccountController.text.trim().length < 6 ||
          _bankIfscController.text.trim().length < 8)
        missing.add('Bank Details');

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
        if (state.aadhaarFrontPath != null)
          tasks['Aadhaar Front'] = () => _kycRepository!
              .uploadDocument(File(state.aadhaarFrontPath!), 'kyc_document');
        if (state.aadhaarBackPath != null)
          tasks['Aadhaar Back'] = () => _kycRepository!
              .uploadDocument(File(state.aadhaarBackPath!), 'kyc_document');
        if (state.panPath != null)
          tasks['PAN'] = () => _kycRepository!
              .uploadDocument(File(state.panPath!), 'kyc_document');
        if (state.selfiePath != null)
          tasks['Selfie'] = () => _kycRepository!
              .uploadDocument(File(state.selfiePath!), 'profile_photo');
        if (state.signaturePath != null)
          tasks['Signature'] = () => _kycRepository!
              .uploadDocument(File(state.signaturePath!), 'kyc_document');

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
        if (state.aadhaarFrontPath != null)
          DocumentLocalCache.save('aadhaarFront', state.aadhaarFrontPath!);
        if (state.aadhaarBackPath != null)
          DocumentLocalCache.save('aadhaarBack', state.aadhaarBackPath!);
        if (state.panPath != null)
          DocumentLocalCache.save('panCard', state.panPath!);
        if (state.signaturePath != null)
          DocumentLocalCache.save('signature', state.signaturePath!);
      }

      ref
          .read(userOnboardingNotifierProvider.notifier)
          .setUploading(true, 'Saving profile...');

      // ONBOARDING-AUDIT 2026-08-14 P2-8: split the upload and
      // refresh into two distinct steps so the rider gets a
      // specific error message instead of one generic catch-all.
      // The previous version lumped updateProfile + clearFormCache
      // + refresh() into a single try/catch — a refresh failure
      // looked like an upload failure and the rider re-entered the
      // form even though the server already had their data.
      try {
        await _kycRepository!.updateProfile(
          riderId: riderId,
          name: _nameController.text,
          email: _emailController.text,
          address: _addressController.text,
          dob: _dobController.text,
          fatherName: _fatherNameController.text,
          motherName: _motherNameController.text,
          bankName: _bankNameController.text,
          accountNumber: _bankAccountController.text,
          ifscCode: _bankIfscController.text,
          aadhaarFrontUrl: aadhaarFrontUrl,
          aadhaarBackUrl: aadhaarBackUrl,
          panUrl: panUrl,
          selfieUrl: selfieUrl,
          signatureUrl: signatureUrl,
        );
        await KycRepository.clearFormCache(riderId: riderId);
      } catch (e) {
        // Upload step failed — rider must retry; the form data is
        // still local and they can re-submit.
        if (!mounted) return;
        _showError(_formatKycError(e));
        return;
      }

      // Upload succeeded. Refresh the rider provider separately so
      // a refresh failure shows a distinct message and the rider
      // isn't sent back through the form.
      try {
        await ref.read(riderProvider.notifier).refresh();
      } catch (e) {
        if (!mounted) return;
        appDebug('KYC submit: refresh failed after upload success: $e');
        // The profile IS saved; just tell the rider what happened.
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

  /// ONBOARDING-AUDIT 2026-08-14 P2-8: extract the error formatting
  /// so the split upload/refresh handlers can reuse the same
  /// user-friendly mapping (422 → validation, 401 → session
  /// expired, network → offline).
  String _formatKycError(Object e) {
    final msg = e.toString();
    appDebug('KYC submit error: $msg');
    if (msg.contains('422') || msg.contains('VALIDATION')) {
      final match = RegExp(r'"message":"([^"]+)"').firstMatch(msg);
      return match != null
          ? match.group(1)!
          : 'Please check your documents and try uploading again.';
    } else if (msg.contains('401') || msg.contains('unauthorized')) {
      return 'Session expired. Please log in again.';
    } else if (msg.contains('network') || msg.contains('timeout')) {
      return 'No internet connection. Please check and retry.';
    }
    return 'Something went wrong. Please try again.';
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
        style: AppTypography.bodySmall
            .copyWith(fontWeight: FontWeight.w600)
            .copyWith(
                color: isActive ? Colors.white : AppColors.onSurfaceVariant),
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
    final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
    final emailText = _emailController.text.trim();
    final isEmailValid = emailText.isEmpty || emailRegex.hasMatch(emailText);
    switch (state.currentStep) {
      case 1:
        return _nameController.text.trim().isNotEmpty &&
            _dobController.text.trim().isNotEmpty &&
            _fatherNameController.text.trim().isNotEmpty &&
            _motherNameController.text.trim().isNotEmpty &&
            _addressController.text.trim().isNotEmpty &&
            isEmailValid;
      case 2:
        return state.aadhaarFrontUploaded &&
            state.aadhaarBackUploaded &&
            state.panUploaded &&
            // PR-ONBOARDING-2026-08-11 (audit 2.4): step 2 progression now
            // requires bank name + account number + IFSC, not just an
            // account number. A rider can no longer reach step 3 with an
            // empty IFSC and only learn at the 422 from the server.
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
    final onboardingState = ref.watch(userOnboardingNotifierProvider);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
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
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    buildCurtainHeader(
                      context: context,
                      title: 'Rider Profile',
                      subtitle: 'Complete your details to finish onboarding',
                      onBack: () {
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
                                    _bankAccountController.text
                                        .trim()
                                        .isNotEmpty &&
                                    _bankIfscController.text.trim().isNotEmpty,
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
