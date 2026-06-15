import 'package:flutter/material.dart';
import 'package:json_annotation/json_annotation.dart';

part 'support_model.g.dart';

@JsonSerializable(createFactory: false, createToJson: false)
class FaqCategory {
  final String id;
  final String title;
  final String subtitle;
  final int articleCount;
  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;

  const FaqCategory({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.articleCount,
    required this.icon,
    required this.iconColor,
    required this.iconBgColor,
  });

  factory FaqCategory.fromJson(Map<String, dynamic> json) {
    return FaqCategory(
      id: json['id'] as String,
      title: json['title'] as String,
      subtitle: json['subtitle'] as String,
      articleCount: json['articleCount'] as int,
      icon: _getIconData(json['icon'] as String),
      iconColor: Color(_parseColor(json['iconColor'])),
      iconBgColor: Color(_parseColor(json['iconBgColor'])),
    );
  }

  static int _parseColor(dynamic value) {
    if (value is int) return value;
    final str = value.toString();
    // Handle both "0xFFD97706" and "4292409094" formats
    if (str.startsWith('0x') || str.startsWith('0X')) {
      return int.tryParse(str.substring(2), radix: 16) ?? 0xFF000000;
    }
    return int.tryParse(str) ?? 0xFF000000;
  }

  static IconData _getIconData(String name) {
    switch (name) {
      case 'build':
        return Icons.build_outlined;
      case 'payment':
        return Icons.credit_card_outlined;
      case 'moped':
        return Icons.electric_moped_outlined;
      case 'person':
        return Icons.person_outline;
      case 'chat':
        return Icons.chat_bubble_outline;
      default:
        return Icons.help_outline;
    }
  }
}

@JsonSerializable()
class FaqItem {
  final String id;
  final String categoryId;
  final String question;
  final String answer;

  const FaqItem({
    required this.id,
    required this.categoryId,
    required this.question,
    required this.answer,
  });

  String get category => categoryId;

  factory FaqItem.fromJson(Map<String, dynamic> json) =>
      _$FaqItemFromJson(json);
  Map<String, dynamic> toJson() => _$FaqItemToJson(this);
}

@JsonSerializable(createFactory: false)
class IssueModel {
  final String id;
  final String ticketId;
  final String subject;
  final String message;
  final String category;
  final String status;
  final DateTime createdAt;

  IssueModel({
    required this.id,
    required this.ticketId,
    required this.subject,
    required this.message,
    required this.category,
    required this.status,
    required this.createdAt,
  });

  factory IssueModel.fromJson(Map<String, dynamic> json) {
    return IssueModel(
      id: json['id'] as String,
      ticketId: json['ticketId'] as String? ?? json['id'] as String,
      subject: json['subject'] as String? ??
          json['title'] as String? ??
          'No Subject',
      message:
          json['message'] as String? ?? json['description'] as String? ?? '',
      category: json['category'] as String,
      status: json['status'] as String,
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => _$IssueModelToJson(this);
}

@JsonSerializable()
class SupportConfig {
  final String supportPhone;
  final String supportEmail;
  @JsonKey(defaultValue: [])
  final List<String> ticketChecklist;

  const SupportConfig({
    required this.supportPhone,
    required this.supportEmail,
    this.ticketChecklist = const [],
  });

  factory SupportConfig.fromJson(Map<String, dynamic> json) =>
      _$SupportConfigFromJson(json);
  Map<String, dynamic> toJson() => _$SupportConfigToJson(this);
}
