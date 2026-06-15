// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Ryd';

  @override
  String get common_loading => 'Loading...';

  @override
  String get common_error => 'Something went wrong';

  @override
  String get common_retry => 'Retry';

  @override
  String get common_offline => 'You\'re Offline';

  @override
  String get common_offlineMessage =>
      'Data shown may be outdated. Actions will sync when you reconnect.';

  @override
  String get common_syncing => 'Syncing...';

  @override
  String common_pendingSync(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count pending actions will sync',
      two: '$count pending actions will sync',
      one: '1 pending action will sync',
      zero: '',
    );
    return '$_temp0';
  }

  @override
  String get common_savedOffline =>
      'Saved offline — will submit when connected';

  @override
  String get common_noData => 'No data available';

  @override
  String get common_currencyRupee => '₹';

  @override
  String common_rupeeAmount(String amount) {
    return '₹$amount';
  }

  @override
  String get common_cancel => 'Cancel';

  @override
  String get common_save => 'Save';

  @override
  String get common_confirm => 'Confirm';

  @override
  String get common_close => 'Close';

  @override
  String get common_fromCache => 'Showing cached data';

  @override
  String get common_updated => 'Updated just now';

  @override
  String get dashboard_title => 'Ryd';

  @override
  String get dashboard_subtitle => 'Dashboard';

  @override
  String get dashboard_statusActive => 'ACCOUNT ACTIVE';

  @override
  String get dashboard_statusSuspended => 'ACCOUNT SUSPENDED';

  @override
  String get dashboard_statusPreActive => 'PENDING ACTIVATION';

  @override
  String get dashboard_welcomeBack => 'Welcome back,';

  @override
  String get dashboard_subscription => 'Current Subscription';

  @override
  String get dashboard_timeRemaining => 'Time Remaining';

  @override
  String get dashboard_nextRecharge => 'Next Recharge';

  @override
  String get dashboard_manageSubscription => 'Manage Subscription';

  @override
  String get dashboard_activeHub => 'Active Hub';

  @override
  String get dashboard_teamLeader => 'Team Leader';

  @override
  String get dashboard_inviteEarnTitle => 'Refer Friends, Get Rewards!';

  @override
  String get dashboard_inviteEarnSubtitle => 'Invite & Earn';

  @override
  String get dashboard_referralCopied => 'Referral code copied!';

  @override
  String get dashboard_todaysPerformance => 'Today\'s Performance';

  @override
  String get dashboard_distance => 'Distance';

  @override
  String get dashboard_power => 'Power';

  @override
  String get dashboard_assignedVehicle => 'Assigned Vehicle';

  @override
  String get dashboard_vehicleDetails => 'Details';

  @override
  String dashboard_kilometers(String km) {
    return '$km km';
  }

  @override
  String dashboard_kwh(String kwh) {
    return '$kwh kWh';
  }

  @override
  String get dashboard_notifications => 'Notifications';

  @override
  String get dashboard_rentalDetails => 'Rental Details';

  @override
  String get dashboard_choosePlan => 'Choose Plan';

  @override
  String get suspension_negativeBalance => 'Wallet Balance Below ₹0';

  @override
  String suspension_negativeBalanceDesc(String amount) {
    return 'Your wallet has a negative balance of ₹$amount. Please top up to restore your account.';
  }

  @override
  String get suspension_lowBalance => 'Low Wallet Balance';

  @override
  String suspension_lowBalanceDesc(String amount) {
    return 'Your wallet balance is ₹$amount. Daily rental charges may cause suspension.';
  }

  @override
  String get suspension_kycPending => 'KYC Verification Pending';

  @override
  String suspension_kycPendingDesc(String status) {
    return 'Your KYC is $status. Complete document verification to activate your account.';
  }

  @override
  String get suspension_depositPending => 'Security Deposit Required';

  @override
  String get suspension_depositPendingDesc =>
      'Your security deposit has not been received or approved. Please submit your payment.';

  @override
  String get suspension_planExpired => 'Subscription Expired';

  @override
  String get suspension_planExpiredDesc =>
      'Your rental plan has expired. Select a new plan to continue riding.';

  @override
  String get suspension_noActivePlan => 'No Active Subscription';

  @override
  String get suspension_noActivePlanDesc =>
      'You need an active rental plan to use Ryd services.';

  @override
  String get suspension_returnRequired => 'Vehicle Return Overdue';

  @override
  String get suspension_returnRequiredDesc =>
      'Your vehicle return is overdue. Please return the vehicle to avoid penalties.';

  @override
  String get suspension_terminated => 'Account Terminated';

  @override
  String get suspension_terminatedDesc =>
      'Your account has been terminated. Please contact support for assistance.';

  @override
  String get suspension_topUpNow => 'Top Up Now';

  @override
  String get suspension_resubmitKyc => 'Resubmit KYC';

  @override
  String get suspension_completeKyc => 'Complete KYC';

  @override
  String get suspension_payDeposit => 'Pay Deposit';

  @override
  String get suspension_choosePlan => 'Choose Plan';

  @override
  String get suspension_endRental => 'End Rental';

  @override
  String get suspension_contactSupport => 'Contact Support';

  @override
  String get wallet_title => 'My Wallet';

  @override
  String get wallet_availableBalance => 'Available Balance';

  @override
  String get wallet_paymentStreak => 'Payment Streak';

  @override
  String wallet_streakOf(int days) {
    return '$days / 5 Days';
  }

  @override
  String wallet_streakMessage(int days) {
    return '$days day streak! Keep going to unlock premium tiers.';
  }

  @override
  String get wallet_topUp => 'Top Up';

  @override
  String get wallet_history => 'History';

  @override
  String get wallet_transactionHistory => 'Transaction History';

  @override
  String get wallet_viewAll => 'View All';

  @override
  String get wallet_recentTransactions => 'Recent Transactions';

  @override
  String get wallet_noTransactions => 'No transactions yet';

  @override
  String get wallet_dailyRental => 'Daily Rental';

  @override
  String get wallet_weeklyPlan => 'Weekly Plan';

  @override
  String get wallet_securityDeposit => 'Security Deposit';

  @override
  String get wallet_topUpUpi => 'Top Up — UPI';

  @override
  String get wallet_loyaltyReward => 'Loyalty Reward';

  @override
  String get wallet_penalty => 'Penalty';

  @override
  String get wallet_refund => 'Refund';

  @override
  String get wallet_statusPending => 'PENDING';

  @override
  String get wallet_statusApproved => 'APPROVED';

  @override
  String get wallet_statusRejected => 'REJECTED';

  @override
  String get wallet_streakKeepGoing =>
      'Maintaining a 5-day streak unlocks premium tiers';

  @override
  String wallet_unlockPremiumTiers(int days) {
    return '$days day streak! Keep going to unlock premium tiers.';
  }

  @override
  String get history_title => 'Transaction History';

  @override
  String get history_credits => 'Credits';

  @override
  String get history_debits => 'Debits';

  @override
  String get history_all => 'All';

  @override
  String get history_searchHint => 'Search transactions...';

  @override
  String get history_noResults => 'No transactions found';

  @override
  String get history_tapBreakdown =>
      'Tap any transaction to see the full fee breakdown';

  @override
  String get history_netAmount => 'Net';

  @override
  String get history_totalCharged => 'Total Charged';

  @override
  String history_includesTax(String amount) {
    return 'Includes ₹$amount in taxes';
  }

  @override
  String history_savedAmount(String amount) {
    return 'Saved ₹$amount';
  }

  @override
  String get history_baseRentalFee => 'Base Rental Fee';

  @override
  String get history_gst => 'GST (18%)';

  @override
  String get history_lateReturnSurcharge => 'Late Return Surcharge';

  @override
  String get history_streakDiscount => 'Streak Discount';

  @override
  String get history_penaltyAmount => 'Penalty Amount';

  @override
  String get history_gstOnSurcharge => 'GST on Surcharge (18%)';

  @override
  String get history_typeCharge => 'Charge';

  @override
  String get history_typeTax => 'Tax';

  @override
  String get history_typeDiscount => 'Discount';

  @override
  String get history_typePenalty => 'Penalty';

  @override
  String get history_typeInfo => 'Info';

  @override
  String get settings_title => 'Settings';

  @override
  String get settings_appSection => 'App Settings';

  @override
  String get settings_language => 'Language';

  @override
  String get settings_languageDesc => 'Choose your preferred language';

  @override
  String get settings_english => 'English';

  @override
  String get settings_hindi => 'हिंदी';

  @override
  String get settings_securitySection => 'Security';

  @override
  String get settings_changePassword => 'Change Password';

  @override
  String get settings_biometricLogin => 'Biometric Login';

  @override
  String get settings_aboutSection => 'About';

  @override
  String settings_version(String version) {
    return 'Version $version';
  }

  @override
  String get settings_privacyPolicy => 'Privacy Policy';

  @override
  String get settings_termsOfService => 'Terms of Service';

  @override
  String get settings_logout => 'Log Out';

  @override
  String get settings_logoutConfirm => 'Are you sure you want to log out?';

  @override
  String get settings_deleteAccount => 'Delete Account';

  @override
  String get settings_notificationPreferences => 'Notification Preferences';

  @override
  String get nav_home => 'Home';

  @override
  String get nav_wallet => 'Wallet';

  @override
  String get nav_support => 'Support';

  @override
  String get nav_profile => 'Profile';

  @override
  String onboarding_welcome(String name) {
    return 'Welcome, $name!';
  }

  @override
  String get onboarding_completeProfile =>
      'Complete the following steps to activate your account and start your journey with Ryd.';

  @override
  String get onboarding_nextStep => 'Next Step';

  @override
  String get onboarding_completeKyc => 'Complete KYC';

  @override
  String get onboarding_addGuarantor => 'Add Guarantor';

  @override
  String get onboarding_payDeposit => 'Pay Deposit';

  @override
  String get onboarding_choosePlan => 'Choose Plan';

  @override
  String get onboarding_schedulePickup => 'Schedule Pickup';

  @override
  String get onboarding_confirmed => 'Subscription Confirmed!';

  @override
  String get onboarding_planActive =>
      'Your plan is now active. You can now proceed to the nearest hub to pick up your vehicle.';

  @override
  String get onboarding_proceedToPickup => 'Proceed to Pickup';

  @override
  String get onboarding_selectHub => 'Select Pickup Hub';

  @override
  String get onboarding_connectVehicle => 'Connect Vehicle';

  @override
  String get onboarding_verifyVehicle => 'Verify Vehicle';

  @override
  String get onboarding_inspection => 'Vehicle Inspection';

  @override
  String get onboarding_capturePhoto => 'Capture Pickup Photo';

  @override
  String get onboarding_finalVerification => 'Final Verification';

  @override
  String get onboarding_readyToRoll => 'Ready to Roll?';

  @override
  String get onboarding_reviewSign =>
      'Review and sign to complete your vehicle collection.';

  @override
  String get onboarding_signature => 'Digital Signature';

  @override
  String get onboarding_completeStart => 'Complete & Start Riding';

  @override
  String get onboarding_youAreLive => 'You\'re Live!';

  @override
  String get onboarding_successBody =>
      'Everything is synced. Your vehicle is ready and your dashboard is now live. Enjoy your ride!';

  @override
  String get onboarding_goToDashboard => 'Go to Dashboard';

  @override
  String get dashboard_syncingIndicator =>
      'Syncing... 1 pending action being uploaded';

  @override
  String get dashboard_riderLabel => 'RIDER';
}
