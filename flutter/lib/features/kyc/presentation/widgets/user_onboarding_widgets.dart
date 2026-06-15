import 'dart:io';
import 'package:flutter/material.dart';

class PersonalDetailsCard extends StatelessWidget {
  final TextEditingController nameController;
  final TextEditingController dobController;
  final TextEditingController emailController;
  final TextEditingController fatherNameController;
  final TextEditingController motherNameController;
  final TextEditingController addressController;
  final String phone;
  final VoidCallback onSelectDob;

  const PersonalDetailsCard({
    super.key,
    required this.nameController,
    required this.dobController,
    required this.emailController,
    required this.fatherNameController,
    required this.motherNameController,
    required this.addressController,
    required this.phone,
    required this.onSelectDob,
  });

  @override
  Widget build(BuildContext context) {
    final formattedPhone = phone.length >= 10
        ? '+91 ${phone.substring(0, 5)} ${phone.substring(5)}'
        : phone;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.person,
                    color: Color(0xFF2563EB), size: 18),
              ),
              const SizedBox(width: 10),
              const Text('Personal Details',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF111827))),
            ],
          ),
          const SizedBox(height: 16),
          _buildTextField('Full Name', 'Enter full name', nameController,
              key: const Key('fullNameField')),
          const SizedBox(height: 12),
          _buildDateField('Date of Birth', 'DD-MM-YYYY', dobController, onSelectDob),
          const SizedBox(height: 12),
          _buildTextField(
              'Email Address', 'Enter email address', emailController,
              key: const Key('emailField')),
          const SizedBox(height: 12),
          _buildPhoneField(formattedPhone),
          const SizedBox(height: 12),
          _buildTextField(
              "Father's Name", "Enter father's name", fatherNameController,
              key: const Key('fatherNameField')),
          const SizedBox(height: 12),
          _buildTextField(
              "Mother's Name", "Enter mother's name", motherNameController,
              key: const Key('motherNameField')),
          const SizedBox(height: 12),
          _buildTextArea(
              'Current Address', 'Enter your full address', addressController),
        ],
      ),
    );
  }

  Widget _buildTextField(String label, String hint, TextEditingController controller, {Key? key}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF374151))),
        const SizedBox(height: 6),
        TextField(
          key: key,
          controller: controller,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            filled: true,
            fillColor: const Color(0xFFF9FAFB),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB))),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFF2563EB))),
          ),
        ),
      ],
    );
  }

  Widget _buildDateField(String label, String hint, TextEditingController controller, VoidCallback onTap) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF374151))),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: onTap,
          child: AbsorbPointer(
            child: TextField(
              key: const Key('dobField'),
              controller: controller,
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
                prefixIcon: const Icon(Icons.calendar_today, size: 18, color: Color(0xFF6B7280)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                filled: true,
                fillColor: const Color(0xFFF9FAFB),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFFD1D5DB))),
                enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
                focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: Color(0xFF2563EB))),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneField(String phone) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Phone Number',
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF374151))),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF3F4F6),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Row(
            children: [
              const Icon(Icons.phone, size: 16, color: Color(0xFF9CA3AF)),
              const SizedBox(width: 8),
              Text(phone,
                  style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF6B7280),
                      fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTextArea(String label, String hint, TextEditingController controller) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF374151))),
        const SizedBox(height: 6),
        TextField(
          key: const Key('currentAddressField'),
          controller: controller,
          maxLines: 3,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            filled: true,
            fillColor: const Color(0xFFF9FAFB),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB))),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFF2563EB))),
          ),
        ),
      ],
    );
  }
}

class IdentityVerificationCard extends StatelessWidget {
  final bool aadhaarFrontUploaded;
  final bool aadhaarBackUploaded;
  final bool panUploaded;
  final bool bankDetailsDone;
  final VoidCallback onPickAadhaarFront;
  final VoidCallback onPickAadhaarBack;
  final VoidCallback onPickPan;
  final VoidCallback onShowBankDialog;

  const IdentityVerificationCard({
    super.key,
    required this.aadhaarFrontUploaded,
    required this.aadhaarBackUploaded,
    required this.panUploaded,
    required this.bankDetailsDone,
    required this.onPickAadhaarFront,
    required this.onPickAadhaarBack,
    required this.onPickPan,
    required this.onShowBankDialog,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        cross CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                    color: const Color(0xFFEEF2FF),
                    borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.badge_outlined,
                    color: Color(0xFF4F46E5), size: 18),
              ),
              const SizedBox(width: 10),
              const Text('Identity Verification',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF111827))),
            ],
          ),
          const SizedBox(height: 4),
          const Text('Clear photos only. Max 5MB each.',
              style: TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                  child: DocTile(
                label: 'Aadhaar Card\n(Front)',
                icon: Icons.upload_file,
                isUploaded: aadhaarFrontUploaded,
                onTap: onPickAadhaarFront,
                key: const Key('aadhaarFrontTile'),
              )),
              const SizedBox(width: 12),
              Expanded(
                  child: DocTile(
                label: 'Aadhaar Card\n(Back)',
                icon: Icons.upload_file,
                isUploaded: aadhaarBackUploaded,
                onTap: onPickAadhaarBack,
                key: const Key('aadhaarBackTile'),
              )),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  child: DocTile(
                label: 'PAN Card',
                icon: Icons.upload_file,
                isUploaded: panUploaded,
                onTap: onPickPan,
                key: const Key('panTile'),
              )),
              const SizedBox(width: 12),
              Expanded(
                  child: DocTile(
                label: 'Bank Details',
                icon: Icons.account_balance,
                isUploaded: bankDetailsDone,
                onTap: onShowBankDialog,
                key: const Key('bankTile'),
              )),
            ],
          ),
        ],
      ),
    );
  }
}

class DocTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isUploaded;
  final VoidCallback onTap;

  const DocTile({
    super.key,
    required this.label,
    required this.icon,
    required this.isUploaded,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isUploaded ? const Color(0xFFF0FDF4) : const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color:
                isUploaded ? const Color(0xFF10B981) : const Color(0xFFD1D5DB),
            width: isUploaded ? 1 : 2,
          ),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isUploaded ? const Color(0xFFDCFCE7) : Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon,
                  color: isUploaded
                      ? const Color(0xFF10B981)
                      : const Color(0xFF6B7280),
                  size: 20),
            ),
            const SizedBox(height: 8),
            Text(
              isUploaded ? 'Uploaded' : label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: isUploaded
                    ? const Color(0xFF10B981)
                    : const Color(0xFF374151),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SelfieCard extends StatelessWidget {
  final bool selfieUploaded;
  final String? selfiePath;
  final VoidCallback onTap;

  const SelfieCard({
    super.key,
    required this.selfieUploaded,
    required this.selfiePath,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: GestureDetector(
        key: const Key('selfieTile'),
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (selfieUploaded && selfiePath != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.file(File(selfiePath!),
                    height: 160, fit: BoxFit.cover),
              )
            else
              Container(
                height: 120,
                decoration: BoxDecoration(
                  color: const Color(0xFFF9FAFB),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFD1D5DB), width: 2),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: const Icon(Icons.photo_camera,
                          color: Color(0xFF2563EB), size: 28),
                    ),
                    const SizedBox(height: 8),
                    const Text('Take Rider Photo',
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 2),
                    const Text('Tap to capture your photo',
                        style:
                            TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                  ],
                ),
              ),
            if (selfieUploaded) ...[
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.check, color: Color(0xFF10B981), size: 14),
                        SizedBox(width: 4),
                        Text('Photo Captured',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF065F46))),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class SignatureCard extends StatelessWidget {
  final bool signatureUploaded;
  final VoidCallback onTap;

  const SignatureCard({
    super.key,
    required this.signatureUploaded,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(8)),
                  child: const Icon(Icons.draw,
                      color: Color(0xFF2563EB), size: 18)),
              const SizedBox(width: 10),
              const Text('Digital Signature',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF111827))),
            ],
          ),
          const SizedBox(height: 4),
          const Text('Sign below to authorize documentation.',
              style: TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          const SizedBox(height: 12),
          GestureDetector(
            key: const Key('signatureTile'),
            onTap: onTap,
            child: Container(
              height: 120,
              decoration: BoxDecoration(
                color: signatureUploaded
                    ? const Color(0xFFF0FDF4)
                    : const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                    color: signatureUploaded
                        ? const Color(0xFF10B981)
                        : const Color(0xFFD1D5DB)),
              ),
              child: Stack(
                children: [
                  Center(
                      child: Text(
                          signatureUploaded
                              ? 'Signature Captured'
                              : 'Tap to draw signature',
                          style: TextStyle(
                              fontSize: 14,
                              color: signatureUploaded
                                  ? const Color(0xFF10B981)
                                  : const Color(0xFF9CA3AF)))),
                  if (signatureUploaded)
                    Positioned(
                        top: 8,
                        right: 8,
                        child: Container(
                            padding: const EdgeInsets.all(2),
                            decoration: const BoxDecoration(
                                color: Color(0xFF10B981),
                                shape: BoxShape.circle),
                            child: const Icon(Icons.check,
                                color: Colors.white, size: 12))),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class UserOnboardingAppBar extends StatelessWidget {
  final VoidCallback? onBack;

  const UserOnboardingAppBar({super.key, this.onBack});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE5E7EB), width: 1)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: Color(0xFF111827)),
            onPressed: onBack,
          ),
          const Expanded(
            child: Text(
              'Onboarding',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: Color(0xFF111827),
                  fontSize: 18,
                  fontWeight: FontWeight.w600),
            ),
          ),
          const Padding(
            padding: EdgeInsets.only(right: 8),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Step',
                    style: TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
                Text('1/2',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF111827))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class UserOnboardingHeader extends StatelessWidget {
  const UserOnboardingHeader({super.key});

  @override
  Widget build(BuildContext context) {
    final double screenWidth = MediaQuery.of(context).size.width;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 6,
          decoration: BoxDecoration(
              color: const Color(0xFFE5E7EB),
              borderRadius: BorderRadius.circular(3)),
          child: Stack(
            children: [
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                width: screenWidth * 0.45,
                child: Container(
                    decoration: BoxDecoration(
                        color: const Color(0xFF10B981),
                        borderRadius: BorderRadius.circular(3))),
              ),
              Positioned(
                right: 0,
                top: 0,
                bottom: 0,
                width: screenWidth * 0.45,
                child: Container(
                    decoration: BoxDecoration(
                        color: const Color(0xFFEEF2FF),
                        borderRadius: BorderRadius.circular(3))),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text('Almost there!',
            style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: Color(0xFF111827))),
        const SizedBox(height: 6),
        const Text(
            'We need a few more details to set up your fleet profile securely.',
            style: TextStyle(fontSize: 14, color: Color(0xFF6B7280))),
      ],
    );
  }
}

class UserOnboardingBottomButton extends StatelessWidget {
  final bool canProceed;
  final bool isUploading;
  final VoidCallback? onNext;

  const UserOnboardingBottomButton({
    super.key,
    required this.canProceed,
    required this.isUploading,
    this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE5E7EB)))),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          key: const Key('nextOnboardingButton'),
          onPressed: canProceed && !isUploading ? onNext : null,
          style: ElevatedButton.styleFrom(
            backgroundColor:
                canProceed ? const Color(0xFF2563EB) : const Color(0xFF9CA3AF),
            disabledBackgroundColor: const Color(0xFF9CA3AF),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            elevation: 0,
          ),
          child: isUploading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      color: Colors.white, strokeWidth: 2))
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                        canProceed
                            ? 'NEXT: ADD GUARANTOR'
                            : 'COMPLETE ALL FIELDS',
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white)),
                    const SizedBox(width: 8),
                    const Icon(Icons.arrow_forward,
                        color: Colors.white, size: 18),
                  ],
                ),
        ),
      ),
    );
  }
}

class UserOnboardingDialogField extends StatelessWidget {
  final String label;
  final String hint;
  final TextEditingController controller;

  const UserOnboardingDialogField({
    super.key,
    required this.label,
    required this.hint,
    required this.controller,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFF9CA3AF)),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB))),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB))),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFF2563EB))),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          ),
        ),
      ],
    );
  }
}

