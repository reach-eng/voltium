import 'dart:convert';
import 'dart:math';
import 'package:shared_preferences/shared_preferences.dart';

class ReferralCode {
  final String code;
  final int usageCount;
  final int maxUses;
  final int rewardAmount;
  final DateTime createdAt;
  final bool isActive;

  ReferralCode({
    required this.code,
    this.usageCount = 0,
    this.maxUses = 10,
    required this.rewardAmount,
    required this.createdAt,
    this.isActive = true,
  });

  bool get isExpired => usageCount >= maxUses;

  int get remainingUses => maxUses - usageCount;

  Map<String, dynamic> toJson() => {
        'code': code,
        'usageCount': usageCount,
        'maxUses': maxUses,
        'rewardAmount': rewardAmount,
        'createdAt': createdAt.toIso8601String(),
        'isActive': isActive,
      };

  factory ReferralCode.fromJson(Map<String, dynamic> json) => ReferralCode(
        code: json['code'],
        usageCount: json['usageCount'] ?? 0,
        maxUses: json['maxUses'] ?? 10,
        rewardAmount: json['rewardAmount'],
        createdAt: DateTime.parse(json['createdAt']),
        isActive: json['isActive'] ?? true,
      );
}

class PromoCode {
  final String code;
  final int discountPercent;
  final int? maxDiscount;
  final int? minOrder;
  final DateTime? validUntil;
  final bool isActive;

  PromoCode({
    required this.code,
    required this.discountPercent,
    this.maxDiscount,
    this.minOrder,
    this.validUntil,
    this.isActive = true,
  });

  bool get isExpired =>
      validUntil != null && validUntil!.isBefore(DateTime.now());

  Map<String, dynamic> toJson() => {
        'code': code,
        'discountPercent': discountPercent,
        'maxDiscount': maxDiscount,
        'minOrder': minOrder,
        'validUntil': validUntil?.toIso8601String(),
        'isActive': isActive,
      };

  factory PromoCode.fromJson(Map<String, dynamic> json) => PromoCode(
        code: json['code'],
        discountPercent: json['discountPercent'],
        maxDiscount: json['maxDiscount'],
        minOrder: json['minOrder'],
        validUntil: json['validUntil'] != null
            ? DateTime.parse(json['validUntil'])
            : null,
        isActive: json['isActive'] ?? true,
      );
}

class ReferralService {
  static const String _keyReferral = 'volt_referral';
  static const String _keyPromo = 'volt_promo';

  ReferralCode? _myReferralCode;
  ReferralCode? get myReferralCode => _myReferralCode;

  List<ReferralCode> _referredUsers = [];
  List<ReferralCode> get referredUsers => _referredUsers;

  List<PromoCode> _availablePromos = [];
  List<PromoCode> get availablePromos => _availablePromos;

  ReferralService();

  Future<void> init() async {
    await _loadData();
  }

  Future<void> _loadData() async {
    final prefs = await SharedPreferences.getInstance();

    final referralJson = prefs.getString(_keyReferral);
    if (referralJson != null) {
      try {
        final data = jsonDecode(referralJson) as Map<String, dynamic>;
        _myReferralCode = ReferralCode.fromJson(data['myCode']);
        _referredUsers = (data['referred'] as List?)
                ?.map((e) => ReferralCode.fromJson(e))
                .toList() ??
            [];
      } catch (_) {}
    }

    final promoJson = prefs.getString(_keyPromo);
    if (promoJson != null) {
      try {
        _availablePromos = (jsonDecode(promoJson) as List)
            .map((e) => PromoCode.fromJson(e))
            .toList();
      } catch (_) {}
    }
  }

  Future<void> _saveData() async {
    final prefs = await SharedPreferences.getInstance();

    await prefs.setString(
        _keyReferral,
        jsonEncode({
          'myCode': _myReferralCode?.toJson(),
          'referred': _referredUsers.map((c) => c.toJson()).toList(),
        }));

    await prefs.setString(
        _keyPromo,
        jsonEncode(
          _availablePromos.map((c) => c.toJson()).toList(),
        ));
  }

  String _generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    final random = Random.secure();
    return List.generate(8, (_) => chars[random.nextInt(chars.length)]).join();
  }

  Future<void> generateMyReferralCode() async {
    final code = _generateCode();
    _myReferralCode = ReferralCode(
      code: code,
      rewardAmount: 50000,
      createdAt: DateTime.now(),
    );
    await _saveData();
  }

  Future<bool> applyReferralCode(String code) async {
    if (_myReferralCode?.code == code) {
      throw Exception('Cannot use your own referral code');
    }

    for (final user in _referredUsers) {
      if (user.code == code && !user.isExpired) {
        _referredUsers = _referredUsers.map((u) {
          if (u.code == code) {
            return ReferralCode(
              code: u.code,
              usageCount: u.usageCount + 1,
              maxUses: u.maxUses,
              rewardAmount: u.rewardAmount,
              createdAt: u.createdAt,
              isActive: u.usageCount + 1 < u.maxUses,
            );
          }
          return u;
        }).toList();
        await _saveData();
        return true;
      }
    }
    return false;
  }

  Future<PromoCode?> validatePromoCode(String code) async {
    final promo = _availablePromos
        .where((p) =>
            p.code.toUpperCase() == code.toUpperCase() &&
            p.isActive &&
            !p.isExpired)
        .firstOrNull;
    return promo;
  }

  Future<int> calculateDiscount(PromoCode promo, int amount) async {
    if (promo.minOrder != null && amount < promo.minOrder!) {
      throw Exception('Minimum order amount is ₹${promo.minOrder! / 100}');
    }
    int discount = (amount * promo.discountPercent) ~/ 100;
    if (promo.maxDiscount != null && discount > promo.maxDiscount!) {
      discount = promo.maxDiscount!;
    }
    return discount;
  }

  Future<void> addPromoCode(PromoCode promo) async {
    _availablePromos.add(promo);
    await _saveData();
  }

  Future<void> seedSamplePromos() async {
    _availablePromos = [
      PromoCode(
        code: 'WELCOME50',
        discountPercent: 50,
        maxDiscount: 5000,
        minOrder: 10000,
        validUntil: DateTime.now().add(const Duration(days: 30)),
      ),
      PromoCode(
        code: 'FLAT100',
        discountPercent: 100,
        maxDiscount: 10000,
        minOrder: 50000,
        validUntil: DateTime.now().add(const Duration(days: 60)),
      ),
    ];
    await _saveData();
  }
}
