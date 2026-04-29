import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
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

  late TextEditingController _gNameController;
  late TextEditingController _gRelationController;
  late TextEditingController _gPhoneController;

  @override
  void initState() {
    super.initState();
    final rider = context.read<AppProvider>().rider;
    _nameController = TextEditingController(text: rider?.name ?? '');
    _emailController = TextEditingController(text: rider?.email ?? '');
    _phoneController = TextEditingController(text: rider?.phone ?? '');
    _fatherNameController = TextEditingController(text: rider?.fatherName ?? '');
    _motherNameController = TextEditingController(text: rider?.motherName ?? '');

    _gNameController = TextEditingController(text: rider?.guarantorName ?? '');
    _gRelationController = TextEditingController(text: rider?.guarantorRelation ?? '');
    _gPhoneController = TextEditingController(text: rider?.guarantorPhone ?? '');
  }

  @override
  void dispose() {
    for (var controller in [
      _nameController, _emailController, _phoneController,
      _fatherNameController, _motherNameController,
      _gNameController, _gRelationController, _gPhoneController
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _saveProfile() {
    final provider = context.read<AppProvider>();
    final rider = provider.rider;
    if (rider != null) {
      final updated = rider.copyWith(
        name: _nameController.text,
        email: _emailController.text,
        phone: _phoneController.text,
        fatherName: _fatherNameController.text,
        motherName: _motherNameController.text,
        guarantorName: _gNameController.text,
        guarantorRelation: _gRelationController.text,
        guarantorPhone: _gPhoneController.text,
      );
      provider.updateRider(updated);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updates submitted for approval'), backgroundColor: Color(0xFF10B981)),
        );
        Navigator.pop(context);
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
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
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
                              _buildTextField('Full Name', _nameController, Icons.person_outline, key: const Key('editFullNameField')),
                              const SizedBox(height: 16),
                              _buildTextField('Phone Number', _phoneController, Icons.phone_outlined, keyboardType: TextInputType.phone, key: const Key('editPhoneField')),
                              const SizedBox(height: 16),
                              _buildTextField('Email Address', _emailController, Icons.email_outlined, keyboardType: TextInputType.emailAddress, key: const Key('editEmailField')),
                              const SizedBox(height: 16),
                              _buildTextField('Father\'s Name', _fatherNameController, Icons.family_restroom_outlined, key: const Key('editFatherNameField')),
                              const SizedBox(height: 16),
                              _buildTextField('Mother\'s Name', _motherNameController, Icons.family_restroom_outlined, key: const Key('editMotherNameField')),
                            ],
                          ),
                        ),
                        const SizedBox(height: 32),
                        FadeUpWidget(
                          delay: 300,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _buildSectionHeader('GUARANTOR INFORMATION'),
                              _buildTextField('Guarantor Name', _gNameController, Icons.shield_outlined, key: const Key('editGuarantorNameField')),
                              const SizedBox(height: 16),
                              _buildTextField('Relationship', _gRelationController, Icons.handshake_outlined, key: const Key('editRelationshipField')),
                              const SizedBox(height: 16),
                              _buildTextField('Guarantor Phone', _gPhoneController, Icons.phone_android_outlined, keyboardType: TextInputType.phone, key: const Key('editGuarantorPhoneField')),
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
                            onPressed: _saveProfile,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0053C1),
                              foregroundColor: Colors.white,
                              minimumSize: const Size(double.infinity, 56),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                              elevation: 8,
                              shadowColor: const Color(0xFF0053C1).withOpacity(0.4),
                            ),
                            child: const Text('SUBMIT FOR APPROVAL', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.2)),
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
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)],
              ),
              child: const Icon(Icons.arrow_back, size: 18, color: Color(0xFF1E293B)),
            ),
          ),
          const SizedBox(width: 16),
          const Text('Edit Profile', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, left: 4),
      child: Text(
        title,
        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 1.2),
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
              style: TextStyle(color: Color(0xFF9A3412), fontSize: 13, fontWeight: FontWeight.w600, height: 1.4),
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
            decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle, boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 20, offset: Offset(0, 10))]),
            child: const CircleAvatar(
              radius: 54,
              backgroundColor: Color(0xFFF1F5F9),
              child: Icon(Icons.person, size: 54, color: Color(0xFF94A3B8)),
            ),
          ),
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(color: Color(0xFF0053C1), shape: BoxShape.circle),
              child: const Icon(Icons.camera_alt, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField(String label, TextEditingController controller, IconData icon, {TextInputType keyboardType = TextInputType.text, Key? key}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF64748B))),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))]),
          child: TextField(
            key: key,
            controller: controller,
            keyboardType: keyboardType,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF1E293B)),
            decoration: InputDecoration(
              prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 18),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            ),
          ),
        ),
      ],
    );
  }
}
