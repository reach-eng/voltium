import 'package:json_annotation/json_annotation.dart';

part 'rider_wallet.g.dart';

/// Wallet balance, payment streak, and rental plan information.
///
/// Extracted from [RiderModel] — widgets that show wallet or plan
/// data can depend only on this sub-model.
@JsonSerializable()
class RiderWallet {
  final double walletBalance;
  final int paymentStreak;
  final String planStatus;
  final String? currentPlan;
  final DateTime? planStartDate;
  final DateTime? planEndDate;

  const RiderWallet({
    this.walletBalance = 0.0,
    this.paymentStreak = 0,
    this.planStatus = 'NONE',
    this.currentPlan,
    this.planStartDate,
    this.planEndDate,
  });

  RiderWallet copyWith({
    double? walletBalance,
    int? paymentStreak,
    String? planStatus,
    String? currentPlan,
    DateTime? planStartDate,
    DateTime? planEndDate,
  }) {
    return RiderWallet(
      walletBalance: walletBalance ?? this.walletBalance,
      paymentStreak: paymentStreak ?? this.paymentStreak,
      planStatus: planStatus ?? this.planStatus,
      currentPlan: currentPlan ?? this.currentPlan,
      planStartDate: planStartDate ?? this.planStartDate,
      planEndDate: planEndDate ?? this.planEndDate,
    );
  }

  factory RiderWallet.fromJson(Map<String, dynamic> json) =>
      _$RiderWalletFromJson(json);

  Map<String, dynamic> toJson() => _$RiderWalletToJson(this);
}
