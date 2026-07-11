import 'dart:convert';
void main() {
  const jsonStr = '{"success":true,"data":[{"id":"cmrdcrved000wri60w7l6jd74","name":"Weekly","type":"WEEKLY","price":1400,"durationDays":7,"description":"Make timely payments to earn rewards","isActive":true,"securityDeposit":200000,"isSecurityRefundable":true,"refundableAfterDays":180,"additionalInfo":null,"createdAt":"2026-07-09T10:17:29.269Z","updatedAt":"2026-07-09T10:17:29.269Z","deletedAt":null}]}';
  final response = jsonDecode(jsonStr);
  try {
    final List<dynamic> data = response['data'] ?? [];
    final plans = data.map((e) {
      final json = e as Map<String, dynamic>;
      return {
        'id': json['id'] as String,
        'name': json['name'] as String,
        'description': json['description'] as String?,
        'price': (json['price'] as num).toDouble(),
        'durationDays': (json['durationDays'] as num).toInt(),
        'features': (json['features'] as List<dynamic>?)?.map((x) => x as String).toList() ?? [],
        'category': json['category'] as String? ?? '',
      };
    }).toList();
    print('SUCCESS: $plans');
  } catch (e, st) {
    print('ERROR: $e');
    print(st);
  }
}
