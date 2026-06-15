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
}
