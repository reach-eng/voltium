// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Voltium';

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
  String get dashboard_title => 'Voltium';

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
      'You need an active rental plan to use Voltium services.';

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
      'Complete the following steps to activate your account and start your journey with Voltium.';

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

  @override
  String get txtsomethingWentWrong => 'Something went wrong';

  @override
  String get txtreload => 'Reload';

  @override
  String get txtriderNotFoundPleaseContactSupport =>
      'Rider not found. Please contact support.';

  @override
  String get txtvoltium => 'Voltium';

  @override
  String get txtcreateAccount => 'Create Account';

  @override
  String get txtloginWithPhone => 'Login with Phone';

  @override
  String get txtmanageYourJourneyWithPrecision =>
      'Manage your journey with precision.';

  @override
  String get txtwelcome => 'Welcome';

  @override
  String get txtenterTheRegisteredPhoneNumberToLoginOrEnterANewNumberToCreateAnotherAccount =>
      'Enter the registered phone number to login or enter a new number to create another account.';

  @override
  String get txtaSecureOtpWillBeSent => 'A SECURE OTP WILL BE SENT';

  @override
  String get txtenter => 'Enter';

  @override
  String get txttermsOfService => 'Terms of Service';

  @override
  String get txtprivacyPolicy => 'Privacy Policy';

  @override
  String get txtotpCodeResentSuccessfully => 'OTP code resent successfully!';

  @override
  String get txtinitializeSystem => 'Initialize System';

  @override
  String get txtdashboard => 'Dashboard';

  @override
  String get txtrejectionRemarks => 'Rejection Remarks';

  @override
  String get txtpickupYourVehicle => 'PICKUP YOUR VEHICLE';

  @override
  String get txtemergencyContacts => 'Emergency Contacts';

  @override
  String get txtaddContact => 'Add Contact';

  @override
  String get txtnoEmergencyContacts => 'No emergency contacts';

  @override
  String get txtaddContactsToAlertInCaseOfEmergency =>
      'Add contacts to alert in case of emergency';

  @override
  String get txtaddEmergencyContact => 'Add Emergency Contact';

  @override
  String get txtcancel => 'Cancel';

  @override
  String get txtadd => 'Add';

  @override
  String get txtprimary => 'PRIMARY';

  @override
  String get txtsetAsPrimary => 'Set as Primary';

  @override
  String get txtdelete => 'Delete';

  @override
  String get txtemergencySos => 'Emergency SOS';

  @override
  String get txtsosAlertTriggeredDialing =>
      'SOS Alert Triggered! Dialing emergency services (112)...';

  @override
  String get txttakeAPhoto => 'Take a Photo';

  @override
  String get txtchooseFromGallery => 'Choose from Gallery';

  @override
  String get txtotpSentToGuarantorPhone => 'OTP sent to guarantor phone';

  @override
  String get txtphoneVerifiedSuccessfully => 'Phone verified successfully';

  @override
  String get txtguarantorDetails => 'Guarantor Details';

  @override
  String get txtguarantorPhoneNumber => 'Guarantor Phone Number';

  @override
  String get txtphoneNumberVerified => 'Phone Number Verified';

  @override
  String get txtenterOtp => 'Enter OTP';

  @override
  String get txtverifyOtp => 'VERIFY OTP';

  @override
  String get txtdocumentsUpload => 'Documents Upload';

  @override
  String get txtclearPhotosOnlyMax5mbEach => 'Clear photos only. Max 5MB each.';

  @override
  String get txtguarantorSignature => 'Guarantor Signature';

  @override
  String get txtsignOnScreenToAuthorizeDetails =>
      'Sign on screen to authorize details.';

  @override
  String get txtonboarding => 'Onboarding';

  @override
  String get txtstep => 'Step';

  @override
  String get txtoneMoreStep => 'One more step';

  @override
  String get txtweNeedAFewMoreDetailsToSetUpYourFleetProfileSecurely =>
      'We need a few more details to set up your fleet profile securely.';

  @override
  String get txtfinishSetup => 'FINISH SETUP';

  @override
  String get txtunableToOpenDocument => 'Unable to open document';

  @override
  String get txtreferAndEarn => 'Refer & Earn';

  @override
  String get txtrefresh => 'Refresh';

  @override
  String txtfailedToUploadProof(String error) {
    return 'Failed to upload proof: $error';
  }

  @override
  String get txtpleaseUploadPaymentProof =>
      'Please upload a payment proof before submitting.';

  @override
  String txtfailedToSubmitDeposit(String error) {
    return 'Failed to submit deposit: $error';
  }

  @override
  String get txtdiscard => 'Discard';

  @override
  String get txtremovePhoto => 'Remove Photo';

  @override
  String txtupToNPhotosPerTicket(String count) {
    return 'Up to $count photos per ticket';
  }

  @override
  String get txtticketCreatedSuccessfully => 'Ticket created successfully';

  @override
  String txtfailedToCreateTicket(String error) {
    return 'Failed to create ticket: $error';
  }

  @override
  String txtfailedToSubmitFeedback(String error) {
    return 'Failed to submit feedback: $error';
  }

  @override
  String get txtcreateTicket => 'Create Ticket';

  @override
  String txtcallNumberForEmergencyAssistance(String number) {
    return 'Call $number for emergency assistance?';
  }

  @override
  String get txtadvanceRentalPlanFee => 'Advance Rental Plan Fee';

  @override
  String get txttopUpProofSubmittedSuccessfully =>
      'Top-up proof submitted successfully!';

  @override
  String get txtupiIdCopiedToClipboard => 'UPI ID copied to clipboard';

  @override
  String get txttopUpAmountAddedToWallet => 'Top-Up Amount (Added to Wallet)';

  @override
  String get txttotalPayable => 'Total Payable';

  @override
  String get txtchangeLockPassword => 'Change Lock Password';

  @override
  String get txtlockPassword => 'Lock Password';

  @override
  String get txtlockPasswordSubtitle =>
      'Enter your device lock password to verify security configuration.';

  @override
  String get txtlockPasswordVerifyFailed => 'Lock password verification failed';

  @override
  String get txtverify => 'Verify';

  @override
  String get txtenterAValid10DigitNumber => 'Enter a valid 10-digit number';

  @override
  String get txtenterThe6DigitOtp => 'Enter the 6-digit OTP';

  @override
  String get txtmyDocuments => 'My Documents';

  @override
  String get txtsecurityProfile => 'SECURITY PROFILE';

  @override
  String get txtnoDocumentsSubmittedYet => 'No documents submitted yet';

  @override
  String get txtverified => 'VERIFIED';

  @override
  String get txthavingTroubleWithDocuments => 'Having trouble with documents?';

  @override
  String get txtifYouSeeAnyIssuesWithYourVerifiedDocumentsOrNeedToUpdateThemPleaseRaiseASupportTicket =>
      'If you see any issues with your verified documents or need to update them, please raise a support ticket.';

  @override
  String get txtcontactSupport => 'CONTACT SUPPORT';

  @override
  String get txtintentOfUse => 'Intent of Use';

  @override
  String get txtselectYourPrimaryUsageToHelpUsCustomizeYourExperienceAndSupport =>
      'Select your primary usage to help us customize your experience and support.';

  @override
  String get txtswitchingBetweenTypesIsPossibleLaterThroughAccountSettingsThoughCommercialAccessMayRequireAdditionalVerification =>
      'Switching between types is possible later through account settings, though commercial access may require additional verification.';

  @override
  String get txtconfirmSelection => 'Confirm Selection';

  @override
  String get txtdrawSignature => 'Draw Signature';

  @override
  String get txtclear => 'Clear';

  @override
  String get txtsave => 'Save';

  @override
  String get txtbankDetails => 'Bank Details';

  @override
  String get txtclose => 'Close';

  @override
  String get txttakeSelfie => 'Take Selfie';

  @override
  String get txtcamera => 'Camera';

  @override
  String get txtgallery => 'Gallery';

  @override
  String get txtpersonalDetails => 'Personal Details';

  @override
  String get txtphoneNumber => 'Phone Number';

  @override
  String get txtidentityVerification => 'Identity Verification';

  @override
  String get txttakeRiderPhoto => 'Take Rider Photo';

  @override
  String get txttapToCaptureYourPhoto => 'Tap to capture your photo';

  @override
  String get txtphotoCaptured => 'Photo Captured';

  @override
  String get txtdigitalSignature => 'Digital Signature';

  @override
  String get txtsignBelowToAuthorizeDocumentation =>
      'Sign below to authorize documentation.';

  @override
  String get txtalmostThere => 'Almost there!';

  @override
  String get txtnotifications => 'Notifications';

  @override
  String get txtnoNotificationsYet => 'No notifications yet';

  @override
  String get txtpreferencesSaved => 'Preferences saved';

  @override
  String get txtfailedToSavePreferences => 'Failed to save preferences';

  @override
  String get txtsavePreferences => 'Save Preferences';

  @override
  String get txtnotificationPreferences => 'Notification Preferences';

  @override
  String get txtdeleteNotification => 'Delete Notification';

  @override
  String get txtareYouSureYouWantToDeleteThisNotification =>
      'Are you sure you want to delete this notification?';

  @override
  String get txtnotificationDeleted => 'Notification deleted';

  @override
  String get txtmarkAllRead => 'MARK ALL READ';

  @override
  String get txtauthorizedSignatory => 'Authorized Signatory';

  @override
  String get txtsignedBy => 'SIGNED BY';

  @override
  String get txtdate => 'DATE';

  @override
  String get txtneedHelp => 'NEED HELP?';

  @override
  String get txtlegal => 'Legal';

  @override
  String get txtpleaseReviewAndAcceptOurLegalDocumentsToContinue =>
      'Please review and accept our legal documents to continue.';

  @override
  String get txtagreeToTerms => 'Agree to Terms';

  @override
  String get txtcontinue => 'Continue';

  @override
  String get txtskip => 'Skip';

  @override
  String get txtprivacyChoices => 'Privacy choices';

  @override
  String get txtchooseWhatVoltiumMayCollectForRiderSafetySupportAndComplianceYouCanRevokeOptionalConsentHereBeforeContinuing =>
      'Choose what Voltium may collect for rider safety, support, and compliance. You can revoke optional consent here before continuing.';

  @override
  String get txtrideTheFuture => 'Ride the Future';

  @override
  String get txtconnectingToGrid => 'CONNECTING TO GRID';

  @override
  String get txtretry => 'Retry';

  @override
  String get txteverythingIsSyncedYourVehicleIsReadyAndYourDashboardIsNowLiveEnjoyYourRide =>
      'Everything is synced. Your vehicle is ready and your dashboard is now live. Enjoy your ride!';

  @override
  String get txtsplashTagline => 'Electric scooter rentals';

  @override
  String get txtloginWelcomeSubtitle =>
      'Enter the registered phone number to login or enter a new number to create another account.';

  @override
  String get txtloginLegalIntro => 'By signing in, you agree to our';

  @override
  String get txtloginReferralHint => 'Referral Code (Optional)';

  @override
  String get txtloginSecureOtpNote => 'A secure OTP will be sent';

  @override
  String get txtloginEnterButton => 'Enter';

  @override
  String get txtloginSendingButton => 'Sending…';

  @override
  String get txtloginNetworkError => 'Network error. Please try again.';

  @override
  String get txtotpVerifyTitle => 'Verify OTP';

  @override
  String get txtotpWelcomeBack => 'Welcome Back!';

  @override
  String get txtotpSignupSubtitle => 'Enter the 6-digit code sent to ';

  @override
  String get txtotpLoginSubtitle => 'Enter the code to login to your account ';

  @override
  String get txtotpVerifyFailed => 'Failed to verify OTP. Please try again.';

  @override
  String get txtotpResendError => 'Error resending OTP';

  @override
  String get txtgoToDashboard => 'Go to Dashboard';

  @override
  String get txtpleaseLogInAgain => 'Please log in again.';

  @override
  String get txtfailedToCompletePickupPleaseTryAgain =>
      'Failed to complete pickup. Please try again.';

  @override
  String get txtfinalVerification => 'Final Verification';

  @override
  String get txtreadyToRoll => 'Ready to Roll?';

  @override
  String get txtpleaseReviewAndSignTheDigitalRentalAgreementBeforeCollectingYourVehicle =>
      'Please review and sign the digital rental agreement before collecting your vehicle.';

  @override
  String get txtdrawYourSignatureHere => 'Draw your signature here';

  @override
  String get txtiConfirmThatIHaveInspectedTheVehicleAndAcceptResponsibilityForItsCareAndTrafficCompliance =>
      'I confirm that I have inspected the vehicle and accept responsibility for its care and traffic compliance.';

  @override
  String get txtteamLeader => 'Team Leader';

  @override
  String get txtassignedTeamLeader => 'Assigned Team Leader';

  @override
  String get txtrequestSubmittedToSupportTeam =>
      'Request submitted to support team';

  @override
  String get txtvehiclePhotos => 'Vehicle Photos';

  @override
  String get txtassignedVehicle => 'ASSIGNED VEHICLE';

  @override
  String get txtpickupPhotos => 'PICKUP PHOTOS';

  @override
  String get txtbackToDashboard => 'Back to Dashboard';

  @override
  String get txtassignmentDetails => 'ASSIGNMENT DETAILS';

  @override
  String get txtemergencyContactVerifiedSuccessfully =>
      'Emergency contact verified successfully';

  @override
  String get txtvehicleCondition => 'Vehicle Condition';

  @override
  String get txtmandatory => 'MANDATORY';

  @override
  String get txtphotoWithVehicle => 'Photo with Vehicle';

  @override
  String get txttakeASelfieNextToTheVehicleBeforeRiding =>
      'Take a selfie next to the vehicle before riding';

  @override
  String get txtdeleteAccount => 'Delete Account';

  @override
  String get txtthisActionIsIrreversibleAllYourDataIncludingKycDocumentsWalletBalanceAndRentalHistoryWillBePermanentlyDeletedAreYouSure =>
      'This action is irreversible. All your data, including KYC documents, wallet balance, and rental history will be permanently deleted. Are you sure?';

  @override
  String get txtaccountDeletionIsNotYetAvailablePleaseContactSupport =>
      'Account deletion is not yet available. Please contact support.';

  @override
  String get txtsettings => 'Settings';

  @override
  String get txtphoneNumberChangeComingSoon =>
      'Phone number change coming soon';

  @override
  String get txtpasswordChangeComingSoon => 'Password change coming soon';

  @override
  String get txtselectLanguage => 'Select Language';

  @override
  String get txtenglish => 'English';

  @override
  String get txtthisActionIsIrreversible => 'This action is irreversible';

  @override
  String get txtaddEntry => 'Add Entry';

  @override
  String get txtearningsLog => 'Earnings Log';

  @override
  String get txtnoEarningsLoggedYet => 'No earnings logged yet';

  @override
  String get txtselectProfilePhoto => 'Select Profile Photo';

  @override
  String get txtfailedToCapturePhoto => 'Failed to capture photo';

  @override
  String get txtguarantorPhoneCannotBeTheSameAsYourPhone =>
      'Guarantor phone cannot be the same as your phone';

  @override
  String get txtfailedToSendOtp => 'Failed to send OTP';

  @override
  String get txtguarantorPhoneVerified => 'Guarantor phone verified';

  @override
  String get txtinvalidOtp => 'Invalid OTP';

  @override
  String get txtprofileUpdatedSuccessfully => 'Profile updated successfully';

  @override
  String get txtfailedToUpdateProfilePleaseTryAgain =>
      'Failed to update profile. Please try again.';

  @override
  String get txtsubmitForApproval => 'SUBMIT FOR APPROVAL';

  @override
  String get txteditProfile => 'Edit Profile';

  @override
  String get txtguarantorPhone => 'Guarantor Phone';

  @override
  String get txtphoneVerified => 'Phone verified';

  @override
  String get txtquickLinks => 'QUICK LINKS';

  @override
  String get txtprofile => 'Profile';

  @override
  String get txtweeklyEarnings => 'WEEKLY EARNINGS';

  @override
  String get txtthisWeek => 'THIS WEEK';

  @override
  String get txttrips => 'TRIPS';

  @override
  String get txthours => 'HOURS';

  @override
  String get txtweeklySummary => 'WEEKLY SUMMARY';

  @override
  String get txtprofileChangesRequireAdminApprovalBeforeBecomingActive =>
      'Profile changes require admin approval before becoming active.';

  @override
  String get txtlogout => 'Logout';

  @override
  String get txtreferrals => 'Referrals';

  @override
  String get txtfailedToSubscribeCheckYourBalance =>
      'Failed to subscribe. Check your balance.';

  @override
  String get txtbestValue => 'BEST VALUE';

  @override
  String get txtselectANewPlan => 'Select a new plan';

  @override
  String get txtchooseTheRentalDurationThatBestFitsYourNeedsYouCanChangeThisAtAnyTime =>
      'Choose the rental duration that best fits your needs. You can change this at any time.';

  @override
  String get txtconfirmNewPlan => 'Confirm New Plan';

  @override
  String get txterrorSubmittingReturnPleaseTryAgain =>
      'Error submitting return. Please try again.';

  @override
  String get txtrequestSubmitted => 'Request Submitted!';

  @override
  String get txtyourVehicleReturnRequestHasBeenSentForApproval =>
      'Your vehicle return request has been sent for approval.';

  @override
  String get txtendRental => 'End Rental';

  @override
  String get txtareYouSure => 'Are you sure?';

  @override
  String get txtreturningYourVehicleWillEndYourCurrentRentalPeriodMakeSureToCompleteAllInspectionSteps =>
      'Returning your vehicle will end your current rental period. Make sure to complete all inspection steps.';

  @override
  String get txtreturnInspection => 'RETURN INSPECTION';

  @override
  String get txttakeReturnPhotosOfYourVehicle =>
      'Take return photos of your vehicle';

  @override
  String get txtodometerReading => 'ODOMETER READING';

  @override
  String get txtbatteryLevel => 'Battery Level';

  @override
  String get txtiConfirmTheVehicleIsReturnedInGoodConditionWithAllAccessoriesIntact =>
      'I confirm the vehicle is returned in good condition with all accessories intact.';

  @override
  String get txtconfirmReturn => 'Confirm Return';

  @override
  String get txtpleaseTakeAllInspectionPhotosToContinue =>
      'Please take all inspection photos to continue';

  @override
  String get txtsubscriptionConfirmed => 'Subscription Confirmed!';

  @override
  String get txtyourPlanIsNowActiveYouCanNowProceedToTheNearestHubToPickUpYourVehicle =>
      'Your plan is now active. You can now proceed to the nearest hub to pick up your vehicle.';

  @override
  String get txtproceedToPickup => 'Proceed to Pickup';

  @override
  String get txtrentalDetails => 'Rental Details';

  @override
  String get txtrewards => 'Rewards';

  @override
  String get txtnoResultsFound => 'No results found';

  @override
  String get txtstillNeedHelp => 'Still need help?';

  @override
  String get txtquickTip => 'Quick Tip';

  @override
  String get txtprevious => 'PREVIOUS';

  @override
  String get txtshareYourThoughts => 'Share Your Thoughts';

  @override
  String get txtyourFeedbackHelpsUsImproveTheExperienceForEveryone =>
      'Your feedback helps us improve the experience for everyone.';

  @override
  String get txtfeedback => 'Feedback';

  @override
  String get txtsubmitFeedback => 'SUBMIT FEEDBACK';

  @override
  String get txtenjoyingVoltium => 'Enjoying Voltium?';

  @override
  String get txttakeAMomentToRateYourExperienceItHelpsUsGrow =>
      'Take a moment to rate your experience. It helps us grow!';

  @override
  String get txtrateUs => 'RATE US';

  @override
  String get txtnotNow => 'NOT NOW';

  @override
  String get txtsupportCenter => 'Support Center';

  @override
  String get txtsupportChecklist => 'Support Checklist';

  @override
  String get txtpleaseVerify => 'PLEASE VERIFY';

  @override
  String get txtbeforeCreatingATicketPleaseEnsureYouHaveCompletedTheseStepsToHelpUsResolveYourIssueFaster =>
      'Before creating a ticket, please ensure you have completed these steps to help us resolve your issue faster.';

  @override
  String get txtproceedToSupport => 'Proceed to Support';

  @override
  String get txtkeepCheckingAllItemsToProceed =>
      'Keep checking all items to proceed';

  @override
  String get txtcallNow => 'Call Now';

  @override
  String get txtwhatIssueAreYouExperiencing =>
      'What issue are you experiencing?';

  @override
  String get txttroubleshootAnotherIssue => 'Troubleshoot Another Issue';

  @override
  String get txtselectPhotoSource => 'Select Photo Source';

  @override
  String get txtraiseATicket => 'Raise a Ticket';

  @override
  String get txtissueType => 'ISSUE TYPE';

  @override
  String get txtdescription => 'DESCRIPTION';

  @override
  String get txtraiseTicket => 'RAISE TICKET';

  @override
  String get txtanswerHonestlyForTheMostAccurateDiagnosis =>
      'Answer honestly for the most accurate diagnosis.';

  @override
  String get txtyes => 'Yes';

  @override
  String get txtdiagnosticPathTaken => 'Diagnostic path taken';

  @override
  String get txttransactionHistory => 'Transaction History';

  @override
  String get txttapAnyTransactionToSeeTheFullFeeBreakdown =>
      'Tap any transaction to see the full fee breakdown';

  @override
  String get txtnoTransactionsFound => 'No transactions found';

  @override
  String get txttotalCharged => 'TOTAL CHARGED';

  @override
  String get txtenterAmount => 'Enter Amount';

  @override
  String get txthowMuchWouldYouLikeToAdd => 'How much would you like to add?';

  @override
  String get txtstep2Of3 => 'Step 2 of 3';

  @override
  String get txtproceedToPayment => 'PROCEED TO PAYMENT';

  @override
  String get txttakePhoto => 'Take Photo';

  @override
  String get txtstep3Of3 => 'Step 3 of 3';

  @override
  String get txtuploadProof => 'Upload Proof';

  @override
  String get txtedit => 'Edit';

  @override
  String get txtproofOfTopUp => 'Proof of Top Up';

  @override
  String get txtpleaseAttachAPhotoOfTheRiderGivingTheCashToAVoltiumTeamMemberOrTheReceiptOfTheOnlinePayment =>
      'Please attach a photo of the rider giving the cash to a Voltium team member or the receipt of the online payment.';

  @override
  String get txtuploadPhotoProof => 'Upload Photo Proof';

  @override
  String get txtchangePhoto => 'Change Photo';

  @override
  String get txttapToUploadPhoto => 'Tap to upload photo';

  @override
  String get txtcameraOrGallery => 'Camera or gallery';

  @override
  String get txtsubmitProof => 'Submit Proof';

  @override
  String get txtstep1Of3 => 'Step 1 of 3';

  @override
  String get txtselectPurpose => 'Select Purpose';

  @override
  String get txtstandardAmount => 'Standard Amount';

  @override
  String get txtimportantInformation => 'Important Information';

  @override
  String get txtcontinueToPayment => 'Continue to Payment';

  @override
  String get txtpaymentSubmitted => 'Payment Submitted';

  @override
  String get txtverificationInProgress => 'Verification in Progress';

  @override
  String get txttopUp => 'Top Up';

  @override
  String get txtensureThePhotoShowsBothTheRiderAndTeamMemberOrThePaymentReceipt =>
      'Ensure the photo shows both the rider and team member or the payment receipt';

  @override
  String get txtphotoUploadedSuccessfully => 'Photo uploaded successfully';

  @override
  String get txtwallet => 'Wallet';

  @override
  String get txtdeleteHistory => 'Delete History?';

  @override
  String get txtthisWillClearYourLocalTransactionHistoryThisActionCannotBeUndone =>
      'This will clear your local transaction history. This action cannot be undone.';

  @override
  String get txtsecurityDeposit => 'Security Deposit';

  @override
  String get txtelectricVehicleRentalService =>
      'Electric Vehicle Rental Service';

  @override
  String get txttransactionReceipt => 'Transaction Receipt';

  @override
  String get txtthankYouForUsingVoltium => 'Thank you for using Voltium!';

  @override
  String get txtapprovalMatrix => 'Approval Matrix';

  @override
  String get txtgoBack => 'Go Back?';

  @override
  String get txtcurrentSubscription => 'CURRENT SUBSCRIPTION';

  @override
  String get txttimeRemaining => 'TIME REMAINING';

  @override
  String get txtnextRecharge => 'NEXT RECHARGE';

  @override
  String get txtshareYourCodeWithFriends => 'Share your code with friends';

  @override
  String get txtyourCode => 'YOUR CODE';

  @override
  String get txtchangeTl => 'Change TL';

  @override
  String get txtchangeTeamLeader => 'Change Team Leader';

  @override
  String get txtpleaseProvideAReasonForChangingYourAssignedTeamLeaderThisWillBeReviewedByTheSupportTeam =>
      'Please provide a reason for changing your assigned Team Leader. This will be reviewed by the support team.';

  @override
  String get txtyourRequestHasBeenSubmittedForApproval =>
      'Your request has been submitted for approval';

  @override
  String get txtsubmitRequest => 'Submit Request';

  @override
  String get txtmanageSubscription => 'Manage Subscription';

  @override
  String get txtviewYourCurrentActivePlanDetailsBelowToChangeOrUpgradeYourPlanPleaseSubmitARequestToYourHubManager =>
      'View your current active plan details below. To change or upgrade your plan, please submit a request to your hub manager.';

  @override
  String get txtactive => 'Active';

  @override
  String get txtrequestPlanChange => 'Request Plan Change';

  @override
  String get txtcapturePhoto => 'Capture Photo';

  @override
  String get txtcancelReturnProcess => 'Cancel Return Process';

  @override
  String get txtpleaseDoNotCloseTheApp => 'Please do not close the app.';

  @override
  String get txtreturnRequestSubmitted => 'Return Request Submitted';

  @override
  String get txtyourVehicleReturnRequestIsPendingApprovalOurHubManagerWillVerifyYourSubmissionSoon =>
      'Your vehicle return request is pending approval. Our hub manager will verify your submission soon.';

  @override
  String get txtgreat => 'Great!';

  @override
  String get txtfailedToSubmitReturnRequestPleaseTryAgain =>
      'Failed to submit return request. Please try again.';

  @override
  String get txtintentUpdatedSuccessfully => 'Intent updated successfully';

  @override
  String get txtviewDetails => 'View Details';

  @override
  String get txtassignedTl => 'Assigned TL';

  @override
  String get txttopUpWallet => 'Top Up Wallet';

  @override
  String get txtrentalRecoveryStreak => 'Rental Recovery Streak';

  @override
  String get txtall => 'All';

  @override
  String get txtpleaseEnterAValidAmount => 'Please enter a valid amount';

  @override
  String get txtpleaseEnterValidTripsCount => 'Please enter valid trips count';

  @override
  String get txtpleaseEnterValidHours => 'Please enter valid hours';

  @override
  String get txtaddEarning => 'Add Earning';

  @override
  String get txtsubmit => 'Submit';

  @override
  String get txtdailyBreakdown => 'DAILY BREAKDOWN';

  @override
  String get txttryAgain => 'Try Again';

  @override
  String get txtvoltiumSoftLock => 'VOLTIUM SOFT LOCK';

  @override
  String get txtcontactVoltiumSupportToUnlock =>
      'Contact Voltium support to unlock';

  @override
  String get txtunlock => 'UNLOCK';

  @override
  String get txtvoltiumSecuritySystemV30 => 'Voltium Security System v3.0';

  @override
  String get txtnoInternetConnection => 'No internet connection';

  @override
  String get txtyouAreOffline => 'You are offline';

  @override
  String get txtbackOnline => 'Back online';

  @override
  String get txtupdateRequired => 'Update Required';

  @override
  String get txtaCriticalUpdateIsRequiredToContinueUsingTheAppThisVersionIsNoLongerSupported =>
      'A critical update is required to continue using the app. This version is no longer supported.';

  @override
  String get txtupdateNow => 'UPDATE NOW';

  @override
  String get txtlowWalletBalance => 'Low Wallet Balance';

  @override
  String get txtdismiss => 'DISMISS';

  @override
  String get txtopenSettings => 'OPEN SETTINGS';

  @override
  String get txtpickupVerification => 'Pickup Verification';

  @override
  String get txtcompleteTheVerificationStepsToAssignAndPickUpYourVehicle =>
      'Complete the verification steps to assign and pick up your vehicle';

  @override
  String get txtensureAllDetailsAreAccurateBeforeProceeding =>
      'ENSURE ALL DETAILS ARE ACCURATE BEFORE PROCEEDING';

  @override
  String get txtselectVehicle => 'Select Vehicle';

  @override
  String get txtnoVehiclesMatchYourSearch => 'No vehicles match your search';

  @override
  String get txtkycRejected => 'KYC REJECTED';

  @override
  String get txtkycApproved => 'KYC Approved';

  @override
  String get txtpending => 'PENDING';

  @override
  String get txtaccountAction => 'Account Action';

  @override
  String get txtrequired => 'Required';

  @override
  String get txtinactive => 'INACTIVE';

  @override
  String get txtriderId => 'RIDER ID';

  @override
  String get txtcontactSupportForOnboardingAssistance =>
      'Contact support for onboarding assistance';

  @override
  String get txtshare => 'Share';

  @override
  String get txtreferFriends => 'Refer Friends';

  @override
  String get txtyourReferralCode => 'Your Referral Code';

  @override
  String get txtcodeCopied => 'Code copied!';

  @override
  String get txtshareReferral => 'Share Referral';

  @override
  String get txtshareVia => 'Share via';

  @override
  String get txtlinkCopied => 'Link copied!';

  @override
  String get txtactionRequired => 'Action Required';

  @override
  String get txtelectricMobility => 'Electric Mobility';

  @override
  String get txtcredit => 'Credit';

  @override
  String get txtdebit => 'Debit';

  @override
  String get txtwalletBalance => 'Wallet Balance';

  @override
  String get txtevPlus => 'EV Plus';

  @override
  String get menu_title => 'Menu';

  @override
  String get menu_account => 'ACCOUNT';

  @override
  String get menu_profile => 'Profile';

  @override
  String get menu_myDocuments => 'My Documents';

  @override
  String get menu_rewardsMore => 'REWARDS & MORE';

  @override
  String get menu_rewards => 'Rewards';

  @override
  String get menu_referralProgram => 'Referral Program';

  @override
  String get menu_general => 'GENERAL';

  @override
  String get menu_workflowServices => 'Workflow & Services';

  @override
  String get menu_appSettings => 'App Settings';

  @override
  String get menu_language => 'Language';

  @override
  String get menu_selectLanguage => 'Select Language';

  @override
  String get menu_emergencySos => 'Emergency SOS';

  @override
  String get settings_preferences => 'PREFERENCES';

  @override
  String get settings_darkMode => 'Dark Mode';

  @override
  String get settings_appearance => 'Appearance';

  @override
  String get settings_followSystem => 'Follow System';

  @override
  String get settings_themeLight => 'Light';

  @override
  String get settings_themeDark => 'Dark';

  @override
  String get settings_supportLegal => 'SUPPORT & LEGAL';

  @override
  String get settings_feedback => 'Feedback';

  @override
  String get settings_legal => 'Legal';

  @override
  String get settings_about => 'ABOUT';

  @override
  String get settings_appVersion => 'App Version';

  @override
  String get settings_rateUs => 'Rate Us';

  @override
  String get settings_accountSection => 'ACCOUNT';

  @override
  String get settings_deleteConfirmTitle => 'Delete Account';

  @override
  String get settings_deleteConfirmBody =>
      'This action is irreversible. All your data, including KYC documents, wallet balance, and rental history will be permanently deleted. Are you sure?';

  @override
  String get settings_delete => 'Delete';

  @override
  String get settings_deleteReason => 'Requested from app settings';

  @override
  String get settings_deleteNotAvailable =>
      'Account deletion is not yet available. Please contact support.';

  @override
  String get settings_notifications => 'Notifications';

  @override
  String get settings_changePhone => 'Change Phone Number';

  @override
  String get settings_comingSoon => 'Coming soon';

  @override
  String get txtfullName => 'Full Name';

  @override
  String get txtenterFullName => 'Enter full name';

  @override
  String get txtdateOfBirth => 'Date of Birth';

  @override
  String get txtemailAddress => 'Email Address';

  @override
  String get txtenterEmailAddress => 'Enter email address';

  @override
  String get txtfathersName => 'Father\'s Name';

  @override
  String get txtenterFathersName => 'Enter father\'s name';

  @override
  String get txtmothersName => 'Mother\'s Name';

  @override
  String get txtenterMothersName => 'Enter mother\'s name';

  @override
  String get txtcurrentAddress => 'Current Address';

  @override
  String get txtenterYourFullAddress => 'Enter your full address';

  @override
  String get txtaadhaarFront => 'Aadhaar Card\n(Front)';

  @override
  String get txtaadhaarBack => 'Aadhaar Card\n(Back)';

  @override
  String get txtpanCard => 'PAN Card';

  @override
  String get txtbankName => 'Bank Name';

  @override
  String get txtaccountNumber => 'Account Number';

  @override
  String get txtifscCode => 'IFSC Code';

  @override
  String get txtclearPhotosOnly => 'Clear photos only. Max 5MB each.';

  @override
  String get txtriderProfile => 'Rider Profile';

  @override
  String get txtcompleteDetailsSubtitle =>
      'Complete your details to finish onboarding';

  @override
  String get txtconfirmAndProceed => 'Confirm & Proceed';

  @override
  String get txtensureAllDetailsAccurate =>
      'ENSURE ALL DETAILS ARE ACCURATE BEFORE PROCEEDING';

  @override
  String get txtselfieLiveCameraHint =>
      'Live camera capture required for KYC verification';

  @override
  String get txtofflineDraftBanner =>
      'You\'re offline — your draft is saved locally. Connect to internet to submit.';

  @override
  String get txtdocumentPreview => 'Document Preview';

  @override
  String get txtretakePhoto => 'Retake Photo';

  @override
  String get txtkeepPhoto => 'Keep Photo';

  @override
  String get txtuploaded => 'Uploaded';

  @override
  String get txtpermissionsTitle => 'Permissions';

  @override
  String get txtpermissionsSubtitle =>
      'Please allow the following permissions to ensure safety and functionality.';

  @override
  String get txtlocationPermName => 'Location';

  @override
  String get txtlocationPermDesc => 'Track rides and find nearby vehicles';

  @override
  String get txtnotificationsPermName => 'Notifications';

  @override
  String get txtnotificationsPermDesc => 'Receive important updates and alerts';

  @override
  String get txtbatteryPermName => 'Battery Optimization';

  @override
  String get txtbatteryPermDesc =>
      'Allow the app to run reliably in the background.';

  @override
  String get txtcameraPermName => 'Camera';

  @override
  String get txtcameraPermDesc => 'Document upload and QR scanning';

  @override
  String get txtphonePermName => 'Phone State';

  @override
  String get txtphonePermDesc => 'Phone state (for safety call detection)';

  @override
  String get txtphonePermTooltip =>
      'Reads call state (incoming/outgoing) so ride-safety features can detect emergency calls — it never reads call history or contacts.';

  @override
  String get txtcontactsPermName => 'Contacts';

  @override
  String get txtcontactsPermDesc =>
      'Access contacts for emergency SOS and referrals';

  @override
  String get txtmicPermName => 'Microphone';

  @override
  String get txtmicPermDesc => 'Required for audio recording and verification';

  @override
  String get txtdeviceAdminPermName => 'Device Admin';

  @override
  String get txtdeviceAdminPermDesc =>
      'Required for fleet security and remote lock features';

  @override
  String get txtbackgroundLocationPermName => 'Background Location';

  @override
  String get txtbackgroundLocationPermDesc =>
      'Required for trip tracking when the app is in the background.';

  @override
  String get txtcallLogPermName => 'Call Log';

  @override
  String get txtcallLogPermDesc =>
      'Used for ride-safety verification and emergency contact confirmation.';

  @override
  String get txtpreciseLocationRequired =>
      'Precise location is required. Please enable it in Settings.';

  @override
  String get txtbeforeYouBegin => 'Before You Begin';

  @override
  String get txtquickKycSubtitle => 'Quick KYC verification (~3 mins)';

  @override
  String get txtpleaseHaveReady => 'Please have these ready:';

  @override
  String get txtaadhaarCard => 'Aadhaar Card';

  @override
  String get txtaadhaarCardDesc => 'Front and back photo or E-Aadhaar PDF';

  @override
  String get txtpanCardDesc => 'For tax and identity verification';

  @override
  String get txtthreeMinutesTime => '3 Minutes of Time';

  @override
  String get txtfastAutomatedVerification => 'Fast automated verification';

  @override
  String get txtimReady => 'I\'m Ready';

  @override
  String get txtillDoThisLater => 'I\'ll do this later';

  @override
  String get txtsyncingLatestDocs => 'Syncing latest documents…';

  @override
  String get txtlegalAgreeCheckboxPrefix => 'I have read and agree to the ';

  @override
  String get txtelectronicSignature => '(Electronic Signature)';

  @override
  String get txtlegalHelpText =>
      'If you have any questions about our policies, please contact our support team at ';

  @override
  String get txtorCall => ' or call ';

  @override
  String get txtdidntReceiveCode => 'DIDN\'T RECEIVE THE CODE?';

  @override
  String get txtresendCode => 'Resend Code';

  @override
  String txtresendIn(int seconds) {
    return 'Resend in ${seconds}s';
  }

  @override
  String get txtverifying => 'Verifying…';

  @override
  String get txtverifyAndProceed => 'Verify & Proceed';

  @override
  String get txtgreetingMorning => 'Good Morning';

  @override
  String get txtgreetingAfternoon => 'Good Afternoon';

  @override
  String get txtgreetingEvening => 'Good Evening';

  @override
  String get txtguestRider => 'Rider';

  @override
  String get txtshowingCachedData => 'Showing cached data';

  @override
  String get txtnoDataAvailable => 'No data available';

  @override
  String get txtvehiclePendingAssignment => 'Vehicle Pending Assignment';

  @override
  String get txtnoPlan => 'NO PLAN';

  @override
  String get txtweeklyPayment => 'WEEKLY PAYMENT';

  @override
  String get txtdailyPayment => 'DAILY PAYMENT';

  @override
  String get txtmonthlyPayment => 'MONTHLY PAYMENT';

  @override
  String get txtexpired => 'Expired';

  @override
  String get txtexpiresToday => 'Expires Today';

  @override
  String txtdaysCount(int count) {
    return '$count Days';
  }

  @override
  String get txttotalBalance => 'TOTAL BALANCE';

  @override
  String get txtavailableBalance => 'AVAILABLE BALANCE';

  @override
  String txtstreakDays(int current, int total) {
    return '$current/$total Days';
  }

  @override
  String txtminRechargeNotice(String amount) {
    return 'A minimum recharge of ₹$amount is required to proceed further.';
  }

  @override
  String txtlowBalanceWarningNotice(int amount) {
    return 'Top Up Now to Ride. Your balance is insufficient. Min top-up: ₹$amount.';
  }

  @override
  String get txttopUpWalletAction => 'Top Up Wallet';

  @override
  String get txtshareCodeWithFriends => 'Share your code with friends';

  @override
  String get txtreferralCodeCopied => 'Referral code copied!';

  @override
  String txtshareReferralMessage(String code) {
    return 'Use my code $code to join Voltium!';
  }

  @override
  String get txtjoinVoltiumSubject => 'Join Voltium';

  @override
  String get txtviewDetailsAction => 'View Details';

  @override
  String get txtnotAssigned => 'Not assigned';

  @override
  String get txtassignedTlBadge => 'Assigned TL';

  @override
  String get txttlPendingNotice => 'Your hub will assign a team leader shortly';

  @override
  String get txtnoContactNumberTl =>
      'No contact number available for your Team Leader.';

  @override
  String get txtcouldNotOpenDialer =>
      'Could not open the phone dialer. Please try again.';

  @override
  String get txtscooterSubmissionRequired => 'Scooter Submission\nRequired';

  @override
  String get txtpendingReturnSubmission => 'Pending return submission';

  @override
  String txtsubmissionDatePrefix(String date) {
    return 'Submission Date: $date';
  }

  @override
  String txthubNamePrefix(String hub) {
    return 'Hub Name: $hub';
  }

  @override
  String get txtdesignatedHub => 'Designated Hub';

  @override
  String get txtupcomingRentDebit => 'UPCOMING RENT DEBIT';

  @override
  String get txttopUpBeforeTomorrow6am => 'Top-up before tomorrow 6 AM';

  @override
  String txtrentDebitNoticeShortfall(
      String rent, String balance, String shortfall) {
    return 'Rent of ₹$rent will be debited automatically. Your current wallet balance is ₹$balance (shortfall: ₹$shortfall).';
  }

  @override
  String txtrentDebitNoticeSufficient(String rent, String balance) {
    return 'Rent of ₹$rent will be debited tomorrow 6 AM. Wallet balance ₹$balance is sufficient.';
  }

  @override
  String txttopUpAmountAction(String amount) {
    return 'Top up ₹$amount';
  }

  @override
  String get txtchangeTeamLeaderTitle => 'Change Team Leader';

  @override
  String get txtchangeTlReasonPrompt =>
      'Please provide a reason for changing your assigned Team Leader. This will be reviewed by the support team.';

  @override
  String get txtenterReasonHint => 'Enter your reason here...';

  @override
  String get txtprovideDetailedReason =>
      'Please provide a detailed reason (at least 5 characters)';

  @override
  String get txttlChangeSubmitted =>
      'Your TL change request has been submitted for approval';

  @override
  String txtfailedToSubmitRequest(String error) {
    return 'Failed to submit request: $error';
  }

  @override
  String get txtmanageSubscriptionTitle => 'Manage Subscription';

  @override
  String get txtmanageSubscriptionSubtitle =>
      'View your current active plan details below. To change or upgrade your plan, please submit a request to your hub manager.';

  @override
  String get txtactiveBadge => 'Active';

  @override
  String get txtperDay => '/ day';

  @override
  String get txtperWeek => '/ week';

  @override
  String get txtperMonth => '/ month';

  @override
  String get txtrequestPlanChangeButton => 'Request Plan Change';

  @override
  String get txtendRentalButton => 'End Rental';

  @override
  String get txtchangeIntentButton => 'Change Intent of Use';

  @override
  String txtchangeIntentPrefix(String intent) {
    return 'Change Intent: $intent';
  }

  @override
  String txtstepXofY(int current, int total) {
    return 'Step $current of $total';
  }

  @override
  String txtcaptureViewOfVehicle(String view) {
    return 'Capture $view of Vehicle';
  }

  @override
  String get txtensureClearPhotoPrompt =>
      'Ensure the photo is clear and well-lit for faster approval.';

  @override
  String get txtcapturePhotoBtn => 'Capture Photo';

  @override
  String get txtcancelReturnProcessBtn => 'Cancel Return Process';

  @override
  String get txtuploadingPhotosSubmitting =>
      'Uploading photos & submitting request...';

  @override
  String get txtdoNotCloseApp => 'Please do not close the app.';

  @override
  String get txtreturnRequestSubmittedTitle => 'Return Request Submitted';

  @override
  String get txtreturnRequestSubmittedBody =>
      'Your vehicle return request is pending approval. Our hub manager will verify your submission soon.';

  @override
  String get txtgreatBtn => 'Great!';

  @override
  String get txtfailedToSubmitReturn =>
      'Failed to submit return request. Please try again.';

  @override
  String get txtleftSide => 'Left Side';

  @override
  String get txtrightSide => 'Right Side';

  @override
  String get txtfrontView => 'Front View';

  @override
  String get txtspeedometer => 'Speedometer';

  @override
  String get txtpersonalUse => 'Personal Use';

  @override
  String get txtecommerceDelivery => 'E-commerce Delivery';

  @override
  String get txtfoodDelivery => 'Food Delivery';

  @override
  String get txtother => 'Other';

  @override
  String get txtrentalDetailsTitle => 'Rental Details';

  @override
  String get txtcurrentPlanSection => 'CURRENT PLAN';

  @override
  String get txtnoActivePlan => 'No Active Plan';

  @override
  String get txtperCycle => ' / cycle';

  @override
  String get txtrentalInformation => 'Rental Information';

  @override
  String get txtstartDate => 'Start Date';

  @override
  String get txtendDate => 'End Date';

  @override
  String get txtpaymentStreak => 'Payment Streak';

  @override
  String get txtchangePlan => 'Change Plan';

  @override
  String get txtpickupHub => 'Pickup Hub';

  @override
  String get txtintentUpdatedSuccess => 'Intent updated successfully';

  @override
  String txtfailedToUpdateIntent(String error) {
    return 'Failed to update intent: $error';
  }

  @override
  String get txtteamLeaderInfoDescription =>
      'Your team leader is your primary point of contact for daily operations, route guidance, and on-ground support.';

  @override
  String get txtrequestTlChange => 'Request Team Leader change';

  @override
  String get txtback => 'Back';

  @override
  String get txtselectTeamLeader => 'Select Team Leader';

  @override
  String get txtcall => 'Call';

  @override
  String get txtnotProvided => 'Not provided';

  @override
  String get txtemergencyContact => 'Emergency Contact';

  @override
  String get txtkycStatusTitle => 'KYC STATUS';

  @override
  String get txtguarantorStatusTitle => 'GUARANTOR';

  @override
  String get txtvehicleTitle => 'Vehicle';

  @override
  String get txtaddress => 'Address';

  @override
  String get txtunderReview => 'Under Review';

  @override
  String get txtphone => 'Phone';

  @override
  String get txtverifiedAndSecure => 'Verified & Secure';

  @override
  String get txtidentityGuarantorVerifiedDesc =>
      'Your identity and guarantor information have been verified. You can view or download copies of your documents below.';

  @override
  String get txtverificationInProgressDesc =>
      'Your verification is in progress. Some documents may still be under review by our safety team.';

  @override
  String get txtyourDocuments => 'YOUR DOCUMENTS';

  @override
  String get txtguarantorDocuments => 'GUARANTOR\'S DOCUMENTS';

  @override
  String txtfilesCount(int count) {
    return '$count FILES';
  }

  @override
  String get txtaadhaarCardFront => 'Aadhaar Card (Front)';

  @override
  String get txtaadhaarCardBack => 'Aadhaar Card (Back)';

  @override
  String get txtpanCardLabel => 'PAN Card';

  @override
  String get txtguarantorAadhaarFront => 'Guarantor\'s Aadhaar (Front)';

  @override
  String get txtguarantorAadhaarBack => 'Guarantor\'s Aadhaar (Back)';

  @override
  String get txtguarantorPanCard => 'Guarantor\'s PAN Card';

  @override
  String get txtverificationVideo => 'Verification Video';

  @override
  String get txtguarantorSignatureDoc => 'Guarantor\'s Signature';

  @override
  String get txtverifiedAndActive => 'Verified & Active';

  @override
  String get txtopenExternal => 'Open External';

  @override
  String get txtriderNotFound => 'Rider not found. Please contact support.';

  @override
  String get txtriderSessionNotReady =>
      'Could not submit: rider session is not ready yet. Please try again in a moment.';

  @override
  String get txtsessionExpiredPleaseLogIn =>
      'Your session expired. Please log in again to continue.';

  @override
  String get txtsecurityDepositProofSubmitted =>
      'Security deposit proof submitted — we\'ll review it shortly.';

  @override
  String get txttopUpProofSubmitted => 'Top-up proof submitted successfully!';

  @override
  String get txtfailedToDeleteNotification => 'Failed to delete notification';

  @override
  String get txterrWalletLoadFailed =>
      'Couldn\'t load your transactions. Pull to retry.';

  @override
  String get txtlockedOverlayEnterPassword => 'Please enter password.';

  @override
  String get txtlockedOverlayPasswordMustBe12Digits =>
      'Password must be a 12 digit number.';

  @override
  String get txtlockedOverlayIncorrectPassword =>
      'Incorrect Password. Contact Voltium support.';

  @override
  String get txtlockedOverlayVerificationFailed =>
      'Verification failed. Please check your network and try again.';

  @override
  String get txtlockedOverlayAccountLocked =>
      'Your account has been locked by Voltium.';

  @override
  String get txtlockedOverlayContactSupportToUnlock =>
      'Please contact support to unlock.';
}
