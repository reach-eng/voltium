import 'package:json_annotation/json_annotation.dart';

class ToDoubleConverter implements JsonConverter<double, Object> {
  const ToDoubleConverter();

  @override
  double fromJson(Object json) {
    if (json is double) return json;
    if (json is int) return json.toDouble();
    if (json is String) return double.tryParse(json) ?? 0.0;
    return 0.0;
  }

  @override
  Object toJson(double value) => value;
}
