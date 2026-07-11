import 'dart:io';
import 'package:image/image.dart' as img;

void main() {
  final file = File('assets/logo.png');
  final bytes = file.readAsBytesSync();
  final original = img.decodeImage(bytes);
  if (original == null) return;
  
  final foreground = img.Image(width: original.width, height: original.height);
  final background = img.Image(width: original.width, height: original.height);
  
  for (var y = 0; y < original.height; y++) {
    for (var x = 0; x < original.width; x++) {
      final pixel = original.getPixel(x, y);
      
      if (pixel.r > 200 && pixel.g > 200 && pixel.b > 200 && pixel.a > 100) {
        foreground.setPixel(x, y, img.ColorRgba8(255, 255, 255, 255));
        background.setPixel(x, y, img.ColorRgba8(0, 83, 193, 255)); 
      } else {
        foreground.setPixel(x, y, img.ColorRgba8(0, 0, 0, 0));
        background.setPixel(x, y, pixel);
      }
    }
  }
  
  for (var y = 0; y < background.height; y++) {
    for (var x = 0; x < background.width; x++) {
      final p = background.getPixel(x, y);
      if (p.a < 255) {
        background.setPixel(x, y, img.ColorRgba8(0, 83, 193, 255));
      }
    }
  }
  
  File('assets/logo_foreground.png').writeAsBytesSync(img.encodePng(foreground));
  File('assets/logo_background.png').writeAsBytesSync(img.encodePng(background));
  print('Done!');
}
