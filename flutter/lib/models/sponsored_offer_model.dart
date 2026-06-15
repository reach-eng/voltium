import 'package:json_annotation/json_annotation.dart';

part 'sponsored_offer_model.g.dart';

@JsonSerializable()
class SponsoredOffer {
  final String id;
  final String title;
  final String description;
  final String? icon;
  final DateTime validFrom;
  final DateTime validUntil;
  final bool isActive;

  const SponsoredOffer({
    required this.id,
    required this.title,
    required this.description,
    this.icon,
    required this.validFrom,
    required this.validUntil,
    this.isActive = true,
  });

  factory SponsoredOffer.fromJson(Map<String, dynamic> json) =>
      _$SponsoredOfferFromJson(json);
  Map<String, dynamic> toJson() => _$SponsoredOfferToJson(this);
}
