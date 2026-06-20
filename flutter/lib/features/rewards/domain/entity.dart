/// Reward domain entity.
class RewardEntity {
  final String id;
  final String title;
  final int points;
  final DateTime createdAt;

  const RewardEntity({
    required this.id,
    this.title = '',
    this.points = 0,
    required this.createdAt,
  });

  factory RewardEntity.fromJson(Map<String, dynamic> json) {
    return RewardEntity(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      points: (json['points'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}

/// Referral domain entity.
class ReferralEntity {
  final String referralCode;
  final int totalReferrals;
  final int totalPoints;

  const ReferralEntity({
    this.referralCode = '',
    this.totalReferrals = 0,
    this.totalPoints = 0,
  });

  factory ReferralEntity.fromJson(Map<String, dynamic> json) {
    return ReferralEntity(
      referralCode: json['referralCode'] as String? ?? '',
      totalReferrals: (json['totalReferrals'] as num?)?.toInt() ?? 0,
      totalPoints: (json['totalPoints'] as num?)?.toInt() ?? 0,
    );
  }
}
