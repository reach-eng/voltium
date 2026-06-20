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

  /// No description provided for @txtsomethingWentWrong.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong'**
  String get txtsomethingWentWrong;

  /// No description provided for @txtreload.
  ///
  /// In en, this message translates to:
  /// **'Reload'**
  String get txtreload;

  /// No description provided for @txtriderNotFoundPleaseContactSupport.
  ///
  /// In en, this message translates to:
  /// **'Rider not found. Please contact support.'**
  String get txtriderNotFoundPleaseContactSupport;

  /// No description provided for @txtvoltium.
  ///
  /// In en, this message translates to:
  /// **'Voltium'**
  String get txtvoltium;

  /// No description provided for @txtcreateAccount.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get txtcreateAccount;

  /// No description provided for @txtloginWithPhone.
  ///
  /// In en, this message translates to:
  /// **'Login with Phone'**
  String get txtloginWithPhone;

  /// No description provided for @txtmanageYourJourneyWithPrecision.
  ///
  /// In en, this message translates to:
  /// **'Manage your journey with precision.'**
  String get txtmanageYourJourneyWithPrecision;

  /// No description provided for @txtwelcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome'**
  String get txtwelcome;

  /// No description provided for @txtenterTheRegisteredPhoneNumberToLoginOrEnterANewNumberToCreateAnotherAccount.
  ///
  /// In en, this message translates to:
  /// **'Enter the registered phone number to login or enter a new number to create another account.'**
  String
      get txtenterTheRegisteredPhoneNumberToLoginOrEnterANewNumberToCreateAnotherAccount;

  /// No description provided for @txtaSecureOtpWillBeSent.
  ///
  /// In en, this message translates to:
  /// **'A SECURE OTP WILL BE SENT'**
  String get txtaSecureOtpWillBeSent;

  /// No description provided for @txtenter.
  ///
  /// In en, this message translates to:
  /// **'Enter'**
  String get txtenter;

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

  /// No description provided for @txtdashboard.
  ///
  /// In en, this message translates to:
  /// **'Dashboard'**
  String get txtdashboard;

  /// No description provided for @txtrejectionRemarks.
  ///
  /// In en, this message translates to:
  /// **'Rejection Remarks'**
  String get txtrejectionRemarks;

  /// No description provided for @txtpickupYourVehicle.
  ///
  /// In en, this message translates to:
  /// **'PICKUP YOUR VEHICLE'**
  String get txtpickupYourVehicle;

  /// No description provided for @txtemergencyContacts.
  ///
  /// In en, this message translates to:
  /// **'Emergency Contacts'**
  String get txtemergencyContacts;

  /// No description provided for @txtaddContact.
  ///
  /// In en, this message translates to:
  /// **'Add Contact'**
  String get txtaddContact;

  /// No description provided for @txtnoEmergencyContacts.
  ///
  /// In en, this message translates to:
  /// **'No emergency contacts'**
  String get txtnoEmergencyContacts;

  /// No description provided for @txtaddContactsToAlertInCaseOfEmergency.
  ///
  /// In en, this message translates to:
  /// **'Add contacts to alert in case of emergency'**
  String get txtaddContactsToAlertInCaseOfEmergency;

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

  /// No description provided for @txtprimary.
  ///
  /// In en, this message translates to:
  /// **'PRIMARY'**
  String get txtprimary;

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

  /// No description provided for @txttakeAPhoto.
  ///
  /// In en, this message translates to:
  /// **'Take a Photo'**
  String get txttakeAPhoto;

  /// No description provided for @txtchooseFromGallery.
  ///
  /// In en, this message translates to:
  /// **'Choose from Gallery'**
  String get txtchooseFromGallery;

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

  /// No description provided for @txtdocumentsUpload.
  ///
  /// In en, this message translates to:
  /// **'Documents Upload'**
  String get txtdocumentsUpload;

  /// No description provided for @txtclearPhotosOnlyMax5mbEach.
  ///
  /// In en, this message translates to:
  /// **'Clear photos only. Max 5MB each.'**
  String get txtclearPhotosOnlyMax5mbEach;

  /// No description provided for @txtguarantorSignature.
  ///
  /// In en, this message translates to:
  /// **'Guarantor Signature'**
  String get txtguarantorSignature;

  /// No description provided for @txtsignOnScreenToAuthorizeDetails.
  ///
  /// In en, this message translates to:
  /// **'Sign on screen to authorize details.'**
  String get txtsignOnScreenToAuthorizeDetails;

  /// No description provided for @txtonboarding.
  ///
  /// In en, this message translates to:
  /// **'Onboarding'**
  String get txtonboarding;

  /// No description provided for @txtstep.
  ///
  /// In en, this message translates to:
  /// **'Step'**
  String get txtstep;

  /// No description provided for @txtoneMoreStep.
  ///
  /// In en, this message translates to:
  /// **'One more step'**
  String get txtoneMoreStep;

  /// No description provided for @txtweNeedAFewMoreDetailsToSetUpYourFleetProfileSecurely.
  ///
  /// In en, this message translates to:
  /// **'We need a few more details to set up your fleet profile securely.'**
  String get txtweNeedAFewMoreDetailsToSetUpYourFleetProfileSecurely;

  /// No description provided for @txtfinishSetup.
  ///
  /// In en, this message translates to:
  /// **'FINISH SETUP'**
  String get txtfinishSetup;

  /// No description provided for @txtunableToOpenDocument.
  ///
  /// In en, this message translates to:
  /// **'Unable to open document'**
  String get txtunableToOpenDocument;

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

  /// No description provided for @txtintentOfUse.
  ///
  /// In en, this message translates to:
  /// **'Intent of Use'**
  String get txtintentOfUse;

  /// No description provided for @txtselectYourPrimaryUsageToHelpUsCustomizeYourExperienceAndSupport.
  ///
  /// In en, this message translates to:
  /// **'Select your primary usage to help us customize your experience and support.'**
  String get txtselectYourPrimaryUsageToHelpUsCustomizeYourExperienceAndSupport;

  /// No description provided for @txtswitchingBetweenTypesIsPossibleLaterThroughAccountSettingsThoughCommercialAccessMayRequireAdditionalVerification.
  ///
  /// In en, this message translates to:
  /// **'Switching between types is possible later through account settings, though commercial access may require additional verification.'**
  String
      get txtswitchingBetweenTypesIsPossibleLaterThroughAccountSettingsThoughCommercialAccessMayRequireAdditionalVerification;

  /// No description provided for @txtconfirmSelection.
  ///
  /// In en, this message translates to:
  /// **'Confirm Selection'**
  String get txtconfirmSelection;

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

  /// No description provided for @txtclose.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get txtclose;

  /// No description provided for @txttakeSelfie.
  ///
  /// In en, this message translates to:
  /// **'Take Selfie'**
  String get txttakeSelfie;

  /// No description provided for @txtcamera.
  ///
  /// In en, this message translates to:
  /// **'Camera'**
  String get txtcamera;

  /// No description provided for @txtgallery.
  ///
  /// In en, this message translates to:
  /// **'Gallery'**
  String get txtgallery;

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

  /// No description provided for @txtdigitalSignature.
  ///
  /// In en, this message translates to:
  /// **'Digital Signature'**
  String get txtdigitalSignature;

  /// No description provided for @txtsignBelowToAuthorizeDocumentation.
  ///
  /// In en, this message translates to:
  /// **'Sign below to authorize documentation.'**
  String get txtsignBelowToAuthorizeDocumentation;

  /// No description provided for @txtalmostThere.
  ///
  /// In en, this message translates to:
  /// **'Almost there!'**
  String get txtalmostThere;

  /// No description provided for @txtnotifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get txtnotifications;

  /// No description provided for @txtnoNotificationsYet.
  ///
  /// In en, this message translates to:
  /// **'No notifications yet'**
  String get txtnoNotificationsYet;

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

  /// No description provided for @txtdeleteNotification.
  ///
  /// In en, this message translates to:
  /// **'Delete Notification'**
  String get txtdeleteNotification;

  /// No description provided for @txtareYouSureYouWantToDeleteThisNotification.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to delete this notification?'**
  String get txtareYouSureYouWantToDeleteThisNotification;

  /// No description provided for @txtnotificationDeleted.
  ///
  /// In en, this message translates to:
  /// **'Notification deleted'**
  String get txtnotificationDeleted;

  /// No description provided for @txtmarkAllRead.
  ///
  /// In en, this message translates to:
  /// **'MARK ALL READ'**
  String get txtmarkAllRead;

  /// No description provided for @txtauthorizedSignatory.
  ///
  /// In en, this message translates to:
  /// **'Authorized Signatory'**
  String get txtauthorizedSignatory;

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

  /// No description provided for @txtskip.
  ///
  /// In en, this message translates to:
  /// **'Skip'**
  String get txtskip;

  /// No description provided for @txtprivacyChoices.
  ///
  /// In en, this message translates to:
  /// **'Privacy choices'**
  String get txtprivacyChoices;

  /// No description provided for @txtchooseWhatVoltiumMayCollectForRiderSafetySupportAndComplianceYouCanRevokeOptionalConsentHereBeforeContinuing.
  ///
  /// In en, this message translates to:
  /// **'Choose what Voltium may collect for rider safety, support, and compliance. You can revoke optional consent here before continuing.'**
  String
      get txtchooseWhatVoltiumMayCollectForRiderSafetySupportAndComplianceYouCanRevokeOptionalConsentHereBeforeContinuing;

  /// No description provided for @txtrideTheFuture.
  ///
  /// In en, this message translates to:
  /// **'Ride the Future'**
  String get txtrideTheFuture;

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

  /// No description provided for @txteverythingIsSyncedYourVehicleIsReadyAndYourDashboardIsNowLiveEnjoyYourRide.
  ///
  /// In en, this message translates to:
  /// **'Everything is synced. Your vehicle is ready and your dashboard is now live. Enjoy your ride!'**
  String
      get txteverythingIsSyncedYourVehicleIsReadyAndYourDashboardIsNowLiveEnjoyYourRide;

  /// No description provided for @txtgoToDashboard.
  ///
  /// In en, this message translates to:
  /// **'Go to Dashboard'**
  String get txtgoToDashboard;

  /// No description provided for @txtpleaseLogInAgain.
  ///
  /// In en, this message translates to:
  /// **'Please log in again.'**
  String get txtpleaseLogInAgain;

  /// No description provided for @txtfailedToCompletePickupPleaseTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Failed to complete pickup. Please try again.'**
  String get txtfailedToCompletePickupPleaseTryAgain;

  /// No description provided for @txtfinalVerification.
  ///
  /// In en, this message translates to:
  /// **'Final Verification'**
  String get txtfinalVerification;

  /// No description provided for @txtreadyToRoll.
  ///
  /// In en, this message translates to:
  /// **'Ready to Roll?'**
  String get txtreadyToRoll;

  /// No description provided for @txtpleaseReviewAndSignTheDigitalRentalAgreementBeforeCollectingYourVehicle.
  ///
  /// In en, this message translates to:
  /// **'Please review and sign the digital rental agreement before collecting your vehicle.'**
  String
      get txtpleaseReviewAndSignTheDigitalRentalAgreementBeforeCollectingYourVehicle;

  /// No description provided for @txtdrawYourSignatureHere.
  ///
  /// In en, this message translates to:
  /// **'Draw your signature here'**
  String get txtdrawYourSignatureHere;

  /// No description provided for @txtiConfirmThatIHaveInspectedTheVehicleAndAcceptResponsibilityForItsCareAndTrafficCompliance.
  ///
  /// In en, this message translates to:
  /// **'I confirm that I have inspected the vehicle and accept responsibility for its care and traffic compliance.'**
  String
      get txtiConfirmThatIHaveInspectedTheVehicleAndAcceptResponsibilityForItsCareAndTrafficCompliance;

  /// No description provided for @txtteamLeader.
  ///
  /// In en, this message translates to:
  /// **'Team Leader'**
  String get txtteamLeader;

  /// No description provided for @txtassignedTeamLeader.
  ///
  /// In en, this message translates to:
  /// **'Assigned Team Leader'**
  String get txtassignedTeamLeader;

  /// No description provided for @txtrequestSubmittedToSupportTeam.
  ///
  /// In en, this message translates to:
  /// **'Request submitted to support team'**
  String get txtrequestSubmittedToSupportTeam;

  /// No description provided for @txtvehiclePhotos.
  ///
  /// In en, this message translates to:
  /// **'Vehicle Photos'**
  String get txtvehiclePhotos;

  /// No description provided for @txtassignedVehicle.
  ///
  /// In en, this message translates to:
  /// **'ASSIGNED VEHICLE'**
  String get txtassignedVehicle;

  /// No description provided for @txtpickupPhotos.
  ///
  /// In en, this message translates to:
  /// **'PICKUP PHOTOS'**
  String get txtpickupPhotos;

  /// No description provided for @txtbackToDashboard.
  ///
  /// In en, this message translates to:
  /// **'Back to Dashboard'**
  String get txtbackToDashboard;

  /// No description provided for @txtassignmentDetails.
  ///
  /// In en, this message translates to:
  /// **'ASSIGNMENT DETAILS'**
  String get txtassignmentDetails;

  /// No description provided for @txtemergencyContactVerifiedSuccessfully.
  ///
  /// In en, this message translates to:
  /// **'Emergency contact verified successfully'**
  String get txtemergencyContactVerifiedSuccessfully;

  /// No description provided for @txtvehicleCondition.
  ///
  /// In en, this message translates to:
  /// **'Vehicle Condition'**
  String get txtvehicleCondition;

  /// No description provided for @txtmandatory.
  ///
  /// In en, this message translates to:
  /// **'MANDATORY'**
  String get txtmandatory;

  /// No description provided for @txtphotoWithVehicle.
  ///
  /// In en, this message translates to:
  /// **'Photo with Vehicle'**
  String get txtphotoWithVehicle;

  /// No description provided for @txttakeASelfieNextToTheVehicleBeforeRiding.
  ///
  /// In en, this message translates to:
  /// **'Take a selfie next to the vehicle before riding'**
  String get txttakeASelfieNextToTheVehicleBeforeRiding;

  /// No description provided for @txtdeleteAccount.
  ///
  /// In en, this message translates to:
  /// **'Delete Account'**
  String get txtdeleteAccount;

  /// No description provided for @txtthisActionIsIrreversibleAllYourDataIncludingKycDocumentsWalletBalanceAndRentalHistoryWillBePermanentlyDeletedAreYouSure.
  ///
  /// In en, this message translates to:
  /// **'This action is irreversible. All your data, including KYC documents, wallet balance, and rental history will be permanently deleted. Are you sure?'**
  String
      get txtthisActionIsIrreversibleAllYourDataIncludingKycDocumentsWalletBalanceAndRentalHistoryWillBePermanentlyDeletedAreYouSure;

  /// No description provided for @txtaccountDeletionIsNotYetAvailablePleaseContactSupport.
  ///
  /// In en, this message translates to:
  /// **'Account deletion is not yet available. Please contact support.'**
  String get txtaccountDeletionIsNotYetAvailablePleaseContactSupport;

  /// No description provided for @txtsettings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get txtsettings;

  /// No description provided for @txtphoneNumberChangeComingSoon.
  ///
  /// In en, this message translates to:
  /// **'Phone number change coming soon'**
  String get txtphoneNumberChangeComingSoon;

  /// No description provided for @txtpasswordChangeComingSoon.
  ///
  /// In en, this message translates to:
  /// **'Password change coming soon'**
  String get txtpasswordChangeComingSoon;

  /// No description provided for @txtselectLanguage.
  ///
  /// In en, this message translates to:
  /// **'Select Language'**
  String get txtselectLanguage;

  /// No description provided for @txtenglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get txtenglish;

  /// No description provided for @txtthisActionIsIrreversible.
  ///
  /// In en, this message translates to:
  /// **'This action is irreversible'**
  String get txtthisActionIsIrreversible;

  /// No description provided for @txtaddEntry.
  ///
  /// In en, this message translates to:
  /// **'Add Entry'**
  String get txtaddEntry;

  /// No description provided for @txtearningsLog.
  ///
  /// In en, this message translates to:
  /// **'Earnings Log'**
  String get txtearningsLog;

  /// No description provided for @txtnoEarningsLoggedYet.
  ///
  /// In en, this message translates to:
  /// **'No earnings logged yet'**
  String get txtnoEarningsLoggedYet;

  /// No description provided for @txtselectProfilePhoto.
  ///
  /// In en, this message translates to:
  /// **'Select Profile Photo'**
  String get txtselectProfilePhoto;

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

  /// No description provided for @txtfailedToUpdateProfilePleaseTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Failed to update profile. Please try again.'**
  String get txtfailedToUpdateProfilePleaseTryAgain;

  /// No description provided for @txtsubmitForApproval.
  ///
  /// In en, this message translates to:
  /// **'SUBMIT FOR APPROVAL'**
  String get txtsubmitForApproval;

  /// No description provided for @txteditProfile.
  ///
  /// In en, this message translates to:
  /// **'Edit Profile'**
  String get txteditProfile;

  /// No description provided for @txtguarantorPhone.
  ///
  /// In en, this message translates to:
  /// **'Guarantor Phone'**
  String get txtguarantorPhone;

  /// No description provided for @txtverify.
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get txtverify;

  /// No description provided for @txtphoneVerified.
  ///
  /// In en, this message translates to:
  /// **'Phone verified'**
  String get txtphoneVerified;

  /// No description provided for @txtquickLinks.
  ///
  /// In en, this message translates to:
  /// **'QUICK LINKS'**
  String get txtquickLinks;

  /// No description provided for @txtprofile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get txtprofile;

  /// No description provided for @txtweeklyEarnings.
  ///
  /// In en, this message translates to:
  /// **'WEEKLY EARNINGS'**
  String get txtweeklyEarnings;

  /// No description provided for @txtthisWeek.
  ///
  /// In en, this message translates to:
  /// **'THIS WEEK'**
  String get txtthisWeek;

  /// No description provided for @txttrips.
  ///
  /// In en, this message translates to:
  /// **'TRIPS'**
  String get txttrips;

  /// No description provided for @txthours.
  ///
  /// In en, this message translates to:
  /// **'HOURS'**
  String get txthours;

  /// No description provided for @txtweeklySummary.
  ///
  /// In en, this message translates to:
  /// **'WEEKLY SUMMARY'**
  String get txtweeklySummary;

  /// No description provided for @txtprofileChangesRequireAdminApprovalBeforeBecomingActive.
  ///
  /// In en, this message translates to:
  /// **'Profile changes require admin approval before becoming active.'**
  String get txtprofileChangesRequireAdminApprovalBeforeBecomingActive;

  /// No description provided for @txtlogout.
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get txtlogout;

  /// No description provided for @txtreferrals.
  ///
  /// In en, this message translates to:
  /// **'Referrals'**
  String get txtreferrals;

  /// No description provided for @txtfailedToSubscribeCheckYourBalance.
  ///
  /// In en, this message translates to:
  /// **'Failed to subscribe. Check your balance.'**
  String get txtfailedToSubscribeCheckYourBalance;

  /// No description provided for @txtbestValue.
  ///
  /// In en, this message translates to:
  /// **'BEST VALUE'**
  String get txtbestValue;

  /// No description provided for @txtselectANewPlan.
  ///
  /// In en, this message translates to:
  /// **'Select a new plan'**
  String get txtselectANewPlan;

  /// No description provided for @txtchooseTheRentalDurationThatBestFitsYourNeedsYouCanChangeThisAtAnyTime.
  ///
  /// In en, this message translates to:
  /// **'Choose the rental duration that best fits your needs. You can change this at any time.'**
  String
      get txtchooseTheRentalDurationThatBestFitsYourNeedsYouCanChangeThisAtAnyTime;

  /// No description provided for @txtconfirmNewPlan.
  ///
  /// In en, this message translates to:
  /// **'Confirm New Plan'**
  String get txtconfirmNewPlan;

  /// No description provided for @txterrorSubmittingReturnPleaseTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Error submitting return. Please try again.'**
  String get txterrorSubmittingReturnPleaseTryAgain;

  /// No description provided for @txtrequestSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Request Submitted!'**
  String get txtrequestSubmitted;

  /// No description provided for @txtyourVehicleReturnRequestHasBeenSentForApproval.
  ///
  /// In en, this message translates to:
  /// **'Your vehicle return request has been sent for approval.'**
  String get txtyourVehicleReturnRequestHasBeenSentForApproval;

  /// No description provided for @txtendRental.
  ///
  /// In en, this message translates to:
  /// **'End Rental'**
  String get txtendRental;

  /// No description provided for @txtareYouSure.
  ///
  /// In en, this message translates to:
  /// **'Are you sure?'**
  String get txtareYouSure;

  /// No description provided for @txtreturningYourVehicleWillEndYourCurrentRentalPeriodMakeSureToCompleteAllInspectionSteps.
  ///
  /// In en, this message translates to:
  /// **'Returning your vehicle will end your current rental period. Make sure to complete all inspection steps.'**
  String
      get txtreturningYourVehicleWillEndYourCurrentRentalPeriodMakeSureToCompleteAllInspectionSteps;

  /// No description provided for @txtreturnInspection.
  ///
  /// In en, this message translates to:
  /// **'RETURN INSPECTION'**
  String get txtreturnInspection;

  /// No description provided for @txttakeReturnPhotosOfYourVehicle.
  ///
  /// In en, this message translates to:
  /// **'Take return photos of your vehicle'**
  String get txttakeReturnPhotosOfYourVehicle;

  /// No description provided for @txtodometerReading.
  ///
  /// In en, this message translates to:
  /// **'ODOMETER READING'**
  String get txtodometerReading;

  /// No description provided for @txtbatteryLevel.
  ///
  /// In en, this message translates to:
  /// **'Battery Level'**
  String get txtbatteryLevel;

  /// No description provided for @txtiConfirmTheVehicleIsReturnedInGoodConditionWithAllAccessoriesIntact.
  ///
  /// In en, this message translates to:
  /// **'I confirm the vehicle is returned in good condition with all accessories intact.'**
  String
      get txtiConfirmTheVehicleIsReturnedInGoodConditionWithAllAccessoriesIntact;

  /// No description provided for @txtconfirmReturn.
  ///
  /// In en, this message translates to:
  /// **'Confirm Return'**
  String get txtconfirmReturn;

  /// No description provided for @txtpleaseTakeAllInspectionPhotosToContinue.
  ///
  /// In en, this message translates to:
  /// **'Please take all inspection photos to continue'**
  String get txtpleaseTakeAllInspectionPhotosToContinue;

  /// No description provided for @txtsubscriptionConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Subscription Confirmed!'**
  String get txtsubscriptionConfirmed;

  /// No description provided for @txtyourPlanIsNowActiveYouCanNowProceedToTheNearestHubToPickUpYourVehicle.
  ///
  /// In en, this message translates to:
  /// **'Your plan is now active. You can now proceed to the nearest hub to pick up your vehicle.'**
  String
      get txtyourPlanIsNowActiveYouCanNowProceedToTheNearestHubToPickUpYourVehicle;

  /// No description provided for @txtproceedToPickup.
  ///
  /// In en, this message translates to:
  /// **'Proceed to Pickup'**
  String get txtproceedToPickup;

  /// No description provided for @txtrentalDetails.
  ///
  /// In en, this message translates to:
  /// **'Rental Details'**
  String get txtrentalDetails;

  /// No description provided for @txtrewards.
  ///
  /// In en, this message translates to:
  /// **'Rewards'**
  String get txtrewards;

  /// No description provided for @txtnoResultsFound.
  ///
  /// In en, this message translates to:
  /// **'No results found'**
  String get txtnoResultsFound;

  /// No description provided for @txtstillNeedHelp.
  ///
  /// In en, this message translates to:
  /// **'Still need help?'**
  String get txtstillNeedHelp;

  /// No description provided for @txtquickTip.
  ///
  /// In en, this message translates to:
  /// **'Quick Tip'**
  String get txtquickTip;

  /// No description provided for @txtprevious.
  ///
  /// In en, this message translates to:
  /// **'PREVIOUS'**
  String get txtprevious;

  /// No description provided for @txtshareYourThoughts.
  ///
  /// In en, this message translates to:
  /// **'Share Your Thoughts'**
  String get txtshareYourThoughts;

  /// No description provided for @txtyourFeedbackHelpsUsImproveTheExperienceForEveryone.
  ///
  /// In en, this message translates to:
  /// **'Your feedback helps us improve the experience for everyone.'**
  String get txtyourFeedbackHelpsUsImproveTheExperienceForEveryone;

  /// No description provided for @txtfeedback.
  ///
  /// In en, this message translates to:
  /// **'Feedback'**
  String get txtfeedback;

  /// No description provided for @txtsubmitFeedback.
  ///
  /// In en, this message translates to:
  /// **'SUBMIT FEEDBACK'**
  String get txtsubmitFeedback;

  /// No description provided for @txtenjoyingVoltium.
  ///
  /// In en, this message translates to:
  /// **'Enjoying Voltium?'**
  String get txtenjoyingVoltium;

  /// No description provided for @txttakeAMomentToRateYourExperienceItHelpsUsGrow.
  ///
  /// In en, this message translates to:
  /// **'Take a moment to rate your experience. It helps us grow!'**
  String get txttakeAMomentToRateYourExperienceItHelpsUsGrow;

  /// No description provided for @txtrateUs.
  ///
  /// In en, this message translates to:
  /// **'RATE US'**
  String get txtrateUs;

  /// No description provided for @txtnotNow.
  ///
  /// In en, this message translates to:
  /// **'NOT NOW'**
  String get txtnotNow;

  /// No description provided for @txtsupportCenter.
  ///
  /// In en, this message translates to:
  /// **'Support Center'**
  String get txtsupportCenter;

  /// No description provided for @txtsupportChecklist.
  ///
  /// In en, this message translates to:
  /// **'Support Checklist'**
  String get txtsupportChecklist;

  /// No description provided for @txtpleaseVerify.
  ///
  /// In en, this message translates to:
  /// **'PLEASE VERIFY'**
  String get txtpleaseVerify;

  /// No description provided for @txtbeforeCreatingATicketPleaseEnsureYouHaveCompletedTheseStepsToHelpUsResolveYourIssueFaster.
  ///
  /// In en, this message translates to:
  /// **'Before creating a ticket, please ensure you have completed these steps to help us resolve your issue faster.'**
  String
      get txtbeforeCreatingATicketPleaseEnsureYouHaveCompletedTheseStepsToHelpUsResolveYourIssueFaster;

  /// No description provided for @txtproceedToSupport.
  ///
  /// In en, this message translates to:
  /// **'Proceed to Support'**
  String get txtproceedToSupport;

  /// No description provided for @txtkeepCheckingAllItemsToProceed.
  ///
  /// In en, this message translates to:
  /// **'Keep checking all items to proceed'**
  String get txtkeepCheckingAllItemsToProceed;

  /// No description provided for @txtcallNow.
  ///
  /// In en, this message translates to:
  /// **'Call Now'**
  String get txtcallNow;

  /// No description provided for @txtwhatIssueAreYouExperiencing.
  ///
  /// In en, this message translates to:
  /// **'What issue are you experiencing?'**
  String get txtwhatIssueAreYouExperiencing;

  /// No description provided for @txttroubleshootAnotherIssue.
  ///
  /// In en, this message translates to:
  /// **'Troubleshoot Another Issue'**
  String get txttroubleshootAnotherIssue;

  /// No description provided for @txtselectPhotoSource.
  ///
  /// In en, this message translates to:
  /// **'Select Photo Source'**
  String get txtselectPhotoSource;

  /// No description provided for @txtraiseATicket.
  ///
  /// In en, this message translates to:
  /// **'Raise a Ticket'**
  String get txtraiseATicket;

  /// No description provided for @txtissueType.
  ///
  /// In en, this message translates to:
  /// **'ISSUE TYPE'**
  String get txtissueType;

  /// No description provided for @txtdescription.
  ///
  /// In en, this message translates to:
  /// **'DESCRIPTION'**
  String get txtdescription;

  /// No description provided for @txtraiseTicket.
  ///
  /// In en, this message translates to:
  /// **'RAISE TICKET'**
  String get txtraiseTicket;

  /// No description provided for @txtanswerHonestlyForTheMostAccurateDiagnosis.
  ///
  /// In en, this message translates to:
  /// **'Answer honestly for the most accurate diagnosis.'**
  String get txtanswerHonestlyForTheMostAccurateDiagnosis;

  /// No description provided for @txtyes.
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get txtyes;

  /// No description provided for @txtdiagnosticPathTaken.
  ///
  /// In en, this message translates to:
  /// **'Diagnostic path taken'**
  String get txtdiagnosticPathTaken;

  /// No description provided for @txttransactionHistory.
  ///
  /// In en, this message translates to:
  /// **'Transaction History'**
  String get txttransactionHistory;

  /// No description provided for @txttapAnyTransactionToSeeTheFullFeeBreakdown.
  ///
  /// In en, this message translates to:
  /// **'Tap any transaction to see the full fee breakdown'**
  String get txttapAnyTransactionToSeeTheFullFeeBreakdown;

  /// No description provided for @txtnoTransactionsFound.
  ///
  /// In en, this message translates to:
  /// **'No transactions found'**
  String get txtnoTransactionsFound;

  /// No description provided for @txttotalCharged.
  ///
  /// In en, this message translates to:
  /// **'TOTAL CHARGED'**
  String get txttotalCharged;

  /// No description provided for @txtenterAmount.
  ///
  /// In en, this message translates to:
  /// **'Enter Amount'**
  String get txtenterAmount;

  /// No description provided for @txthowMuchWouldYouLikeToAdd.
  ///
  /// In en, this message translates to:
  /// **'How much would you like to add?'**
  String get txthowMuchWouldYouLikeToAdd;

  /// No description provided for @txtstep2Of3.
  ///
  /// In en, this message translates to:
  /// **'Step 2 of 3'**
  String get txtstep2Of3;

  /// No description provided for @txtproceedToPayment.
  ///
  /// In en, this message translates to:
  /// **'PROCEED TO PAYMENT'**
  String get txtproceedToPayment;

  /// No description provided for @txttakePhoto.
  ///
  /// In en, this message translates to:
  /// **'Take Photo'**
  String get txttakePhoto;

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

  /// No description provided for @txtpleaseAttachAPhotoOfTheRiderGivingTheCashToAVoltiumTeamMemberOrTheReceiptOfTheOnlinePayment.
  ///
  /// In en, this message translates to:
  /// **'Please attach a photo of the rider giving the cash to a Voltium team member or the receipt of the online payment.'**
  String
      get txtpleaseAttachAPhotoOfTheRiderGivingTheCashToAVoltiumTeamMemberOrTheReceiptOfTheOnlinePayment;

  /// No description provided for @txtuploadPhotoProof.
  ///
  /// In en, this message translates to:
  /// **'Upload Photo Proof'**
  String get txtuploadPhotoProof;

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

  /// No description provided for @txtstep1Of3.
  ///
  /// In en, this message translates to:
  /// **'Step 1 of 3'**
  String get txtstep1Of3;

  /// No description provided for @txtselectPurpose.
  ///
  /// In en, this message translates to:
  /// **'Select Purpose'**
  String get txtselectPurpose;

  /// No description provided for @txtstandardAmount.
  ///
  /// In en, this message translates to:
  /// **'Standard Amount'**
  String get txtstandardAmount;

  /// No description provided for @txtimportantInformation.
  ///
  /// In en, this message translates to:
  /// **'Important Information'**
  String get txtimportantInformation;

  /// No description provided for @txtcontinueToPayment.
  ///
  /// In en, this message translates to:
  /// **'Continue to Payment'**
  String get txtcontinueToPayment;

  /// No description provided for @txtpaymentSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Payment Submitted'**
  String get txtpaymentSubmitted;

  /// No description provided for @txtverificationInProgress.
  ///
  /// In en, this message translates to:
  /// **'Verification in Progress'**
  String get txtverificationInProgress;

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

  /// No description provided for @txtsecurityDeposit.
  ///
  /// In en, this message translates to:
  /// **'SECURITY DEPOSIT'**
  String get txtsecurityDeposit;

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

  /// No description provided for @txtcurrentSubscription.
  ///
  /// In en, this message translates to:
  /// **'CURRENT SUBSCRIPTION'**
  String get txtcurrentSubscription;

  /// No description provided for @txttimeRemaining.
  ///
  /// In en, this message translates to:
  /// **'TIME REMAINING'**
  String get txttimeRemaining;

  /// No description provided for @txtnextRecharge.
  ///
  /// In en, this message translates to:
  /// **'NEXT RECHARGE'**
  String get txtnextRecharge;

  /// No description provided for @txtshareYourCodeWithFriends.
  ///
  /// In en, this message translates to:
  /// **'Share your code with friends'**
  String get txtshareYourCodeWithFriends;

  /// No description provided for @txtyourCode.
  ///
  /// In en, this message translates to:
  /// **'YOUR CODE'**
  String get txtyourCode;

  /// No description provided for @txtchangeTl.
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
