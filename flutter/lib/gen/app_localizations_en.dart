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
  String get txtverify => 'Verify';

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
  String get txtsecurityDeposit => 'SECURITY DEPOSIT';

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
}
