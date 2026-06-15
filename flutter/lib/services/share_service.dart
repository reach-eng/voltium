import 'package:share_plus/share_plus.dart';

class ShareService {
  static Future<void> shareApp({
    String? message,
    String? subject,
  }) async {
    final shareText = message ??
        'Download Voltium - EV Rental App\n\n'
            'Rent electric vehicles easily. Join the green revolution!\n\n'
            'Download now: https://play.google.com/store/apps/details?id=com.voltium.rider';

    await Share.share(
      shareText,
      subject: subject ?? 'Voltium - EV Rental App',
    );
  }

  static Future<void> shareReferral({
    required String referralCode,
    String? riderName,
  }) async {
    final message = riderName != null
        ? '$riderName invited you to join Voltium!\n\n'
            'Use my referral code: $referralCode\n\n'
            'Download now and get exciting rewards!'
        : 'Use my referral code: $referralCode\n\n'
            'Join Voltium - EV Rental App and get rewards!';

    await Share.share(
      message,
      subject: 'Join Voltium with my referral code',
    );
  }

  static Future<void> shareVehicle(String vehicleName, String location) async {
    await Share.share(
      'Check out this vehicle on Voltium!\n\n'
      '$vehicleName\n'
      'Location: $location\n\n'
      'Download the app to rent now!',
      subject: 'Voltium Vehicle',
    );
  }
}
