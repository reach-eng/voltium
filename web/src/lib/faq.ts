export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string;
  priority: 'high' | 'medium' | 'low';
}

export const VOLTIUM_FAQ: FaqEntry[] = [
  // ── ACCOUNT & KYC ──────────────────────────────────────────
  {
    id: 'acct-activate',
    question: 'How to activate my account?',
    answer:
      'To activate your Ryd account, first sign up with your mobile number and verify it via the OTP sent to your phone. Next, complete your profile by providing your full name, email, and address. Finally, complete the KYC verification by uploading your Aadhaar card or PAN card along with a selfie. Once approved, your account will be activated within 24 hours.',
    keywords: ['activate', 'account', 'sign up', 'registration', 'onboard'],
    category: 'ACCOUNT_KYC',
    priority: 'high',
  },
  {
    id: 'kyc-documents',
    question: 'What documents are needed for KYC?',
    answer:
      'Ryd requires a valid government-issued ID for KYC verification. You can submit either your Aadhaar card or PAN card. You will also need to upload a clear selfie photo for identity matching. Make sure the document is not expired and all details are legible. The upload should be a colour scan or a clear photo — blurry or cropped images will be rejected.',
    keywords: ['kyc', 'documents', 'aadhaar', 'pan', 'id proof', 'verification'],
    category: 'ACCOUNT_KYC',
    priority: 'high',
  },
  {
    id: 'kyc-rejected',
    question: 'Why was my KYC rejected?',
    answer:
      'KYC verification may be rejected due to blurry or unreadable document photos, expired ID documents, mismatch between the name on the document and your profile, or an unclear selfie. Check the rejection reason in the app under Profile > KYC Status, re-upload the correct documents, and submit again. If the issue persists, contact our support team for assistance.',
    keywords: ['kyc', 'rejected', 'failed', 'verification failed', 'document issue'],
    category: 'ACCOUNT_KYC',
    priority: 'high',
  },
  {
    id: 'profile-update',
    question: 'How to update my profile?',
    answer:
      'Open the Ryd app and go to Settings > Profile. From there, you can update your name, email, phone number, and address. For changes that affect KYC — such as your name or date of birth — you may need to re-verify your identity by uploading fresh documents. Profile photo changes take effect immediately.',
    keywords: ['profile', 'update', 'edit', 'personal details', 'name change'],
    category: 'ACCOUNT_KYC',
    priority: 'medium',
  },

  // ── WALLET & PAYMENTS ──────────────────────────────────────
  {
    id: 'wallet-topup',
    question: 'How do I top up my wallet?',
    answer:
      'To top up your Ryd wallet, go to the Wallet section in the app and tap "Top Up." Choose or enter an amount (minimum ₹100), then select your payment method — currently UPI is supported. Complete the payment via your preferred UPI app, and the balance will reflect in your wallet instantly. Keep your transaction ID handy in case of any issues.',
    keywords: ['top up', 'wallet', 'add money', 'recharge', 'balance', 'upi'],
    category: 'WALLET_PAYMENTS',
    priority: 'high',
  },
  {
    id: 'wallet-negative',
    question: 'My wallet balance went negative. What do I do?',
    answer:
      'A negative wallet balance usually occurs when your rental charges exceed your available balance at the end of a trip. To resolve this, top up your wallet immediately through the Wallet section. Your account may be restricted from starting new rentals until the negative balance is cleared. If you believe the charge is incorrect, raise a support ticket with your ride details for review.',
    keywords: ['negative', 'balance', 'wallet', 'overdue', 'debt', 'owe'],
    category: 'WALLET_PAYMENTS',
    priority: 'high',
  },
  {
    id: 'security-deposit',
    question: 'What is the security deposit for?',
    answer:
      'The security deposit is a one-time refundable amount (₹500) collected when you activate your account. It covers potential damages, late fees, or outstanding charges. The deposit is refunded when you close your account, minus any deductions for pending dues. It is not used for daily rental charges — those are deducted separately from your wallet balance.',
    keywords: ['security deposit', 'deposit', 'refundable', '₹500', 'activation fee'],
    category: 'WALLET_PAYMENTS',
    priority: 'medium',
  },
  {
    id: 'wallet-withdraw',
    question: 'How do I withdraw money?',
    answer:
      'Currently, Ryd does not support direct wallet withdrawals to bank accounts. Your wallet balance is used exclusively for rental charges, top-ups, and plan payments. If you have a significant balance and wish to close your account, contact support and we will process a refund of your wallet balance along with your security deposit within 7-10 business days.',
    keywords: ['withdraw', 'refund', 'transfer', 'bank account', 'cash out'],
    category: 'WALLET_PAYMENTS',
    priority: 'medium',
  },
  {
    id: 'payment-streak',
    question: 'What is the Payment Streak feature?',
    answer:
      'The Payment Streak rewards you for consistent on-time payments. Each time you top up your wallet or pay your rental charges on time, your streak counter increases. After 7 consecutive on-time payments, you earn streak badges and cashback rewards. Missing a payment resets your streak to zero. You can view your current streak on the Wallet dashboard.',
    keywords: ['streak', 'payment streak', 'reward', 'badge', 'on-time', 'consistency'],
    category: 'WALLET_PAYMENTS',
    priority: 'low',
  },

  // ── RENTAL & PLANS ─────────────────────────────────────────
  {
    id: 'select-plan',
    question: 'How do I select a rental plan?',
    answer:
      'After your account is activated, go to the Plans section on the home screen. Browse available plans — Daily, Weekly, and Monthly options are available with varying kilometre limits. Tap on a plan to view details including price, KM allowance, and validity. Select your preferred plan, confirm your payment method, and complete the payment to activate the plan.',
    keywords: ['plan', 'rental plan', 'subscription', 'daily', 'weekly', 'monthly', 'choose'],
    category: 'RENTAL_PLANS',
    priority: 'high',
  },
  {
    id: 'change-plan-midcycle',
    question: 'Can I change my plan mid-cycle?',
    answer:
      'Yes, you can upgrade or change your rental plan mid-cycle. Go to Dashboard > Active Plan > Change Plan. If you upgrade, you will only be charged the prorated difference for the remaining cycle. If you downgrade, the change takes effect at the start of your next billing cycle. Note that switching plans may adjust your kilometre allowance accordingly.',
    keywords: ['change plan', 'upgrade', 'downgrade', 'mid-cycle', 'switch plan', 'modify'],
    category: 'RENTAL_PLANS',
    priority: 'medium',
  },
  {
    id: 'plan-expired',
    question: 'What happens when my plan expires?',
    answer:
      'When your plan expires, you will receive a notification 24 hours before the end date. You can renew or extend the plan from the Plans section. If the plan is not renewed, the vehicle must be returned to the designated hub before the expiry time. Continuing to use the vehicle after expiry incurs per-hour overtime charges at ₹15/hour. Please return the vehicle promptly to avoid penalties.',
    keywords: ['expired', 'expiry', 'plan ended', 'overdue', 'renew', 'extend'],
    category: 'RENTAL_PLANS',
    priority: 'high',
  },
  {
    id: 'dynamic-pricing',
    question: 'How does dynamic pricing work?',
    answer:
      'Ryd uses dynamic pricing to manage demand across peak and off-peak hours. During high-demand periods (evenings, weekends, holidays), rental prices may increase by up to 20%. During off-peak times, you may find discounted rates. The current pricing tier is always displayed before you confirm a booking so there are no surprises. Dynamic pricing does not apply to active subscriptions.',
    keywords: ['dynamic pricing', 'surge', 'peak', 'demand', 'price change', 'expensive'],
    category: 'RENTAL_PLANS',
    priority: 'medium',
  },
  {
    id: 'switch-vehicle',
    question: 'Can I switch vehicles during my rental?',
    answer:
      'Vehicle switching during an active rental is allowed once per cycle. Go to Dashboard > Active Plan > Switch Vehicle and choose an available vehicle from your nearest hub. The switch must be completed at a Ryd hub — you cannot swap vehicles on the road. Your kilometre allowance and plan duration remain unchanged. A small switching fee of ₹50 may apply.',
    keywords: ['switch vehicle', 'change vehicle', 'swap', 'different scooter', 'exchange'],
    category: 'RENTAL_PLANS',
    priority: 'medium',
  },

  // ── VEHICLE & PICKUP ───────────────────────────────────────
  {
    id: 'vehicle-pickup',
    question: 'How do I pick up my vehicle?',
    answer:
      'Once your rental plan is active, go to Dashboard > Pick Up Vehicle to find your nearest available hub. Navigate to the hub using the in-app map. At the hub, scan the QR code on the vehicle to begin your pickup. Complete the pre-ride inspection checklist by checking the tyres, brakes, lights, battery level, and body condition. Once confirmed, the vehicle unlocks and your ride begins.',
    keywords: ['pickup', 'pick up', 'collect', 'get vehicle', 'start ride', 'hub'],
    category: 'VEHICLE_PICKUP',
    priority: 'high',
  },
  {
    id: 'vehicle-inspection',
    question: 'What should I check during vehicle inspection?',
    answer:
      'During the pre-ride inspection, check the following: tyre condition and pressure, front and rear brakes (test both), headlight and tail light functionality, horn operation, battery charge level (should be above 30%), body panels for scratches or dents, and the helmet availability in the storage compartment. Photograph any existing damage and report it in the app before starting your ride to avoid being held responsible later.',
    keywords: ['inspection', 'check', 'pre-ride', 'damage', 'tyre', 'brake', 'battery'],
    category: 'VEHICLE_PICKUP',
    priority: 'high',
  },
  {
    id: 'vehicle-no-accelerate',
    question: "The vehicle won't accelerate. What should I do?",
    answer:
      'If the vehicle does not accelerate, first check that the ignition is on and the kickstand is fully retracted — the motor cuts off if the stand is down. Next, verify the battery level is above 5%. If the issue persists, restart the vehicle by turning it off and on again using the key. If none of these steps work, report the issue in the app under Help > Report Vehicle Issue and request a replacement vehicle from the nearest hub.',
    keywords: ['accelerate', 'not moving', 'motor', "won't go", 'no power', 'stuck'],
    category: 'VEHICLE_PICKUP',
    priority: 'high',
  },
  {
    id: 'screen-blank',
    question: 'Screen is blank. What do I do?',
    answer:
      "If the vehicle display screen is blank, first try pressing the power button on the dashboard. If it does not respond, the battery may be critically low — connect the vehicle to a charging station. If the battery is sufficient, the display fuse may have blown. In this case, report the issue via the app and request a vehicle swap. Do not attempt to ride a vehicle with a non-functional display as you won't be able to see speed or battery information.",
    keywords: ['screen', 'blank', 'display', 'dashboard', 'no display', 'off'],
    category: 'VEHICLE_PICKUP',
    priority: 'medium',
  },
  {
    id: 'charge-vehicle',
    question: 'How do I charge the vehicle?',
    answer:
      'Ryd vehicles can be charged at any Ryd charging station or compatible public charging point. Open the charging port on the scooter, connect the charger cable, and follow the instructions on the charging station. The battery level is displayed on the dashboard and in the app. A full charge takes approximately 3-4 hours. Charging at Ryd stations during your rental is free of cost.',
    keywords: ['charge', 'charging', 'battery', 'plug in', 'power', 'charging station'],
    category: 'VEHICLE_PICKUP',
    priority: 'high',
  },
  {
    id: 'return-vehicle',
    question: 'Where do I return the vehicle?',
    answer:
      'Vehicles must be returned to any designated Ryd hub. Open the app and navigate to Dashboard > End Rental to see nearby return hubs on the map. Park the vehicle in the designated slot, plug in the charger if available, and complete the return checklist in the app by photographing the vehicle condition. Once submitted, the ride ends and any remaining charges are settled from your wallet.',
    keywords: ['return', 'drop off', 'end rental', 'hub', 'parking', 'drop vehicle'],
    category: 'VEHICLE_PICKUP',
    priority: 'high',
  },
  {
    id: 'return-late',
    question: 'What if I return the vehicle late?',
    answer:
      'Returning a vehicle after your plan expires incurs overtime charges of ₹15 per hour, billed to your wallet. If your wallet balance is insufficient, it may go negative. A 30-minute grace period is given after expiry — no charges apply within this window. Repeatedly late returns may affect your rider rating and eligibility for future rentals. If you anticipate a delay, extend your plan in advance from the app.',
    keywords: ['late', 'delay', 'overtime', 'penalty', 'late return', 'grace period'],
    category: 'VEHICLE_PICKUP',
    priority: 'medium',
  },

  // ── TROUBLESHOOTING ────────────────────────────────────────
  {
    id: 'account-suspended',
    question: 'App shows "Account Suspended" — what do I do?',
    answer:
      'Account suspension can occur due to unpaid dues, KYC expiry, policy violations, or suspicious activity. Open the app — you will see a banner with the specific reason for suspension. For unpaid dues, clear your negative wallet balance. For KYC issues, re-upload valid documents. If you believe the suspension is in error, tap "Appeal" on the suspension banner or contact support with your rider ID for a review. Most issues are resolved within 48 hours.',
    keywords: ['suspended', 'suspension', 'banned', 'locked', 'blocked', 'account disabled'],
    category: 'TROUBLESHOOTING',
    priority: 'high',
  },
  {
    id: 'offline-app',
    question: "I'm offline. Can I still use the app?",
    answer:
      'Ryd supports limited offline functionality. If you go offline during an active ride, the vehicle will continue to operate normally. Your ride data (distance, time) is stored locally and synced automatically when you reconnect. However, you cannot start new rides, top up your wallet, or access support features while offline. For safety, ensure you have internet access before starting a ride for real-time assistance features.',
    keywords: ['offline', 'no internet', 'no network', 'disconnected', 'airplane'],
    category: 'TROUBLESHOOTING',
    priority: 'medium',
  },
  {
    id: 'payment-failed',
    question: 'My payment failed. What should I do?',
    answer:
      "Payment failures are commonly caused by insufficient UPI balance, incorrect UPI PIN, or a temporary bank server issue. First, check your bank balance and try again. Ensure your UPI app is updated and linked to the correct bank account. If the amount was debited but the wallet wasn't credited, wait 5-10 minutes and check again. If the issue persists after 30 minutes, raise a support ticket with your transaction ID for a refund investigation.",
    keywords: ['payment failed', 'transaction failed', 'upi failed', 'debit', 'deducted'],
    category: 'TROUBLESHOOTING',
    priority: 'high',
  },
  {
    id: 'contact-support',
    question: 'How do I contact support?',
    answer:
      'You can reach Voltium support through multiple channels: In-app chat with the Voltium Assistant (available 24/7), email at support@voltium.in, or by calling our helpline at 1800-855-VOLT (toll-free) between 8 AM and 10 PM IST. For urgent issues, use the SOS button in the app. You can also create a support ticket from the Support section in the app, and our team will respond within 2 hours during business hours.',
    keywords: ['contact', 'support', 'help', 'call', 'email', 'helpline', 'reach'],
    category: 'TROUBLESHOOTING',
    priority: 'medium',
  },

  // ── SAFETY ─────────────────────────────────────────────────
  {
    id: 'emergency-procedure',
    question: 'What should I do in case of an emergency?',
    answer:
      'In any emergency situation, your safety comes first. Press and hold the SOS button in the Ryd app to immediately connect to our emergency helpline. If you are in danger, call 112 (national emergency number) first. Move to a safe location away from traffic. Do not attempt to move an injured person unless there is immediate danger. Once safe, report the incident in the app so Ryd can assist with documentation and support.',
    keywords: ['emergency', 'urgent', 'danger', 'safe', 'help now', 'critical'],
    category: 'SAFETY',
    priority: 'high',
  },
  {
    id: 'sos-button',
    question: 'How does the SOS button work?',
    answer:
      'The SOS button is accessible from any screen in the Ryd app. Press and hold the red SOS button for 3 seconds to trigger an emergency alert. This immediately sends your live GPS location, rider ID, and vehicle details to the Ryd emergency response team. A trained agent will call you within 60 seconds. The SOS feature works even with low battery (as long as the phone is on) and does not require an active internet connection — it uses SMS as a fallback.',
    keywords: ['sos', 'panic button', 'emergency button', 'alert', 'distress'],
    category: 'SAFETY',
    priority: 'high',
  },
  {
    id: 'accident-procedure',
    question: 'What happens if I have an accident?',
    answer:
      'If you are involved in an accident, first ensure everyone is safe and call 112 for medical assistance if needed. Then press the SOS button in the Ryd app. Ryd vehicles are insured, and our incident response team will guide you through the process. Document the scene with photos — vehicle damage, road conditions, and any injuries. Do not admit fault or negotiate with third parties. File an FIR at the nearest police station and share the copy with Ryd support.',
    keywords: ['accident', 'crash', 'collision', 'injury', 'damage', 'incident'],
    category: 'SAFETY',
    priority: 'high',
  },
  {
    id: 'report-defect',
    question: 'How to report a vehicle defect?',
    answer:
      'To report a vehicle defect, go to Dashboard > Active Ride > Report Issue. Select the defect category (electrical, mechanical, body damage, tyre issue, or other) and describe the problem. Attach photos if possible. The report is sent to our maintenance team, and you will be offered a vehicle swap at the nearest hub. If the defect makes the vehicle unsafe to ride, park it safely and use the app to request roadside assistance.',
    keywords: ['defect', 'issue', 'problem', 'broken', 'malfunction', 'maintenance'],
    category: 'SAFETY',
    priority: 'medium',
  },

  // ── REWARDS & REFERRALS ────────────────────────────────────
  {
    id: 'referral-program',
    question: 'How does the referral program work?',
    answer:
      "Ryd's referral program rewards you for bringing new riders. Go to Profile > Refer & Earn to get your unique referral code or link. Share it with friends — when they sign up using your code and complete their first rental, you both receive ₹100 wallet credit. There is no limit to the number of referrals you can make. Track your referrals and earned rewards in the Referral section of the app.",
    keywords: ['referral', 'refer', 'invite', 'friend', 'code', 'refer and earn'],
    category: 'REWARDS_REFERRALS',
    priority: 'medium',
  },
  {
    id: 'loyalty-streak',
    question: 'What is the loyalty streak?',
    answer:
      'The loyalty streak tracks your consecutive rental days. Ride every day without a gap to build your streak — at 7 days you earn a Bronze badge and ₹50 cashback, at 14 days a Silver badge and ₹150 cashback, and at 30 days a Gold badge with ₹500 cashback plus priority vehicle selection. Missing even one day resets your streak to zero, so consistency is key. Your current streak and rewards are visible on the Rewards screen.',
    keywords: [
      'loyalty',
      'streak',
      'badge',
      'consecutive',
      'daily ride',
      'gold',
      'silver',
      'bronze',
    ],
    category: 'REWARDS_REFERRALS',
    priority: 'low',
  },
  {
    id: 'earn-rewards',
    question: 'How do I earn rewards?',
    answer:
      'Ryd offers several ways to earn rewards: complete referral sign-ups (₹100 each), maintain payment streaks (cashback after 7 consecutive on-time payments), build loyalty streaks through daily rides (badge-based cashback), and participate in seasonal promotions and challenges announced via in-app notifications. All earned rewards are credited directly to your wallet and can be used for rental payments.',
    keywords: ['rewards', 'earn', 'cashback', 'points', 'benefits', 'perks'],
    category: 'REWARDS_REFERRALS',
    priority: 'low',
  },
];
