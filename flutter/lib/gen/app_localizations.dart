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
  /// **'Ryd'**
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
  /// **'Ryd'**
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
  /// **'You need an active rental plan to use Ryd services.'**
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
  /// **'Complete the following steps to activate your account and start your journey with Ryd.'**
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
