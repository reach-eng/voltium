import 'dart:io';
import 'package:flutter/material.dart';
import 'package:voltium_rider/features/kyc/presentation/widgets/user_onboarding_widgets.dart' show DocTile;

class GuarantorDetailsCard extends StatelessWidget {
  final TextEditingController nameController;
  final TextEditingController dobController;
  final TextEditingController phoneController;
  final TextEditingController fatherNameController;
  final TextEditingController motherNameController;
  final TextEditingController addressController;
  final bool isPhoneVerified;
  final bool isSendingOtp;
  final bool isOtpSent;
  final bool isVerifyingOtp;
  final VoidCallback onSendOtp;
  final VoidCallback onVerifyOtp;
  final VoidCallback onSelectDob;
  final Widget otpBoxes;

  const GuarantorDetailsCard({
    super.key,
    required this.nameController,
    required this.dobController,
    required this.phoneController,
    required this.fatherNameController,
    required this.motherNameController,
    required this.addressController,
    required this.isPhoneVerified,
    required this.isSendingOtp,
    required this.isOtpSent,
    required this.isVerifyingOtp,
    required this.onSendOtp,
    required this.onVerifyOtp,
    required this.onSelectDob,
    required this.otpBoxes,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Guarantor Details',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 20),
          _buildTextField('Full Name', 'Enter guarantor\'s full name', nameController,
              key: const Key('guarantorFullNameField')),
          const SizedBox(height: 16),
          _buildDateField('Date of Birth', 'DD-MM-YYYY', dobController, onSelectDob),
          const SizedBox(height: 16),
          _buildPhoneField(context),
          const SizedBox(height: 16),
          _buildTextField('Father\'s Name', 'Enter father\'s name', fatherNameController,
              key: const Key('guarantorFatherNameField')),
          const SizedBox(height: 16),
          _buildTextField('Mother\'s Name', 'Enter mother\'s name', motherNameController,
              key: const Key('guarantorMotherNameField')),
          const SizedBox(height: 16),
          _buildTextArea('Current Address', 'Enter full address', addressController),
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
                fontWeight: FontWeight.w600,
                color: Color(0xFF64748B))),
        const SizedBox(height: 8),
        TextField(
          key: key,
          controller: controller,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF3B82F6))),
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
                fontWeight: FontWeight.w600,
                color: Color(0xFF64748B))),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: onTap,
          child: AbsorbPointer(
            child: TextField(
              key: const Key('guarantorDobField'),
              controller: controller,
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                prefixIcon: const Icon(Icons.calendar_today, size: 18, color: Color(0xFF64748B)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF3B82F6))),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneField(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Guarantor Phone Number',
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF64748B))),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                key: const Key('guarantorPhoneField'),
                controller: phoneController,
                keyboardType: TextInputType.phone,
                enabled: !isPhoneVerified,
                decoration: InputDecoration(
                  hintText: 'Enter 10-digit number',
                  hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                  enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                  focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF3B82F6))),
                ),
              ),
            ),
            if (!isPhoneVerified) ...[
              const SizedBox(width: 12),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  key: const Key('sendOtpButton'),
                  onPressed: isSendingOtp || phoneController.text.length < 10 ? null : onSendOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF3B82F6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: isSendingOtp
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text(isOtpSent ? 'RESEND' : 'SEND OTP',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ],
        ),
        if (isPhoneVerified) ...[
          const SizedBox(height: 8),
          Row(
            children: const [
              Icon(Icons.check_circle, color: Color(0xFF10B981), size: 16),
              SizedBox(width: 6),
              Text('Phone Number Verified',
                  style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF10B981),
                      fontWeight: FontWeight.w600)),
            ],
          ),
        ],
        if (isOtpSent && !isPhoneVerified) ...[
          const SizedBox(height: 16),
          const Text('Enter OTP',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF64748B))),
          const SizedBox(height: 8),
          otpBoxes,
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              key: const Key('verifyOtpButton'),
              onPressed: isVerifyingOtp ? null : onVerifyOtp,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              child: isVerifyingOtp
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('VERIFY OTP',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildTextArea(String label, String hint, TextEditingController controller) {
    return Column(
      cross CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF64748B))),
        const SizedBox(height: 8),
        TextField(
          key: const Key('guarantorAddressField'),
          controller: controller,
          maxLines: 3,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF3B82F6))),
          ),
        ),
      ],
    );
  }
}

class GuarantorIdentityVerificationCard extends StatelessWidget {
  final bool aadhaarFrontUploaded;
  final bool aadhaarBackUploaded;
  final bool panUploaded;
  final bool photoUploaded;
  final VoidCallback onPickAadhaarFront;
  final VoidCallback onPickAadhaarBack;
  final VoidCallback onPickPan;
  final VoidCallback onPickPhoto;

  const GuarantorIdentityVerificationCard({
    super.key,
    required this.aadhaarFrontUploaded,
    required this.aadhaarBackUploaded,
    required this.panUploaded,
    required this.photoUploaded,
    required this.onPickAadhaarFront,
    required this.onPickAadhaarBack,
    required this.onPickPan,
    required this.onPickPhoto,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Documents Upload',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 4),
          const Text('Clear photos only. Max 5MB each.',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                  child: DocTile(
                label: 'Aadhaar Card\n(Front)',
                icon: Icons.upload_file,
                isUploaded: aadhaarFrontUploaded,
                onTap: onPickAadhaarFront,
                key: const Key('guarantorAadhaarFrontTile'),
              )),
              const SizedBox(width: 12),
              Expanded(
                  child: DocTile(
                label: 'Aadhaar Card\n(Back)',
                icon: Icons.upload_file,
                isUploaded: aadhaarBackUploaded,
                onTap: onPickAadhaarBack,
                key: const Key('guarantorAadhaarBackTile'),
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
                key: const Key('guarantorPanTile'),
              )),
              const SizedBox(width: 12),
              Expanded(
                  child: DocTile(
                label: 'Guarantor Photo',
                icon: Icons.face,
                isUploaded: photoUploaded,
                onTap: onPickPhoto,
                key: const Key('guarantorPhotoTile'),
              )),
            ],
          ),
        ],
      ),
    );
  }
}

class GuarantorVideoProofCard extends StatelessWidget {
  final bool videoUploaded;
  final String? videoPath;
  final VoidCallback onTap;

  const GuarantorVideoProofCard({
    super.key,
    required this.videoUploaded,
    required this.videoPath,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Consent Video (Compulsory)',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 4),
          const Text(
              'Record a 5-sec video holding ID, saying "I agree to be the guarantor for [Rider Name]"',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
          const SizedBox(height: 20),
          GestureDetector(
            key: const Key('guarantorVideoTile'),
            onTap: onTap,
            child: Container(
              height: 140,
              decoration: BoxDecoration(
                color: videoUploaded ? const Color(0xFFECFDF5) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: videoUploaded ? const Color(0xFF10B981) : const Color(0xFFE2E8F0),
                  width: videoUploaded ? 1 : 2,
                ),
              ),
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      videoUploaded ? Icons.check_circle : Icons.videocam,
                      color: videoUploaded ? const Color(0xFF10B981) : const Color(0xFF94A3B8),
                      size: 36,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      videoUploaded ? 'Video Recorded' : 'Record Consent Video',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: videoUploaded ? const Color(0xFF10B981) : const Color(0xFF1E293B),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class GuarantorSignatureCard extends StatelessWidget {
  final bool signatureUploaded;
  final VoidCallback onTap;

  const GuarantorSignatureCard({
    super.key,
    required this.signatureUploaded,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Guarantor Signature',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 4),
          const Text('Sign on screen to authorize details.',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
          const SizedBox(height: 20),
          GestureDetector(
            key: const Key('guarantorSignatureTile'),
            onTap: onTap,
            child: Container(
              height: 140,
              decoration: BoxDecoration(
                color: signatureUploaded ? const Color(0xFFECFDF5) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: signatureUploaded ? const Color(0xFF10B981) : const Color(0xFFE2E8F0),
                  width: signatureUploaded ? 1 : 2,
                ),
              ),
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      signatureUploaded ? Icons.check_circle : Icons.draw,
                      color: signatureUploaded ? const Color(0xFF10B981) : const Color(0xFF94A3B8),
                      size: 36,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      signatureUploaded ? 'Signature Saved' : 'Draw Signature',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: signatureUploaded ? const Color(0xFF10B981) : const Color(0xFF1E293B),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class GuarantorOnboardingHeader extends StatelessWidget {
  final VoidCallback? onBack;

  const GuarantorOnboardingHeader({super.key, this.onBack});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: onBack,
            ),
            const Expanded(
              child: Text(
                'Onboarding',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: const [
                  Text('Step',
                      style: TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
                  Text('2/2',
                      style:
                          TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class GuarantorOnboardingProgressSection extends StatelessWidget {
  const GuarantorOnboardingProgressSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 8,
            decoration: BoxDecoration(
              color: const Color(0xFFE5E7EB),
              borderRadius: BorderRadius.circular(4),
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: 1.0,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          const Text('One more step',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const Text(
            'We need a few more details to set up your fleet profile securely.',
            style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
          ),
        ],
      ),
    );
  }
}

class GuarantorOnboardingOtpBoxes extends StatelessWidget {
  final List<TextEditingController> otpControllers;
  final List<FocusNode> otpFocusNodes;
  final Function(int, String) onChanged;

  const GuarantorOnboardingOtpBoxes({
    super.key,
    required this.otpControllers,
    required this.otpFocusNodes,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List.generate(6, (i) {
        return SizedBox(
          width: 40,
          height: 48,
          child: TextFormField(
            controller: otpControllers[i],
            focusNode: otpFocusNodes[i],
            keyboardType: TextInputType.number,
            maxLength: 1,
            textAlign: TextAlign.center,
            textInputAction:
                i < 5 ? TextInputAction.next : TextInputAction.done,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              counterText: '',
              filled: true,
              fillColor: Colors.white,
              contentPadding: EdgeInsets.zero,
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide:
                    const BorderSide(color: Color(0xFF2563EB), width: 2),
              ),
            ),
            onChanged: (v) => onChanged(i, v),
          ),
        );
      }),
    );
  }
}

class GuarantorOnboardingBottomButton extends StatelessWidget {
  final bool canProceed;
  final bool isUploading;
  final VoidCallback? onSubmit;

  const GuarantorOnboardingBottomButton({
    super.key,
    required this.canProceed,
    required this.isUploading,
    this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          key: const Key('completeOnboardingButton'),
          onPressed: canProceed && !isUploading ? onSubmit : null,
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
                      color: Colors.white, strokeWidth: 2),
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Text('FINISH SETUP',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white)),
                    SizedBox(width: 8),
                    Icon(Icons.check, color: Colors.white, size: 18),
                  ],
                ),
        ),
      ),
    );
  }
}

