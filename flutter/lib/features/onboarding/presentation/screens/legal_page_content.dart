part of 'legal_page_screen.dart';

class _LegalSection {
  final String id;
  final String title;
  final String content;
  const _LegalSection({
    required this.id,
    required this.title,
    required this.content,
  });
}

const _sections = <_LegalSection>[
  _LegalSection(
    id: 'terms',
    title: 'Terms of Service',
    content:
        '''$_kBrandFull ("Company", "we", "us", or "our") operates the $_kBrandShort electric vehicle rental platform. By accessing or using our services, you agree to be bound by these Terms of Service.

1. SERVICE DESCRIPTION: $_kBrandShort provides electric vehicle rental services to registered riders. All vehicles remain the property of $_kBrandShort and are provided on a rental basis only.

2. ELIGIBILITY: You must be at least 18 years of age, hold a valid driving license, and have completed KYC verification to use our services.

3. RENTAL PERIOD: Rentals are offered on weekly, bi-weekly, and monthly plans. The rental period begins at vehicle pickup and ends upon return inspection.

4. USER RESPONSIBILITIES: Riders are responsible for the vehicle's safety, daily maintenance, and adherence to traffic regulations. Any damage caused by negligence will be charged to the rider.

5. PAYMENT: All payments must be made through the $_kBrandShort platform. Security deposits are refundable subject to vehicle condition at return.

6. TERMINATION: $_kBrandShort reserves the right to terminate rental agreements for violation of terms, non-payment, or misuse of vehicles.

7. LIABILITY: $_kBrandShort's liability is limited to the rental value of the vehicle. We are not liable for indirect, incidental, or consequential damages.

8. GOVERNING LAW: These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in New Delhi.''',
  ),
  _LegalSection(
    id: 'privacy',
    title: 'Privacy Policy',
    content:
        '''$_kBrandShort is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal information.

1. INFORMATION WE COLLECT: We collect personal identification information (name, phone, email, address, date of birth), government-issued IDs (Aadhaar, PAN), driving license details, bank account information for refunds, vehicle usage data, and GPS location data.

2. HOW WE USE YOUR DATA: Your data is used for identity verification and KYC compliance, rental agreement management, payment processing, customer support, safety and emergency services, and service improvement.

3. DATA SHARING: We may share your data with government authorities as required by law, our guarantor verification partners, payment processing banks, and insurance providers for claim processing.

4. DATA SECURITY: We implement industry-standard encryption, secure servers, and regular security audits. GPS data is encrypted and accessible only to authorized safety personnel.

5. DATA RETENTION: We retain your data for the duration of your account plus 7 years as required by Indian financial regulations.

6. YOUR RIGHTS: You have the right to access, correct, and delete your personal data. Requests can be submitted through the app or by contacting support.

7. COOKIES: We use essential cookies for app functionality and analytics cookies to improve our services. You can manage cookie preferences in app settings.''',
  ),
  _LegalSection(
    id: 'refund',
    title: 'Refund Policy',
    content: '''$_kBrandShort maintains a transparent and fair refund policy:

1. SECURITY DEPOSIT: Fully refundable upon vehicle return in good condition. Processing time is 7-10 business days. Deductions may apply for vehicle damage, missing accessories, or outstanding dues.

2. PLAN CANCELLATION: If you cancel within 24 hours of plan activation, a full refund is issued. After 24 hours, no refund is available for the current billing period.

3. WALLET TOP-UP: Wallet balances are non-refundable but can be used for future transactions, plan renewals, or transferred to another $_kBrandShort rider.

4. PROMOTIONAL CREDITS: Reward credits and promotional amounts are non-refundable and have validity periods as specified at the time of issuance.

5. DISPUTE RESOLUTION: For refund disputes, contact support within 30 days of the transaction. Provide transaction ID and reason for dispute. Our team will investigate and respond within 5 business days.

6. FORCE MAJEURE: In case of service disruptions due to natural disasters, government orders, or other force majeure events, refunds will be processed on a pro-rata basis.

7. REFUND METHOD: All refunds are processed to the original payment method. Bank account refunds may take 7-10 business days to reflect.''',
  ),
  _LegalSection(
    id: 'guarantor',
    title: "Guarantor's Agreement",
    content:
        '''1. AGREEMENT: This Guarantor's Agreement ("Agreement") is made between $_kBrandFull and the individual designated as the Guarantor for the Rider.

1. GUARANTEE: The Guarantor unconditionally and irrevocably guarantees the due and punctual payment of all rental fees, penalties, and damage costs incurred by the Rider.

2. LIABILITY: The Guarantor's liability is co-extensive with that of the Rider. In case of default by the Rider, the Company may proceed directly against the Guarantor without first exhausting remedies against the Rider.

3. VALIDITY: This guarantee remains valid for the entire duration of the Rider's association with $_kBrandShort and until all dues are cleared and the vehicle is returned in satisfactory condition.

4. DOCUMENTATION: The Guarantor agrees to provide valid identity proof, address proof, and a verification video as part of the onboarding process.

5. NOTIFICATIONS: The Guarantor consents to receive communications from $_kBrandShort regarding the Rider's account status, payments, and emergency situations.

6. INDEMNITY: The Guarantor agrees to indemnify $_kBrandShort against any losses, damages, or legal costs arising from the Rider's misuse of the vehicle or breach of contract.''',
  ),
];