import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';

// Helper: Convert rupees to paise
const paise = (rupees: number) => Math.round(rupees * 100);

async function main() {
  console.log('Seeding database...');

  // ==================== ADMIN ACCOUNTS ====================
  // Hash passwords properly (PBKDF2-SHA256)
  const hashedAdminPw = await hashPassword('admin123');

  const superAdmin = await db.admin.upsert({
    where: { email: 'superadmin@voltium.in' },
    update: {},
    create: {
      email: 'superadmin@voltium.in',
      password: hashedAdminPw,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  await db.admin.upsert({
    where: { email: 'admin@voltium.in' },
    update: {},
    create: {
      email: 'admin@voltium.in',
      password: hashedAdminPw,
      name: 'Rajesh Kumar',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  await db.admin.upsert({
    where: { email: 'ops@voltium.in' },
    update: {},
    create: {
      email: 'ops@voltium.in',
      password: hashedAdminPw,
      name: 'Priya Singh',
      role: 'OPERATIONS_ADMIN',
      isActive: true,
    },
  });
  console.log('Created admin accounts (passwords hashed)');

  // ==================== HUBS ====================
  await db.hub.upsert({
    where: { id: 'hub-delhi-central' },
    update: {},
    create: {
      id: 'hub-delhi-central',
      name: 'New Delhi Central',
      location: 'Connaught Place, New Delhi',
      city: 'Delhi',
      isActive: true,
    },
  });
  await db.hub.upsert({
    where: { id: 'hub-delhi-east' },
    update: {},
    create: {
      id: 'hub-delhi-east',
      name: 'East Delhi Hub',
      location: 'Laxmi Nagar, Delhi',
      city: 'Delhi',
      isActive: true,
    },
  });
  await db.hub.upsert({
    where: { id: 'hub-gurgaon' },
    update: {},
    create: {
      id: 'hub-gurgaon',
      name: 'Gurgaon Sector 29',
      location: 'Sector 29, Gurgaon',
      city: 'Gurgaon',
      isActive: true,
    },
  });
  console.log('Created hubs');

  // ==================== VEHICLES ====================
  const vehicles = [
    {
      id: 'vh-001',
      vehicleId: 'VF-VH-001',
      vehicleNumber: 'DL 04 AB 1234',
      model: 'Volt MX-4',
      batteryPartner: 'Battery Smart',
      status: 'AVAILABLE',
      hubId: 'hub-delhi-central',
    },
    {
      id: 'vh-002',
      vehicleId: 'VF-VH-002',
      vehicleNumber: 'DL 04 AB 1235',
      model: 'Volt MX-4',
      batteryPartner: 'Mooving',
      status: 'ASSIGNED',
      hubId: 'hub-delhi-central',
    },
    {
      id: 'vh-003',
      vehicleId: 'VF-VH-003',
      vehicleNumber: 'DL 04 AB 1236',
      model: 'Volt MX-3',
      batteryPartner: 'Battery Smart',
      status: 'MAINTENANCE',
      hubId: 'hub-delhi-central',
    },
    {
      id: 'vh-004',
      vehicleId: 'VF-VH-004',
      vehicleNumber: 'DL 04 CD 5678',
      model: 'Ather 450X Gen3',
      batteryPartner: 'Battery Smart',
      status: 'AVAILABLE',
      hubId: 'hub-delhi-east',
    },
    {
      id: 'vh-005',
      vehicleId: 'VF-VH-005',
      vehicleNumber: 'DL 04 CD 5679',
      model: 'Ather 450X Gen3',
      batteryPartner: 'Mooving',
      status: 'ACTIVE_RENTAL',
      hubId: 'hub-delhi-east',
    },
    {
      id: 'vh-006',
      vehicleId: 'VF-VH-006',
      vehicleNumber: 'HR 26 AB 4321',
      model: 'Volt MX-4',
      batteryPartner: 'Battery Smart',
      status: 'AVAILABLE',
      hubId: 'hub-gurgaon',
    },
    {
      id: 'vh-007',
      vehicleId: 'VF-VH-007',
      vehicleNumber: 'HR 26 AB 4322',
      model: 'Volt MX-3',
      batteryPartner: 'Mooving',
      status: 'RETIRED',
      hubId: 'hub-gurgaon',
    },
    {
      id: 'vh-008',
      vehicleId: 'VF-VH-008',
      vehicleNumber: 'DL 04 EF 9012',
      model: 'Ather 450X Gen3',
      batteryPartner: 'Battery Smart',
      status: 'AVAILABLE',
      hubId: 'hub-delhi-central',
    },
  ];
  for (const v of vehicles) {
    await db.vehicle.upsert({ where: { vehicleId: v.vehicleId }, update: {}, create: v });
  }
  console.log('Created vehicles');

  // ==================== RENTAL PLANS ====================
  // Prices now stored in paise
  const plans = [
    {
      id: 'plan-daily',
      name: 'Daily Plan',
      type: 'DAILY' as const,
      price: paise(399),
      durationDays: 1,
      description: 'Perfect for short trips and first-time riders',
      isActive: true,
    },
    {
      id: 'plan-weekly',
      name: 'Weekly Premium',
      type: 'WEEKLY' as const,
      price: paise(2199),
      durationDays: 7,
      description: 'Best value for regular delivery riders',
      isActive: true,
    },
    {
      id: 'plan-weekly-lite',
      name: 'Weekly Lite',
      type: 'WEEKLY' as const,
      price: paise(1599),
      durationDays: 7,
      description: 'Budget-friendly weekly option',
      isActive: true,
    },
    {
      id: 'plan-monthly',
      name: 'Monthly Pro',
      type: 'MONTHLY' as const,
      price: paise(7499),
      durationDays: 30,
      description: 'Maximum savings for committed riders',
      isActive: true,
    },
  ];
  for (const p of plans) {
    await db.rentalPlan.upsert({ where: { id: p.id }, update: {}, create: p });
  }
  console.log('Created rental plans');

  // ==================== SHIFTS ====================
  const shifts = [
    {
      id: 'shift-morning',
      name: 'Morning',
      startTime: '06:00',
      endTime: '14:00',
      maxBookings: 5,
      isActive: true,
    },
    {
      id: 'shift-afternoon',
      name: 'Afternoon',
      startTime: '14:00',
      endTime: '22:00',
      maxBookings: 5,
      isActive: true,
    },
    {
      id: 'shift-night',
      name: 'Night',
      startTime: '22:00',
      endTime: '06:00',
      maxBookings: 3,
      isActive: true,
    },
  ];
  for (const s of shifts) {
    await db.shift.upsert({ where: { id: s.id }, update: {}, create: s });
  }
  console.log('Created shifts');

  // ==================== TEAM LEADERS ====================
  const teamLeaders = [
    {
      id: 'tl-1',
      name: 'Amit Sharma',
      phone: '9876512345',
      email: 'amit.sharma@voltium.in',
      isActive: true,
    },
    {
      id: 'tl-2',
      name: 'Suresh Patel',
      phone: '9876567890',
      email: 'suresh.patel@voltium.in',
      isActive: true,
    },
    {
      id: 'tl-3',
      name: 'Rahul Kumar',
      phone: '9876511111',
      email: 'rahul.kumar@voltium.in',
      isActive: true,
    },
    {
      id: 'tl-4',
      name: 'Vikram Singh',
      phone: '9876522222',
      email: 'vikram.singh@voltium.in',
      isActive: false,
    },
  ];
  for (const tl of teamLeaders) {
    await db.teamLeader.upsert({ where: { id: tl.id }, update: {}, create: tl });
  }
  console.log('Created team leaders');

  // ==================== RIDERS (normalized) ====================
  // Rider core records
  const riders = [
    {
      id: 'rider-1',
      riderId: 'VF-RD-001',
      phone: '9999900001',
      fullName: 'Arjun Sharma',
      email: 'arjun.sharma@gmail.com',
      fatherName: 'Rajesh Sharma',
      dob: '15-05-1998',
      intent: 'deliver',
      state: 'POST_ACTIVE',
      rentalStatus: 'ACTIVE',
      assignedVehicle: 'VF-VH-002',
      pickupHub: 'New Delhi Central',
      teamLeader: 'Amit Sharma',
      referralCode: 'ARJUN2024',
      accountStatus: 'ACTIVE',
      planStatus: 'ACTIVE',
      currentPlan: 'Weekly Premium',
      planStartDate: new Date(Date.now() - 2 * 86400000),
      planEndDate: new Date(Date.now() + 5 * 86400000),
      locationGranted: true,
      batteryGranted: true,
      contactsGranted: true,
      phoneGranted: true,
      kycDone: true,
      depositDone: true,
      planDone: true,
      pickupDone: true,
    },
    {
      id: 'rider-2',
      riderId: 'VF-RD-002',
      phone: '9999900002',
      fullName: 'Deepak Verma',
      email: 'deepak.verma@gmail.com',
      fatherName: 'Manoj Verma',
      dob: '20-11-2000',
      intent: 'deliver',
      state: 'PRE_ACTIVE',
      rentalStatus: 'NONE',
      pickupHub: 'East Delhi Hub',
      referralCode: 'DEEPAK2024',
      accountStatus: 'PRE_ACTIVE',
      locationGranted: true,
      batteryGranted: false,
    },
    {
      id: 'rider-3',
      riderId: 'VF-RD-003',
      phone: '9999900003',
      fullName: 'Priyanka Gupta',
      email: 'priyanka.gupta@gmail.com',
      fatherName: 'Anil Gupta',
      dob: '10-03-1996',
      intent: 'personal',
      state: 'POST_ACTIVE',
      rentalStatus: 'ACTIVE',
      assignedVehicle: 'VF-VH-005',
      pickupHub: 'Gurgaon Sector 29',
      teamLeader: 'Suresh Patel',
      referralCode: 'PRIYA2024',
      referredBy: 'ARJUN2024',
      accountStatus: 'ACTIVE',
      planStatus: 'ACTIVE',
      currentPlan: 'Monthly Pro',
      planStartDate: new Date(Date.now() - 15 * 86400000),
      planEndDate: new Date(Date.now() + 15 * 86400000),
      locationGranted: true,
      batteryGranted: true,
      cameraGranted: true,
      phoneGranted: true,
      kycDone: true,
      depositDone: true,
      planDone: true,
      pickupDone: true,
    },
    {
      id: 'rider-4',
      riderId: 'VF-RD-004',
      phone: '9999900004',
      fullName: 'Rohit Mehta',
      email: 'rohit.mehta@gmail.com',
      dob: '25-08-1995',
      intent: 'deliver',
      state: 'SUSPENDED',
      rentalStatus: 'RETURN_REQUIRED',
      assignedVehicle: 'VF-VH-003',
      pickupHub: 'New Delhi Central',
      referralCode: 'ROHIT2024',
      accountStatus: 'SUSPENDED',
      planStatus: 'EXPIRED',
      locationGranted: true,
      kycDone: true,
      depositDone: true,
      planDone: true,
      pickupDone: true,
    },
    {
      id: 'rider-5',
      riderId: 'VF-RD-005',
      phone: '9999900005',
      fullName: 'Neha Singh',
      email: 'neha.singh@gmail.com',
      dob: '05-12-1999',
      intent: 'deliver',
      state: 'ONBOARDING',
      referralCode: 'NEHA2024',
      accountStatus: 'PRE_ACTIVE',
      locationGranted: true,
    },
    {
      id: 'rider-6',
      riderId: 'VF-RD-006',
      phone: '9999900006',
      fullName: 'Manish Kumar',
      email: 'manish.kumar@gmail.com',
      dob: '18-06-1997',
      intent: 'personal',
      state: 'POST_ACTIVE',
      rentalStatus: 'ACTIVE',
      assignedVehicle: 'VF-VH-004',
      pickupHub: 'East Delhi Hub',
      teamLeader: 'Rahul Kumar',
      referralCode: 'MANISH2024',
      accountStatus: 'ACTIVE',
      planStatus: 'ACTIVE',
      currentPlan: 'Weekly Premium',
      planStartDate: new Date(Date.now() - 5 * 86400000),
      planEndDate: new Date(Date.now() + 2 * 86400000),
      locationGranted: true,
      batteryGranted: true,
      contactsGranted: true,
      callLogsGranted: true,
      micGranted: true,
      cameraGranted: true,
      phoneGranted: true,
      kycDone: true,
      depositDone: true,
      planDone: true,
      pickupDone: true,
    },
  ];

  for (const r of riders) {
    const {
      state,
      rentalStatus,
      accountStatus,
      planStatus,
      kycDone,
      depositDone,
      planDone,
      pickupDone,
      ...cleanedRider
    } = r as any;

    let lifecycleStatus = 'NEW';
    if (state === 'POST_ACTIVE') {
      lifecycleStatus = 'ACTIVE';
    } else if (state === 'PRE_ACTIVE') {
      lifecycleStatus = 'NEW';
    } else if (state === 'SUSPENDED') {
      lifecycleStatus = 'SUSPENDED';
    } else if (state === 'ONBOARDING') {
      lifecycleStatus = 'PROFILE_SUBMITTED';
    }

    const riderData = {
      ...cleanedRider,
      lifecycleStatus,
      kycDoneAt: kycDone ? new Date() : null,
      depositDoneAt: depositDone ? new Date() : null,
      planDoneAt: planDone ? new Date() : null,
      pickedUpAt: pickupDone ? new Date() : null,
      registrationDoneAt: kycDone ? new Date() : null,
    };

    await db.rider.upsert({ where: { riderId: r.riderId }, update: {}, create: riderData });
  }
  console.log('Created riders');

  // ==================== KYC PROFILES ====================
  const kycProfiles = [
    {
      riderId: 'rider-1',
      status: 'APPROVED',
      aadhaarNumber: '1234-5678-9012',
      panNumber: 'ABCDE1234F',
      bankName: 'SBI',
      accountNumber: '1234567890',
      ifscCode: 'SBIN0001234',
      profilePhoto: 'https://placehold.co/400x400/0053c1/white?text=Arjun+Sharma',
      aadhaarFront: 'https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Front',
      aadhaarBack: 'https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Back',
      panCard: 'https://placehold.co/600x400/f3f4f6/191c1e?text=PAN+Card',
      signature: 'https://placehold.co/400x200/ffffff/000000?text=Arjun+Sig',
    },
    {
      riderId: 'rider-3',
      status: 'APPROVED',
      aadhaarNumber: '9876-5432-1098',
      panNumber: 'FGHIJ5678K',
      bankName: 'HDFC',
      accountNumber: '9876543210',
      ifscCode: 'HDFC0005678',
      profilePhoto: 'https://placehold.co/400x400/2f6dde/white?text=Priyanka+Gupta',
      aadhaarFront: 'https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Front',
      aadhaarBack: 'https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Back',
      panCard: 'https://placehold.co/600x400/f3f4f6/191c1e?text=PAN+Card',
      signature: 'https://placehold.co/400x200/ffffff/000000?text=Priyanka+Sig',
    },
    {
      riderId: 'rider-4',
      status: 'APPROVED',
      aadhaarNumber: '1111-2222-3333',
      panNumber: 'LMNOP9012Q',
      bankName: 'ICICI',
      accountNumber: '1122334455',
      ifscCode: 'ICIC0009012',
      profilePhoto: 'https://placehold.co/400x400/565e74/white?text=Rohit+Mehta',
      aadhaarFront: 'https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Front',
      aadhaarBack: 'https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Back',
      panCard: 'https://placehold.co/600x400/f3f4f6/191c1e?text=PAN+Card',
      signature: 'https://placehold.co/400x200/ffffff/000000?text=Rohit+Sig',
    },
    {
      riderId: 'rider-6',
      status: 'APPROVED',
      aadhaarNumber: '4444-5555-6666',
      panNumber: 'RSTUV3456W',
      bankName: 'Axis',
      accountNumber: '5566778899',
      ifscCode: 'UTIB0003456',
      profilePhoto: 'https://placehold.co/400x400/16a34a/white?text=Manish+Kumar',
      aadhaarFront: 'https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Front',
      aadhaarBack: 'https://placehold.co/600x400/f3f4f6/191c1e?text=Aadhaar+Back',
      panCard: 'https://placehold.co/600x400/f3f4f6/191c1e?text=PAN+Card',
      signature: 'https://placehold.co/400x200/ffffff/000000?text=Manish+Sig',
    },
  ];
  for (const kyc of kycProfiles) {
    await db.kycProfile.upsert({ where: { riderId: kyc.riderId }, update: kyc, create: kyc });
  }
  console.log('Created KYC profiles');

  // ==================== GUARANTORS ====================
  const guarantors = [
    {
      riderId: 'rider-1',
      status: 'APPROVED',
      name: 'Vikram Sharma',
      relation: 'Father',
      phone: '9876543210',
      dob: '20-03-1970',
    },
    {
      riderId: 'rider-3',
      status: 'APPROVED',
      name: 'Rakesh Gupta',
      relation: 'Brother',
      phone: '9876587654',
      dob: '12-07-1993',
    },
    {
      riderId: 'rider-4',
      status: 'APPROVED',
      name: 'Sunil Mehta',
      relation: 'Father',
      phone: '9876511100',
      dob: '08-11-1968',
    },
    {
      riderId: 'rider-6',
      status: 'APPROVED',
      name: 'Ravi Kumar',
      relation: 'Uncle',
      phone: '9876522233',
      dob: '25-01-1975',
    },
  ];
  for (const g of guarantors) {
    await db.guarantor.upsert({ where: { riderId: g.riderId }, update: {}, create: g });
  }
  console.log('Created guarantors');

  // ==================== WALLETS ====================
  // All amounts in paise (₹2500 = 250000)
  const wallets = [
    {
      riderId: 'rider-1',
      balanceInPaise: paise(2500),
      securityDeposit: paise(5000),
      depositStatus: 'APPROVED',
      paymentStreak: 12,
    },
    {
      riderId: 'rider-2',
      balanceInPaise: 0,
      securityDeposit: 0,
      depositStatus: 'PENDING',
      paymentStreak: 0,
    },
    {
      riderId: 'rider-3',
      balanceInPaise: paise(1200),
      securityDeposit: paise(5000),
      depositStatus: 'APPROVED',
      paymentStreak: 8,
    },
    {
      riderId: 'rider-4',
      balanceInPaise: paise(200),
      securityDeposit: paise(5000),
      depositStatus: 'APPROVED',
      paymentStreak: 3,
    },
    {
      riderId: 'rider-5',
      balanceInPaise: 0,
      securityDeposit: 0,
      depositStatus: 'PENDING',
      paymentStreak: 0,
    },
    {
      riderId: 'rider-6',
      balanceInPaise: paise(3800),
      securityDeposit: paise(5000),
      depositStatus: 'APPROVED',
      paymentStreak: 20,
    },
  ];
  for (const w of wallets) {
    await db.wallet.upsert({ where: { riderId: w.riderId }, update: {}, create: w });
  }
  console.log('Created wallets');

  // ==================== TRANSACTIONS ====================
  // Amounts in paise
  const transactions = [
    {
      riderId: 'rider-1',
      type: 'CREDIT',
      amount: paise(3000),
      purpose: 'TOP_UP',
      reason: 'Wallet Top-up',
      method: 'UPI',
      status: 'APPROVED',
      createdAt: new Date(Date.now() - 7 * 86400000),
      description: 'Wallet top-up via UPI',
    },
    {
      riderId: 'rider-1',
      type: 'DEBIT',
      amount: paise(2199),
      purpose: 'RENTAL_FEE',
      reason: 'Weekly Premium Plan',
      method: 'SYSTEM',
      status: 'APPROVED',
      createdAt: new Date(Date.now() - 2 * 86400000),
      description: 'Weekly Premium + GST',
    },
    {
      riderId: 'rider-1',
      type: 'CREDIT',
      amount: paise(500),
      purpose: 'REFUND',
      reason: 'Late refund',
      method: 'SYSTEM',
      status: 'APPROVED',
      createdAt: new Date(Date.now() - 86400000),
      description: 'Refund for service delay',
    },
    {
      riderId: 'rider-1',
      type: 'DEBIT',
      amount: paise(50),
      purpose: 'PENALTY',
      reason: 'Late return fee',
      method: 'SYSTEM',
      status: 'PENDING',
      createdAt: new Date(Date.now() - 43200000),
      description: 'Late return penalty (2 hours)',
    },
    {
      riderId: 'rider-2',
      type: 'CREDIT',
      amount: paise(5000),
      purpose: 'SECURITY_DEPOSIT',
      reason: 'Security Deposit',
      method: 'UPI',
      status: 'PENDING',
      createdAt: new Date(Date.now() - 3 * 86400000),
      description: 'Security deposit payment',
    },
    {
      riderId: 'rider-3',
      type: 'CREDIT',
      amount: paise(7499),
      purpose: 'TOP_UP',
      reason: 'Monthly Plan Top-up',
      method: 'UPI',
      status: 'APPROVED',
      createdAt: new Date(Date.now() - 15 * 86400000),
      description: 'Monthly Pro plan payment',
    },
    {
      riderId: 'rider-3',
      type: 'CREDIT',
      amount: paise(500),
      purpose: 'REWARD',
      reason: 'Referral Bonus',
      method: 'SYSTEM',
      status: 'APPROVED',
      createdAt: new Date(Date.now() - 10 * 86400000),
      description: 'Referral reward: NEHA2024',
    },
    {
      riderId: 'rider-4',
      type: 'CREDIT',
      amount: paise(5000),
      purpose: 'SECURITY_DEPOSIT',
      reason: 'Security Deposit',
      method: 'UPI',
      status: 'APPROVED',
      createdAt: new Date(Date.now() - 30 * 86400000),
      description: 'Security deposit payment',
    },
    {
      riderId: 'rider-6',
      type: 'CREDIT',
      amount: paise(5000),
      purpose: 'SECURITY_DEPOSIT',
      reason: 'Security Deposit',
      method: 'UPI',
      status: 'APPROVED',
      createdAt: new Date(Date.now() - 45 * 86400000),
      description: 'Security deposit payment',
    },
    {
      riderId: 'rider-6',
      type: 'CREDIT',
      amount: paise(4398),
      purpose: 'TOP_UP',
      reason: 'Wallet Top-up',
      method: 'UPI',
      status: 'PENDING',
      createdAt: new Date(Date.now() - 21600000),
      description: 'Wallet top-up via UPI',
    },
  ];
  for (const t of transactions) {
    let purpose = t.purpose;
    if (purpose === 'RENTAL_FEE') {
      purpose = 'RENT_PAYMENT';
    } else if (purpose === 'PENALTY') {
      purpose = 'ADMIN_ADJUSTMENT';
    }
    await db.transaction.create({
      data: {
        ...t,
        purpose: purpose as any,
      },
    });
  }
  console.log('Created transactions');

  // ==================== SUPPORT TICKETS ====================
  const tickets = [
    {
      ticketId: '#1001',
      riderId: 'rider-1',
      category: 'VEHICLE',
      priority: 'HIGH',
      subject: 'Battery not charging',
      message: 'Vehicle VF-VH-002 battery is not charging at Battery Smart station.',
      status: 'IN_PROGRESS',
      assignedTo: 'admin@voltium.in',
      createdAt: new Date(Date.now() - 2 * 86400000),
    },
    {
      ticketId: '#1002',
      riderId: 'rider-3',
      category: 'PAYMENT',
      priority: 'MEDIUM',
      subject: 'Amount deducted but plan not activated',
      message: 'I paid ₹7499 for Monthly Pro but it shows as pending.',
      status: 'OPEN',
      createdAt: new Date(Date.now() - 86400000),
    },
    {
      ticketId: '#1003',
      riderId: 'rider-4',
      category: 'GENERAL',
      priority: 'LOW',
      subject: 'KYC update request',
      message: 'I need to update my address details.',
      status: 'RESOLVED',
      assignedTo: 'ops@voltium.in',
      resolvedAt: new Date(Date.now() - 5 * 86400000),
      createdAt: new Date(Date.now() - 7 * 86400000),
    },
    {
      ticketId: '#1004',
      riderId: 'rider-2',
      category: 'TECHNICAL',
      priority: 'MEDIUM',
      subject: 'App crashing on OTP screen',
      message: 'The app crashes every time I try to enter OTP.',
      status: 'OPEN',
      createdAt: new Date(Date.now() - 14400000),
    },
    {
      ticketId: '#1005',
      riderId: 'rider-6',
      category: 'TROUBLESHOOTER',
      priority: 'HIGH',
      subject: 'Vehicle making unusual noise',
      message: 'Vehicle VF-VH-004 making grinding noise from rear wheel.',
      status: 'IN_PROGRESS',
      assignedTo: 'admin@voltium.in',
      createdAt: new Date(Date.now() - 28800000),
    },
  ];
  for (const t of tickets) {
    await db.supportTicket.upsert({ where: { ticketId: t.ticketId }, update: {}, create: t });
  }
  console.log('Created tickets');

  // ==================== OFFERS ====================
  const offers = [
    {
      id: 'offer-1',
      title: 'Zero Processing Fees',
      description: 'No processing fees on your next weekly lease renewal.',
      icon: 'Zap',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 30 * 86400000),
      isActive: true,
      isSponsored: true,
    },
    {
      id: 'offer-2',
      title: 'Refer & Earn ₹500',
      description: 'Invite friends and earn ₹500 for each successful referral.',
      icon: 'Gift',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 90 * 86400000),
      isActive: true,
      isSponsored: false,
    },
    {
      id: 'offer-3',
      title: 'Weekend Warrior',
      description: 'Get 20% off on Daily Plans booked for weekends.',
      icon: 'Calendar',
      validFrom: new Date(Date.now() - 7 * 86400000),
      validUntil: new Date(Date.now() + 60 * 86400000),
      isActive: true,
      isSponsored: false,
    },
    {
      id: 'offer-4',
      title: 'First Ride Free',
      description: 'New riders get their first daily plan completely free.',
      icon: 'Star',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 15 * 86400000),
      isActive: false,
      isSponsored: true,
    },
  ];
  for (const o of offers) {
    await db.offer.upsert({ where: { id: o.id }, update: {}, create: o });
  }
  console.log('Created offers');

  // ==================== COUPONS ====================
  const coupons = [
    {
      code: 'WELCOME100',
      description: '₹100 off for new riders',
      discountType: 'fixed',
      discountValue: 100,
      minAmount: 500,
      maxUses: 1000,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 90 * 86400000),
      isActive: true,
    },
    {
      code: 'WEEKEND20',
      description: '20% off on weekend plans',
      discountType: 'percentage',
      discountValue: 20,
      minAmount: 399,
      maxUses: 500,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 60 * 86400000),
      isActive: true,
    },
    {
      code: 'REFER500',
      description: 'Flat ₹500 off on weekly plan',
      discountType: 'fixed',
      discountValue: 500,
      minAmount: 1599,
      maxUses: 200,
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 45 * 86400000),
      isActive: true,
    },
    {
      code: 'EXPIRED50',
      description: '₹50 off - expired',
      discountType: 'fixed',
      discountValue: 50,
      minAmount: 200,
      maxUses: 100,
      validFrom: new Date(Date.now() - 60 * 86400000),
      validUntil: new Date(Date.now() - 10 * 86400000),
      isActive: false,
    },
  ];
  for (const c of coupons) {
    await db.coupon.upsert({
      where: { code: c.code },
      update: {},
      create: {
        ...c,
        discountType: c.discountType.toUpperCase() as any,
        currentUses: Math.floor(Math.random() * 50),
      },
    });
  }
  console.log('Created coupons');

  // ==================== REWARDS ====================
  const rewards = [
    {
      riderId: 'rider-1',
      title: 'Streak Bonus - 12 weeks',
      points: 600,
      createdAt: new Date(Date.now() - 2 * 86400000),
    },
    {
      riderId: 'rider-1',
      title: 'Referral Bonus',
      points: 500,
      createdAt: new Date(Date.now() - 10 * 86400000),
    },
    {
      riderId: 'rider-3',
      title: 'Streak Bonus - 8 weeks',
      points: 400,
      createdAt: new Date(Date.now() - 5 * 86400000),
    },
    {
      riderId: 'rider-3',
      title: 'Referral Bonus - Deepak joined',
      points: 500,
      createdAt: new Date(Date.now() - 15 * 86400000),
    },
    {
      riderId: 'rider-6',
      title: 'Streak Bonus - 20 weeks',
      points: 1000,
      createdAt: new Date(Date.now() - 86400000),
    },
    {
      riderId: 'rider-6',
      title: 'Loyalty Champion',
      points: 200,
      createdAt: new Date(Date.now() - 7 * 86400000),
    },
  ];
  for (const r of rewards) {
    await db.reward.create({ data: r });
  }
  console.log('Created rewards');

  // ==================== NOTIFICATIONS ====================
  const notifications = [
    {
      riderId: 'rider-1',
      title: 'Plan Expiring Soon',
      message: 'Your Weekly Premium plan expires in 5 days. Renew now.',
      type: 'ALERT',
      isRead: false,
    },
    {
      riderId: 'rider-1',
      title: 'Payment Received',
      message: 'Your wallet top-up of ₹3,000 has been credited.',
      type: 'PAYMENT',
      isRead: true,
    },
    {
      riderId: 'rider-3',
      title: 'Reward Earned!',
      message: 'You earned 500 points for referring a friend.',
      type: 'PROMOTION',
      isRead: false,
    },
    {
      riderId: 'rider-2',
      title: 'KYC Pending',
      message: 'Please complete your KYC verification.',
      type: 'INFO',
      isRead: false,
    },
    {
      riderId: 'rider-4',
      title: 'Account Suspended',
      message: 'Your account has been suspended.',
      type: 'ALERT',
      isRead: true,
    },
    {
      riderId: 'rider-6',
      title: 'Maintenance Reminder',
      message: 'Vehicle VF-VH-004 is due for scheduled maintenance.',
      type: 'INFO',
      isRead: false,
    },
  ];
  for (const n of notifications) {
    await db.notification.create({ data: n });
  }
  console.log('Created notifications');

  // ==================== SETTINGS ====================
  const settings = [
    { key: 'dailyRent', value: String(paise(399)) },
    { key: 'weeklyRent', value: String(paise(2199)) },
    { key: 'monthlyRent', value: String(paise(7499)) },
    { key: 'securityDeposit', value: String(paise(5000)) },
    { key: 'lateFee', value: String(paise(50)) },
    { key: 'referralBonus', value: String(paise(500)) },
    { key: 'autoApproveKYC', value: 'false' },
    { key: 'emailNotifications', value: 'true' },
    { key: 'smsNotifications', value: 'true' },
    { key: 'gracePeriodHours', value: '24' },
    { key: 'BACKUP_LOCK_STATUS', value: 'NONE' },
    { key: 'BACKUP_LOCK_STARTED_AT', value: '' },
    { key: 'BACKUP_LOCK_OWNER', value: '' },
  ];
  for (const s of settings) {
    await db.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log('Created settings');

  // ==================== SYSTEM SETTINGS ====================
  const systemSettings = [
    {
      key: 'APP_PUBLIC_URL',
      value: 'http://localhost:8081',
      valueType: 'URL',
      category: 'APP_URLS',
      description: 'Public URL of the rider application website.',
    },
    {
      key: 'API_BASE_URL',
      value: 'http://localhost:8081/api',
      valueType: 'URL',
      category: 'APP_URLS',
      description: 'Base endpoint URL of the backend service APIs.',
    },
    {
      key: 'LOCAL_STORAGE_ROOT',
      value: 'D:/VoltiumServer/data/uploads',
      valueType: 'PATH',
      category: 'STORAGE',
      description: 'Local directory root path where rider uploaded files are stored.',
    },
    {
      key: 'BACKUP_ROOT',
      value: 'D:/VoltiumServer/data/backups',
      valueType: 'PATH',
      category: 'BACKUP',
      description: 'Local directory path where database and uploads backups are stored.',
    },
    {
      key: 'BACKUP_SECONDARY_ROOT',
      value: '',
      valueType: 'PATH',
      category: 'BACKUP',
      description: 'Optional secondary destination path (e.g. USB flash drive) for backups.',
    },
    {
      key: 'BACKUP_FREQUENCY',
      value: 'DAILY',
      valueType: 'STRING',
      category: 'BACKUP',
      description:
        'How often scheduled automatic backups are triggered (DAILY, WEEKLY, MONTHLY, MANUAL).',
    },
    {
      key: 'BACKUP_TIME_OF_DAY',
      value: '02:00',
      valueType: 'STRING',
      category: 'BACKUP',
      description: 'Hour and minute (HH:MM) in 24hr format when the backup triggers.',
    },
    {
      key: 'BACKUP_TIMEZONE',
      value: 'Asia/Kolkata',
      valueType: 'STRING',
      category: 'BACKUP',
      description: 'Timezone context to resolve the trigger time of day.',
    },
    {
      key: 'BACKUP_KEEP_DAILY',
      value: '7',
      valueType: 'NUMBER',
      category: 'BACKUP',
      description: 'Number of daily backups to preserve under retention policy.',
    },
    {
      key: 'BACKUP_KEEP_WEEKLY',
      value: '4',
      valueType: 'NUMBER',
      category: 'BACKUP',
      description: 'Number of weekly backups to preserve under retention policy.',
    },
    {
      key: 'BACKUP_KEEP_MONTHLY',
      value: '3',
      valueType: 'NUMBER',
      category: 'BACKUP',
      description: 'Number of monthly backups to preserve under retention policy.',
    },
    {
      key: 'BACKUP_KEEP_MANUAL',
      value: '10',
      valueType: 'NUMBER',
      category: 'BACKUP',
      description: 'Max limit of manual backups to retain before pruning.',
    },
    {
      key: 'BACKUP_MINIMUM_FREE_DISK_GB',
      value: '10',
      valueType: 'NUMBER',
      category: 'BACKUP',
      description: 'Minimum remaining disk space in GB required to trigger a backup.',
    },
    {
      key: 'MAINTENANCE_MODE',
      value: 'false',
      valueType: 'BOOLEAN',
      category: 'SERVER',
      description:
        'Whether the application is currently in maintenance mode blocking rider operations.',
    },
    {
      key: 'MAINTENANCE_MESSAGE',
      value: 'System is currently under maintenance. Please check back later.',
      valueType: 'STRING',
      category: 'SERVER',
      description: 'Banner message shown to riders when maintenance mode is active.',
    },
  ];

  for (const s of systemSettings) {
    await db.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log('Created system settings');

  // ==================== LEGAL DOCUMENTS ====================
  const legalDocs = [
    {
      type: 'terms',
      title: 'Terms of Service',
      content:
        '# Terms of Service\n\n**Last Updated:** October 15, 2024\n\n## 1. Acceptance of Terms\n\nBy accessing or using the Voltium platform, you agree to be bound by these Terms.\n\n## 2. Vehicle Rental\n\n### 2.1 Eligibility\n- Must be at least 18 years old\n- Must hold a valid driving license\n- Must complete KYC verification\n\n## 3. Payments\n\n### 3.1 Security Deposit\n- ₹5,000 refundable security deposit\n- Refunded within 7 business days\n\n### 3.2 Late Fees\n- ₹50/hour after grace period',
    },
    {
      type: 'privacy',
      title: 'Privacy Policy',
      content:
        '# Privacy Policy\n\n## Information We Collect\n\n### Personal Information\n- Full name, email, phone number\n- Government ID details\n- Bank account details\n\n## Data Security\n- AES-256 encryption\n- Regular security audits',
    },
    {
      type: 'refund',
      title: 'Refund Policy',
      content:
        '# Refund Policy\n\n## Security Deposit\n- Processed within 7 business days\n- Deducted for damages or unpaid fees\n\n## Top-up Refunds\n- Unused wallet balance refundable\n- Processing: 5-7 business days',
    },
    {
      type: 'lease',
      title: 'Lease Agreement',
      content:
        '# Vehicle Lease Agreement\n\n## Parties\n- **Voltium Electric Mobility** (Lessor)\n- **Rider** (Lessee)\n\n## Terms\n- Security Deposit: ₹5,000\n- Maintenance handled by Lessor\n- 24-hour roadside assistance',
    },
  ];
  for (const doc of legalDocs) {
    await db.legalDocument.upsert({ where: { type: doc.type }, update: {}, create: doc });
  }
  console.log('Created legal documents');

  // ==================== FAQs ====================
  const faqs = [
    {
      id: 'faq-1',
      question: 'How do I request a battery swap?',
      answer: 'Go to Support > Battery Issue. Our team will reach you within 30 minutes.',
      category: 'Vehicle',
      order: 1,
      isActive: true,
    },
    {
      id: 'faq-2',
      question: 'What is the late fee policy?',
      answer: '₹50 per hour after grace period. Maximum 24 hours worth.',
      category: 'Payments',
      order: 2,
      isActive: true,
    },
    {
      id: 'faq-3',
      question: 'How long do refunds take?',
      answer: '5-7 business days, credited to original payment method.',
      category: 'Payments',
      order: 3,
      isActive: true,
    },
    {
      id: 'faq-4',
      question: 'What happens in case of vehicle damage?',
      answer: 'Report immediately through the app. Minor scratches covered by deposit.',
      category: 'Vehicle',
      order: 4,
      isActive: true,
    },
    {
      id: 'faq-5',
      question: 'How do I update KYC documents?',
      answer: 'Profile > Edit Profile > KYC Documents. Verification takes 24-48 hours.',
      category: 'Account',
      order: 5,
      isActive: true,
    },
    {
      id: 'faq-6',
      question: 'Can I switch plans mid-cycle?',
      answer: 'Yes! Upgrade anytime. Remaining value prorated to new plan.',
      category: 'Plans',
      order: 6,
      isActive: true,
    },
    {
      id: 'faq-7',
      question: 'What if my vehicle breaks down?',
      answer: 'Call 1800-VOLT. Replacement vehicle within 2 hours. No charge for downtime.',
      category: 'Vehicle',
      order: 7,
      isActive: true,
    },
    {
      id: 'faq-8',
      question: 'How does the referral program work?',
      answer: 'Share your code. Both earn ₹500 when referred friend completes first rental.',
      category: 'Rewards',
      order: 8,
      isActive: true,
    },
  ];
  for (const faq of faqs) {
    await db.faq.upsert({ where: { id: faq.id }, update: {}, create: faq });
  }
  console.log('Created FAQs');

  console.log('\n✅ Database seeded successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('  Super Admin: superadmin@voltium.in / admin123');
  console.log('  Admin: admin@voltium.in / admin123');
  console.log('  Admin: ops@voltium.in / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
