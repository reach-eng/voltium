import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../services/api_service.dart';
import '../widgets/fade_up_widget.dart';
import 'dart:ui';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late TextEditingController _nameController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  late TextEditingController _fatherNameController;
  late TextEditingController _motherNameController;
  late TextEditingController _dobController;
  late TextEditingController _addressController;

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
      final source = await showDialog<ImageSource>(
        context: context,
        builder: (ctx) => SimpleDialog(
          title: const Text('Select Profile Photo'),
          children: [
            SimpleDialogOption(
              onPressed: () => Navigator.pop(ctx, ImageSource.camera),
              child: const ListTile(
                  leading: Icon(Icons.camera_alt), title: Text('Camera')),
            ),
            SimpleDialogOption(
              onPressed: () => Navigator.pop(ctx, ImageSource.gallery),
              child: const ListTile(
                  leading: Icon(Icons.photo_library), title: Text('Gallery')),
            ),
          ],
        ),
      );
      if (source == null) return;
      final picker = ImagePicker();
      final image = await picker.pickImage(source: source);
      if (image != null && mounted) {
        setState(() => _profileImage = image);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Failed to capture photo'),
              backgroundColor: Color(0xFFEF4444)),
        );
      }
    }
  }

  @override
  void initState() {
    super.initState();
    final rider = context.read<AppProvider>().rider;
    _nameController = TextEditingController(text: rider?.name ?? '');
    _emailController = TextEditingController(text: rider?.email ?? '');
    _phoneController = TextEditingController(text: rider?.phone ?? '');
    _fatherNameController =
        TextEditingController(text: rider?.fatherName ?? '');
    _motherNameController =
        TextEditingController(text: rider?.motherName ?? '');
    final dob = rider?.dob;
    _dobController = TextEditingController(
      text: dob != null
          ? '${dob.year}-${_twoDigits(dob.month)}-${_twoDigits(dob.day)}'
          : '',
    );
    _addressController =
        TextEditingController(text: rider?.currentAddress ?? '');

    _gNameController = TextEditingController(text: rider?.guarantorName ?? '');
    _gPhoneController =
        TextEditingController(text: rider?.guarantorPhone ?? '');
    _gAddressController =
        TextEditingController(text: rider?.guarantorAddress ?? '');
    _gOtpController = TextEditingController();
    _originalGPhone = rider?.guarantorPhone ?? '';
    // If guarantor phone already exists, it's already verified
    _isGPhoneVerified = (rider?.guarantorPhone ?? '').isNotEmpty;
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
        const SnackBar(
            content: Text('Enter a valid 10-digit number'),
            backgroundColor: Color(0xFFEF4444)),
      );
      return;
    }
    final rider = context.read<AppProvider>().rider;
    if (phone == rider?.phone) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Guarantor phone cannot be the same as your phone'),
            backgroundColor: Color(0xFFEF4444)),
      );
      return;
    }
    setState(() => _isSendingGOtp = true);
    try {
      final result = await ApiService().sendOtp(phone: phone);
      if (mounted) {
        setState(() {
          _isSendingGOtp = false;
          _isGOtpSent = true;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('OTP sent to guarantor phone'),
              backgroundColor: Color(0xFF10B981)),
        );
        // In dev mode, auto-fill OTP if returned by the API
        final devOtp = result['data']?['otp']?.toString();
        if (devOtp != null && devOtp.length == 6) {
          _gOtpController.text = devOtp;
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSendingGOtp = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Failed to send OTP'),
              backgroundColor: Color(0xFFEF4444)),
        );
      }
    }
  }

  Future<void> _verifyGuarantorOtp() async {
    if (_gOtpController.text.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Enter the 6-digit OTP'),
            backgroundColor: Color(0xFFEF4444)),
      );
      return;
    }
    final phone = _gPhoneController.text.replaceAll(RegExp(r'\D'), '');
    setState(() => _isVerifyingGOtp = true);
    try {
      await ApiService().verifyOtp(phone: phone, otp: _gOtpController.text);
      if (mounted) {
        setState(() {
          _isVerifyingGOtp = false;
          _isGPhoneVerified = true;
          _isGOtpSent = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Guarantor phone verified'),
              backgroundColor: Color(0xFF10B981)),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isVerifyingGOtp = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Invalid OTP'), backgroundColor: Color(0xFFEF4444)),
        );
      }
    }
  }

  Future<void> _saveProfile() async {
    final provider = context.read<AppProvider>();
    final rider = provider.rider;
    if (rider == null || rider.riderId.isEmpty) return;

    setState(() => _isSaving = true);

    try {
      await ApiService().updateProfile(
        riderId: rider.riderId,
        data: {
          'name': _nameController.text,
          'email': _emailController.text,
          'phone': _phoneController.text,
          'fatherName': _fatherNameController.text,
          'motherName': _motherNameController.text,
          'dob': _dobController.text.isNotEmpty ? _dobController.text : null,
          'currentAddress': _addressController.text,
          'guarantorName': _gNameController.text,
          'guarantorPhone': _gPhoneController.text,
          'guarantorAddress': _gAddressController.text,
        },
      );

      await provider.refreshFromApi();

      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Profile updated successfully'),
              backgroundColor: Color(0xFF10B981)),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content:
                  const Text('Failed to update profile. Please try again.'),
              backgroundColor: Color(0xFFEF4444)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
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
                        horizontal: 24, vertical: 16),
                    child: Column(
                      children: [
                        FadeUpWidget(delay: 0, child: _buildAvatarSection()),
                        const SizedBox(height: 32),
                        FadeUpWidget(
                          delay: 100,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _buildSectionHeader('PERSONAL INFORMATION'),
                              _buildTextField('Full Name', _nameController,
                                  Icons.person_outline,
                                  key: const Key('editFullNameField')),
                              const SizedBox(height: 16),
                              _buildTextField('Phone Number', _phoneController,
                                  Icons.phone_outlined,
                                  keyboardType: TextInputType.phone,
                                  key: const Key('editPhoneField')),
                              const SizedBox(height: 16),
                              _buildTextField('Email Address', _emailController,
                                  Icons.email_outlined,
                                  keyboardType: TextInputType.emailAddress,
                                  key: const Key('editEmailField')),
                              const SizedBox(height: 16),
                              _buildTextField(
                                  'Father\'s Name',
                                  _fatherNameController,
                                  Icons.family_restroom_outlined,
                                  key: const Key('editFatherNameField')),
                              const SizedBox(height: 16),
                              _buildTextField(
                                  'Mother\'s Name',
                                  _motherNameController,
                                  Icons.family_restroom_outlined,
                                  key: const Key('editMotherNameField')),
                              const SizedBox(height: 16),
                              _buildDateField('Date of Birth', _dobController,
                                  key: const Key('editDobField')),
                              const SizedBox(height: 16),
                              _buildTextField('Current Address',
                                  _addressController, Icons.home_outlined,
                                  key: const Key('editAddressField')),
                            ],
                          ),
                        ),
                        const SizedBox(height: 32),
                        FadeUpWidget(
                          delay: 300,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _buildSectionHeader('GUARANTOR DETAILS'),
                              _buildTextField('Guarantor Name',
                                  _gNameController, Icons.shield_outlined,
                                  key: const Key('editGuarantorNameField')),
                              const SizedBox(height: 16),
                              _buildGuarantorPhoneField(),
                              const SizedBox(height: 16),
                              _buildTextField('Guarantor Address',
                                  _gAddressController, Icons.home_outlined,
                                  key: const Key('editGuarantorAddressField')),
                            ],
                          ),
                        ),
                        const SizedBox(height: 32),
                        FadeUpWidget(delay: 500, child: _buildAdminNote()),
                        const SizedBox(height: 32),
                        FadeUpWidget(
                          delay: 600,
                          child: ElevatedButton(
                            key: const Key('submitProfileButton'),
                            onPressed: _isSaving ? null : _saveProfile,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0053C1),
                              foregroundColor: Colors.white,
                              minimumSize: const Size(double.infinity, 56),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(28)),
                              elevation: 8,
                              shadowColor:
                                  const Color(0xFF0053C1).withOpacity(0.4),
                            ),
                            child: _isSaving
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                        color: Colors.white, strokeWidth: 2))
                                : const Text('SUBMIT FOR APPROVAL',
                                    style: TextStyle(
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 1.2)),
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
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF1F5F9), Color(0xFFF8FAFC)],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          InkWell(
            onTap: () => Navigator.maybePop(context),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withOpacity(0.05), blurRadius: 10)
                ],
              ),
              child: const Icon(Icons.arrow_back,
                  size: 18, color: Color(0xFF1E293B)),
            ),
          ),
          const SizedBox(width: 16),
          const Text('Edit Profile',
              style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E293B))),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, left: 4),
      child: Text(
        title,
        style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w900,
            color: Color(0xFF64748B),
            letterSpacing: 1.2),
      ),
    );
  }

  Widget _buildAdminNote() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFFED7AA)),
      ),
      child: const Row(
        children: [
          Icon(Icons.info_outline, color: Color(0xFFD97706), size: 22),
          SizedBox(width: 16),
          Expanded(
            child: Text(
              'Profile changes require admin approval before becoming active.',
              style: TextStyle(
                  color: Color(0xFF9A3412),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  height: 1.4),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarSection() {
    return Center(
      child: Stack(
        children: [
          Container(
            padding: const EdgeInsets.all(4),
            decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                      color: Colors.black12,
                      blurRadius: 20,
                      offset: Offset(0, 10))
                ]),
            child: CircleAvatar(
              radius: 54,
              backgroundColor: const Color(0xFFF1F5F9),
              child: _profileImage != null
                  ? ClipOval(
                      child: Image.file(
                        File(_profileImage!.path),
                        width: 108,
                        height: 108,
                        fit: BoxFit.cover,
                      ),
                    )
                  : const Icon(Icons.person,
                      size: 54, color: Color(0xFF94A3B8)),
            ),
          ),
          Positioned(
            right: 0,
            bottom: 0,
            child: GestureDetector(
              onTap: _pickImage,
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(
                    color: Color(0xFF0053C1), shape: BoxShape.circle),
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
    final phoneChanged = _gPhoneController.text != _originalGPhone;
    final needsVerification = phoneChanged && !_isGPhoneVerified;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Text('Guarantor Phone',
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF64748B))),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withOpacity(0.02),
                          blurRadius: 10,
                          offset: const Offset(0, 4))
                    ]),
                child: TextField(
                  key: const Key('editGuarantorPhoneField'),
                  controller: _gPhoneController,
                  keyboardType: TextInputType.phone,
                  onChanged: (_) {
                    setState(() {
                      _isGPhoneVerified =
                          _gPhoneController.text == _originalGPhone &&
                              (_originalGPhone?.isNotEmpty ?? false);
                      _isGOtpSent = false;
                      _gOtpController.clear();
                    });
                  },
                  style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1E293B)),
                  decoration: InputDecoration(
                    prefixIcon: Icon(Icons.phone_android_outlined,
                        color: const Color(0xFF94A3B8), size: 18),
                    suffixIcon: _isGPhoneVerified
                        ? const Icon(Icons.check_circle,
                            color: Color(0xFF10B981), size: 20)
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 16),
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
                    backgroundColor: const Color(0xFF0053C1),
                    disabledBackgroundColor: const Color(0xFF93C5FD),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                  ),
                  child: _isSendingGOtp
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : Text(_isGOtpSent ? 'Resend' : 'Send OTP',
                          style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: Colors.white)),
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
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                            color: Colors.black.withOpacity(0.02),
                            blurRadius: 10,
                            offset: const Offset(0, 4))
                      ]),
                  child: TextField(
                    controller: _gOtpController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF1E293B),
                        letterSpacing: 8),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.lock_outline,
                          color: Color(0xFF94A3B8), size: 18),
                      hintText: '••••••',
                      counterText: '',
                      border: InputBorder.none,
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 16, vertical: 16),
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
                    backgroundColor: const Color(0xFF10B981),
                    disabledBackgroundColor: const Color(0xFF6EE7B7),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                  ),
                  child: _isVerifyingGOtp
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : const Text('Verify',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: Colors.white)),
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
              color: const Color(0xFFDCFCE7),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Icon(Icons.check_circle, color: Color(0xFF10B981), size: 14),
                SizedBox(width: 6),
                Text('Phone verified',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF065F46))),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildTextField(
      String label, TextEditingController controller, IconData icon,
      {TextInputType keyboardType = TextInputType.text, Key? key}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Text(label,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF64748B))),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 10,
                    offset: const Offset(0, 4))
              ]),
          child: TextField(
            key: key,
            controller: controller,
            keyboardType: keyboardType,
            style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1E293B)),
            decoration: InputDecoration(
              prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 18),
              border: InputBorder.none,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDateField(String label, TextEditingController controller,
      {Key? key}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Text(label,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF64748B))),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 10,
                    offset: const Offset(0, 4))
              ]),
          child: TextField(
            key: key,
            controller: controller,
            readOnly: true,
            style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1E293B)),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.calendar_today_outlined,
                  color: Color(0xFF94A3B8), size: 18),
              suffixIcon: const Icon(Icons.edit_calendar_outlined,
                  color: Color(0xFF0053C1), size: 18),
              border: InputBorder.none,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              hintText: 'YYYY-MM-DD',
            ),
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: controller.text.isNotEmpty
                    ? DateTime.tryParse(controller.text)
                    : DateTime(2000, 1, 1),
                firstDate: DateTime(1940),
                lastDate:
                    DateTime.now().subtract(const Duration(days: 18 * 365)),
              );
              if (picked != null) {
                controller.text =
                    '${picked.year}-${_twoDigits(picked.month)}-${_twoDigits(picked.day)}';
              }
            },
          ),
        ),
      ],
    );
  }
}
