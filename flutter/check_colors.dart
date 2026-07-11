import 'dart:io';
import 'package:image/image.dart' as img;

void main() {
  final file = File('assets/logo.png');
  final bytes = file.readAsBytesSync();
  final original = img.decodeImage(bytes);
  if (original == null) return;
  
  int darkCount = 0;
  for (var y = 0; y < original.height; y++) {
    for (var x = 0; x < original.width; x++) {
      final p = original.getPixel(x, y);
      if (p.r < 50 && p.g < 50 && p.b < 80 && p.a > 100) {
        darkCount++;
      }
    }
  }
  print('Dark pixels:  out of ');
}
