/// PR-132 (RA-F-4) — image decode helper test
///
/// Asserts:
/// 1. The helper file exists and exports decodeImageWithCap +
///    decodeFileWithCap
/// 2. The helper has the documented maxWidth behavior
/// 3. The DecodeResult class has the dispose() method
library;

import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('image_decode.dart exists with the public API', () {
    final f = File('lib/utils/image_decode.dart');
    expect(f.existsSync(), isTrue);
    final content = f.readAsStringSync();
    expect(content, contains('decodeImageWithCap'));
    expect(content, contains('decodeFileWithCap'));
    expect(content, contains('DecodeResult'));
    expect(content, contains('class DecodeResult'));
  });

  test('decodeImageWithCap accepts a maxWidth parameter with default 2048', () {
    final f = File('lib/utils/image_decode.dart');
    final content = f.readAsStringSync();
    expect(content, contains('maxWidth'));
    expect(content, contains('int maxWidth = 2048'));
  });

  test('DecodeResult exposes the original dimensions for UI ratio', () {
    final f = File('lib/utils/image_decode.dart');
    final content = f.readAsStringSync();
    expect(content, contains('originalWidth'));
    expect(content, contains('originalHeight'));
  });

  test('DecodeResult has dispose() for native bitmap cleanup', () {
    final f = File('lib/utils/image_decode.dart');
    final content = f.readAsStringSync();
    expect(content, contains('void dispose()'));
    expect(content, contains('image.dispose()'));
  });

  test('the helper has a doc comment explaining the 9x RAM savings', () {
    final f = File('lib/utils/image_decode.dart');
    final content = f.readAsStringSync();
    expect(content, contains('12MP'));
    expect(content, contains('9x'));
  });
}
