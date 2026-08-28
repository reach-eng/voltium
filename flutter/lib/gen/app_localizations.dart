import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_hi.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'gen/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('hi')
  ];

  /// Application name shown in AppBar
  ///
  /// In en, this message translates to:
  /// **'Voltium'**
  String get appTitle;

  /// Generic loading indicator
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get common_loading;

  /// Generic error message
  ///
  /// In en, this message translates to:
  /// **'Something went wrong'**
  String get common_error;

  /// Retry button label
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get common_retry;

  /// Offline status banner title
  ///
  /// In en, this message translates to:
  /// **'You\'re Offline'**
  String get common_offline;

  /// Offline status banner subtitle
  ///
  /// In en, this message translates to:
  /// **'Data shown may be outdated. Actions will sync when you reconnect.'**
  String get common_offlineMessage;

  /// Sync in progress indicator
  ///
  /// In en, this message translates to:
  /// **'Syncing...'**
  String get common_syncing;

  /// Pending sync count message
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{} =1{1 pending action will sync} =2{{count} pending actions will sync} other{{count} pending actions will sync}}'**
  String common_pendingSync(int count);

  /// Toast when action queued offline
  ///
  /// In en, this message translates to:
  /// **'Saved offline — will submit when connected'**
  String get common_savedOffline;

  /// Empty state message
  ///
  /// In en, this message translates to:
  /// **'No data available'**
  String get common_noData;

  /// Indian Rupee symbol
  ///
  /// In en, this message translates to:
  /// **'₹'**
  String get common_currencyRupee;

  /// Formatted rupee amount
  ///
  /// In en, this message translates to:
  /// **'₹{amount}'**
  String common_rupeeAmount(String amount);

  /// Cancel button label
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get common_cancel;

  /// Save button label
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get common_save;

  /// Confirm button label
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get common_confirm;

  /// Close button label
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get common_close;

  /// Indicator that data is from local cache
  ///
  /// In en, this message translates to:
  /// **'Showing cached data'**
  String get common_fromCache;

  /// Fresh data indicator
  ///
  /// In en, this message translates to:
  /// **'Updated just now'**
  String get common_updated;

  /// Active Dashboard AppBar title
  ///
  /// In en, this message translates to:
  /// **'Voltium'**
  String get dashboard_title;

  /// Active Dashboard AppBar subtitle
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get dashboard_subtitle;

  /// Green active status badge
  ///
  /// In en, this message translates to:
  /// **'ACCOUNT ACTIVE'**
  String get dashboard_statusActive;

  /// Red suspended status badge
  ///
  /// In en, this message translates to:
  /// **'ACCOUNT SUSPENDED'**
  String get dashboard_statusSuspended;

  /// Amber pre-active status badge
  ///
  /// In en, this message translates to:
  /// **'PENDING ACTIVATION'**
  String get dashboard_statusPreActive;

  /// Dashboard greeting prefix
  ///
  /// In en, this message translates to:
  /// **'Welcome back,'**
  String get dashboard_welcomeBack;

  /// Subscription card section label
  ///
  /// In en, this message translates to:
  /// **'Current Subscription'**
  String get dashboard_subscription;

  /// Time left in plan
  ///
  /// In en, this message translates to:
  /// **'Time Remaining'**
  String get dashboard_timeRemaining;

  /// Next recharge date label
  ///
  /// In en, this message translates to:
  /// **'Next Recharge'**
  String get dashboard_nextRecharge;

  /// Manage subscription button
  ///
  /// In en, this message translates to:
  /// **'Manage Subscription'**
  String get dashboard_manageSubscription;

  /// Active hub section label
  ///
  /// In en, this message translates to:
  /// **'Active Hub'**
  String get dashboard_activeHub;

  /// Team leader section label
  ///
  /// In en, this message translates to:
  /// **'Team Leader'**
  String get dashboard_teamLeader;

  /// Referral widget headline
  ///
  /// In en, this message translates to:
  /// **'Refer Friends, Get Rewards!'**
  String get dashboard_inviteEarnTitle;

  /// Referral widget section label
  ///
  /// In en, this message translates to:
  /// **'Invite & Earn'**
  String get dashboard_inviteEarnSubtitle;

  /// Toast after copying referral code
  ///
  /// In en, this message translates to:
  /// **'Referral code copied!'**
  String get dashboard_referralCopied;

  /// Performance section header
  ///
  /// In en, this message translates to:
  /// **'Today\'s Performance'**
  String get dashboard_todaysPerformance;

  /// Distance metric label
  ///
  /// In en, this message translates to:
  /// **'Distance'**
  String get dashboard_distance;

  /// Power consumption label
  ///
  /// In en, this message translates to:
  /// **'Power'**
  String get dashboard_power;

  /// Vehicle assignment label
  ///
  /// In en, this message translates to:
  /// **'Assigned Vehicle'**
  String get dashboard_assignedVehicle;

  /// Vehicle details button
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get dashboard_vehicleDetails;

  /// Formatted kilometers
  ///
  /// In en, this message translates to:
  /// **'{km} km'**
  String dashboard_kilometers(String km);

  /// Formatted kilowatt-hours
  ///
  /// In en, this message translates to:
  /// **'{kwh} kWh'**
  String dashboard_kwh(String kwh);

  /// Notifications screen title
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get dashboard_notifications;

  /// Rental details screen title
  ///
  /// In en, this message translates to:
  /// **'Rental Details'**
  String get dashboard_rentalDetails;

  /// Choose plan screen title
  ///
  /// In en, this message translates to:
  /// **'Choose Plan'**
  String get dashboard_choosePlan;

  /// Suspension reason: negative wallet
  ///
  /// In en, this message translates to:
  /// **'Wallet Balance Below ₹0'**
  String get suspension_negativeBalance;

  /// Suspension description for negative balance
  ///
  /// In en, this message translates to:
  /// **'Your wallet has a negative balance of ₹{amount}. Please top up to restore your account.'**
  String suspension_negativeBalanceDesc(String amount);

  /// Warning: low wallet balance
  ///
  /// In en, this message translates to:
  /// **'Low Wallet Balance'**
  String get suspension_lowBalance;

  /// Warning description for low balance
  ///
  /// In en, this message translates to:
  /// **'Your wallet balance is ₹{amount}. Daily rental charges may cause suspension.'**
  String suspension_lowBalanceDesc(String amount);

  /// KYC not completed
  ///
  /// In en, this message translates to:
  /// **'KYC Verification Pending'**
  String get suspension_kycPending;

  /// KYC pending description
  ///
  /// In en, this message translates to:
  /// **'Your KYC is {status}. Complete document verification to activate your account.'**
  String suspension_kycPendingDesc(String status);

  /// Deposit not paid
  ///
  /// In en, this message translates to:
  /// **'Security Deposit Required'**
  String get suspension_depositPending;

  /// Deposit pending description
  ///
  /// In en, this message translates to:
  /// **'Your security deposit has not been received or approved. Please submit your payment.'**
  String get suspension_depositPendingDesc;

  /// Plan expired
  ///
  /// In en, this message translates to:
  /// **'Subscription Expired'**
  String get suspension_planExpired;

  /// Plan expired description
  ///
  /// In en, this message translates to:
  /// **'Your rental plan has expired. Select a new plan to continue riding.'**
  String get suspension_planExpiredDesc;

  /// No plan selected
  ///
  /// In en, this message translates to:
  /// **'No Active Subscription'**
  String get suspension_noActivePlan;

  /// No plan description
  ///
  /// In en, this message translates to:
  /// **'You need an active rental plan to use Voltium services.'**
  String get suspension_noActivePlanDesc;

  /// Vehicle return overdue
  ///
  /// In en, this message translates to:
  /// **'Vehicle Return Overdue'**
  String get suspension_returnRequired;

  /// Return overdue description
  ///
  /// In en, this message translates to:
  /// **'Your vehicle return is overdue. Please return the vehicle to avoid penalties.'**
  String get suspension_returnRequiredDesc;

  /// Account terminated
  ///
  /// In en, this message translates to:
  /// **'Account Terminated'**
  String get suspension_terminated;

  /// Account terminated description
  ///
  /// In en, this message translates to:
  /// **'Your account has been terminated. Please contact support for assistance.'**
  String get suspension_terminatedDesc;

  /// Action button for balance issues
  ///
  /// In en, this message translates to:
  /// **'Top Up Now'**
  String get suspension_topUpNow;

  /// Action button for rejected KYC
  ///
  /// In en, this message translates to:
  /// **'Resubmit KYC'**
  String get suspension_resubmitKyc;

  /// Action button for pending KYC
  ///
  /// In en, this message translates to:
  /// **'Complete KYC'**
  String get suspension_completeKyc;

  /// Action button for deposit
  ///
  /// In en, this message translates to:
  /// **'Pay Deposit'**
  String get suspension_payDeposit;

  /// Action button for plan
  ///
  /// In en, this message translates to:
  /// **'Choose Plan'**
  String get suspension_choosePlan;

  /// Action button for return
  ///
  /// In en, this message translates to:
  /// **'End Rental'**
  String get suspension_endRental;

  /// Action button for support
  ///
  /// In en, this message translates to:
  /// **'Contact Support'**
  String get suspension_contactSupport;

  /// Wallet screen title
  ///
  /// In en, this message translates to:
  /// **'My Wallet'**
  String get wallet_title;

  /// Balance label on wallet card
  ///
  /// In en, this message translates to:
  /// **'Available Balance'**
  String get wallet_availableBalance;

  /// Streak progress label
  ///
  /// In en, this message translates to:
  /// **'Payment Streak'**
  String get wallet_paymentStreak;

  /// Streak progress counter
  ///
  /// In en, this message translates to:
  /// **'{days} / 5 Days'**
  String wallet_streakOf(int days);

  /// Streak motivation message
  ///
  /// In en, this message translates to:
  /// **'{days} day streak! Keep going to unlock premium tiers.'**
  String wallet_streakMessage(int days);

  /// Top up button
  ///
  /// In en, this message translates to:
  /// **'Top Up'**
  String get wallet_topUp;

  /// History button
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get wallet_history;

  /// Transaction list section header
  ///
  /// In en, this message translates to:
  /// **'Transaction History'**
  String get wallet_transactionHistory;

  /// View all transactions link
  ///
  /// In en, this message translates to:
  /// **'View All'**
  String get wallet_viewAll;

  /// Recent transactions section
  ///
  /// In en, this message translates to:
  /// **'Recent Transactions'**
  String get wallet_recentTransactions;

  /// Empty transaction list
  ///
  /// In en, this message translates to:
  /// **'No transactions yet'**
  String get wallet_noTransactions;

  /// Transaction type: daily rental
  ///
  /// In en, this message translates to:
  /// **'Daily Rental'**
  String get wallet_dailyRental;

  /// Transaction type: weekly plan
  ///
  /// In en, this message translates to:
  /// **'Weekly Plan'**
  String get wallet_weeklyPlan;

  /// Transaction type: security deposit
  ///
  /// In en, this message translates to:
  /// **'Security Deposit'**
  String get wallet_securityDeposit;

  /// Transaction type: UPI top up
  ///
  /// In en, this message translates to:
  /// **'Top Up — UPI'**
  String get wallet_topUpUpi;

  /// Transaction type: loyalty reward
  ///
  /// In en, this message translates to:
  /// **'Loyalty Reward'**
  String get wallet_loyaltyReward;

  /// Transaction type: penalty
  ///
  /// In en, this message translates to:
  /// **'Penalty'**
  String get wallet_penalty;

  /// Transaction type: refund
  ///
  /// In en, this message translates to:
  /// **'Refund'**
  String get wallet_refund;

  /// Transaction status
  ///
  /// In en, this message translates to:
  /// **'PENDING'**
  String get wallet_statusPending;

  /// Transaction status
  ///
  /// In en, this message translates to:
  /// **'APPROVED'**
  String get wallet_statusApproved;

  /// Transaction status
  ///
  /// In en, this message translates to:
  /// **'REJECTED'**
  String get wallet_statusRejected;

  /// Transaction-history filter chip Ã¢â‚¬â€ debits whose purpose is RENTAL
  ///
  /// In en, this message translates to:
  /// **'Rent'**
  String get wallet_filterRent;

  /// Transaction-history filter chip Ã¢â‚¬â€ debits whose purpose is SECURITY_DEPOSIT
  ///
  /// In en, this message translates to:
  /// **'Security'**
  String get wallet_filterSecurity;

  /// Transaction-history filter chip Ã¢â‚¬â€ non-rental, non-deposit debits
  ///
  /// In en, this message translates to:
  /// **'Deduction'**
  String get wallet_filterDeduction;

  /// Security deposit row sub-label when the deposit is refundable
  ///
  /// In en, this message translates to:
  /// **'Refundable'**
  String get wallet_statusRefundable;

  /// Security deposit row sub-label when the deposit is non-refundable
  ///
  /// In en, this message translates to:
  /// **'Non-Refundable'**
  String get wallet_statusNonRefundable;

  /// Streak info text
  ///
  /// In en, this message translates to:
  /// **'Maintaining a 5-day streak unlocks premium tiers'**
  String get wallet_streakKeepGoing;

  /// Streak motivation
  ///
  /// In en, this message translates to:
  /// **'{days} day streak! Keep going to unlock premium tiers.'**
  String wallet_unlockPremiumTiers(int days);

  /// History screen title
  ///
  /// In en, this message translates to:
  /// **'Transaction History'**
  String get history_title;

  /// Credit filter tab
  ///
  /// In en, this message translates to:
  /// **'Credits'**
  String get history_credits;

  /// Debit filter tab
  ///
  /// In en, this message translates to:
  /// **'Debits'**
  String get history_debits;

  /// All filter tab
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get history_all;

  /// Search placeholder
  ///
  /// In en, this message translates to:
  /// **'Search transactions...'**
  String get history_searchHint;

  /// Empty search results
  ///
  /// In en, this message translates to:
  /// **'No transactions found'**
  String get history_noResults;

  /// Info hint about breakdowns
  ///
  /// In en, this message translates to:
  /// **'Tap any transaction to see the full fee breakdown'**
  String get history_tapBreakdown;

  /// Net amount label
  ///
  /// In en, this message translates to:
  /// **'Net'**
  String get history_netAmount;

  /// Breakdown total label
  ///
  /// In en, this message translates to:
  /// **'Total Charged'**
  String get history_totalCharged;

  /// Tax info in breakdown
  ///
  /// In en, this message translates to:
  /// **'Includes ₹{amount} in taxes'**
  String history_includesTax(String amount);

  /// Discount savings
  ///
  /// In en, this message translates to:
  /// **'Saved ₹{amount}'**
  String history_savedAmount(String amount);

  /// Breakdown line item
  ///
  /// In en, this message translates to:
  /// **'Base Rental Fee'**
  String get history_baseRentalFee;

  /// Breakdown line item
  ///
  /// In en, this message translates to:
  /// **'GST (18%)'**
  String get history_gst;

  /// Breakdown line item
  ///
  /// In en, this message translates to:
  /// **'Late Return Surcharge'**
  String get history_lateReturnSurcharge;

  /// Breakdown line item
  ///
  /// In en, this message translates to:
  /// **'Streak Discount'**
  String get history_streakDiscount;

  /// Breakdown line item
  ///
  /// In en, this message translates to:
  /// **'Penalty Amount'**
  String get history_penaltyAmount;

  /// Breakdown line item
  ///
  /// In en, this message translates to:
  /// **'GST on Surcharge (18%)'**
  String get history_gstOnSurcharge;

  /// Breakdown type badge
  ///
  /// In en, this message translates to:
  /// **'Charge'**
  String get history_typeCharge;

  /// Breakdown type badge
  ///
  /// In en, this message translates to:
  /// **'Tax'**
  String get history_typeTax;

  /// Breakdown type badge
  ///
  /// In en, this message translates to:
  /// **'Discount'**
  String get history_typeDiscount;

  /// Breakdown type badge
  ///
  /// In en, this message translates to:
  /// **'Penalty'**
  String get history_typePenalty;

  /// Breakdown type badge
  ///
  /// In en, this message translates to:
  /// **'Info'**
  String get history_typeInfo;

  /// Settings screen title
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings_title;

  /// Settings section header
  ///
  /// In en, this message translates to:
  /// **'App Settings'**
  String get settings_appSection;

  /// Language setting label
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get settings_language;

  /// Language setting description
  ///
  /// In en, this message translates to:
  /// **'Choose your preferred language'**
  String get settings_languageDesc;

  /// English language option
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get settings_english;

  /// Hindi language option
  ///
  /// In en, this message translates to:
  /// **'हिंदी'**
  String get settings_hindi;

  /// Security section header
  ///
  /// In en, this message translates to:
  /// **'Security'**
  String get settings_securitySection;

  /// Change password option
  ///
  /// In en, this message translates to:
  /// **'Change Password'**
  String get settings_changePassword;

  /// Biometric login option
  ///
  /// In en, this message translates to:
  /// **'Biometric Login'**
  String get settings_biometricLogin;

  /// About section header
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get settings_aboutSection;

  /// App version
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String settings_version(String version);

  /// Privacy policy link
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get settings_privacyPolicy;

  /// Terms link
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get settings_termsOfService;

  /// Logout button
  ///
  /// In en, this message translates to:
  /// **'Log Out'**
  String get settings_logout;

  /// Logout confirmation dialog
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to log out?'**
  String get settings_logoutConfirm;

  /// Delete account option
  ///
  /// In en, this message translates to:
  /// **'Delete Account'**
  String get settings_deleteAccount;

  /// Notification settings
  ///
  /// In en, this message translates to:
  /// **'Notification Preferences'**
  String get settings_notificationPreferences;

  /// Bottom nav: home
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get nav_home;

  /// Bottom nav: wallet
  ///
  /// In en, this message translates to:
  /// **'Wallet'**
  String get nav_wallet;

  /// Bottom nav: support
  ///
  /// In en, this message translates to:
  /// **'Support'**
  String get nav_support;

  /// Bottom nav: profile
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get nav_profile;

  /// Onboarding welcome greeting
  ///
  /// In en, this message translates to:
  /// **'Welcome, {name}!'**
  String onboarding_welcome(String name);

  /// Onboarding intro text
  ///
  /// In en, this message translates to:
  /// **'Complete the following steps to activate your account and start your journey with Voltium.'**
  String get onboarding_completeProfile;

  /// Generic next step button
  ///
  /// In en, this message translates to:
  /// **'Next Step'**
  String get onboarding_nextStep;

  /// KYC step label
  ///
  /// In en, this message translates to:
  /// **'Complete KYC'**
  String get onboarding_completeKyc;

  /// Guarantor step label
  ///
  /// In en, this message translates to:
  /// **'Add Guarantor'**
  String get onboarding_addGuarantor;

  /// Deposit step label
  ///
  /// In en, this message translates to:
  /// **'Pay Deposit'**
  String get onboarding_payDeposit;

  /// Plan selection step label
  ///
  /// In en, this message translates to:
  /// **'Choose Plan'**
  String get onboarding_choosePlan;

  /// Pickup step label
  ///
  /// In en, this message translates to:
  /// **'Schedule Pickup'**
  String get onboarding_schedulePickup;

  /// Plan success title
  ///
  /// In en, this message translates to:
  /// **'Subscription Confirmed!'**
  String get onboarding_confirmed;

  /// Plan success body
  ///
  /// In en, this message translates to:
  /// **'Your plan is now active. You can now proceed to the nearest hub to pick up your vehicle.'**
  String get onboarding_planActive;

  /// Plan success button
  ///
  /// In en, this message translates to:
  /// **'Proceed to Pickup'**
  String get onboarding_proceedToPickup;

  /// Pickup hub screen title
  ///
  /// In en, this message translates to:
  /// **'Select Pickup Hub'**
  String get onboarding_selectHub;

  /// Connect vehicle screen title
  ///
  /// In en, this message translates to:
  /// **'Connect Vehicle'**
  String get onboarding_connectVehicle;

  /// Verify vehicle button
  ///
  /// In en, this message translates to:
  /// **'Verify Vehicle'**
  String get onboarding_verifyVehicle;

  /// Inspection screen title
  ///
  /// In en, this message translates to:
  /// **'Vehicle Inspection'**
  String get onboarding_inspection;

  /// Capture photo button
  ///
  /// In en, this message translates to:
  /// **'Capture Pickup Photo'**
  String get onboarding_capturePhoto;

  /// Final verification screen title
  ///
  /// In en, this message translates to:
  /// **'Final Verification'**
  String get onboarding_finalVerification;

  /// Final screen headline
  ///
  /// In en, this message translates to:
  /// **'Ready to Roll?'**
  String get onboarding_readyToRoll;

  /// Final screen subtitle
  ///
  /// In en, this message translates to:
  /// **'Review and sign to complete your vehicle collection.'**
  String get onboarding_reviewSign;

  /// Signature pad label
  ///
  /// In en, this message translates to:
  /// **'Digital Signature'**
  String get onboarding_signature;

  /// Final completion button
  ///
  /// In en, this message translates to:
  /// **'Complete & Start Riding'**
  String get onboarding_completeStart;

  /// Onboarding completion title
  ///
  /// In en, this message translates to:
  /// **'You\'re Live!'**
  String get onboarding_youAreLive;

  /// Onboarding completion body
  ///
  /// In en, this message translates to:
  /// **'Everything is synced. Your vehicle is ready and your dashboard is now live. Enjoy your ride!'**
  String get onboarding_successBody;

  /// Final success button
  ///
  /// In en, this message translates to:
  /// **'Go to Dashboard'**
  String get onboarding_goToDashboard;

  /// Dashboard sync status message
  ///
  /// In en, this message translates to:
  /// **'Syncing... 1 pending action being uploaded'**
  String get dashboard_syncingIndicator;

  /// Label above rider name in profile card
  ///
  /// In en, this message translates to:
  /// **'RIDER'**
  String get dashboard_riderLabel;

  /// No description provided for @txtwelcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome'**
  String get txtwelcome;

  /// No description provided for @txttermsOfService.
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get txttermsOfService;

  /// No description provided for @txtprivacyPolicy.
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get txtprivacyPolicy;

  /// No description provided for @txtotpCodeResentSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'OTP code resent successfully!'**
  String get txtotpCodeResentSuccessfully;

  /// No description provided for @txtinitializeSystem.
  ///
  /// In en, this message translates to:
  /// **'Initialize System'**
  String get txtinitializeSystem;

  /// No description provided for @txtaddContact.
  ///
  /// In en, this message translates to:
  /// **'Add Contact'**
  String get txtaddContact;

  /// No description provided for @txtaddEmergencyContact.
  ///
  /// In en, this message translates to:
  /// **'Add Emergency Contact'**
  String get txtaddEmergencyContact;

  /// No description provided for @txtcancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get txtcancel;

  /// No description provided for @txtadd.
  ///
  /// In en, this message translates to:
  /// **'Add'**
  String get txtadd;

  /// No description provided for @txtsetAsPrimary.
  ///
  /// In en, this message translates to:
  /// **'Set as Primary'**
  String get txtsetAsPrimary;

  /// No description provided for @txtdelete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get txtdelete;

  /// No description provided for @txtemergencySos.
  ///
  /// In en, this message translates to:
  /// **'Emergency SOS'**
  String get txtemergencySos;

  /// SnackBar shown after the rider triggers Emergency SOS
  ///
  /// In en, this message translates to:
  /// **'SOS Alert Triggered! Dialing emergency services (112)...'**
  String get txtsosAlertTriggeredDialing;

  /// No description provided for @txtotpSentToGuarantorPhone.
  ///
  /// In en, this message translates to:
  /// **'OTP sent to guarantor phone'**
  String get txtotpSentToGuarantorPhone;

  /// No description provided for @txtphoneVerifiedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Phone verified successfully'**
  String get txtphoneVerifiedSuccessfully;

  /// No description provided for @txtguarantorDetails.
  ///
  /// In en, this message translates to:
  /// **'Guarantor Details'**
  String get txtguarantorDetails;

  /// No description provided for @txtguarantorPhoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Guarantor Phone Number'**
  String get txtguarantorPhoneNumber;

  /// No description provided for @txtphoneNumberVerified.
  ///
  /// In en, this message translates to:
  /// **'Phone Number Verified'**
  String get txtphoneNumberVerified;

  /// No description provided for @txtenterOtp.
  ///
  /// In en, this message translates to:
  /// **'Enter OTP'**
  String get txtenterOtp;

  /// No description provided for @txtverifyOtp.
  ///
  /// In en, this message translates to:
  /// **'VERIFY OTP'**
  String get txtverifyOtp;

  /// No description provided for @txtclearPhotosOnlyMax5mbEach.
  ///
  /// In en, this message translates to:
  /// **'Clear photos only. Max 5MB each.'**
  String get txtclearPhotosOnlyMax5mbEach;

  /// No description provided for @txtunableToOpenDocument.
  ///
  /// In en, this message translates to:
  /// **'Unable to open document'**
  String get txtunableToOpenDocument;

  /// AppBar title of the referral screen (Refer & Earn)
  ///
  /// In en, this message translates to:
  /// **'Refer & Earn'**
  String get txtreferAndEarn;

  /// Generic Refresh button label (used in error/retry states)
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get txtrefresh;

  /// SnackBar shown when a top-up/deposit proof photo upload fails. {error} is the underlying exception message.
  ///
  /// In en, this message translates to:
  /// **'Failed to upload proof: {error}'**
  String txtfailedToUploadProof(String error);

  /// SnackBar shown when the rider tries to submit a deposit without a proof photo attached
  ///
  /// In en, this message translates to:
  /// **'Please upload a payment proof before submitting.'**
  String get txtpleaseUploadPaymentProof;

  /// SnackBar shown when the deposit submission fails. {error} is the underlying exception message.
  ///
  /// In en, this message translates to:
  /// **'Failed to submit deposit: {error}'**
  String txtfailedToSubmitDeposit(String error);

  /// Discard button label (e.g. when leaving an unsaved edit profile screen)
  ///
  /// In en, this message translates to:
  /// **'Discard'**
  String get txtdiscard;

  /// Button to remove a captured/attached photo in the end-rental flow
  ///
  /// In en, this message translates to:
  /// **'Remove Photo'**
  String get txtremovePhoto;

  /// Helper text in the create-ticket form, showing the per-ticket photo limit. {count} is the integer limit.
  ///
  /// In en, this message translates to:
  /// **'Up to {count} photos per ticket'**
  String txtupToNPhotosPerTicket(String count);

  /// SnackBar shown after a support ticket is created
  ///
  /// In en, this message translates to:
  /// **'Ticket created successfully'**
  String get txtticketCreatedSuccessfully;

  /// SnackBar shown when a support ticket submission fails. {error} is the underlying exception message.
  ///
  /// In en, this message translates to:
  /// **'Failed to create ticket: {error}'**
  String txtfailedToCreateTicket(String error);

  /// SnackBar shown when the feedback form submission fails. {error} is the underlying exception message.
  ///
  /// In en, this message translates to:
  /// **'Failed to submit feedback: {error}'**
  String txtfailedToSubmitFeedback(String error);

  /// Button/CTA label for creating a new support ticket
  ///
  /// In en, this message translates to:
  /// **'Create Ticket'**
  String get txtcreateTicket;

  /// Confirmation dialog message before launching the emergency call. {number} is the SOS phone number.
  ///
  /// In en, this message translates to:
  /// **'Call {number} for emergency assistance?'**
  String txtcallNumberForEmergencyAssistance(String number);

  /// Label in the top-up flow breakdown for the optional advance rental fee
  ///
  /// In en, this message translates to:
  /// **'Advance Rental Plan Fee'**
  String get txtadvanceRentalPlanFee;

  /// SnackBar shown after the rider submits a top-up/deposit proof photo
  ///
  /// In en, this message translates to:
  /// **'Top up proof submitted successfully!'**
  String get txttopUpProofSubmittedSuccessfully;

  /// SnackBar shown when the rider copies the UPI ID for offline payment
  ///
  /// In en, this message translates to:
  /// **'UPI ID copied to clipboard'**
  String get txtupiIdCopiedToClipboard;

  /// Receipt line label Ã¢â‚¬â€ the top-up amount that gets added to the rider's wallet balance
  ///
  /// In en, this message translates to:
  /// **'Top Up Amount (Added to Wallet)'**
  String get txttopUpAmountAddedToWallet;

  /// Receipt line label Ã¢â‚¬â€ the final total the rider pays (top-up + plan fee + deposit)
  ///
  /// In en, this message translates to:
  /// **'Total Payable'**
  String get txttotalPayable;

  /// Settings Ã¢â€ â€™ tile + dialog title for the lock-password verification flow
  ///
  /// In en, this message translates to:
  /// **'Change Lock Password'**
  String get txtchangeLockPassword;

  /// TextField label inside the lock-password verification dialog
  ///
  /// In en, this message translates to:
  /// **'Lock Password'**
  String get txtlockPassword;

  /// Body text of the lock-password verification dialog
  ///
  /// In en, this message translates to:
  /// **'Enter your device lock password to verify security configuration.'**
  String get txtlockPasswordSubtitle;

  /// SnackBar shown when the lock-password verification request throws
  ///
  /// In en, this message translates to:
  /// **'Lock password verification failed'**
  String get txtlockPasswordVerifyFailed;

  /// Submit-button label on the lock-password verification dialog
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get txtverify;

  /// EditProfile screen SnackBar when guarantor phone is too short
  ///
  /// In en, this message translates to:
  /// **'Enter a valid 10-digit number'**
  String get txtenterAValid10DigitNumber;

  /// EditProfile screen SnackBar when the OTP input isn't 6 digits yet
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit OTP'**
  String get txtenterThe6DigitOtp;

  /// No description provided for @txtmyDocuments.
  ///
  /// In en, this message translates to:
  /// **'My Documents'**
  String get txtmyDocuments;

  /// No description provided for @txtsecurityProfile.
  ///
  /// In en, this message translates to:
  /// **'SECURITY PROFILE'**
  String get txtsecurityProfile;

  /// No description provided for @txtnoDocumentsSubmittedYet.
  ///
  /// In en, this message translates to:
  /// **'No documents submitted yet'**
  String get txtnoDocumentsSubmittedYet;

  /// No description provided for @txtverified.
  ///
  /// In en, this message translates to:
  /// **'VERIFIED'**
  String get txtverified;

  /// No description provided for @txthavingTroubleWithDocuments.
  ///
  /// In en, this message translates to:
  /// **'Having trouble with documents?'**
  String get txthavingTroubleWithDocuments;

  /// No description provided for @txtifYouSeeAnyIssuesWithYourVerifiedDocumentsOrNeedToUpdateThemPleaseRaiseASupportTicket.
  ///
  /// In en, this message translates to:
  /// **'If you see any issues with your verified documents or need to update them, please raise a support ticket.'**
  String
      get txtifYouSeeAnyIssuesWithYourVerifiedDocumentsOrNeedToUpdateThemPleaseRaiseASupportTicket;

  /// No description provided for @txtcontactSupport.
  ///
  /// In en, this message translates to:
  /// **'CONTACT SUPPORT'**
  String get txtcontactSupport;

  /// No description provided for @txtdrawSignature.
  ///
  /// In en, this message translates to:
  /// **'Draw Signature'**
  String get txtdrawSignature;

  /// No description provided for @txtclear.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get txtclear;

  /// No description provided for @txtsave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get txtsave;

  /// No description provided for @txtbankDetails.
  ///
  /// In en, this message translates to:
  /// **'Bank Details'**
  String get txtbankDetails;

  /// No description provided for @txttakeSelfie.
  ///
  /// In en, this message translates to:
  /// **'Take Selfie'**
  String get txttakeSelfie;

  /// No description provided for @txtpersonalDetails.
  ///
  /// In en, this message translates to:
  /// **'Personal Details'**
  String get txtpersonalDetails;

  /// No description provided for @txtphoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Phone Number'**
  String get txtphoneNumber;

  /// No description provided for @txtidentityVerification.
  ///
  /// In en, this message translates to:
  /// **'Identity Verification'**
  String get txtidentityVerification;

  /// No description provided for @txttakeRiderPhoto.
  ///
  /// In en, this message translates to:
  /// **'Take Rider Photo'**
  String get txttakeRiderPhoto;

  /// No description provided for @txttapToCaptureYourPhoto.
  ///
  /// In en, this message translates to:
  /// **'Tap to capture your photo'**
  String get txttapToCaptureYourPhoto;

  /// No description provided for @txtphotoCaptured.
  ///
  /// In en, this message translates to:
  /// **'Photo Captured'**
  String get txtphotoCaptured;

  /// No description provided for @txtsignBelowToAuthorizeDocumentation.
  ///
  /// In en, this message translates to:
  /// **'Sign below to authorize documentation.'**
  String get txtsignBelowToAuthorizeDocumentation;

  /// No description provided for @txtpreferencesSaved.
  ///
  /// In en, this message translates to:
  /// **'Preferences saved'**
  String get txtpreferencesSaved;

  /// No description provided for @txtfailedToSavePreferences.
  ///
  /// In en, this message translates to:
  /// **'Failed to save preferences'**
  String get txtfailedToSavePreferences;

  /// No description provided for @txtsavePreferences.
  ///
  /// In en, this message translates to:
  /// **'Save Preferences'**
  String get txtsavePreferences;

  /// No description provided for @txtnotificationPreferences.
  ///
  /// In en, this message translates to:
  /// **'Notification Preferences'**
  String get txtnotificationPreferences;

  /// Section header for the global on/off toggles on the notification preferences screen
  ///
  /// In en, this message translates to:
  /// **'MASTER SWITCH'**
  String get notif_prefsMasterSection;

  /// No description provided for @notif_prefsPushTitle.
  ///
  /// In en, this message translates to:
  /// **'Push Notifications'**
  String get notif_prefsPushTitle;

  /// No description provided for @notif_prefsPushSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Receive push notifications from Voltium'**
  String get notif_prefsPushSubtitle;

  /// No description provided for @notif_prefsSoundTitle.
  ///
  /// In en, this message translates to:
  /// **'Sound'**
  String get notif_prefsSoundTitle;

  /// No description provided for @notif_prefsSoundSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Play sound for notifications'**
  String get notif_prefsSoundSubtitle;

  /// No description provided for @notif_prefsVibrationTitle.
  ///
  /// In en, this message translates to:
  /// **'Vibration'**
  String get notif_prefsVibrationTitle;

  /// No description provided for @notif_prefsVibrationSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Vibrate for notifications'**
  String get notif_prefsVibrationSubtitle;

  /// Section header for the per-category notification toggles
  ///
  /// In en, this message translates to:
  /// **'NOTIFICATION CATEGORIES'**
  String get notif_prefsCategoriesSection;

  /// No description provided for @notif_prefsPaymentsTitle.
  ///
  /// In en, this message translates to:
  /// **'Payments'**
  String get notif_prefsPaymentsTitle;

  /// No description provided for @notif_prefsPaymentsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Top-ups, rent deductions, refunds'**
  String get notif_prefsPaymentsSubtitle;

  /// No description provided for @notif_prefsKycTitle.
  ///
  /// In en, this message translates to:
  /// **'KYC'**
  String get notif_prefsKycTitle;

  /// No description provided for @notif_prefsKycSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Document verification updates'**
  String get notif_prefsKycSubtitle;

  /// No description provided for @notif_prefsMaintenanceTitle.
  ///
  /// In en, this message translates to:
  /// **'Maintenance'**
  String get notif_prefsMaintenanceTitle;

  /// No description provided for @notif_prefsMaintenanceSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Service reminders, battery swaps'**
  String get notif_prefsMaintenanceSubtitle;

  /// No description provided for @notif_prefsAnnouncementsTitle.
  ///
  /// In en, this message translates to:
  /// **'Announcements'**
  String get notif_prefsAnnouncementsTitle;

  /// No description provided for @notif_prefsAnnouncementsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Promotions, offers, platform updates'**
  String get notif_prefsAnnouncementsSubtitle;

  /// No description provided for @txtnotificationDeleted.
  ///
  /// In en, this message translates to:
  /// **'Notification deleted'**
  String get txtnotificationDeleted;

  /// No description provided for @txtsignedBy.
  ///
  /// In en, this message translates to:
  /// **'SIGNED BY'**
  String get txtsignedBy;

  /// No description provided for @txtdate.
  ///
  /// In en, this message translates to:
  /// **'DATE'**
  String get txtdate;

  /// No description provided for @txtneedHelp.
  ///
  /// In en, this message translates to:
  /// **'NEED HELP?'**
  String get txtneedHelp;

  /// No description provided for @txtlegal.
  ///
  /// In en, this message translates to:
  /// **'Legal'**
  String get txtlegal;

  /// No description provided for @txtpleaseReviewAndAcceptOurLegalDocumentsToContinue.
  ///
  /// In en, this message translates to:
  /// **'Please review and accept our legal documents to continue.'**
  String get txtpleaseReviewAndAcceptOurLegalDocumentsToContinue;

  /// No description provided for @txtagreeToTerms.
  ///
  /// In en, this message translates to:
  /// **'Agree to Terms'**
  String get txtagreeToTerms;

  /// No description provided for @txtcontinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get txtcontinue;

  /// Title of the skip-guarantor confirmation dialog on the onboarding screen
  ///
  /// In en, this message translates to:
  /// **'Skip guarantor?'**
  String get txtguarantorSkipTitle;

  /// Body of the skip-guarantor confirmation dialog. {amount} is the admin-configured extra deposit, e.g. 'Ã¢â€šÂ¹1,000'.
  ///
  /// In en, this message translates to:
  /// **'Skipping the guarantor requires a higher security deposit of {amount} on top of your plan deposit. The amount is set by Voltium and may change. You\'ll be charged the difference when you start your rental.'**
  String txtguarantorSkipBody(String amount);

  /// Sub-label on the skip dialog when the deposit amount came from the admin panel
  ///
  /// In en, this message translates to:
  /// **'Configured by Voltium'**
  String get txtguarantorSkipSourceAdmin;

  /// Sub-label on the skip dialog when the admin endpoint is unreachable and a default amount is being used
  ///
  /// In en, this message translates to:
  /// **'Default Ã¢â‚¬â€ admin has not set a value yet'**
  String get txtguarantorSkipSourceFallback;

  /// Confirm-button label on the skip-guarantor dialog
  ///
  /// In en, this message translates to:
  /// **'SKIP & PAY EXTRA'**
  String get txtguarantorSkipConfirm;

  /// No description provided for @txtconnectingToGrid.
  ///
  /// In en, this message translates to:
  /// **'CONNECTING TO GRID'**
  String get txtconnectingToGrid;

  /// No description provided for @txtretry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get txtretry;

  /// Splash screen tagline below the brand name
  ///
  /// In en, this message translates to:
  /// **'Electric scooter rentals'**
  String get txtsplashTagline;

  /// Login screen welcome-section body text
  ///
  /// In en, this message translates to:
  /// **'Enter the registered phone number to login or enter a new number to create another account.'**
  String get txtloginWelcomeSubtitle;

  /// Login screen footer intro line above the Terms/Privacy links
  ///
  /// In en, this message translates to:
  /// **'By signing in, you agree to our'**
  String get txtloginLegalIntro;

  /// Phone-entry widget referral-code field hint
  ///
  /// In en, this message translates to:
  /// **'Referral Code (Optional)'**
  String get txtloginReferralHint;

  /// Phone-entry widget OTP note shown below the inputs
  ///
  /// In en, this message translates to:
  /// **'A secure OTP will be sent'**
  String get txtloginSecureOtpNote;

  /// Login screen primary submit button (sends OTP)
  ///
  /// In en, this message translates to:
  /// **'Enter'**
  String get txtloginEnterButton;

  /// Login screen submit-button label while the OTP request is in flight
  ///
  /// In en, this message translates to:
  /// **'SendingÃ¢â‚¬Â¦'**
  String get txtloginSendingButton;

  /// Login screen SnackBar when the OTP send request fails on a non-API error (e.g. socket)
  ///
  /// In en, this message translates to:
  /// **'Network error. Please try again.'**
  String get txtloginNetworkError;

  /// OTP screen title shown for new riders
  ///
  /// In en, this message translates to:
  /// **'Verify OTP'**
  String get txtotpVerifyTitle;

  /// OTP screen title shown for returning riders
  ///
  /// In en, this message translates to:
  /// **'Welcome Back!'**
  String get txtotpWelcomeBack;

  /// OTP screen subtitle for new riders, followed by the phone number in primary blue
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit code sent to '**
  String get txtotpSignupSubtitle;

  /// OTP screen subtitle for returning riders, followed by the phone number in primary blue
  ///
  /// In en, this message translates to:
  /// **'Enter the code to login to your account '**
  String get txtotpLoginSubtitle;

  /// OTP screen SnackBar when the verify request fails on a non-API error
  ///
  /// In en, this message translates to:
  /// **'Failed to verify OTP. Please try again.'**
  String get txtotpVerifyFailed;

  /// OTP screen SnackBar when the resend request fails
  ///
  /// In en, this message translates to:
  /// **'Error resending OTP'**
  String get txtotpResendError;

  /// No description provided for @txtpleaseLogInAgain.
  ///
  /// In en, this message translates to:
  /// **'Please log in again.'**
  String get txtpleaseLogInAgain;

  /// No description provided for @txtfinalVerification.
  ///
  /// In en, this message translates to:
  /// **'Final Verification'**
  String get txtfinalVerification;

  /// No description provided for @txtassignedVehicle.
  ///
  /// In en, this message translates to:
  /// **'ASSIGNED VEHICLE'**
  String get txtassignedVehicle;

  /// No description provided for @txtfailedToCapturePhoto.
  ///
  /// In en, this message translates to:
  /// **'Failed to capture photo'**
  String get txtfailedToCapturePhoto;

  /// No description provided for @txtguarantorPhoneCannotBeTheSameAsYourPhone.
  ///
  /// In en, this message translates to:
  /// **'Guarantor phone cannot be the same as your phone'**
  String get txtguarantorPhoneCannotBeTheSameAsYourPhone;

  /// No description provided for @txtfailedToSendOtp.
  ///
  /// In en, this message translates to:
  /// **'Failed to send OTP'**
  String get txtfailedToSendOtp;

  /// No description provided for @txtguarantorPhoneVerified.
  ///
  /// In en, this message translates to:
  /// **'Guarantor phone verified'**
  String get txtguarantorPhoneVerified;

  /// No description provided for @txtinvalidOtp.
  ///
  /// In en, this message translates to:
  /// **'Invalid OTP'**
  String get txtinvalidOtp;

  /// No description provided for @txtprofileUpdatedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Profile updated successfully'**
  String get txtprofileUpdatedSuccessfully;

  /// No description provided for @txteditProfile.
  ///
  /// In en, this message translates to:
  /// **'Edit Profile'**
  String get txteditProfile;

  /// No description provided for @txtprofile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get txtprofile;

  /// No description provided for @txterrorSubmittingReturnPleaseTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Error submitting return. Please try again.'**
  String get txterrorSubmittingReturnPleaseTryAgain;

  /// No description provided for @txtrewards.
  ///
  /// In en, this message translates to:
  /// **'Rewards'**
  String get txtrewards;

  /// No description provided for @txtcallNow.
  ///
  /// In en, this message translates to:
  /// **'Call Now'**
  String get txtcallNow;

  /// No description provided for @txtstep2Of3.
  ///
  /// In en, this message translates to:
  /// **'Step 2 of 3'**
  String get txtstep2Of3;

  /// No description provided for @txtproceedToPayment.
  ///
  /// In en, this message translates to:
  /// **'Proceed to payment'**
  String get txtproceedToPayment;

  /// No description provided for @txtstep3Of3.
  ///
  /// In en, this message translates to:
  /// **'Step 3 of 3'**
  String get txtstep3Of3;

  /// No description provided for @txtuploadProof.
  ///
  /// In en, this message translates to:
  /// **'Upload Proof'**
  String get txtuploadProof;

  /// No description provided for @txtedit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get txtedit;

  /// No description provided for @txtproofOfTopUp.
  ///
  /// In en, this message translates to:
  /// **'Proof of Top Up'**
  String get txtproofOfTopUp;

  /// No description provided for @txtuploadPhotoProof.
  ///
  /// In en, this message translates to:
  /// **'Upload Photo Proof'**
  String get txtuploadPhotoProof;

  /// Header for the proof screen's instant-payment (online) option
  ///
  /// In en, this message translates to:
  /// **'Instant Payment'**
  String get txtproofInstantPayment;

  /// No description provided for @txtproofSelectPaymentMethod.
  ///
  /// In en, this message translates to:
  /// **'SELECT PAYMENT METHOD'**
  String get txtproofSelectPaymentMethod;

  /// No description provided for @txtproofPayCash.
  ///
  /// In en, this message translates to:
  /// **'Cash'**
  String get txtproofPayCash;

  /// No description provided for @txtproofPayUpi.
  ///
  /// In en, this message translates to:
  /// **'UPI'**
  String get txtproofPayUpi;

  /// No description provided for @txtproofPayInstant.
  ///
  /// In en, this message translates to:
  /// **'Instant'**
  String get txtproofPayInstant;

  /// No description provided for @txtproofUpiIdLabel.
  ///
  /// In en, this message translates to:
  /// **'VOLTIUM UPI ID'**
  String get txtproofUpiIdLabel;

  /// No description provided for @txtproofCopyUpiId.
  ///
  /// In en, this message translates to:
  /// **'Copy UPI ID'**
  String get txtproofCopyUpiId;

  /// No description provided for @txtproofUpiRefLabel.
  ///
  /// In en, this message translates to:
  /// **'UPI Reference / UTR Number'**
  String get txtproofUpiRefLabel;

  /// No description provided for @txtproofUpiRefHint.
  ///
  /// In en, this message translates to:
  /// **'Enter 12-digit UTR / Ref (optional)'**
  String get txtproofUpiRefHint;

  /// No description provided for @txtproofTopUpAmountLabel.
  ///
  /// In en, this message translates to:
  /// **'TOP UP AMOUNT'**
  String get txtproofTopUpAmountLabel;

  /// No description provided for @txtproofTransferToUpi.
  ///
  /// In en, this message translates to:
  /// **'Transfer to Voltium official UPI ID'**
  String get txtproofTransferToUpi;

  /// No description provided for @txtproofPayViaUpi.
  ///
  /// In en, this message translates to:
  /// **'Pay via UPI'**
  String get txtproofPayViaUpi;

  /// No description provided for @txtproofInstantPaymentBreakdown.
  ///
  /// In en, this message translates to:
  /// **'Instant Payment Breakdown'**
  String get txtproofInstantPaymentBreakdown;

  /// No description provided for @txtproofPointsToActiveGateway.
  ///
  /// In en, this message translates to:
  /// **'Points to current active payment gateway'**
  String get txtproofPointsToActiveGateway;

  /// No description provided for @txtproofTopUpWillBeInstant.
  ///
  /// In en, this message translates to:
  /// **'Top up will be instant. Up to 2.5% extra (Ã¢â€šÂ¹{fee}) gateway fee will be added to your top up amount.'**
  String txtproofTopUpWillBeInstant(String fee);

  /// No description provided for @txtproofGatewayFee.
  ///
  /// In en, this message translates to:
  /// **'Gateway Fee ({percent}%)'**
  String txtproofGatewayFee(String percent);

  /// No description provided for @txtproofZeroGatewayFee.
  ///
  /// In en, this message translates to:
  /// **'Ã¢â€šÂ¹0 (Paid by Voltium)'**
  String get txtproofZeroGatewayFee;

  /// No description provided for @txtproofTopUpWillBeInstantCovered.
  ///
  /// In en, this message translates to:
  /// **'Top up will be instant. Gateway fee is 100% covered by Voltium (Ã¢â€šÂ¹0 extra fee for rider).'**
  String get txtproofTopUpWillBeInstantCovered;

  /// No description provided for @txtchangePhoto.
  ///
  /// In en, this message translates to:
  /// **'Change Photo'**
  String get txtchangePhoto;

  /// No description provided for @txttapToUploadPhoto.
  ///
  /// In en, this message translates to:
  /// **'Tap to upload photo'**
  String get txttapToUploadPhoto;

  /// No description provided for @txtcameraOrGallery.
  ///
  /// In en, this message translates to:
  /// **'Camera or gallery'**
  String get txtcameraOrGallery;

  /// No description provided for @txtsubmitProof.
  ///
  /// In en, this message translates to:
  /// **'Submit Proof'**
  String get txtsubmitProof;

  /// Submit-button label when payment mode is Instant (includes total amount)
  ///
  /// In en, this message translates to:
  /// **'Proceed to Instant Pay ({total})'**
  String txtproceedToInstantPay(Object total);

  /// No description provided for @txtstep1Of3.
  ///
  /// In en, this message translates to:
  /// **'Step 1 of 3'**
  String get txtstep1Of3;

  /// No description provided for @txttopUp.
  ///
  /// In en, this message translates to:
  /// **'Top Up'**
  String get txttopUp;

  /// No description provided for @txtensureThePhotoShowsBothTheRiderAndTeamMemberOrThePaymentReceipt.
  ///
  /// In en, this message translates to:
  /// **'Ensure the photo shows both the rider and team member or the payment receipt'**
  String get txtensureThePhotoShowsBothTheRiderAndTeamMemberOrThePaymentReceipt;

  /// No description provided for @txtphotoUploadedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Photo uploaded successfully'**
  String get txtphotoUploadedSuccessfully;

  /// No description provided for @txtwallet.
  ///
  /// In en, this message translates to:
  /// **'Wallet'**
  String get txtwallet;

  /// No description provided for @txtdeleteHistory.
  ///
  /// In en, this message translates to:
  /// **'Delete History?'**
  String get txtdeleteHistory;

  /// No description provided for @txtthisWillClearYourLocalTransactionHistoryThisActionCannotBeUndone.
  ///
  /// In en, this message translates to:
  /// **'This will clear your local transaction history. This action cannot be undone.'**
  String
      get txtthisWillClearYourLocalTransactionHistoryThisActionCannotBeUndone;

  /// No description provided for @txtelectricVehicleRentalService.
  ///
  /// In en, this message translates to:
  /// **'Electric Vehicle Rental Service'**
  String get txtelectricVehicleRentalService;

  /// No description provided for @txttransactionReceipt.
  ///
  /// In en, this message translates to:
  /// **'Transaction Receipt'**
  String get txttransactionReceipt;

  /// No description provided for @txtthankYouForUsingVoltium.
  ///
  /// In en, this message translates to:
  /// **'Thank you for using Voltium!'**
  String get txtthankYouForUsingVoltium;

  /// No description provided for @txtapprovalMatrix.
  ///
  /// In en, this message translates to:
  /// **'Approval Matrix'**
  String get txtapprovalMatrix;

  /// No description provided for @txtgoBack.
  ///
  /// In en, this message translates to:
  /// **'Go Back?'**
  String get txtgoBack;

  /// No description provided for @txtshareYourCodeWithFriends.
  ///
  /// In en, this message translates to:
  /// **'Share your code with friends'**
  String get txtshareYourCodeWithFriends;

  /// Change TL button label
  ///
  /// In en, this message translates to:
  /// **'Change TL'**
  String get txtchangeTl;

  /// No description provided for @txtchangeTeamLeader.
  ///
  /// In en, this message translates to:
  /// **'Change Team Leader'**
  String get txtchangeTeamLeader;

  /// No description provided for @txtpleaseProvideAReasonForChangingYourAssignedTeamLeaderThisWillBeReviewedByTheSupportTeam.
  ///
  /// In en, this message translates to:
  /// **'Please provide a reason for changing your assigned Team Leader. This will be reviewed by the support team.'**
  String
      get txtpleaseProvideAReasonForChangingYourAssignedTeamLeaderThisWillBeReviewedByTheSupportTeam;

  /// No description provided for @txtyourRequestHasBeenSubmittedForApproval.
  ///
  /// In en, this message translates to:
  /// **'Your request has been submitted for approval'**
  String get txtyourRequestHasBeenSubmittedForApproval;

  /// No description provided for @txtsubmitRequest.
  ///
  /// In en, this message translates to:
  /// **'Submit Request'**
  String get txtsubmitRequest;

  /// No description provided for @txtmanageSubscription.
  ///
  /// In en, this message translates to:
  /// **'Manage Subscription'**
  String get txtmanageSubscription;

  /// No description provided for @txtviewYourCurrentActivePlanDetailsBelowToChangeOrUpgradeYourPlanPleaseSubmitARequestToYourHubManager.
  ///
  /// In en, this message translates to:
  /// **'View your current active plan details below. To change or upgrade your plan, please submit a request to your hub manager.'**
  String
      get txtviewYourCurrentActivePlanDetailsBelowToChangeOrUpgradeYourPlanPleaseSubmitARequestToYourHubManager;

  /// No description provided for @txtactive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get txtactive;

  /// No description provided for @txtrequestPlanChange.
  ///
  /// In en, this message translates to:
  /// **'Request Plan Change'**
  String get txtrequestPlanChange;

  /// No description provided for @txtcapturePhoto.
  ///
  /// In en, this message translates to:
  /// **'Capture Photo'**
  String get txtcapturePhoto;

  /// No description provided for @txtcancelReturnProcess.
  ///
  /// In en, this message translates to:
  /// **'Cancel Return Process'**
  String get txtcancelReturnProcess;

  /// No description provided for @txtpleaseDoNotCloseTheApp.
  ///
  /// In en, this message translates to:
  /// **'Please do not close the app.'**
  String get txtpleaseDoNotCloseTheApp;

  /// No description provided for @txtreturnRequestSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Return Request Submitted'**
  String get txtreturnRequestSubmitted;

  /// No description provided for @txtyourVehicleReturnRequestIsPendingApprovalOurHubManagerWillVerifyYourSubmissionSoon.
  ///
  /// In en, this message translates to:
  /// **'Your vehicle return request is pending approval. Our hub manager will verify your submission soon.'**
  String
      get txtyourVehicleReturnRequestIsPendingApprovalOurHubManagerWillVerifyYourSubmissionSoon;

  /// No description provided for @txtgreat.
  ///
  /// In en, this message translates to:
  /// **'Great!'**
  String get txtgreat;

  /// No description provided for @txtfailedToSubmitReturnRequestPleaseTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Failed to submit return request. Please try again.'**
  String get txtfailedToSubmitReturnRequestPleaseTryAgain;

  /// No description provided for @txtintentUpdatedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Intent updated successfully'**
  String get txtintentUpdatedSuccessfully;

  /// No description provided for @txtviewDetails.
  ///
  /// In en, this message translates to:
  /// **'View Details'**
  String get txtviewDetails;

  /// No description provided for @txtassignedTl.
  ///
  /// In en, this message translates to:
  /// **'Assigned TL'**
  String get txtassignedTl;

  /// No description provided for @txttopUpWallet.
  ///
  /// In en, this message translates to:
  /// **'Top Up Wallet'**
  String get txttopUpWallet;

  /// No description provided for @txtrentalRecoveryStreak.
  ///
  /// In en, this message translates to:
  /// **'Rental Recovery Streak'**
  String get txtrentalRecoveryStreak;

  /// No description provided for @txtall.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get txtall;

  /// No description provided for @txtpleaseEnterAValidAmount.
  ///
  /// In en, this message translates to:
  /// **'Please enter a valid amount'**
  String get txtpleaseEnterAValidAmount;

  /// No description provided for @txtpleaseEnterValidTripsCount.
  ///
  /// In en, this message translates to:
  /// **'Please enter valid trips count'**
  String get txtpleaseEnterValidTripsCount;

  /// No description provided for @txtpleaseEnterValidHours.
  ///
  /// In en, this message translates to:
  /// **'Please enter valid hours'**
  String get txtpleaseEnterValidHours;

  /// No description provided for @txtaddEarning.
  ///
  /// In en, this message translates to:
  /// **'Add Earning'**
  String get txtaddEarning;

  /// No description provided for @txtsubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit'**
  String get txtsubmit;

  /// No description provided for @txtdailyBreakdown.
  ///
  /// In en, this message translates to:
  /// **'DAILY BREAKDOWN'**
  String get txtdailyBreakdown;

  /// No description provided for @txttryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try Again'**
  String get txttryAgain;

  /// No description provided for @txtvoltiumSoftLock.
  ///
  /// In en, this message translates to:
  /// **'VOLTIUM SOFT LOCK'**
  String get txtvoltiumSoftLock;

  /// No description provided for @txtcontactVoltiumSupportToUnlock.
  ///
  /// In en, this message translates to:
  /// **'Contact Voltium support to unlock'**
  String get txtcontactVoltiumSupportToUnlock;

  /// No description provided for @txtunlock.
  ///
  /// In en, this message translates to:
  /// **'UNLOCK'**
  String get txtunlock;

  /// No description provided for @txtvoltiumSecuritySystemV30.
  ///
  /// In en, this message translates to:
  /// **'Voltium Security System v3.0'**
  String get txtvoltiumSecuritySystemV30;

  /// No description provided for @txtnoInternetConnection.
  ///
  /// In en, this message translates to:
  /// **'No internet connection'**
  String get txtnoInternetConnection;

  /// No description provided for @txtyouAreOffline.
  ///
  /// In en, this message translates to:
  /// **'You are offline'**
  String get txtyouAreOffline;

  /// No description provided for @txtbackOnline.
  ///
  /// In en, this message translates to:
  /// **'Back online'**
  String get txtbackOnline;

  /// No description provided for @txtupdateRequired.
  ///
  /// In en, this message translates to:
  /// **'Update Required'**
  String get txtupdateRequired;

  /// No description provided for @txtaCriticalUpdateIsRequiredToContinueUsingTheAppThisVersionIsNoLongerSupported.
  ///
  /// In en, this message translates to:
  /// **'A critical update is required to continue using the app. This version is no longer supported.'**
  String
      get txtaCriticalUpdateIsRequiredToContinueUsingTheAppThisVersionIsNoLongerSupported;

  /// No description provided for @txtupdateNow.
  ///
  /// In en, this message translates to:
  /// **'UPDATE NOW'**
  String get txtupdateNow;

  /// No description provided for @txtlowWalletBalance.
  ///
  /// In en, this message translates to:
  /// **'Low Wallet Balance'**
  String get txtlowWalletBalance;

  /// No description provided for @txtdismiss.
  ///
  /// In en, this message translates to:
  /// **'DISMISS'**
  String get txtdismiss;

  /// No description provided for @txtopenSettings.
  ///
  /// In en, this message translates to:
  /// **'OPEN SETTINGS'**
  String get txtopenSettings;

  /// No description provided for @txtpickupVerification.
  ///
  /// In en, this message translates to:
  /// **'Pickup Verification'**
  String get txtpickupVerification;

  /// No description provided for @txtcompleteTheVerificationStepsToAssignAndPickUpYourVehicle.
  ///
  /// In en, this message translates to:
  /// **'Complete the verification steps to assign and pick up your vehicle'**
  String get txtcompleteTheVerificationStepsToAssignAndPickUpYourVehicle;

  /// No description provided for @txtensureAllDetailsAreAccurateBeforeProceeding.
  ///
  /// In en, this message translates to:
  /// **'ENSURE ALL DETAILS ARE ACCURATE BEFORE PROCEEDING'**
  String get txtensureAllDetailsAreAccurateBeforeProceeding;

  /// No description provided for @txtselectVehicle.
  ///
  /// In en, this message translates to:
  /// **'Select Vehicle'**
  String get txtselectVehicle;

  /// No description provided for @txtnoVehiclesMatchYourSearch.
  ///
  /// In en, this message translates to:
  /// **'No vehicles match your search'**
  String get txtnoVehiclesMatchYourSearch;

  /// No description provided for @txtkycRejected.
  ///
  /// In en, this message translates to:
  /// **'KYC REJECTED'**
  String get txtkycRejected;

  /// No description provided for @txtkycApproved.
  ///
  /// In en, this message translates to:
  /// **'KYC Approved'**
  String get txtkycApproved;

  /// Title of the KYC rejection/correction card on the Hang Tight screen
  ///
  /// In en, this message translates to:
  /// **'KYC rejected'**
  String get txtkycRejectionOnHangTightTitle;

  /// Body of the KYC rejection card on the Hang Tight screen
  ///
  /// In en, this message translates to:
  /// **'Please review the rejection remarks and re-submit your documents to continue.'**
  String get txtkycRejectionOnHangTightBody;

  /// Body of the KYC correction-requested card on the Hang Tight screen
  ///
  /// In en, this message translates to:
  /// **'We need more information to verify your identity. Please re-submit your documents to continue.'**
  String get txtkycInfoRequiredOnHangTightBody;

  /// Primary button on the KYC rejection/correction card on the Hang Tight screen
  ///
  /// In en, this message translates to:
  /// **'Fix KYC'**
  String get txtfixKycButton;

  /// No description provided for @txtpending.
  ///
  /// In en, this message translates to:
  /// **'PENDING'**
  String get txtpending;

  /// No description provided for @txtaccountAction.
  ///
  /// In en, this message translates to:
  /// **'Account Action'**
  String get txtaccountAction;

  /// No description provided for @txtrequired.
  ///
  /// In en, this message translates to:
  /// **'Required'**
  String get txtrequired;

  /// No description provided for @txtinactive.
  ///
  /// In en, this message translates to:
  /// **'INACTIVE'**
  String get txtinactive;

  /// No description provided for @txtriderId.
  ///
  /// In en, this message translates to:
  /// **'RIDER ID'**
  String get txtriderId;

  /// No description provided for @txtcontactSupportForOnboardingAssistance.
  ///
  /// In en, this message translates to:
  /// **'Contact support for onboarding assistance'**
  String get txtcontactSupportForOnboardingAssistance;

  /// No description provided for @txtshare.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get txtshare;

  /// No description provided for @txtreferFriends.
  ///
  /// In en, this message translates to:
  /// **'Refer Friends'**
  String get txtreferFriends;

  /// No description provided for @txtyourReferralCode.
  ///
  /// In en, this message translates to:
  /// **'Your Referral Code'**
  String get txtyourReferralCode;

  /// No description provided for @txtcodeCopied.
  ///
  /// In en, this message translates to:
  /// **'Code copied!'**
  String get txtcodeCopied;

  /// No description provided for @txtshareReferral.
  ///
  /// In en, this message translates to:
  /// **'Share Referral'**
  String get txtshareReferral;

  /// No description provided for @txtshareVia.
  ///
  /// In en, this message translates to:
  /// **'Share via'**
  String get txtshareVia;

  /// No description provided for @txtlinkCopied.
  ///
  /// In en, this message translates to:
  /// **'Link copied!'**
  String get txtlinkCopied;

  /// No description provided for @txtactionRequired.
  ///
  /// In en, this message translates to:
  /// **'Action Required'**
  String get txtactionRequired;

  /// No description provided for @txtelectricMobility.
  ///
  /// In en, this message translates to:
  /// **'Electric Mobility'**
  String get txtelectricMobility;

  /// No description provided for @txtcredit.
  ///
  /// In en, this message translates to:
  /// **'Credit'**
  String get txtcredit;

  /// No description provided for @txtdebit.
  ///
  /// In en, this message translates to:
  /// **'Debit'**
  String get txtdebit;

  /// No description provided for @txtwalletBalance.
  ///
  /// In en, this message translates to:
  /// **'Wallet Balance'**
  String get txtwalletBalance;

  /// No description provided for @txtevPlus.
  ///
  /// In en, this message translates to:
  /// **'EV Plus'**
  String get txtevPlus;

  /// Profile menu AppBar title
  ///
  /// In en, this message translates to:
  /// **'Menu'**
  String get menu_title;

  /// Account section header
  ///
  /// In en, this message translates to:
  /// **'ACCOUNT'**
  String get menu_account;

  /// Profile menu link label
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get menu_profile;

  /// Documents menu link label
  ///
  /// In en, this message translates to:
  /// **'My Documents'**
  String get menu_myDocuments;

  /// Rewards section header
  ///
  /// In en, this message translates to:
  /// **'REWARDS & MORE'**
  String get menu_rewardsMore;

  /// Rewards menu link label
  ///
  /// In en, this message translates to:
  /// **'Rewards'**
  String get menu_rewards;

  /// Referral menu link label
  ///
  /// In en, this message translates to:
  /// **'Referral Program'**
  String get menu_referralProgram;

  /// General section header
  ///
  /// In en, this message translates to:
  /// **'GENERAL'**
  String get menu_general;

  /// Workflow hub link label
  ///
  /// In en, this message translates to:
  /// **'Workflow & Services'**
  String get menu_workflowServices;

  /// App Settings menu link label
  ///
  /// In en, this message translates to:
  /// **'App Settings'**
  String get menu_appSettings;

  /// Language menu link label
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get menu_language;

  /// Language picker dialog title
  ///
  /// In en, this message translates to:
  /// **'Select Language'**
  String get menu_selectLanguage;

  /// Emergency SOS menu link label
  ///
  /// In en, this message translates to:
  /// **'Emergency SOS'**
  String get menu_emergencySos;

  /// Preferences section header
  ///
  /// In en, this message translates to:
  /// **'PREFERENCES'**
  String get settings_preferences;

  /// Dark mode toggle label
  ///
  /// In en, this message translates to:
  /// **'Dark Mode'**
  String get settings_darkMode;

  /// Appearance (theme) selector label
  ///
  /// In en, this message translates to:
  /// **'Appearance'**
  String get settings_appearance;

  /// Option to follow the device system theme / locale
  ///
  /// In en, this message translates to:
  /// **'Follow System'**
  String get settings_followSystem;

  /// Light theme option
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get settings_themeLight;

  /// Dark theme option
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get settings_themeDark;

  /// Support section header
  ///
  /// In en, this message translates to:
  /// **'SUPPORT & LEGAL'**
  String get settings_supportLegal;

  /// Feedback link label
  ///
  /// In en, this message translates to:
  /// **'Feedback'**
  String get settings_feedback;

  /// Legal link label
  ///
  /// In en, this message translates to:
  /// **'Legal'**
  String get settings_legal;

  /// About section header
  ///
  /// In en, this message translates to:
  /// **'ABOUT'**
  String get settings_about;

  /// App version label
  ///
  /// In en, this message translates to:
  /// **'App Version'**
  String get settings_appVersion;

  /// Rate us link label
  ///
  /// In en, this message translates to:
  /// **'Rate Us'**
  String get settings_rateUs;

  /// Account section header in settings
  ///
  /// In en, this message translates to:
  /// **'ACCOUNT'**
  String get settings_accountSection;

  /// Delete account confirmation dialog title
  ///
  /// In en, this message translates to:
  /// **'Delete Account'**
  String get settings_deleteConfirmTitle;

  /// Delete account confirmation dialog body
  ///
  /// In en, this message translates to:
  /// **'This action is irreversible. All your data, including KYC documents, wallet balance, and rental history will be permanently deleted. Are you sure?'**
  String get settings_deleteConfirmBody;

  /// Delete button label in confirmation dialog
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get settings_delete;

  /// Default reason recorded when a rider requests account deletion
  ///
  /// In en, this message translates to:
  /// **'Requested from app settings'**
  String get settings_deleteReason;

  /// Snackbar message when delete is not available
  ///
  /// In en, this message translates to:
  /// **'Account deletion is not yet available. Please contact support.'**
  String get settings_deleteNotAvailable;

  /// Notifications toggle label
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get settings_notifications;

  /// Change phone number row in settings
  ///
  /// In en, this message translates to:
  /// **'Change Phone Number'**
  String get settings_changePhone;

  /// Generic coming-soon snackbar title
  ///
  /// In en, this message translates to:
  /// **'Coming soon'**
  String get settings_comingSoon;

  /// Full name input label
  ///
  /// In en, this message translates to:
  /// **'Full Name'**
  String get txtfullName;

  /// Full name placeholder
  ///
  /// In en, this message translates to:
  /// **'Enter full name'**
  String get txtenterFullName;

  /// Date of birth label
  ///
  /// In en, this message translates to:
  /// **'Date of Birth'**
  String get txtdateOfBirth;

  /// Email address label
  ///
  /// In en, this message translates to:
  /// **'Email Address'**
  String get txtemailAddress;

  /// Email address placeholder
  ///
  /// In en, this message translates to:
  /// **'Enter email address'**
  String get txtenterEmailAddress;

  /// Father's name label
  ///
  /// In en, this message translates to:
  /// **'Father\'s Name'**
  String get txtfathersName;

  /// Father's name placeholder
  ///
  /// In en, this message translates to:
  /// **'Enter father\'s name'**
  String get txtenterFathersName;

  /// Mother's name label
  ///
  /// In en, this message translates to:
  /// **'Mother\'s Name'**
  String get txtmothersName;

  /// Mother's name placeholder
  ///
  /// In en, this message translates to:
  /// **'Enter mother\'s name'**
  String get txtenterMothersName;

  /// Current address label
  ///
  /// In en, this message translates to:
  /// **'Current Address'**
  String get txtcurrentAddress;

  /// Current address placeholder
  ///
  /// In en, this message translates to:
  /// **'Enter your full address'**
  String get txtenterYourFullAddress;

  /// Aadhaar front card label
  ///
  /// In en, this message translates to:
  /// **'Aadhaar Card\n(Front)'**
  String get txtaadhaarFront;

  /// Aadhaar back card label
  ///
  /// In en, this message translates to:
  /// **'Aadhaar Card\n(Back)'**
  String get txtaadhaarBack;

  /// PAN card label
  ///
  /// In en, this message translates to:
  /// **'PAN Card'**
  String get txtpanCard;

  /// Bank name label
  ///
  /// In en, this message translates to:
  /// **'Bank Name'**
  String get txtbankName;

  /// Bank account number label
  ///
  /// In en, this message translates to:
  /// **'Account Number'**
  String get txtaccountNumber;

  /// Bank IFSC code label
  ///
  /// In en, this message translates to:
  /// **'IFSC Code'**
  String get txtifscCode;

  /// Take a photo sheet action
  ///
  /// In en, this message translates to:
  /// **'Take a Photo'**
  String get txttakeAPhoto;

  /// Choose from gallery sheet action
  ///
  /// In en, this message translates to:
  /// **'Choose from Gallery'**
  String get txtchooseFromGallery;

  /// Document guidelines subtitle
  ///
  /// In en, this message translates to:
  /// **'Clear photos only. Max 5MB each.'**
  String get txtclearPhotosOnly;

  /// Rider profile screen title
  ///
  /// In en, this message translates to:
  /// **'Rider Profile'**
  String get txtriderProfile;

  /// Rider profile screen subtitle
  ///
  /// In en, this message translates to:
  /// **'Complete your details to finish onboarding'**
  String get txtcompleteDetailsSubtitle;

  /// Confirm and proceed button label
  ///
  /// In en, this message translates to:
  /// **'Confirm & Proceed'**
  String get txtconfirmAndProceed;

  /// KYC confirmation disclaimer
  ///
  /// In en, this message translates to:
  /// **'ENSURE ALL DETAILS ARE ACCURATE BEFORE PROCEEDING'**
  String get txtensureAllDetailsAccurate;

  /// Live camera hint for rider selfie
  ///
  /// In en, this message translates to:
  /// **'Live camera capture required for KYC verification'**
  String get txtselfieLiveCameraHint;

  /// Offline mode draft indicator banner
  ///
  /// In en, this message translates to:
  /// **'You\'re offline Ã¢â‚¬â€ your draft is saved locally. Connect to internet to submit.'**
  String get txtofflineDraftBanner;

  /// Document preview modal title
  ///
  /// In en, this message translates to:
  /// **'Document Preview'**
  String get txtdocumentPreview;

  /// Retake photo action
  ///
  /// In en, this message translates to:
  /// **'Retake Photo'**
  String get txtretakePhoto;

  /// Keep photo action
  ///
  /// In en, this message translates to:
  /// **'Keep Photo'**
  String get txtkeepPhoto;

  /// Uploaded status badge
  ///
  /// In en, this message translates to:
  /// **'Uploaded'**
  String get txtuploaded;

  /// Permissions screen title
  ///
  /// In en, this message translates to:
  /// **'Permissions'**
  String get txtpermissionsTitle;

  /// Permissions screen subtitle
  ///
  /// In en, this message translates to:
  /// **'Please allow the following permissions to ensure safety and functionality.'**
  String get txtpermissionsSubtitle;

  /// Location permission tile name
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get txtlocationPermName;

  /// Location permission tile description
  ///
  /// In en, this message translates to:
  /// **'Track rides and find nearby vehicles'**
  String get txtlocationPermDesc;

  /// Notifications permission tile name
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get txtnotificationsPermName;

  /// Notifications permission tile description
  ///
  /// In en, this message translates to:
  /// **'Receive important updates and alerts'**
  String get txtnotificationsPermDesc;

  /// Battery optimization permission tile name
  ///
  /// In en, this message translates to:
  /// **'Battery Optimization'**
  String get txtbatteryPermName;

  /// Battery optimization permission tile description
  ///
  /// In en, this message translates to:
  /// **'Allow the app to run reliably in the background.'**
  String get txtbatteryPermDesc;

  /// Camera permission tile name
  ///
  /// In en, this message translates to:
  /// **'Camera'**
  String get txtcameraPermName;

  /// Camera permission tile description
  ///
  /// In en, this message translates to:
  /// **'Document upload and QR scanning'**
  String get txtcameraPermDesc;

  /// Phone state permission tile name
  ///
  /// In en, this message translates to:
  /// **'Phone State'**
  String get txtphonePermName;

  /// Phone state permission tile description
  ///
  /// In en, this message translates to:
  /// **'Phone state (for safety call detection)'**
  String get txtphonePermDesc;

  /// Phone state permission tooltip
  ///
  /// In en, this message translates to:
  /// **'Reads call state (incoming/outgoing) so ride-safety features can detect emergency calls Ã¢â‚¬â€ it never reads call history or contacts.'**
  String get txtphonePermTooltip;

  /// Contacts permission tile name
  ///
  /// In en, this message translates to:
  /// **'Contacts'**
  String get txtcontactsPermName;

  /// Contacts permission tile description
  ///
  /// In en, this message translates to:
  /// **'Access contacts for emergency SOS and referrals'**
  String get txtcontactsPermDesc;

  /// Microphone permission tile name
  ///
  /// In en, this message translates to:
  /// **'Microphone'**
  String get txtmicPermName;

  /// Microphone permission tile description
  ///
  /// In en, this message translates to:
  /// **'Required for audio recording and verification'**
  String get txtmicPermDesc;

  /// Device admin permission tile name
  ///
  /// In en, this message translates to:
  /// **'Device Admin'**
  String get txtdeviceAdminPermName;

  /// Device admin permission tile description
  ///
  /// In en, this message translates to:
  /// **'Required for fleet security and remote lock features'**
  String get txtdeviceAdminPermDesc;

  /// Background location permission tile name
  ///
  /// In en, this message translates to:
  /// **'Background Location'**
  String get txtbackgroundLocationPermName;

  /// Background location permission tile description
  ///
  /// In en, this message translates to:
  /// **'Required for trip tracking when the app is in the background.'**
  String get txtbackgroundLocationPermDesc;

  /// Call log permission tile name
  ///
  /// In en, this message translates to:
  /// **'Call Log'**
  String get txtcallLogPermName;

  /// Call log permission tile description
  ///
  /// In en, this message translates to:
  /// **'Used for ride-safety verification and emergency contact confirmation.'**
  String get txtcallLogPermDesc;

  /// Precise location warning snackbar
  ///
  /// In en, this message translates to:
  /// **'Precise location is required. Please enable it in Settings.'**
  String get txtpreciseLocationRequired;

  /// KYC preflight header title
  ///
  /// In en, this message translates to:
  /// **'Before You Begin'**
  String get txtbeforeYouBegin;

  /// KYC preflight header subtitle
  ///
  /// In en, this message translates to:
  /// **'Quick KYC verification (~3 mins)'**
  String get txtquickKycSubtitle;

  /// KYC preflight checklist prompt
  ///
  /// In en, this message translates to:
  /// **'Please have these ready:'**
  String get txtpleaseHaveReady;

  /// Aadhaar card checklist title
  ///
  /// In en, this message translates to:
  /// **'Aadhaar Card'**
  String get txtaadhaarCard;

  /// Aadhaar card checklist subtitle
  ///
  /// In en, this message translates to:
  /// **'Front and back photo or E-Aadhaar PDF'**
  String get txtaadhaarCardDesc;

  /// PAN card checklist subtitle
  ///
  /// In en, this message translates to:
  /// **'For tax and identity verification'**
  String get txtpanCardDesc;

  /// Time estimate checklist title
  ///
  /// In en, this message translates to:
  /// **'3 Minutes of Time'**
  String get txtthreeMinutesTime;

  /// Time estimate checklist subtitle
  ///
  /// In en, this message translates to:
  /// **'Fast automated verification'**
  String get txtfastAutomatedVerification;

  /// KYC preflight ready button
  ///
  /// In en, this message translates to:
  /// **'I\'m Ready'**
  String get txtimReady;

  /// KYC preflight skip button
  ///
  /// In en, this message translates to:
  /// **'I\'ll do this later'**
  String get txtillDoThisLater;

  /// Legal docs syncing indicator
  ///
  /// In en, this message translates to:
  /// **'Syncing latest documentsÃ¢â‚¬Â¦'**
  String get txtsyncingLatestDocs;

  /// Legal agreement checkbox prefix text
  ///
  /// In en, this message translates to:
  /// **'I have read and agree to the '**
  String get txtlegalAgreeCheckboxPrefix;

  /// Electronic signature label
  ///
  /// In en, this message translates to:
  /// **'(Electronic Signature)'**
  String get txtelectronicSignature;

  /// Legal support help text prefix
  ///
  /// In en, this message translates to:
  /// **'If you have any questions about our policies, please contact our support team at '**
  String get txtlegalHelpText;

  /// Legal support help text middle connector
  ///
  /// In en, this message translates to:
  /// **' or call '**
  String get txtorCall;

  /// OTP resend prompt uppercase text
  ///
  /// In en, this message translates to:
  /// **'DIDN\'T RECEIVE THE CODE?'**
  String get txtdidntReceiveCode;

  /// OTP resend button active label
  ///
  /// In en, this message translates to:
  /// **'Resend Code'**
  String get txtresendCode;

  /// OTP resend button countdown label
  ///
  /// In en, this message translates to:
  /// **'Resend in {seconds}s'**
  String txtresendIn(int seconds);

  /// OTP verify button loading state label
  ///
  /// In en, this message translates to:
  /// **'VerifyingÃ¢â‚¬Â¦'**
  String get txtverifying;

  /// OTP verify button active label
  ///
  /// In en, this message translates to:
  /// **'Verify & Proceed'**
  String get txtverifyAndProceed;

  /// Morning greeting on dashboard
  ///
  /// In en, this message translates to:
  /// **'Good Morning'**
  String get txtgreetingMorning;

  /// Afternoon greeting on dashboard
  ///
  /// In en, this message translates to:
  /// **'Good Afternoon'**
  String get txtgreetingAfternoon;

  /// Evening greeting on dashboard
  ///
  /// In en, this message translates to:
  /// **'Good Evening'**
  String get txtgreetingEvening;

  /// Fallback rider name
  ///
  /// In en, this message translates to:
  /// **'Rider'**
  String get txtguestRider;

  /// Cached data banner on dashboard
  ///
  /// In en, this message translates to:
  /// **'Showing cached data'**
  String get txtshowingCachedData;

  /// Empty dashboard message
  ///
  /// In en, this message translates to:
  /// **'No data available'**
  String get txtnoDataAvailable;

  /// Badge when vehicle is not yet assigned
  ///
  /// In en, this message translates to:
  /// **'Vehicle Pending Assignment'**
  String get txtvehiclePendingAssignment;

  /// Plan card header
  ///
  /// In en, this message translates to:
  /// **'CURRENT SUBSCRIPTION'**
  String get txtcurrentSubscription;

  /// No active plan label
  ///
  /// In en, this message translates to:
  /// **'NO PLAN'**
  String get txtnoPlan;

  /// Weekly plan uppercase title
  ///
  /// In en, this message translates to:
  /// **'WEEKLY PAYMENT'**
  String get txtweeklyPayment;

  /// Daily plan uppercase title
  ///
  /// In en, this message translates to:
  /// **'DAILY PAYMENT'**
  String get txtdailyPayment;

  /// Monthly plan uppercase title
  ///
  /// In en, this message translates to:
  /// **'MONTHLY PAYMENT'**
  String get txtmonthlyPayment;

  /// Time remaining box label
  ///
  /// In en, this message translates to:
  /// **'TIME REMAINING'**
  String get txttimeRemaining;

  /// Next recharge box label
  ///
  /// In en, this message translates to:
  /// **'NEXT RECHARGE'**
  String get txtnextRecharge;

  /// Expired plan status label
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get txtexpired;

  /// Expires today plan status label
  ///
  /// In en, this message translates to:
  /// **'Expires Today'**
  String get txtexpiresToday;

  /// Days remaining count label
  ///
  /// In en, this message translates to:
  /// **'{count} Days'**
  String txtdaysCount(int count);

  /// Wallet card total balance label
  ///
  /// In en, this message translates to:
  /// **'TOTAL BALANCE'**
  String get txttotalBalance;

  /// Wallet card available balance label
  ///
  /// In en, this message translates to:
  /// **'AVAILABLE BALANCE'**
  String get txtavailableBalance;

  /// Streak progress label
  ///
  /// In en, this message translates to:
  /// **'{current}/{total} Days'**
  String txtstreakDays(int current, int total);

  /// Minimum recharge disclaimer
  ///
  /// In en, this message translates to:
  /// **'A minimum recharge of Ã¢â€šÂ¹{amount} is required to proceed further.'**
  String txtminRechargeNotice(String amount);

  /// Low balance warning notice
  ///
  /// In en, this message translates to:
  /// **'Top Up Now to Ride. Your balance is insufficient. Min top up: Ã¢â€šÂ¹{amount}.'**
  String txtlowBalanceWarningNotice(int amount);

  /// Top up wallet button label
  ///
  /// In en, this message translates to:
  /// **'Top Up Wallet'**
  String get txttopUpWalletAction;

  /// Referral card subtitle
  ///
  /// In en, this message translates to:
  /// **'Share your code with friends'**
  String get txtshareCodeWithFriends;

  /// Your code uppercase label
  ///
  /// In en, this message translates to:
  /// **'YOUR CODE'**
  String get txtyourCode;

  /// Referral code copied snackbar text
  ///
  /// In en, this message translates to:
  /// **'Referral code copied!'**
  String get txtreferralCodeCopied;

  /// Referral share invitation text
  ///
  /// In en, this message translates to:
  /// **'Use my code {code} to join Voltium!'**
  String txtshareReferralMessage(String code);

  /// Referral share subject text
  ///
  /// In en, this message translates to:
  /// **'Join Voltium'**
  String get txtjoinVoltiumSubject;

  /// Team leader card title
  ///
  /// In en, this message translates to:
  /// **'Team Leader'**
  String get txtteamLeader;

  /// View details link
  ///
  /// In en, this message translates to:
  /// **'View Details'**
  String get txtviewDetailsAction;

  /// Fallback text when resource is unassigned
  ///
  /// In en, this message translates to:
  /// **'Not assigned'**
  String get txtnotAssigned;

  /// Assigned TL subtitle
  ///
  /// In en, this message translates to:
  /// **'Assigned TL'**
  String get txtassignedTlBadge;

  /// Notice when TL is not yet assigned
  ///
  /// In en, this message translates to:
  /// **'Your hub will assign a team leader shortly'**
  String get txttlPendingNotice;

  /// No contact number warning snackbar
  ///
  /// In en, this message translates to:
  /// **'No contact number available for your Team Leader.'**
  String get txtnoContactNumberTl;

  /// Dialer error snackbar
  ///
  /// In en, this message translates to:
  /// **'Could not open the phone dialer. Please try again.'**
  String get txtcouldNotOpenDialer;

  /// Scooter return banner title
  ///
  /// In en, this message translates to:
  /// **'Scooter Submission\nRequired'**
  String get txtscooterSubmissionRequired;

  /// Pending return fallback date label
  ///
  /// In en, this message translates to:
  /// **'Pending return submission'**
  String get txtpendingReturnSubmission;

  /// Submission date label
  ///
  /// In en, this message translates to:
  /// **'Submission Date: {date}'**
  String txtsubmissionDatePrefix(String date);

  /// Hub name label
  ///
  /// In en, this message translates to:
  /// **'Hub Name: {hub}'**
  String txthubNamePrefix(String hub);

  /// Designated hub fallback
  ///
  /// In en, this message translates to:
  /// **'Designated Hub'**
  String get txtdesignatedHub;

  /// Upcoming rent debit header
  ///
  /// In en, this message translates to:
  /// **'UPCOMING RENT DEBIT'**
  String get txtupcomingRentDebit;

  /// Rent prompt card title
  ///
  /// In en, this message translates to:
  /// **'Top up before tomorrow 6 AM'**
  String get txttopUpBeforeTomorrow6am;

  /// Rent debit notice with shortfall
  ///
  /// In en, this message translates to:
  /// **'Rent of Ã¢â€šÂ¹{rent} will be debited automatically. Your current wallet balance is Ã¢â€šÂ¹{balance} (shortfall: Ã¢â€šÂ¹{shortfall}).'**
  String txtrentDebitNoticeShortfall(
      String rent, String balance, String shortfall);

  /// Rent debit notice with sufficient balance
  ///
  /// In en, this message translates to:
  /// **'Rent of Ã¢â€šÂ¹{rent} will be debited tomorrow 6 AM. Wallet balance Ã¢â€šÂ¹{balance} is sufficient.'**
  String txtrentDebitNoticeSufficient(String rent, String balance);

  /// Top up button label with amount
  ///
  /// In en, this message translates to:
  /// **'Top up Ã¢â€šÂ¹{amount}'**
  String txttopUpAmountAction(String amount);

  /// Assigned team leader sheet title
  ///
  /// In en, this message translates to:
  /// **'Assigned Team Leader'**
  String get txtassignedTeamLeader;

  /// Close button label
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get txtclose;

  /// Change team leader dialog title
  ///
  /// In en, this message translates to:
  /// **'Change Team Leader'**
  String get txtchangeTeamLeaderTitle;

  /// Change TL reason prompt
  ///
  /// In en, this message translates to:
  /// **'Please provide a reason for changing your assigned Team Leader. This will be reviewed by the support team.'**
  String get txtchangeTlReasonPrompt;

  /// Enter reason placeholder
  ///
  /// In en, this message translates to:
  /// **'Enter your reason here...'**
  String get txtenterReasonHint;

  /// Reason validation message
  ///
  /// In en, this message translates to:
  /// **'Please provide a detailed reason (at least 5 characters)'**
  String get txtprovideDetailedReason;

  /// TL change submitted snackbar
  ///
  /// In en, this message translates to:
  /// **'Your TL change request has been submitted for approval'**
  String get txttlChangeSubmitted;

  /// Failed to submit request snackbar
  ///
  /// In en, this message translates to:
  /// **'Failed to submit request: {error}'**
  String txtfailedToSubmitRequest(String error);

  /// Subscription sheet title
  ///
  /// In en, this message translates to:
  /// **'Manage Subscription'**
  String get txtmanageSubscriptionTitle;

  /// Subscription sheet subtitle
  ///
  /// In en, this message translates to:
  /// **'View your current active plan details below. To change or upgrade your plan, please submit a request to your hub manager.'**
  String get txtmanageSubscriptionSubtitle;

  /// Active status badge label
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get txtactiveBadge;

  /// Per day cadence
  ///
  /// In en, this message translates to:
  /// **'/ day'**
  String get txtperDay;

  /// Per week cadence
  ///
  /// In en, this message translates to:
  /// **'/ week'**
  String get txtperWeek;

  /// Per month cadence
  ///
  /// In en, this message translates to:
  /// **'/ month'**
  String get txtperMonth;

  /// Request plan change button
  ///
  /// In en, this message translates to:
  /// **'Request Plan Change'**
  String get txtrequestPlanChangeButton;

  /// End rental button
  ///
  /// In en, this message translates to:
  /// **'End Rental'**
  String get txtendRentalButton;

  /// Change intent of use button
  ///
  /// In en, this message translates to:
  /// **'Change Intent of Use'**
  String get txtchangeIntentButton;

  /// Change intent button with current intent
  ///
  /// In en, this message translates to:
  /// **'Change Intent: {intent}'**
  String txtchangeIntentPrefix(String intent);

  /// Step X of Y label
  ///
  /// In en, this message translates to:
  /// **'Step {current} of {total}'**
  String txtstepXofY(int current, int total);

  /// Capture vehicle view label
  ///
  /// In en, this message translates to:
  /// **'Capture {view} of Vehicle'**
  String txtcaptureViewOfVehicle(String view);

  /// Return photo instruction
  ///
  /// In en, this message translates to:
  /// **'Ensure the photo is clear and well-lit for faster approval.'**
  String get txtensureClearPhotoPrompt;

  /// Capture photo button
  ///
  /// In en, this message translates to:
  /// **'Capture Photo'**
  String get txtcapturePhotoBtn;

  /// Cancel return process button
  ///
  /// In en, this message translates to:
  /// **'Cancel Return Process'**
  String get txtcancelReturnProcessBtn;

  /// Uploading photos progress dialog title
  ///
  /// In en, this message translates to:
  /// **'Uploading photos & submitting request...'**
  String get txtuploadingPhotosSubmitting;

  /// Do not close app notice
  ///
  /// In en, this message translates to:
  /// **'Please do not close the app.'**
  String get txtdoNotCloseApp;

  /// Return request submitted dialog title
  ///
  /// In en, this message translates to:
  /// **'Return Request Submitted'**
  String get txtreturnRequestSubmittedTitle;

  /// Return request submitted dialog body
  ///
  /// In en, this message translates to:
  /// **'Your vehicle return request is pending approval. Our hub manager will verify your submission soon.'**
  String get txtreturnRequestSubmittedBody;

  /// Great button label
  ///
  /// In en, this message translates to:
  /// **'Great!'**
  String get txtgreatBtn;

  /// Failed to submit return snackbar
  ///
  /// In en, this message translates to:
  /// **'Failed to submit return request. Please try again.'**
  String get txtfailedToSubmitReturn;

  /// Left side vehicle view
  ///
  /// In en, this message translates to:
  /// **'Left Side'**
  String get txtleftSide;

  /// Right side vehicle view
  ///
  /// In en, this message translates to:
  /// **'Right Side'**
  String get txtrightSide;

  /// Front view vehicle view
  ///
  /// In en, this message translates to:
  /// **'Front View'**
  String get txtfrontView;

  /// Speedometer vehicle view
  ///
  /// In en, this message translates to:
  /// **'Speedometer'**
  String get txtspeedometer;

  /// Intent of use dialog title
  ///
  /// In en, this message translates to:
  /// **'Intent of Use'**
  String get txtintentOfUse;

  /// Personal use intent option
  ///
  /// In en, this message translates to:
  /// **'Personal Use'**
  String get txtpersonalUse;

  /// E-commerce delivery intent option
  ///
  /// In en, this message translates to:
  /// **'E-commerce Delivery'**
  String get txtecommerceDelivery;

  /// Food delivery intent option
  ///
  /// In en, this message translates to:
  /// **'Food Delivery'**
  String get txtfoodDelivery;

  /// Other intent option
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get txtother;

  /// Rental details screen title
  ///
  /// In en, this message translates to:
  /// **'Rental Details'**
  String get txtrentalDetailsTitle;

  /// Current plan section header
  ///
  /// In en, this message translates to:
  /// **'CURRENT PLAN'**
  String get txtcurrentPlanSection;

  /// No active plan label
  ///
  /// In en, this message translates to:
  /// **'No Active Plan'**
  String get txtnoActivePlan;

  /// Per cycle cadence
  ///
  /// In en, this message translates to:
  /// **' / cycle'**
  String get txtperCycle;

  /// Rental information section header
  ///
  /// In en, this message translates to:
  /// **'Rental Information'**
  String get txtrentalInformation;

  /// Start date row label
  ///
  /// In en, this message translates to:
  /// **'Start Date'**
  String get txtstartDate;

  /// End date row label
  ///
  /// In en, this message translates to:
  /// **'End Date'**
  String get txtendDate;

  /// Security deposit row label
  ///
  /// In en, this message translates to:
  /// **'Security Deposit'**
  String get txtsecurityDeposit;

  /// Payment streak row label
  ///
  /// In en, this message translates to:
  /// **'Payment Streak'**
  String get txtpaymentStreak;

  /// Change plan button label
  ///
  /// In en, this message translates to:
  /// **'Change Plan'**
  String get txtchangePlan;

  /// Pickup Hub label
  ///
  /// In en, this message translates to:
  /// **'Pickup Hub'**
  String get txtpickupHub;

  /// Intent updated success toast
  ///
  /// In en, this message translates to:
  /// **'Intent updated successfully'**
  String get txtintentUpdatedSuccess;

  /// Failed to update intent toast
  ///
  /// In en, this message translates to:
  /// **'Failed to update intent: {error}'**
  String txtfailedToUpdateIntent(String error);

  /// Team leader info card description
  ///
  /// In en, this message translates to:
  /// **'Your team leader is your primary point of contact for daily operations, route guidance, and on-ground support.'**
  String get txtteamLeaderInfoDescription;

  /// Request Team Leader change button label
  ///
  /// In en, this message translates to:
  /// **'Request Team Leader change'**
  String get txtrequestTlChange;

  /// Back to dashboard button label
  ///
  /// In en, this message translates to:
  /// **'Back to Dashboard'**
  String get txtbackToDashboard;

  /// No description provided for @txtback.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get txtback;

  /// Select Team Leader placeholder
  ///
  /// In en, this message translates to:
  /// **'Select Team Leader'**
  String get txtselectTeamLeader;

  /// Call button tooltip
  ///
  /// In en, this message translates to:
  /// **'Call'**
  String get txtcall;

  /// Not provided fallback string
  ///
  /// In en, this message translates to:
  /// **'Not provided'**
  String get txtnotProvided;

  /// Emergency contact row title
  ///
  /// In en, this message translates to:
  /// **'Emergency Contact'**
  String get txtemergencyContact;

  /// KYC status card header
  ///
  /// In en, this message translates to:
  /// **'KYC STATUS'**
  String get txtkycStatusTitle;

  /// Guarantor status card header
  ///
  /// In en, this message translates to:
  /// **'GUARANTOR'**
  String get txtguarantorStatusTitle;

  /// Vehicle row title
  ///
  /// In en, this message translates to:
  /// **'Vehicle'**
  String get txtvehicleTitle;

  /// Address row title
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get txtaddress;

  /// Under review status string
  ///
  /// In en, this message translates to:
  /// **'Under Review'**
  String get txtunderReview;

  /// Phone field label
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get txtphone;

  /// Security profile status title
  ///
  /// In en, this message translates to:
  /// **'Verified & Secure'**
  String get txtverifiedAndSecure;

  /// Verified documents description
  ///
  /// In en, this message translates to:
  /// **'Your identity and guarantor information have been verified. You can view or download copies of your documents below.'**
  String get txtidentityGuarantorVerifiedDesc;

  /// Verification in progress documents description
  ///
  /// In en, this message translates to:
  /// **'Your verification is in progress. Some documents may still be under review by our safety team.'**
  String get txtverificationInProgressDesc;

  /// Rider documents section header
  ///
  /// In en, this message translates to:
  /// **'YOUR DOCUMENTS'**
  String get txtyourDocuments;

  /// Guarantor documents section header
  ///
  /// In en, this message translates to:
  /// **'GUARANTOR\'S DOCUMENTS'**
  String get txtguarantorDocuments;

  /// Category files count badge
  ///
  /// In en, this message translates to:
  /// **'{count} FILES'**
  String txtfilesCount(int count);

  /// Aadhaar Card Front label
  ///
  /// In en, this message translates to:
  /// **'Aadhaar Card (Front)'**
  String get txtaadhaarCardFront;

  /// Aadhaar Card Back label
  ///
  /// In en, this message translates to:
  /// **'Aadhaar Card (Back)'**
  String get txtaadhaarCardBack;

  /// PAN Card label
  ///
  /// In en, this message translates to:
  /// **'PAN Card'**
  String get txtpanCardLabel;

  /// Digital Signature document label
  ///
  /// In en, this message translates to:
  /// **'Digital Signature'**
  String get txtdigitalSignature;

  /// Guarantor Aadhaar Front label
  ///
  /// In en, this message translates to:
  /// **'Guarantor\'s Aadhaar (Front)'**
  String get txtguarantorAadhaarFront;

  /// Guarantor Aadhaar Back label
  ///
  /// In en, this message translates to:
  /// **'Guarantor\'s Aadhaar (Back)'**
  String get txtguarantorAadhaarBack;

  /// Guarantor PAN Card label
  ///
  /// In en, this message translates to:
  /// **'Guarantor\'s PAN Card'**
  String get txtguarantorPanCard;

  /// Guarantor Verification Video label
  ///
  /// In en, this message translates to:
  /// **'Verification Video'**
  String get txtverificationVideo;

  /// Guarantor Signature label
  ///
  /// In en, this message translates to:
  /// **'Guarantor\'s Signature'**
  String get txtguarantorSignatureDoc;

  /// Document verified and active status subtitle
  ///
  /// In en, this message translates to:
  /// **'Verified & Active'**
  String get txtverifiedAndActive;

  /// Open external document viewer button label
  ///
  /// In en, this message translates to:
  /// **'Open External'**
  String get txtopenExternal;

  /// Toast when an authenticated call returns 404 rider
  ///
  /// In en, this message translates to:
  /// **'Rider not found. Please contact support.'**
  String get txtriderNotFound;

  /// Toast when a top-up / submission is attempted before the rider is fully initialized
  ///
  /// In en, this message translates to:
  /// **'Could not submit: rider session is not ready yet. Please try again in a moment.'**
  String get txtriderSessionNotReady;

  /// Toast shown when the API returns 401 mid-session
  ///
  /// In en, this message translates to:
  /// **'Your session expired. Please log in again to continue.'**
  String get txtsessionExpiredPleaseLogIn;

  /// Toast shown after security-deposit proof upload succeeds
  ///
  /// In en, this message translates to:
  /// **'Security deposit proof submitted Ã¢â‚¬â€ we\'ll review it shortly.'**
  String get txtsecurityDepositProofSubmitted;

  /// Toast shown after a regular top-up proof upload succeeds
  ///
  /// In en, this message translates to:
  /// **'Top up receipt submitted successfully!'**
  String get txttopUpProofSubmitted;

  /// Toast shown when notification delete fails on the server
  ///
  /// In en, this message translates to:
  /// **'Failed to delete notification'**
  String get txtfailedToDeleteNotification;

  /// Wallet lastError when transactions fetch fails
  ///
  /// In en, this message translates to:
  /// **'Couldn\'t load your transactions. Pull to retry.'**
  String get txterrWalletLoadFailed;

  /// Locked overlay password-empty validation message
  ///
  /// In en, this message translates to:
  /// **'Please enter password.'**
  String get txtlockedOverlayEnterPassword;

  /// Locked overlay password-format validation message
  ///
  /// In en, this message translates to:
  /// **'Password must be a 12 digit number.'**
  String get txtlockedOverlayPasswordMustBe12Digits;

  /// Locked overlay when the entered password is wrong
  ///
  /// In en, this message translates to:
  /// **'Incorrect Password. Contact Voltium support.'**
  String get txtlockedOverlayIncorrectPassword;

  /// Locked overlay when the unlock API call fails
  ///
  /// In en, this message translates to:
  /// **'Verification failed. Please check your network and try again.'**
  String get txtlockedOverlayVerificationFailed;

  /// Locked overlay headline when admin lock is active
  ///
  /// In en, this message translates to:
  /// **'Your account has been locked by Voltium.'**
  String get txtlockedOverlayAccountLocked;

  /// Locked overlay body when admin lock is active
  ///
  /// In en, this message translates to:
  /// **'Please contact support to unlock.'**
  String get txtlockedOverlayContactSupportToUnlock;

  /// HangTight status-list row: vehicle is assigned to the rider
  ///
  /// In en, this message translates to:
  /// **'Vehicle assignment'**
  String get hangTightVehicleAssignment;

  /// HangTight status-list row: rider has an active plan
  ///
  /// In en, this message translates to:
  /// **'Plan selected'**
  String get hangTightPlanSelected;

  /// HangTight status-list row: rider has not yet completed pickup
  ///
  /// In en, this message translates to:
  /// **'Pickup confirmation'**
  String get hangTightPickupConfirmation;

  /// HangTight hero title
  ///
  /// In en, this message translates to:
  /// **'Hang tight'**
  String get hangTightTitle;

  /// HangTight hero body Ã¢â‚¬â€ 'your account is being set up'
  ///
  /// In en, this message translates to:
  /// **'We\'re setting up your account.\nThis usually takes 5Ã¢â‚¬â€œ10 minutes.'**
  String get hangTightSettingUpBody;

  /// HangTight hint that the rider will be notified when the account is active
  ///
  /// In en, this message translates to:
  /// **'We\'ll send a notification when your account is active. You don\'t need to keep this open.'**
  String get hangTightNotificationHint;

  /// No description provided for @hangTightGuarantorApproved.
  ///
  /// In en, this message translates to:
  /// **'Guarantor approved'**
  String get hangTightGuarantorApproved;

  /// No description provided for @hangTightGuarantorNeedsAttention.
  ///
  /// In en, this message translates to:
  /// **'Guarantor needs attention'**
  String get hangTightGuarantorNeedsAttention;

  /// No description provided for @hangTightGuarantorReplacedPendingReview.
  ///
  /// In en, this message translates to:
  /// **'Guarantor replaced Ã¢â‚¬â€ pending review'**
  String get hangTightGuarantorReplacedPendingReview;

  /// No description provided for @hangTightGuarantorUnderReview.
  ///
  /// In en, this message translates to:
  /// **'Guarantor under review'**
  String get hangTightGuarantorUnderReview;

  /// No description provided for @hangTightPlanSelection.
  ///
  /// In en, this message translates to:
  /// **'Plan selection'**
  String get hangTightPlanSelection;

  /// No description provided for @hangTightPlanNeedsAttention.
  ///
  /// In en, this message translates to:
  /// **'Plan needs attention'**
  String get hangTightPlanNeedsAttention;

  /// No description provided for @hangTightKycApproved.
  ///
  /// In en, this message translates to:
  /// **'KYC approved'**
  String get hangTightKycApproved;

  /// No description provided for @hangTightKycRejectedResubmit.
  ///
  /// In en, this message translates to:
  /// **'KYC rejected Ã¢â‚¬â€ please resubmit'**
  String get hangTightKycRejectedResubmit;

  /// No description provided for @hangTightKycExpired.
  ///
  /// In en, this message translates to:
  /// **'KYC expired'**
  String get hangTightKycExpired;

  /// No description provided for @hangTightKycNeedsMoreInfo.
  ///
  /// In en, this message translates to:
  /// **'KYC needs more info'**
  String get hangTightKycNeedsMoreInfo;

  /// No description provided for @hangTightKycUnderReview.
  ///
  /// In en, this message translates to:
  /// **'KYC under review'**
  String get hangTightKycUnderReview;

  /// No description provided for @hangTightStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get hangTightStatusPending;

  /// No description provided for @hangTightStatusActionNeeded.
  ///
  /// In en, this message translates to:
  /// **'Action needed'**
  String get hangTightStatusActionNeeded;

  /// Empty state when a non-All filter is active and no transactions match
  ///
  /// In en, this message translates to:
  /// **'No transactions matching filter'**
  String get walletNoTransactionsForFilter;

  /// No description provided for @txtaddressHelperText.
  ///
  /// In en, this message translates to:
  /// **'House no, street, city, state, pin code'**
  String get txtaddressHelperText;

  /// No description provided for @txtchooseNewLockPassword.
  ///
  /// In en, this message translates to:
  /// **'Choose a new 4-digit lock password.'**
  String get txtchooseNewLockPassword;

  /// No description provided for @txtdobFormatHint.
  ///
  /// In en, this message translates to:
  /// **'YYYY-MM-DD'**
  String get txtdobFormatHint;

  /// No description provided for @txtenterFatherName.
  ///
  /// In en, this message translates to:
  /// **'Enter father\'s name'**
  String get txtenterFatherName;

  /// No description provided for @txtenterFullAddress.
  ///
  /// In en, this message translates to:
  /// **'Enter full address'**
  String get txtenterFullAddress;

  /// No description provided for @txtenterMotherName.
  ///
  /// In en, this message translates to:
  /// **'Enter mother\'s name'**
  String get txtenterMotherName;

  /// No description provided for @txtenterPhoneHint.
  ///
  /// In en, this message translates to:
  /// **'Enter 10-digit number'**
  String get txtenterPhoneHint;

  /// No description provided for @txtenterValidName.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid name'**
  String get txtenterValidName;

  /// No description provided for @txtguarantorCurrentAddress.
  ///
  /// In en, this message translates to:
  /// **'Current Address'**
  String get txtguarantorCurrentAddress;

  /// No description provided for @txtguarantorEnterAddress.
  ///
  /// In en, this message translates to:
  /// **'Enter your address'**
  String get txtguarantorEnterAddress;

  /// No description provided for @txtguarantorEnterFullName.
  ///
  /// In en, this message translates to:
  /// **'Enter guarantor\'s full name'**
  String get txtguarantorEnterFullName;

  /// No description provided for @txtguarantorFathersName.
  ///
  /// In en, this message translates to:
  /// **'Father\'s Name'**
  String get txtguarantorFathersName;

  /// No description provided for @txtguarantorFullName.
  ///
  /// In en, this message translates to:
  /// **'Full Name'**
  String get txtguarantorFullName;

  /// No description provided for @txtguarantorMothersName.
  ///
  /// In en, this message translates to:
  /// **'Mother\'s Name'**
  String get txtguarantorMothersName;

  /// No description provided for @txtkycContextLine.
  ///
  /// In en, this message translates to:
  /// **'These details are required by RBI for two-wheeler rentals'**
  String get txtkycContextLine;

  /// No description provided for @txtkycGuarantorContextLine.
  ///
  /// In en, this message translates to:
  /// **'Your guarantor\'s details are required by RBI for verification'**
  String get txtkycGuarantorContextLine;

  /// No description provided for @txtresendOtp.
  ///
  /// In en, this message translates to:
  /// **'RESEND'**
  String get txtresendOtp;

  /// No description provided for @txtsendOtp.
  ///
  /// In en, this message translates to:
  /// **'SEND OTP'**
  String get txtsendOtp;

  /// No description provided for @kycPushTitleApproved.
  ///
  /// In en, this message translates to:
  /// **'KYC Approved'**
  String get kycPushTitleApproved;

  /// No description provided for @kycPushBodyApproved.
  ///
  /// In en, this message translates to:
  /// **'Your documents have been verified. You can now pick up your vehicle.'**
  String get kycPushBodyApproved;

  /// No description provided for @kycPushTitleRejected.
  ///
  /// In en, this message translates to:
  /// **'KYC Update Required'**
  String get kycPushTitleRejected;

  /// Body of the KYC rejection push notification. {reason} is the admin's rejection reason. Falls back to kycPushBodyFallback when reason is absent.
  ///
  /// In en, this message translates to:
  /// **'Your KYC was rejected: {reason}'**
  String kycPushBodyRejected(Object reason);

  /// No description provided for @kycPushBodyFallback.
  ///
  /// In en, this message translates to:
  /// **'Please re-upload your documents.'**
  String get kycPushBodyFallback;

  /// No description provided for @kycPushTitleInfoRequired.
  ///
  /// In en, this message translates to:
  /// **'More information needed'**
  String get kycPushTitleInfoRequired;

  /// No description provided for @kycPushBodyInfoRequired.
  ///
  /// In en, this message translates to:
  /// **'We need a bit more information to verify your account. Please re-submit your documents to continue.'**
  String get kycPushBodyInfoRequired;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'hi'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'hi':
      return AppLocalizationsHi();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
