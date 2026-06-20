// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hindi (`hi`).
class AppLocalizationsHi extends AppLocalizations {
  AppLocalizationsHi([String locale = 'hi']) : super(locale);

  @override
  String get appTitle => 'वोल्टफ्लीट';

  @override
  String get common_loading => 'लोड हो रहा है...';

  @override
  String get common_error => 'कुछ गलत हो गया';

  @override
  String get common_retry => 'पुनः प्रयास करें';

  @override
  String get common_offline => 'आप ऑफ़लाइन हैं';

  @override
  String get common_offlineMessage =>
      'दिखाया गया डेटा पुराना हो सकता है। फिर से कनेक्ट होने पर कार्रवाइयां सिंक हो जाएंगी।';

  @override
  String get common_syncing => 'सिंक हो रहा है...';

  @override
  String common_pendingSync(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count कार्रवाइयां सिंक होंगी',
      two: '$count कार्रवाइयां सिंक होंगी',
      one: '1 कार्रवाई सिंक होगी',
      zero: '',
    );
    return '$_temp0';
  }

  @override
  String get common_savedOffline =>
      'ऑफ़लाइन सहेजा गया — कनेक्ट होने पर भेजा जाएगा';

  @override
  String get common_noData => 'कोई डेटा उपलब्ध नहीं';

  @override
  String get common_currencyRupee => '₹';

  @override
  String common_rupeeAmount(String amount) {
    return '₹$amount';
  }

  @override
  String get common_cancel => 'रद्द करें';

  @override
  String get common_save => 'सहेजें';

  @override
  String get common_confirm => 'पुष्टि करें';

  @override
  String get common_close => 'बंद करें';

  @override
  String get common_fromCache => 'कैश्ड डेटा दिखा रहे हैं';

  @override
  String get common_updated => 'अभी अपडेट किया गया';

  @override
  String get dashboard_title => 'वोल्टफ्लीट';

  @override
  String get dashboard_subtitle => 'डैशबोर्ड';

  @override
  String get dashboard_statusActive => 'खाता सक्रिय';

  @override
  String get dashboard_statusSuspended => 'खाता निलंबित';

  @override
  String get dashboard_statusPreActive => 'सक्रियता लंबित';

  @override
  String get dashboard_welcomeBack => 'वापस स्वागत है,';

  @override
  String get dashboard_subscription => 'वर्तमान सदस्यता';

  @override
  String get dashboard_timeRemaining => 'शेष समय';

  @override
  String get dashboard_nextRecharge => 'अगला रिचार्ज';

  @override
  String get dashboard_manageSubscription => 'सदस्यता प्रबंधित करें';

  @override
  String get dashboard_activeHub => 'सक्रिय हब';

  @override
  String get dashboard_teamLeader => 'टीम लीडर';

  @override
  String get dashboard_inviteEarnTitle => 'दोस्तों को रेफ़र करें, इनाम पाएं!';

  @override
  String get dashboard_inviteEarnSubtitle => 'रेफ़र करें और कमाएं';

  @override
  String get dashboard_referralCopied => 'रेफ़रल कोड कॉपी किया गया!';

  @override
  String get dashboard_todaysPerformance => 'आज का प्रदर्शन';

  @override
  String get dashboard_distance => 'दूरी';

  @override
  String get dashboard_power => 'पावर';

  @override
  String get dashboard_assignedVehicle => 'असाइन वाहन';

  @override
  String get dashboard_vehicleDetails => 'विवरण';

  @override
  String dashboard_kilometers(String km) {
    return '$km किमी';
  }

  @override
  String dashboard_kwh(String kwh) {
    return '$kwh kWh';
  }

  @override
  String get dashboard_notifications => 'सूचनाएं';

  @override
  String get dashboard_rentalDetails => 'किराया विवरण';

  @override
  String get dashboard_choosePlan => 'प्लान चुनें';

  @override
  String get suspension_negativeBalance => 'वॉलेट बैलेंस ₹0 से नीचे';

  @override
  String suspension_negativeBalanceDesc(String amount) {
    return 'आपके वॉलेट में ₹$amount की नकारात्मक शेष राशि है। कृपया अपना खाता बहाल करने के लिए टॉप अप करें।';
  }

  @override
  String get suspension_lowBalance => 'कम वॉलेट बैलेंस';

  @override
  String suspension_lowBalanceDesc(String amount) {
    return 'आपका वॉलेट बैलेंस ₹$amount है। दैनिक किराया शुल्क निलंबन का कारण बन सकता है।';
  }

  @override
  String get suspension_kycPending => 'KYC सत्यापन लंबित';

  @override
  String suspension_kycPendingDesc(String status) {
    return 'आपका KYC $status है। अपना खाता सक्रिय करने के लिए दस्तावेज़ सत्यापन पूरा करें।';
  }

  @override
  String get suspension_depositPending => 'सुरक्षा जमा आवश्यक';

  @override
  String get suspension_depositPendingDesc =>
      'आपकी सुरक्षा जमा प्राप्त या स्वीकृत नहीं हुई है। कृपया भुगतान करें।';

  @override
  String get suspension_planExpired => 'सदस्यता समाप्त';

  @override
  String get suspension_planExpiredDesc =>
      'आपकी किराया योजना समाप्त हो गई है। चालना जारी रखने के लिए नई योजना चुनें।';

  @override
  String get suspension_noActivePlan => 'कोई सक्रिय सदस्यता नहीं';

  @override
  String get suspension_noActivePlanDesc =>
      'वोल्टफ्लीट सेवाओं का उपयोग करने के लिए आपके पास सक्रिय किराया योजना होनी चाहिए।';

  @override
  String get suspension_returnRequired => 'वाहन वापसी अतिदेय';

  @override
  String get suspension_returnRequiredDesc =>
      'आपकी वाहन वापसी अतिदेय है। जुर्माना से बचने के लिए कृपया वाहन वापस करें।';

  @override
  String get suspension_terminated => 'खाता समाप्त';

  @override
  String get suspension_terminatedDesc =>
      'आपका खाता समाप्त कर दिया गया है। सहायता के लिए कृपया सपोर्ट से संपर्क करें।';

  @override
  String get suspension_topUpNow => 'अभी टॉप अप करें';

  @override
  String get suspension_resubmitKyc => 'KYC दोबारा भेजें';

  @override
  String get suspension_completeKyc => 'KYC पूरा करें';

  @override
  String get suspension_payDeposit => 'जमा भरें';

  @override
  String get suspension_choosePlan => 'प्लान चुनें';

  @override
  String get suspension_endRental => 'किराया समाप्त करें';

  @override
  String get suspension_contactSupport => 'सपोर्ट से संपर्क करें';

  @override
  String get wallet_title => 'मेरा वॉलेट';

  @override
  String get wallet_availableBalance => 'उपलब्ध बैलेंस';

  @override
  String get wallet_paymentStreak => 'भुगतान स्ट्रीक';

  @override
  String wallet_streakOf(int days) {
    return '$days / 5 दिन';
  }

  @override
  String wallet_streakMessage(int days) {
    return '$days दिन की स्ट्रीक! प्रीमियम टियर अनलॉक करने के लिए जारी रखें।';
  }

  @override
  String get wallet_topUp => 'टॉप अप';

  @override
  String get wallet_history => 'इतिहास';

  @override
  String get wallet_transactionHistory => 'लेनदेन इतिहास';

  @override
  String get wallet_viewAll => 'सभी देखें';

  @override
  String get wallet_recentTransactions => 'हालिया लेनदेन';

  @override
  String get wallet_noTransactions => 'अभी तक कोई लेनदेन नहीं';

  @override
  String get wallet_dailyRental => 'दैनिक किराया';

  @override
  String get wallet_weeklyPlan => 'साप्ताहिक प्लान';

  @override
  String get wallet_securityDeposit => 'सुरक्षा जमा';

  @override
  String get wallet_topUpUpi => 'टॉप अप — UPI';

  @override
  String get wallet_loyaltyReward => 'लॉयल्टी इनाम';

  @override
  String get wallet_penalty => 'जुर्माना';

  @override
  String get wallet_refund => 'रिफ़ंड';

  @override
  String get wallet_statusPending => 'लंबित';

  @override
  String get wallet_statusApproved => 'स्वीकृत';

  @override
  String get wallet_statusRejected => 'अस्वीकृत';

  @override
  String get wallet_streakKeepGoing =>
      '5 दिन की स्ट्रीक बनाए रखने से प्रीमियम टियर अनलॉक होते हैं';

  @override
  String wallet_unlockPremiumTiers(int days) {
    return '$days दिन की स्ट्रीक! प्रीमियम टियर अनलॉक करने के लिए जारी रखें।';
  }

  @override
  String get history_title => 'लेनदेन इतिहास';

  @override
  String get history_credits => 'क्रेडिट';

  @override
  String get history_debits => 'डेबिट';

  @override
  String get history_all => 'सभी';

  @override
  String get history_searchHint => 'लेनदेन खोजें...';

  @override
  String get history_noResults => 'कोई लेनदेन नहीं मिला';

  @override
  String get history_tapBreakdown =>
      'पूर्ण शुल्क विवरण देखने के लिए किसी भी लेनदेन पर टैप करें';

  @override
  String get history_netAmount => 'शुद्ध';

  @override
  String get history_totalCharged => 'कुल शुल्क';

  @override
  String history_includesTax(String amount) {
    return 'करों में ₹$amount शामिल';
  }

  @override
  String history_savedAmount(String amount) {
    return '₹$amount बचाए';
  }

  @override
  String get history_baseRentalFee => 'आधार किराया शुल्क';

  @override
  String get history_gst => 'GST (18%)';

  @override
  String get history_lateReturnSurcharge => 'विलंब वापसी अधिभार';

  @override
  String get history_streakDiscount => 'स्ट्रीक छूट';

  @override
  String get history_penaltyAmount => 'जुर्माना राशि';

  @override
  String get history_gstOnSurcharge => 'अधिभार पर GST (18%)';

  @override
  String get history_typeCharge => 'शुल्क';

  @override
  String get history_typeTax => 'कर';

  @override
  String get history_typeDiscount => 'छूट';

  @override
  String get history_typePenalty => 'जुर्माना';

  @override
  String get history_typeInfo => 'जानकारी';

  @override
  String get settings_title => 'सेटिंग्स';

  @override
  String get settings_appSection => 'ऐप सेटिंग्स';

  @override
  String get settings_language => 'भाषा';

  @override
  String get settings_languageDesc => 'अपनी पसंदीदा भाषा चुनें';

  @override
  String get settings_english => 'English';

  @override
  String get settings_hindi => 'हिंदी';

  @override
  String get settings_securitySection => 'सुरक्षा';

  @override
  String get settings_changePassword => 'पासवर्ड बदलें';

  @override
  String get settings_biometricLogin => 'बायोमेट्रिक लॉगिन';

  @override
  String get settings_aboutSection => 'के बारे में';

  @override
  String settings_version(String version) {
    return 'संस्करण $version';
  }

  @override
  String get settings_privacyPolicy => 'गोपनीयता नीति';

  @override
  String get settings_termsOfService => 'सेवा की शर्तें';

  @override
  String get settings_logout => 'लॉग आउट';

  @override
  String get settings_logoutConfirm => 'क्या आप लॉग आउट करना चाहते हैं?';

  @override
  String get settings_deleteAccount => 'खाता हटाएं';

  @override
  String get settings_notificationPreferences => 'सूचना प्राथमिकताएं';

  @override
  String get nav_home => 'होम';

  @override
  String get nav_wallet => 'वॉलेट';

  @override
  String get nav_support => 'सहायता';

  @override
  String get nav_profile => 'प्रोफ़ाइल';

  @override
  String onboarding_welcome(String name) {
    return 'आपका स्वागत है, $name!';
  }

  @override
  String get onboarding_completeProfile =>
      'अपना खाता सक्रिय करने और वोल्टफ्लीट के साथ अपनी यात्रा शुरू करने के लिए निम्नलिखित चरणों को पूरा करें।';

  @override
  String get onboarding_nextStep => 'अगला कदम';

  @override
  String get onboarding_completeKyc => 'KYC पूरा करें';

  @override
  String get onboarding_addGuarantor => 'गारंटर जोड़ें';

  @override
  String get onboarding_payDeposit => 'जमा राशि भरें';

  @override
  String get onboarding_choosePlan => 'प्लान चुनें';

  @override
  String get onboarding_schedulePickup => 'पिकअप शेड्यूल करें';

  @override
  String get onboarding_confirmed => 'सदस्यता की पुष्टि हो गई!';

  @override
  String get onboarding_planActive =>
      'आपका प्लान अब सक्रिय है। अब आप अपना वाहन लेने के लिए नजदीकी हब पर जा सकते हैं।';

  @override
  String get onboarding_proceedToPickup => 'पिकअप के लिए आगे बढ़ें';

  @override
  String get onboarding_selectHub => 'पिकअप हब चुनें';

  @override
  String get onboarding_connectVehicle => 'वाहन कनेक्ट करें';

  @override
  String get onboarding_verifyVehicle => 'वाहन सत्यापित करें';

  @override
  String get onboarding_inspection => 'वाहन निरीक्षण';

  @override
  String get onboarding_capturePhoto => 'पिकअप फोटो लें';

  @override
  String get onboarding_finalVerification => 'अंतिम सत्यापन';

  @override
  String get onboarding_readyToRoll => 'तैयार हैं?';

  @override
  String get onboarding_reviewSign =>
      'अपना वाहन संग्रह पूरा करने के लिए समीक्षा करें और हस्ताक्षर करें।';

  @override
  String get onboarding_signature => 'डिजिटल हस्ताक्षर';

  @override
  String get onboarding_completeStart => 'पूरा करें और सवारी शुरू करें';

  @override
  String get onboarding_youAreLive => 'आप लाइव हैं!';

  @override
  String get onboarding_successBody =>
      'सब कुछ सिंक हो गया है। आपका वाहन तैयार है और आपका डैशबोर्ड अब लाइव है। अपनी सवारी का आनंद लें!';

  @override
  String get onboarding_goToDashboard => 'डैशबोर्ड पर जाएं';

  @override
  String get dashboard_syncingIndicator =>
      'सिंक हो रहा है... 1 लंबित कार्रवाई अपलोड की जा रही है';

  @override
  String get dashboard_riderLabel => 'राइडर';

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
