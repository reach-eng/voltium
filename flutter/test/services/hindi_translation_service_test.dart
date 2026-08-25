import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/services/hindi_translation_service.dart';

void main() {
  group('HindiTranslationService', () {
    late HindiTranslationService svc;

    setUp(() {
      svc = HindiTranslationService();
    });

    test('translateToHindi returns exact Hindi match', () {
      expect(
          svc.translateToHindi('Your vehicle is ready'), 'आपका वाहन तैयार है');
    });

    test('translateToHindi is case-insensitive', () {
      expect(
          svc.translateToHindi('your vehicle is ready'), 'आपका वाहन तैयार है');
    });

    test('translateToHindi returns original text when no match', () {
      const unknownText = 'Some completely unknown phrase 12345';
      expect(svc.translateToHindi(unknownText), unknownText);
    });

    test('translateToHindi handles empty string', () {
      expect(svc.translateToHindi(''), '');
    });

    test('translateToHindi does token substitution in longer phrase', () {
      final result = svc.translateToHindi('Your rental has ended');
      // "rental" should be substituted to "किराया"
      expect(result, contains('किराया'));
    });

    test('translateToEnglish returns exact English match', () {
      expect(svc.translateToEnglish('आपका वाहन तैयार है'),
          'Your vehicle is ready');
    });

    test('translateToEnglish returns original text when no match', () {
      const unknownHindi = 'अज्ञात पाठ';
      expect(svc.translateToEnglish(unknownHindi), unknownHindi);
    });

    test('translateToEnglish handles empty string', () {
      expect(svc.translateToEnglish(''), '');
    });

    test('LRU cache returns same result on repeated calls', () {
      final first = svc.translateToHindi('KYC approved');
      final second = svc.translateToHindi('KYC approved');
      expect(first, second);
      expect(first, 'KYC स्वीकृत');
    });

    test('known domain terms translate correctly', () {
      expect(svc.translateToHindi('wallet'), 'वॉलेट');
      expect(svc.translateToHindi('guarantor'), 'गारंटर');
      expect(svc.translateToHindi('subscription'), 'सदस्यता');
      expect(svc.translateToHindi('odometer'), 'ओडोमीटर');
    });

    test('bidirectional roundtrip for common terms', () {
      const enTerm = 'KYC approved';
      final hi = svc.translateToHindi(enTerm);
      final backToEn = svc.translateToEnglish(hi);
      expect(backToEn, enTerm);
    });
  });
}
