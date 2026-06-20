// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'support_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FaqItem _$FaqItemFromJson(Map<String, dynamic> json) => FaqItem(
      id: json['id'] as String,
      categoryId: json['categoryId'] as String,
      question: json['question'] as String,
      answer: json['answer'] as String,
    );

Map<String, dynamic> _$FaqItemToJson(FaqItem instance) => <String, dynamic>{
      'id': instance.id,
      'categoryId': instance.categoryId,
      'question': instance.question,
      'answer': instance.answer,
    };

Map<String, dynamic> _$IssueModelToJson(IssueModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'ticketId': instance.ticketId,
      'subject': instance.subject,
      'message': instance.message,
      'category': instance.category,
      'status': instance.status,
      'createdAt': instance.createdAt.toIso8601String(),
    };

SupportConfig _$SupportConfigFromJson(Map<String, dynamic> json) =>
    SupportConfig(
      supportPhone: json['supportPhone'] as String,
      supportEmail: json['supportEmail'] as String,
      ticketChecklist: (json['ticketChecklist'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
    );

Map<String, dynamic> _$SupportConfigToJson(SupportConfig instance) =>
    <String, dynamic>{
      'supportPhone': instance.supportPhone,
      'supportEmail': instance.supportEmail,
      'ticketChecklist': instance.ticketChecklist,
    };
