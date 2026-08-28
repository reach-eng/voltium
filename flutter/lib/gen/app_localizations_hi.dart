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
  String get wallet_filterRent => 'किराया';

  @override
  String get wallet_filterSecurity => 'सुरक्षा जमा';

  @override
  String get wallet_filterDeduction => 'कटौती';

  @override
  String get wallet_statusRefundable => 'रिफ़ंड योग्य';

  @override
  String get wallet_statusNonRefundable => 'गैर-रिफ़ंड योग्य';

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
  String get txtwelcome => 'स्वागत है';

  @override
  String get txttermsOfService => 'सेवा की शर्तें';

  @override
  String get txtprivacyPolicy => 'गोपनीयता नीति';

  @override
  String get txtotpCodeResentSuccessfully =>
      'OTP कोड सफलतापूर्वक दोबारा भेजा गया!';

  @override
  String get txtinitializeSystem => 'सिस्टम शुरू करें';

  @override
  String get txtaddContact => 'संपर्क जोड़ें';

  @override
  String get txtaddEmergencyContact => 'आपातकालीन संपर्क जोड़ें';

  @override
  String get txtcancel => 'रद्द करें';

  @override
  String get txtadd => 'जोड़ें';

  @override
  String get txtsetAsPrimary => 'प्राथमिक बनाएं';

  @override
  String get txtdelete => 'हटाएं';

  @override
  String get txtemergencySos => 'आपातकालीन SOS';

  @override
  String get txtsosAlertTriggeredDialing =>
      'SOS अलर्ट सक्रिय! आपातकालीन सेवाओं (112) को डायल किया जा रहा है...';

  @override
  String get txtotpSentToGuarantorPhone => 'गारंटर के फ़ोन पर OTP भेजा गया';

  @override
  String get txtphoneVerifiedSuccessfully => 'फ़ोन सफलतापूर्वक सत्यापित';

  @override
  String get txtguarantorDetails => 'गारंटर विवरण';

  @override
  String get txtguarantorPhoneNumber => 'गारंटर फ़ोन नंबर';

  @override
  String get txtphoneNumberVerified => 'फ़ोन नंबर सत्यापित';

  @override
  String get txtenterOtp => 'OTP डालें';

  @override
  String get txtverifyOtp => 'OTP सत्यापित करें';

  @override
  String get txtclearPhotosOnlyMax5mbEach => 'साफ़ फ़ोटो। प्रत्येक अधिकतम 5MB।';

  @override
  String get txtunableToOpenDocument => 'दस्तावेज़ खोल नहीं पा रहे';

  @override
  String get txtreferAndEarn => 'रेफ़र करें और कमाएँ';

  @override
  String get txtrefresh => 'रिफ़्रेश करें';

  @override
  String txtfailedToUploadProof(String error) {
    return 'प्रूफ़ अपलोड करने में विफल: $error';
  }

  @override
  String get txtpleaseUploadPaymentProof =>
      'कृपया सबमिट करने से पहले भुगतान प्रूफ़ अपलोड करें।';

  @override
  String txtfailedToSubmitDeposit(String error) {
    return 'डिपॉज़िट सबमिट करने में विफल: $error';
  }

  @override
  String get txtdiscard => 'छोड़ें';

  @override
  String get txtremovePhoto => 'फ़ोटो हटाएं';

  @override
  String txtupToNPhotosPerTicket(String count) {
    return 'प्रति टिकट अधिकतम $count फ़ोटो';
  }

  @override
  String get txtticketCreatedSuccessfully => 'टिकट सफलतापूर्वक बनाया गया';

  @override
  String txtfailedToCreateTicket(String error) {
    return 'टिकट बनाने में विफल: $error';
  }

  @override
  String txtfailedToSubmitFeedback(String error) {
    return 'फ़ीडबैक सबमिट करने में विफल: $error';
  }

  @override
  String get txtcreateTicket => 'टिकट बनाएं';

  @override
  String txtcallNumberForEmergencyAssistance(String number) {
    return 'क्या आप आपातकालीन सहायता के लिए $number पर कॉल करना चाहते हैं?';
  }

  @override
  String get txtadvanceRentalPlanFee => 'अग्रिम किराया योजना शुल्क';

  @override
  String get txttopUpProofSubmittedSuccessfully =>
      'टॉप अप प्रूफ़ सफलतापूर्वक सबमिट किया गया!';

  @override
  String get txtupiIdCopiedToClipboard => 'UPI ID क्लिपबोर्ड पर कॉपी किया गया';

  @override
  String get txttopUpAmountAddedToWallet =>
      'टॉप अप राशि (वॉलेट में जोड़ी जाएगी)';

  @override
  String get txttotalPayable => 'कुल देय राशि';

  @override
  String get txtchangeLockPassword => 'लॉक पासवर्ड बदलें';

  @override
  String get txtlockPassword => 'लॉक पासवर्ड';

  @override
  String get txtlockPasswordSubtitle =>
      'सुरक्षा कॉन्फ़िगरेशन सत्यापित करने के लिए अपने डिवाइस का लॉक पासवर्ड दर्ज करें।';

  @override
  String get txtlockPasswordVerifyFailed => 'लॉक पासवर्ड सत्यापन विफल';

  @override
  String get txtverify => 'सत्यापित करें';

  @override
  String get txtenterAValid10DigitNumber =>
      'एक मान्य 10 अंकों का नंबर दर्ज करें';

  @override
  String get txtenterThe6DigitOtp => '6 अंकों का OTP दर्ज करें';

  @override
  String get txtmyDocuments => 'मेरे दस्तावेज़';

  @override
  String get txtsecurityProfile => 'सुरक्षा प्रोफ़ाइल';

  @override
  String get txtnoDocumentsSubmittedYet => 'अभी तक कोई दस्तावेज़ जमा नहीं हुआ';

  @override
  String get txtverified => 'सत्यापित';

  @override
  String get txthavingTroubleWithDocuments => 'दस्तावेज़ों में परेशानी?';

  @override
  String get txtifYouSeeAnyIssuesWithYourVerifiedDocumentsOrNeedToUpdateThemPleaseRaiseASupportTicket =>
      'अगर आपके सत्यापित दस्तावेज़ों में कोई समस्या है या उन्हें अपडेट करना है, तो कृपया सपोर्ट टिकट उठाएं।';

  @override
  String get txtcontactSupport => 'सपोर्ट से संपर्क करें';

  @override
  String get txtdrawSignature => 'हस्ताक्षर बनाएं';

  @override
  String get txtclear => 'साफ़ करें';

  @override
  String get txtsave => 'सहेजें';

  @override
  String get txtbankDetails => 'बैंक विवरण';

  @override
  String get txttakeSelfie => 'सेल्फी लें';

  @override
  String get txtpersonalDetails => 'व्यक्तिगत विवरण';

  @override
  String get txtphoneNumber => 'फ़ोन नंबर';

  @override
  String get txtidentityVerification => 'पहचान सत्यापन';

  @override
  String get txttakeRiderPhoto => 'राइडर की फ़ोटो लें';

  @override
  String get txttapToCaptureYourPhoto => 'अपनी फ़ोटो के लिए टैप करें';

  @override
  String get txtphotoCaptured => 'फ़ोटो कैप्चर हो गई';

  @override
  String get txtsignBelowToAuthorizeDocumentation =>
      'दस्तावेज़ प्रमाणित करने के लिए नीचे हस्ताक्षर करें।';

  @override
  String get txtpreferencesSaved => 'प्राथमिकताएं सहेजी गईं';

  @override
  String get txtfailedToSavePreferences => 'प्राथमिकताएं सहेज नहीं पाए';

  @override
  String get txtsavePreferences => 'प्राथमिकताएं सहेजें';

  @override
  String get txtnotificationPreferences => 'सूचना प्राथमिकताएं';

  @override
  String get notif_prefsMasterSection => 'मुख्य टॉगल';

  @override
  String get notif_prefsPushTitle => 'पुश नोटिफ़िकेशन';

  @override
  String get notif_prefsPushSubtitle =>
      'Voltium से पुश नोटिफ़िकेशन प्राप्त करें';

  @override
  String get notif_prefsSoundTitle => 'ध्वनि';

  @override
  String get notif_prefsSoundSubtitle => 'नोटिफ़िकेशन के लिए ध्वनि बजाएं';

  @override
  String get notif_prefsVibrationTitle => 'कंपन';

  @override
  String get notif_prefsVibrationSubtitle => 'नोटिफ़िकेशन के लिए कंपन करें';

  @override
  String get notif_prefsCategoriesSection => 'नोटिफ़िकेशन श्रेणियाँ';

  @override
  String get notif_prefsPaymentsTitle => 'भुगतान';

  @override
  String get notif_prefsPaymentsSubtitle => 'टॉप अप, किराया कटौती, रिफ़ंड';

  @override
  String get notif_prefsKycTitle => 'KYC';

  @override
  String get notif_prefsKycSubtitle => 'दस्तावेज़ सत्यापन अपडेट';

  @override
  String get notif_prefsMaintenanceTitle => 'रखरखाव';

  @override
  String get notif_prefsMaintenanceSubtitle => 'सर्विस रिमाइंडर, बैटरी स्वैप';

  @override
  String get notif_prefsAnnouncementsTitle => 'घोषणाएं';

  @override
  String get notif_prefsAnnouncementsSubtitle =>
      'प्रमोशन, ऑफ़र, प्लेटफ़ॉर्म अपडेट';

  @override
  String get txtnotificationDeleted => 'सूचना हटा दी गई';

  @override
  String get txtsignedBy => 'द्वारा हस्ताक्षरित';

  @override
  String get txtdate => 'तारीख';

  @override
  String get txtneedHelp => 'मदद चाहिए?';

  @override
  String get txtlegal => 'कानूनी';

  @override
  String get txtpleaseReviewAndAcceptOurLegalDocumentsToContinue =>
      'आगे बढ़ने के लिए कृपया हमारे कानूनी दस्तावेज़ों की समीक्षा करें और स्वीकार करें।';

  @override
  String get txtagreeToTerms => 'शर्तें स्वीकार करें';

  @override
  String get txtcontinue => 'जारी रखें';

  @override
  String get txtguarantorSkipTitle => 'गारंटर छोड़ें?';

  @override
  String txtguarantorSkipBody(String amount) {
    return 'गारंटर छोड़ने पर आपकी योजना की जमा राशि के अतिरिक्त $amount की उच्च सुरक्षा जमा राशि लगेगी। यह राशि वोल्टियम द्वारा तय की जाती है और बदल सकती है। किराया शुरू करते समय अंतर आपसे लिया जाएगा।';
  }

  @override
  String get txtguarantorSkipSourceAdmin =>
      'वोल्टियम द्वारा कॉन्फ़िगर किया गया';

  @override
  String get txtguarantorSkipSourceFallback =>
      'डिफ़ॉल्ट — व्यवस्थापक ने अभी मान सेट नहीं किया है';

  @override
  String get txtguarantorSkipConfirm => 'छोड़ें और अतिरिक्त भुगतान करें';

  @override
  String get txtconnectingToGrid => 'ग्रिड से जुड़ रहे हैं';

  @override
  String get txtretry => 'फिर से कोशिश करें';

  @override
  String get txtsplashTagline => 'इलेक्ट्रिक स्कूटर किराए पर';

  @override
  String get txtloginWelcomeSubtitle =>
      'लॉगिन करने के लिए पंजीकृत फ़ोन नंबर दर्ज करें या नया खाता बनाने के लिए नया नंबर दर्ज करें।';

  @override
  String get txtloginLegalIntro => 'साइन इन करके, आप हमारी';

  @override
  String get txtloginReferralHint => 'रेफरल कोड (वैकल्पिक)';

  @override
  String get txtloginSecureOtpNote => 'एक सुरक्षित OTP भेजा जाएगा';

  @override
  String get txtloginEnterButton => 'दर्ज करें';

  @override
  String get txtloginSendingButton => 'भेज रहे हैं…';

  @override
  String get txtloginNetworkError => 'नेटवर्क त्रुटि। कृपया फिर से कोशिश करें।';

  @override
  String get txtotpVerifyTitle => 'OTP सत्यापित करें';

  @override
  String get txtotpWelcomeBack => 'वापसी पर स्वागत है!';

  @override
  String get txtotpSignupSubtitle => '6 अंकों का कोड दर्ज करें जो भेजा गया है ';

  @override
  String get txtotpLoginSubtitle =>
      'अपने खाते में लॉगिन करने के लिए कोड दर्ज करें ';

  @override
  String get txtotpVerifyFailed =>
      'OTP सत्यापित नहीं हो पाया। कृपया फिर से कोशिश करें।';

  @override
  String get txtotpResendError => 'OTP दोबारा भेजने में त्रुटि';

  @override
  String get txtpleaseLogInAgain => 'कृपया दोबारा लॉगिन करें।';

  @override
  String get txtfinalVerification => 'अंतिम सत्यापन';

  @override
  String get txtassignedVehicle => 'असाइन वाहन';

  @override
  String get txtfailedToCapturePhoto => 'फ़ोटो कैप्चर नहीं हो पाई';

  @override
  String get txtguarantorPhoneCannotBeTheSameAsYourPhone =>
      'गारंटर का फ़ोन आपके फ़ोन जैसा नहीं हो सकता';

  @override
  String get txtfailedToSendOtp => 'OTP भेज नहीं पाए';

  @override
  String get txtguarantorPhoneVerified => 'गारंटर का फ़ोन सत्यापित';

  @override
  String get txtinvalidOtp => 'गलत OTP';

  @override
  String get txtprofileUpdatedSuccessfully => 'प्रोफ़ाइल सफलतापूर्वक अपडेट';

  @override
  String get txteditProfile => 'प्रोफ़ाइल संपादित करें';

  @override
  String get txtprofile => 'प्रोफ़ाइल';

  @override
  String get txterrorSubmittingReturnPleaseTryAgain =>
      'वापसी जमा करने में गड़बड़ी। कृपया फिर से कोशिश करें।';

  @override
  String get txtrewards => 'इनाम';

  @override
  String get txtcallNow => 'अभी कॉल करें';

  @override
  String get txtstep2Of3 => 'कदम 2 का 3';

  @override
  String get txtproceedToPayment => 'भुगतान के लिए आगे बढ़ें';

  @override
  String get txtstep3Of3 => 'कदम 3 का 3';

  @override
  String get txtuploadProof => 'प्रूफ़ अपलोड करें';

  @override
  String get txtedit => 'संपादित करें';

  @override
  String get txtproofOfTopUp => 'टॉप अप का प्रूफ़';

  @override
  String get txtuploadPhotoProof => 'फ़ोटो प्रूफ़ अपलोड करें';

  @override
  String get txtproofInstantPayment => 'तत्काल भुगतान';

  @override
  String get txtproofSelectPaymentMethod => 'भुगतान विधि चुनें';

  @override
  String get txtproofPayCash => 'कैश';

  @override
  String get txtproofPayUpi => 'UPI';

  @override
  String get txtproofPayInstant => 'तत्काल';

  @override
  String get txtproofUpiIdLabel => 'वोल्टियम UPI आईडी';

  @override
  String get txtproofCopyUpiId => 'UPI आईडी कॉपी करें';

  @override
  String get txtproofUpiRefLabel => 'UPI रेफ़रेंस / UTR नंबर';

  @override
  String get txtproofUpiRefHint =>
      '12 अंकों का UTR / रेफ़रेंस दर्ज करें (वैकल्पिक)';

  @override
  String get txtproofTopUpAmountLabel => 'टॉप अप राशि';

  @override
  String get txtproofTransferToUpi =>
      'वोल्टियम की आधिकारिक UPI आईडी पर ट्रांसफ़र करें';

  @override
  String get txtproofPayViaUpi => 'UPI से भुगतान करें';

  @override
  String get txtproofInstantPaymentBreakdown => 'तत्काल भुगतान विवरण';

  @override
  String get txtproofPointsToActiveGateway => 'वर्तमान सक्रिय भुगतान गेटवे पर';

  @override
  String txtproofTopUpWillBeInstant(String fee) {
    return 'टॉप अप तत्काल होगा। अपने टॉप अप राशि पर 2.5% अतिरिक्त (₹$fee) गेटवे शुल्क जोड़ा जाएगा।';
  }

  @override
  String txtproofGatewayFee(String percent) {
    return 'गेटवे शुल्क ($percent%)';
  }

  @override
  String get txtproofZeroGatewayFee => '₹0 (वोल्टियम द्वारा भुगतान)';

  @override
  String get txtproofTopUpWillBeInstantCovered =>
      'टॉप अप तत्काल होगा। गेटवे शुल्क 100% वोल्टियम द्वारा वहन किया जाता है (राइडर के लिए ₹0 अतिरिक्त शुल्क)।';

  @override
  String get txtchangePhoto => 'फ़ोटो बदलें';

  @override
  String get txttapToUploadPhoto => 'फ़ोटो अपलोड करने के लिए टैप करें';

  @override
  String get txtcameraOrGallery => 'कैमरा या गैलरी';

  @override
  String get txtsubmitProof => 'प्रूफ़ जमा करें';

  @override
  String txtproceedToInstantPay(Object total) {
    return 'इंस्टैंट पे पर आगे बढ़ें ($total)';
  }

  @override
  String get txtstep1Of3 => 'कदम 1 का 3';

  @override
  String get txtchangeTl => 'टीएल बदलें';

  @override
  String get txtsubmitRequest => 'अनुरोध जमा करें';

  @override
  String get txtrentalRecoveryStreak => 'किराया रिकवरी स्ट्रीक';

  @override
  String get txtvoltiumSecuritySystemV30 => 'वोल्टियम सिक्योरिटी सिस्टम v3.0';

  @override
  String get txtopenSettings => 'सेटिंग्स खोलें';

  @override
  String get txtpickupVerification => 'पिकअप सत्यापन';

  @override
  String get txtcompleteTheVerificationStepsToAssignAndPickUpYourVehicle =>
      'अपना वाहन असाइन करने और लेने के लिए सत्यापन चरण पूरे करें';

  @override
  String get txtensureAllDetailsAreAccurateBeforeProceeding =>
      'आगे बढ़ने से पहले सभी विवरण सही हैं यह सुनिश्चित करें';

  @override
  String get txtselectVehicle => 'वाहन चुनें';

  @override
  String get txtnoVehiclesMatchYourSearch =>
      'आपकी खोज से मेल खाने वाला कोई वाहन नहीं';

  @override
  String get txtkycRejected => 'KYC अस्वीकृत';

  @override
  String get txtkycApproved => 'KYC स्वीकृत';

  @override
  String get txtkycRejectionOnHangTightTitle => 'KYC अस्वीकृत';

  @override
  String get txtkycRejectionOnHangTightBody =>
      'कृपया अस्वीकृति के कारणों की समीक्षा करें और अपने दस्तावेज़ फिर से जमा करें।';

  @override
  String get txtkycInfoRequiredOnHangTightBody =>
      'हमें आपकी पहचान सत्यापित करने के लिए और जानकारी चाहिए। कृपया अपने दस्तावेज़ फिर से जमा करें।';

  @override
  String get txtfixKycButton => 'KYC ठीक करें';

  @override
  String get txtpending => 'लंबित';

  @override
  String get txtaccountAction => 'खाता कार्रवाई';

  @override
  String get txtrequired => 'आवश्यक';

  @override
  String get txtinactive => 'निष्क्रिय';

  @override
  String get txtriderId => 'राइडर ID';

  @override
  String get txtcontactSupportForOnboardingAssistance =>
      'ऑनबोर्डिंग सहायता के लिए सपोर्ट से संपर्क करें';

  @override
  String get txtshare => 'साझा करें';

  @override
  String get txtreferFriends => 'दोस्तों को रेफ़र करें';

  @override
  String get txtyourReferralCode => 'आपका रेफ़रल कोड';

  @override
  String get txtcodeCopied => 'कोड कॉपी हो गया!';

  @override
  String get txtshareReferral => 'रेफ़रल साझा करें';

  @override
  String get txtshareVia => 'इसके ज़रिए साझा करें';

  @override
  String get txtlinkCopied => 'लिंक कॉपी हो गया!';

  @override
  String get txtactionRequired => 'कार्रवाई ज़रूरी';

  @override
  String get txtelectricMobility => 'इलेक्ट्रिक मोबिलिटी';

  @override
  String get txtcredit => 'क्रेडिट';

  @override
  String get txtdebit => 'डेबिट';

  @override
  String get txtwalletBalance => 'वॉलेट बैलेंस';

  @override
  String get txtevPlus => 'EV Plus';

  @override
  String get menu_title => 'मेनू';

  @override
  String get menu_account => 'खाता';

  @override
  String get menu_profile => 'प्रोफ़ाइल';

  @override
  String get menu_myDocuments => 'मेरे दस्तावेज़';

  @override
  String get menu_rewardsMore => 'इनाम और अधिक';

  @override
  String get menu_rewards => 'इनाम';

  @override
  String get menu_referralProgram => 'रेफ़रल प्रोग्राम';

  @override
  String get menu_general => 'सामान्य';

  @override
  String get menu_workflowServices => 'वर्कफ़्लो और सेवाएं';

  @override
  String get menu_appSettings => 'ऐप सेटिंग्स';

  @override
  String get menu_language => 'भाषा';

  @override
  String get menu_selectLanguage => 'भाषा चुनें';

  @override
  String get menu_emergencySos => 'आपातकालीन SOS';

  @override
  String get settings_preferences => 'प्राथमिकताएं';

  @override
  String get settings_darkMode => 'डार्क मोड';

  @override
  String get settings_appearance => 'स्वरूप';

  @override
  String get settings_followSystem => 'सिस्टम का अनुसरण करें';

  @override
  String get settings_themeLight => 'लाइट';

  @override
  String get settings_themeDark => 'डार्क';

  @override
  String get settings_supportLegal => 'सहायता और कानूनी';

  @override
  String get settings_feedback => 'प्रतिक्रिया';

  @override
  String get settings_legal => 'कानूनी';

  @override
  String get settings_about => 'के बारे में';

  @override
  String get settings_appVersion => 'ऐप संस्करण';

  @override
  String get settings_rateUs => 'हमें रेट करें';

  @override
  String get settings_accountSection => 'खाता';

  @override
  String get settings_deleteConfirmTitle => 'खाता हटाएं';

  @override
  String get settings_deleteConfirmBody =>
      'यह क्रिया अपरिवर्तनीय है। आपका सारा डेटा, जिसमें KYC दस्तावेज़, वॉलेट बैलेंस और किराया इतिहास शामिल है, स्थायी रूप से हटा दिया जाएगा। क्या आप निश्चित हैं?';

  @override
  String get settings_delete => 'हटाएं';

  @override
  String get settings_deleteReason => 'ऐप सेटिंग्स से अनुरोध किया गया';

  @override
  String get settings_deleteNotAvailable =>
      'खाता हटाना अभी उपलब्ध नहीं है। कृपया सपोर्ट से संपर्क करें।';

  @override
  String get settings_notifications => 'सूचनाएं';

  @override
  String get settings_changePhone => 'फ़ोन नंबर बदलें';

  @override
  String get settings_comingSoon => 'जल्द आ रहा है';

  @override
  String get txtfullName => 'पूरा नाम';

  @override
  String get txtenterFullName => 'पूरा नाम दर्ज करें';

  @override
  String get txtdateOfBirth => 'जन्म तिथि';

  @override
  String get txtemailAddress => 'ईमेल पता';

  @override
  String get txtenterEmailAddress => 'ईमेल पता दर्ज करें';

  @override
  String get txtfathersName => 'पिता का नाम';

  @override
  String get txtenterFathersName => 'पिता का नाम दर्ज करें';

  @override
  String get txtmothersName => 'माता का नाम';

  @override
  String get txtenterMothersName => 'माता का नाम दर्ज करें';

  @override
  String get txtcurrentAddress => 'वर्तमान पता';

  @override
  String get txtenterYourFullAddress => 'अपना पूरा पता दर्ज करें';

  @override
  String get txtaadhaarFront => 'आधार कार्ड\n(सामने)';

  @override
  String get txtaadhaarBack => 'आधार कार्ड\n(पीछे)';

  @override
  String get txtpanCard => 'पैन कार्ड';

  @override
  String get txtbankName => 'बैंक का नाम';

  @override
  String get txtaccountNumber => 'खाता संख्या';

  @override
  String get txtifscCode => 'IFSC कोड';

  @override
  String get txttakeAPhoto => 'फ़ोटो लें';

  @override
  String get txtchooseFromGallery => 'गैलरी से चुनें';

  @override
  String get txtclearPhotosOnly => 'केवल स्पष्ट फ़ोटो। प्रत्येक अधिकतम 5MB।';

  @override
  String get txtriderProfile => 'राइडर प्रोफ़ाइल';

  @override
  String get txtcompleteDetailsSubtitle =>
      'ऑनबोर्डिंग पूरा करने के लिए अपना विवरण भरें';

  @override
  String get txtconfirmAndProceed => 'पुष्टि करें और आगे बढ़ें';

  @override
  String get txtensureAllDetailsAccurate =>
      'आगे बढ़ने से पहले सुनिश्चित करें कि सभी विवरण सही हैं';

  @override
  String get txtselfieLiveCameraHint =>
      'KYC सत्यापन के लिए लाइव कैमरा अनिवार्य है';

  @override
  String get txtofflineDraftBanner =>
      'आप ऑफ़लाइन हैं — आपका ड्राफ्ट स्थानीय रूप से सहेजा गया है। सबमिट करने के लिए इंटरनेट से कनेक्ट करें।';

  @override
  String get txtdocumentPreview => 'दस्तावेज़ पूर्वावलोकन';

  @override
  String get txtretakePhoto => 'फिर से फ़ोटो लें';

  @override
  String get txtkeepPhoto => 'फ़ोटो रखें';

  @override
  String get txtuploaded => 'अपलोड हो गया';

  @override
  String get txtpermissionsTitle => 'अनुमतियाँ';

  @override
  String get txtpermissionsSubtitle =>
      'सुरक्षा और कार्यक्षमता सुनिश्चित करने के लिए कृपया निम्नलिखित अनुमतियाँ दें।';

  @override
  String get txtlocationPermName => 'स्थान';

  @override
  String get txtlocationPermDesc => 'सवारी ट्रैक करें और नजदीकी वाहन खोजें';

  @override
  String get txtnotificationsPermName => 'सूचनाएं';

  @override
  String get txtnotificationsPermDesc =>
      'महत्वपूर्ण अपडेट और अलर्ट प्राप्त करें';

  @override
  String get txtbatteryPermName => 'बैटरी ऑप्टिमाइज़ेशन';

  @override
  String get txtbatteryPermDesc =>
      'ऐप को पृष्ठभूमि में विश्वसनीय रूप से चलने दें।';

  @override
  String get txtcameraPermName => 'कैमरा';

  @override
  String get txtcameraPermDesc => 'दस्तावेज़ अपलोड और क्यूआर स्कैनिंग';

  @override
  String get txtphonePermName => 'फ़ोन स्थिति';

  @override
  String get txtphonePermDesc => 'फ़ोन स्थिति (सुरक्षा कॉल पहचान के लिए)';

  @override
  String get txtphonePermTooltip =>
      'कॉल स्थिति पढ़ता है ताकि आपातकालीन कॉल का पता लगाया जा सके — यह कभी भी कॉल इतिहास या संपर्क नहीं पढ़ता।';

  @override
  String get txtcontactsPermName => 'संपर्क';

  @override
  String get txtcontactsPermDesc => 'आपातकालीन एसओएस और रेफरल के लिए संपर्क';

  @override
  String get txtmicPermName => 'माइक्रोफ़ोन';

  @override
  String get txtmicPermDesc => 'ऑडियो रिकॉर्डिंग और सत्यापन के लिए आवश्यक';

  @override
  String get txtdeviceAdminPermName => 'डिवाइस व्यवस्थापक';

  @override
  String get txtdeviceAdminPermDesc =>
      'फ्लीट सुरक्षा और रिमोट लॉक सुविधाओं के लिए आवश्यक';

  @override
  String get txtbackgroundLocationPermName => 'बैकग्राउंड लोकेशन';

  @override
  String get txtbackgroundLocationPermDesc =>
      'ऐप बैकग्राउंड में होने पर ट्रिप ट्रैकिंग के लिए आवश्यक।';

  @override
  String get txtcallLogPermName => 'कॉल लॉग';

  @override
  String get txtcallLogPermDesc =>
      'राइड सुरक्षा सत्यापन और आपातकालीन संपर्क पुष्टि के लिए उपयोग किया जाता है।';

  @override
  String get txtpreciseLocationRequired =>
      'सटीक स्थान आवश्यक है। कृपया सेटिंग्स में इसे सक्षम करें।';

  @override
  String get txtbeforeYouBegin => 'शुरू करने से पहले';

  @override
  String get txtquickKycSubtitle => 'त्वरित केवाईसी सत्यापन (~3 मिनट)';

  @override
  String get txtpleaseHaveReady => 'कृपया इन्हें तैयार रखें:';

  @override
  String get txtaadhaarCard => 'आधार कार्ड';

  @override
  String get txtaadhaarCardDesc => 'आगे और पीछे की फोटो या ई-आधार पीडीएफ';

  @override
  String get txtpanCardDesc => 'कर और पहचान सत्यापन के लिए';

  @override
  String get txtthreeMinutesTime => '3 मिनट का समय';

  @override
  String get txtfastAutomatedVerification => 'तेज़ स्वचालित सत्यापन';

  @override
  String get txtimReady => 'मैं तैयार हूँ';

  @override
  String get txtillDoThisLater => 'मैं यह बाद में करूँगा';

  @override
  String get txtsyncingLatestDocs => 'नवीनतम दस्तावेज़ सिंक हो रहे हैं…';

  @override
  String get txtlegalAgreeCheckboxPrefix =>
      'मैंने पढ़ लिया है और मैं सहमत हूँ ';

  @override
  String get txtelectronicSignature => '(इलेक्ट्रॉनिक हस्ताक्षर)';

  @override
  String get txtlegalHelpText =>
      'यदि हमारी नीतियों के बारे में कोई प्रश्न हैं, तो कृपया हमारी सहायता टीम से संपर्क करें ';

  @override
  String get txtorCall => ' या कॉल करें ';

  @override
  String get txtdidntReceiveCode => 'क्या आपको कोड नहीं मिला?';

  @override
  String get txtresendCode => 'कोड पुनः भेजें';

  @override
  String txtresendIn(int seconds) {
    return '$seconds सेकंड में पुनः भेजें';
  }

  @override
  String get txtverifying => 'सत्यापित किया जा रहा है…';

  @override
  String get txtverifyAndProceed => 'सत्यापित करें और आगे बढ़ें';

  @override
  String get txtgreetingMorning => 'शुभ प्रभात';

  @override
  String get txtgreetingAfternoon => 'शुभ दोपहर';

  @override
  String get txtgreetingEvening => 'शुभ संध्या';

  @override
  String get txtguestRider => 'राइडर';

  @override
  String get txtshowingCachedData => 'कैश किया गया डेटा दिखाया जा रहा है';

  @override
  String get txtnoDataAvailable => 'कोई डेटा उपलब्ध नहीं है';

  @override
  String get txtvehiclePendingAssignment => 'वाहन आवंटन लंबित है';

  @override
  String get txtcurrentSubscription => 'वर्तमान सदस्यता';

  @override
  String get txtnoPlan => 'कोई प्लान नहीं';

  @override
  String get txtweeklyPayment => 'साप्ताहिक भुगतान';

  @override
  String get txtdailyPayment => 'दैनिक भुगतान';

  @override
  String get txtmonthlyPayment => 'मासिक भुगतान';

  @override
  String get txttimeRemaining => 'शेष समय';

  @override
  String get txtnextRecharge => 'अगला रिचार्ज';

  @override
  String get txtexpired => 'समाप्त';

  @override
  String get txtexpiresToday => 'आज समाप्त हो रहा है';

  @override
  String txtdaysCount(int count) {
    return '$count दिन';
  }

  @override
  String get txttotalBalance => 'कुल बैलेंस';

  @override
  String get txtavailableBalance => 'उपलब्ध बैलेंस';

  @override
  String txtstreakDays(int current, int total) {
    return '$current/$total दिन';
  }

  @override
  String txtminRechargeNotice(String amount) {
    return 'आगे बढ़ने के लिए न्यूनतम ₹$amount का रिचार्ज आवश्यक है।';
  }

  @override
  String txtlowBalanceWarningNotice(int amount) {
    return 'सवारी करने के लिए अभी टॉप अप करें। आपका बैलेंस अपर्याप्त है। न्यूनतम टॉप अप: ₹$amount।';
  }

  @override
  String get txttopUpWalletAction => 'वॉलेट टॉप अप करें';

  @override
  String get txtshareCodeWithFriends => 'दोस्तों के साथ अपना कोड साझा करें';

  @override
  String get txtyourCode => 'आपका कोड';

  @override
  String get txtreferralCodeCopied => 'रेफ़रल कोड कॉपी हो गया!';

  @override
  String txtshareReferralMessage(String code) {
    return 'Voltium से जुड़ने के लिए मेरे कोड $code का उपयोग करें!';
  }

  @override
  String get txtjoinVoltiumSubject => 'Voltium से जुड़ें';

  @override
  String get txtteamLeader => 'टीम लीडर';

  @override
  String get txtviewDetailsAction => 'विवरण देखें';

  @override
  String get txtnotAssigned => 'आवंटित नहीं';

  @override
  String get txtassignedTlBadge => 'आवंटित टीएल';

  @override
  String get txttlPendingNotice => 'आपका हब जल्द ही एक टीम लीडर आवंटित करेगा';

  @override
  String get txtnoContactNumberTl =>
      'आपके टीम लीडर के लिए कोई संपर्क नंबर उपलब्ध नहीं है।';

  @override
  String get txtcouldNotOpenDialer =>
      'फ़ोन डायलर नहीं खोला जा सका। कृपया पुनः प्रयास करें।';

  @override
  String get txtscooterSubmissionRequired => 'स्कूटर जमा करना\nआवश्यक है';

  @override
  String get txtpendingReturnSubmission => 'लंबित वापसी प्रस्तुति';

  @override
  String txtsubmissionDatePrefix(String date) {
    return 'जमा करने की तिथि: $date';
  }

  @override
  String txthubNamePrefix(String hub) {
    return 'हब का नाम: $hub';
  }

  @override
  String get txtdesignatedHub => 'नामित हब';

  @override
  String get txtupcomingRentDebit => 'आगामी किराया कटौती';

  @override
  String get txttopUpBeforeTomorrow6am => 'कल सुबह 6 बजे से पहले टॉप अप करें';

  @override
  String txtrentDebitNoticeShortfall(
      String rent, String balance, String shortfall) {
    return '₹$rent का किराया स्वचालित रूप से काट लिया जाएगा। आपका वर्तमान वॉलेट बैलेंस ₹$balance है (कमी: ₹$shortfall)।';
  }

  @override
  String txtrentDebitNoticeSufficient(String rent, String balance) {
    return 'किराया ₹$rent कल सुबह 6 बजे काटा जाएगा। वॉलेट बैलेंस ₹$balance पर्याप्त है।';
  }

  @override
  String txttopUpAmountAction(String amount) {
    return '₹$amount टॉप अप करें';
  }

  @override
  String get txtassignedTeamLeader => 'आवंटित टीम लीडर';

  @override
  String get txtclose => 'बंद करें';

  @override
  String get txtchangeTeamLeaderTitle => 'टीम लीडर बदलें';

  @override
  String get txtchangeTlReasonPrompt =>
      'कृपया अपने आवंटित टीम लीडर को बदलने का कारण बताएं। सहायता टीम द्वारा इसकी समीक्षा की जाएगी।';

  @override
  String get txtenterReasonHint => 'यहाँ अपना कारण दर्ज करें...';

  @override
  String get txtprovideDetailedReason =>
      'कृपया एक विस्तृत कारण प्रदान करें (कम से कम 5 अक्षर)';

  @override
  String get txttlChangeSubmitted =>
      'आपका टीएल परिवर्तन अनुरोध अनुमोदन के लिए सबमिट कर दिया गया है';

  @override
  String txtfailedToSubmitRequest(String error) {
    return 'अनुरोध सबमिट करने में विफल: $error';
  }

  @override
  String get txtmanageSubscriptionTitle => 'सदस्यता प्रबंधित करें';

  @override
  String get txtmanageSubscriptionSubtitle =>
      'नीचे अपने वर्तमान सक्रिय प्लान का विवरण देखें। अपना प्लान बदलने या अपग्रेड करने के लिए, कृपया अपने हब मैनेजर को अनुरोध सबमिट करें।';

  @override
  String get txtactiveBadge => 'सक्रिय';

  @override
  String get txtperDay => '/ दिन';

  @override
  String get txtperWeek => '/ सप्ताह';

  @override
  String get txtperMonth => '/ माह';

  @override
  String get txtrequestPlanChangeButton => 'प्लान परिवर्तन का अनुरोध करें';

  @override
  String get txtendRentalButton => 'किराया समाप्त करें';

  @override
  String get txtchangeIntentButton => 'उपयोग का उद्देश्य बदलें';

  @override
  String txtchangeIntentPrefix(String intent) {
    return 'उद्देश्य बदलें: $intent';
  }

  @override
  String txtstepXofY(int current, int total) {
    return 'चरण $current का $total';
  }

  @override
  String txtcaptureViewOfVehicle(String view) {
    return 'वाहन का $view कैप्चर करें';
  }

  @override
  String get txtensureClearPhotoPrompt =>
      'तेज़ अनुमोदन के लिए सुनिश्चित करें कि फोटो स्पष्ट और अच्छी रोशनी में हो।';

  @override
  String get txtcapturePhotoBtn => 'फोटो लें';

  @override
  String get txtcancelReturnProcessBtn => 'वापसी प्रक्रिया रद्द करें';

  @override
  String get txtuploadingPhotosSubmitting =>
      'फोटो अपलोड हो रही हैं और अनुरोध सबमिट किया जा रहा है...';

  @override
  String get txtdoNotCloseApp => 'कृपया ऐप बंद न करें।';

  @override
  String get txtreturnRequestSubmittedTitle => 'वापसी अनुरोध सबमिट किया गया';

  @override
  String get txtreturnRequestSubmittedBody =>
      'आपका वाहन वापसी अनुरोध अनुमोदन के लिए लंबित है। हमारा हब मैनेजर जल्द ही आपके सबमिशन को सत्यापित करेगा।';

  @override
  String get txtgreatBtn => 'बहुत बढ़िया!';

  @override
  String get txtfailedToSubmitReturn =>
      'वापसी अनुरोध सबमिट करने में विफल। कृपया पुनः प्रयास करें।';

  @override
  String get txtleftSide => 'बाईं तरफ';

  @override
  String get txtrightSide => 'राइट साइड';

  @override
  String get txtfrontView => 'सामने का दृश्य';

  @override
  String get txtspeedometer => 'स्पीडोमीटर';

  @override
  String get txtintentOfUse => 'उपयोग का उद्देश्य';

  @override
  String get txtpersonalUse => 'व्यक्तिगत उपयोग';

  @override
  String get txtecommerceDelivery => 'ई-कॉमर्स डिलीवरी';

  @override
  String get txtfoodDelivery => 'फ़ूड डिलीवरी';

  @override
  String get txtother => 'अन्य';

  @override
  String get txtrentalDetailsTitle => 'किराया विवरण';

  @override
  String get txtcurrentPlanSection => 'वर्तमान प्लान';

  @override
  String get txtnoActivePlan => 'कोई सक्रिय प्लान नहीं';

  @override
  String get txtperCycle => ' / चक्र';

  @override
  String get txtrentalInformation => 'किराया जानकारी';

  @override
  String get txtstartDate => 'प्रारंभ तिथि';

  @override
  String get txtendDate => 'समाप्ति तिथि';

  @override
  String get txtsecurityDeposit => 'सुरक्षा जमा';

  @override
  String get txtpaymentStreak => 'भुगतान स्ट्रीक';

  @override
  String get txtchangePlan => 'प्लान बदलें';

  @override
  String get txtpickupHub => 'पिकअप हब';

  @override
  String get txtintentUpdatedSuccess => 'उद्देश्य सफलतापूर्वक अपडेट किया गया';

  @override
  String txtfailedToUpdateIntent(String error) {
    return 'उद्देश्य अपडेट करने में विफल: $error';
  }

  @override
  String get txtteamLeaderInfoDescription =>
      'आपके दैनिक संचालन, मार्ग मार्गदर्शन और ऑन-ग्राउंड सहायता के लिए आपके टीम लीडर आपके प्राथमिक संपर्क बिंदु हैं।';

  @override
  String get txtrequestTlChange => 'टीम लीडर बदलने का अनुरोध करें';

  @override
  String get txtbackToDashboard => 'डैशबोर्ड पर वापस जाएं';

  @override
  String get txtback => 'वापस';

  @override
  String get txtselectTeamLeader => 'टीम लीडर चुनें';

  @override
  String get txtcall => 'कॉल करें';

  @override
  String get txtnotProvided => 'उपलब्ध नहीं है';

  @override
  String get txtemergencyContact => 'आपातकालीन संपर्क';

  @override
  String get txtkycStatusTitle => 'केवाईसी स्थिति';

  @override
  String get txtguarantorStatusTitle => 'गारंटर';

  @override
  String get txtvehicleTitle => 'वाहन';

  @override
  String get txtaddress => 'पता';

  @override
  String get txtunderReview => 'समीक्षाधीन';

  @override
  String get txtphone => 'फ़ोन';

  @override
  String get txtverifiedAndSecure => 'सत्यापित और सुरक्षित';

  @override
  String get txtidentityGuarantorVerifiedDesc =>
      'आपकी पहचान और गारंटर की जानकारी सत्यापित हो गई है। आप नीचे अपने दस्तावेज़ देख या डाउनलोड कर सकते हैं।';

  @override
  String get txtverificationInProgressDesc =>
      'आपका सत्यापन प्रगति पर है। कुछ दस्तावेज़ अभी भी हमारी टीम द्वारा समीक्षाधीन हो सकते हैं।';

  @override
  String get txtyourDocuments => 'आपके दस्तावेज़';

  @override
  String get txtguarantorDocuments => 'गारंटर के दस्तावेज़';

  @override
  String txtfilesCount(int count) {
    return '$count फ़ाइलें';
  }

  @override
  String get txtaadhaarCardFront => 'आधार कार्ड (सामने)';

  @override
  String get txtaadhaarCardBack => 'आधार कार्ड (पीछे)';

  @override
  String get txtpanCardLabel => 'पैन कार्ड';

  @override
  String get txtdigitalSignature => 'डिजिटल हस्ताक्षर';

  @override
  String get txtguarantorAadhaarFront => 'गारंटर का आधार (सामने)';

  @override
  String get txtguarantorAadhaarBack => 'गारंटर का आधार (पीछे)';

  @override
  String get txtguarantorPanCard => 'गारंटर का पैन कार्ड';

  @override
  String get txtverificationVideo => 'सत्यापन वीडियो';

  @override
  String get txtguarantorSignatureDoc => 'गारंटर के हस्ताक्षर';

  @override
  String get txtverifiedAndActive => 'सत्यापित और सक्रिय';

  @override
  String get txtopenExternal => 'बाहर खोलें';

  @override
  String get txtriderNotFound =>
      'राइडर नहीं मिला। कृपया सपोर्ट से संपर्क करें।';

  @override
  String get txtriderSessionNotReady =>
      'सबमिट नहीं किया जा सका: राइडर सत्र अभी तैयार नहीं है। कृपया कुछ देर बाद पुनः प्रयास करें।';

  @override
  String get txtsessionExpiredPleaseLogIn =>
      'आपका सत्र समाप्त हो गया है। जारी रखने के लिए कृपया फिर से लॉग इन करें।';

  @override
  String get txtsecurityDepositProofSubmitted =>
      'सिक्योरिटी डिपॉज़िट रसीद सबमिट हो गई — हम जल्द ही इसकी समीक्षा करेंगे।';

  @override
  String get txttopUpProofSubmitted => 'टॉप अप रसीद सफलतापूर्वक सबमिट हो गई!';

  @override
  String get txtfailedToDeleteNotification => 'नोटिफ़िकेशन हटाने में विफल';

  @override
  String get txterrWalletLoadFailed =>
      'आपके लेन-देन लोड नहीं हो सके। पुनः प्रयास के लिए नीचे खींचें।';

  @override
  String get txtlockedOverlayEnterPassword => 'कृपया पासवर्ड दर्ज करें।';

  @override
  String get txtlockedOverlayPasswordMustBe12Digits =>
      'पासवर्ड 12 अंकों की संख्या होनी चाहिए।';

  @override
  String get txtlockedOverlayIncorrectPassword =>
      'गलत पासवर्ड। वोल्टियम सपोर्ट से संपर्क करें।';

  @override
  String get txtlockedOverlayVerificationFailed =>
      'सत्यापन विफल। कृपया अपना नेटवर्क जाँचें और पुनः प्रयास करें।';

  @override
  String get txtlockedOverlayAccountLocked =>
      'वोल्टियम द्वारा आपका खाता लॉक कर दिया गया है।';

  @override
  String get txtlockedOverlayContactSupportToUnlock =>
      'अनलॉक करने के लिए कृपया सपोर्ट से संपर्क करें।';

  @override
  String get hangTightVehicleAssignment => 'वाहन असाइनमेंट';

  @override
  String get hangTightPlanSelected => 'प्लान चुना गया';

  @override
  String get hangTightPickupConfirmation => 'पिकअप पुष्टि';

  @override
  String get hangTightTitle => 'कृपया प्रतीक्षा करें';

  @override
  String get hangTightSettingUpBody =>
      'हम आपका खाता सेट अप कर रहे हैं।\nइसमें आमतौर पर 5-10 मिनट लगते हैं।';

  @override
  String get hangTightNotificationHint =>
      'आपका खाता सक्रिय होने पर हम सूचना भेजेंगे। आपको इसे खुला रखने की आवश्यकता नहीं है।';

  @override
  String get hangTightGuarantorApproved => 'गारंटर स्वीकृत';

  @override
  String get hangTightGuarantorNeedsAttention =>
      'गारंटर पर ध्यान देने की आवश्यकता है';

  @override
  String get hangTightGuarantorReplacedPendingReview =>
      'गारंटर बदला गया — समीक्षाधीन';

  @override
  String get hangTightGuarantorUnderReview => 'गारंटर समीक्षाधीन';

  @override
  String get hangTightPlanSelection => 'योजना चयन';

  @override
  String get hangTightPlanNeedsAttention =>
      'योजना पर ध्यान देने की आवश्यकता है';

  @override
  String get hangTightKycApproved => 'KYC स्वीकृत';

  @override
  String get hangTightKycRejectedResubmit =>
      'KYC अस्वीकृत — कृपया पुनः सबमिट करें';

  @override
  String get hangTightKycExpired => 'KYC समाप्त हो गया';

  @override
  String get hangTightKycNeedsMoreInfo => 'KYC के लिए अधिक जानकारी चाहिए';

  @override
  String get hangTightKycUnderReview => 'KYC समीक्षाधीन';

  @override
  String get hangTightStatusPending => 'लंबित';

  @override
  String get hangTightStatusActionNeeded => 'कार्रवाई आवश्यक';

  @override
  String get walletNoTransactionsForFilter =>
      'इस फ़िल्टर से मेल खाता कोई लेनदेन नहीं';

  @override
  String get txtaddressHelperText => 'मकान नंबर, गली, शहर, राज्य, पिन कोड';

  @override
  String get txtchooseNewLockPassword => 'नया 4 अंकों का लॉक पासवर्ड चुनें।';

  @override
  String get txtdobFormatHint => 'YYYY-MM-DD';

  @override
  String get txtenterFatherName => 'पिता का नाम दर्ज करें';

  @override
  String get txtenterFullAddress => 'पूरा पता दर्ज करें';

  @override
  String get txtenterMotherName => 'माता का नाम दर्ज करें';

  @override
  String get txtenterPhoneHint => '10 अंकों की संख्या दर्ज करें';

  @override
  String get txtenterValidName => 'मान्य नाम दर्ज करें';

  @override
  String get txtguarantorCurrentAddress => 'वर्तमान पता';

  @override
  String get txtguarantorEnterAddress => 'अपना पता दर्ज करें';

  @override
  String get txtguarantorEnterFullName => 'गारंटर का पूरा नाम दर्ज करें';

  @override
  String get txtguarantorFathersName => 'पिता का नाम';

  @override
  String get txtguarantorFullName => 'पूरा नाम';

  @override
  String get txtguarantorMothersName => 'माता का नाम';

  @override
  String get txtkycContextLine =>
      'ये विवरण RBI द्वारा दुपहिया वाहन किराए पर लेने के लिए आवश्यक हैं';

  @override
  String get txtkycGuarantorContextLine =>
      'RBI सत्यापन के लिए आपके गारंटर के विवरण आवश्यक हैं';

  @override
  String get txtresendOtp => 'फिर से भेजें';

  @override
  String get txtsendOtp => 'OTP भेजें';

  @override
  String get kycPushTitleApproved => 'KYC स्वीकृत';

  @override
  String get kycPushBodyApproved =>
      'आपके दस्तावेज़ सत्यापित हो गए हैं। अब आप वाहन उठा सकते हैं।';

  @override
  String get kycPushTitleRejected => 'KYC अपडेट आवश्यक';

  @override
  String kycPushBodyRejected(Object reason) {
    return 'आपका KYC अस्वीकृत कर दिया गया: $reason';
  }

  @override
  String get kycPushBodyFallback => 'कृपया अपने दस्तावेज़ फिर से अपलोड करें।';

  @override
  String get kycPushTitleInfoRequired => 'अधिक जानकारी चाहिए';

  @override
  String get kycPushBodyInfoRequired =>
      'आपके खाते को सत्यापित करने के लिए हमें थोड़ी और जानकारी चाहिए। कृपया अपने दस्तावेज़ फिर से सबमिट करें।';
}
