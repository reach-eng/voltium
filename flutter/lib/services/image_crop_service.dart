import 'dart:io';
import 'package:image_picker/image_picker.dart';
import 'package:image_cropper/image_cropper.dart';
import '../theme/app_theme.dart';

class ImageCropService {
  final ImagePicker _picker = ImagePicker();

  Future<File?> pickAndCrop({
    required ImageSource source,
    double? maxWidth,
    double? maxHeight,
    int imageQuality = 85,
  }) async {
    try {
      final XFile? picked = await _picker.pickImage(
        source: source,
        maxWidth: maxWidth,
        maxHeight: maxHeight,
        imageQuality: imageQuality,
      );
      if (picked == null) return null;
      return await _cropImage(picked.path);
    } catch (e) {
      return null;
    }
  }

  Future<File?> _cropImage(String imagePath) async {
    final croppedFile = await ImageCropper().cropImage(
      uiSettings: [
        AndroidUiSettings(
          toolbarTitle: 'Crop Photo',
          toolbarColor: AppColors.primary,
          toolbarWidgetColor: AppColors.surfaceWhite,
          initAspectRatio: CropAspectRatioPreset.square,
          lockAspectRatio: false,
          hideBottomControls: false,
        ),
        IOSUiSettings(
          title: 'Crop Photo',
          aspectRatioLockEnabled: false,
          resetAspectRatioEnabled: true,
          rotateButtonsHidden: false,
          rotateClockwiseButtonHidden: false,
        ),
      ],
      sourcePath: imagePath,
    );
    return croppedFile != null ? File(croppedFile.path) : null;
  }

  Future<File?> pickFromGallery({int imageQuality = 85}) {
    return pickAndCrop(
      source: ImageSource.gallery,
      maxWidth: 800,
      maxHeight: 800,
      imageQuality: imageQuality,
    );
  }

  Future<File?> pickFromCamera({int imageQuality = 85}) {
    return pickAndCrop(
      source: ImageSource.camera,
      maxWidth: 1200,
      maxHeight: 1200,
      imageQuality: imageQuality,
    );
  }

  Future<File?> cropCircular(String imagePath) async {
    final croppedFile = await ImageCropper().cropImage(
      uiSettings: [
        AndroidUiSettings(
          toolbarTitle: 'Crop Photo',
          toolbarColor: AppColors.primary,
          toolbarWidgetColor: AppColors.surfaceWhite,
          initAspectRatio: CropAspectRatioPreset.square,
          lockAspectRatio: true,
          hideBottomControls: true,
        ),
        IOSUiSettings(
          title: 'Crop Photo',
          aspectRatioLockEnabled: true,
          rotateClockwiseButtonHidden: true,
        ),
      ],
      sourcePath: imagePath,
      aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
    );
    return croppedFile != null ? File(croppedFile.path) : null;
  }

  Future<List<File>> pickMultiple({
    int imageQuality = 85,
    int maxImages = 5,
  }) async {
    try {
      final List<XFile> picked = await _picker.pickMultiImage(
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: imageQuality,
        limit: maxImages,
      );
      return picked.map((xfile) => File(xfile.path)).toList();
    } catch (e) {
      return [];
    }
  }
}
