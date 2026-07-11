import 'dart:io';
import 'package:image/image.dart' as img;

void main() {
  final file = File('assets/logo_foreground.png');
  final bytes = file.readAsBytesSync();
  final original = img.decodeImage(bytes);
  if (original == null) return;
  
  int solidWhite = 0;
  int transWhite = 0;
  int other = 0;
  for (var y = 0; y < original.height; y++) {
    for (var x = 0; x < original.width; x++) {
      final p = original.getPixel(x, y);
      if (p.r == 255 && p.g == 255 && p.b == 255 && p.a == 255) {
        solidWhite++;
      } else if (p.r == 255 && p.g == 255 && p.b == 255 && p.a == 0) {
        transWhite++;
      } else {
        other++;
      }
    }
  }
  print('Solid White: , Trans White: , Other: ');
}
