import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:voltium_rider/widgets/image_source_sheet.dart';
import '../../../../utils/app_logger.dart';

/// Lets the user attach up to 5 photos when raising a support ticket.
///
/// Caller passes in the current count + a callback that runs when a new
/// photo is picked. The `ImageSourceBottomSheet` gives the user the
/// choice between camera and gallery.
Future<void> pickSupportPhoto(
  BuildContext context,
  ImagePicker picker,
  int currentCount,
  void Function(File) onPhotoPicked,
) async {
  if (currentCount >= 5) return;
  try {
    final source = await ImageSourceBottomSheet.show(context: context);
    if (source == null) return;
    final XFile? photo = await picker.pickImage(
      source: source,
      maxWidth: 1600,
      maxHeight: 1600,
      imageQuality: 85,
      requestFullMetadata: false,
    );
    if (photo != null) {
      onPhotoPicked(File(photo.path));
    }
  } catch (e) {
    appDebug('Support photo picker failed: $e');
  }
}

// `TopActionCard` was removed in DARK-MODE-AUDIT 2026-08-14 PR2: it was
// never wired up to a screen and held a static `iconColor`/`iconBgColor`
// pair that bypassed the brightness-aware `ThemeColors` extension. If a
// future screen needs the same shape, prefer resolving the icon colors
// from `AppColors.of(context)` at the call site rather than baking them
// into the constructor.
//
// `RaiseTicketCard` and `TicketListItem` were removed on 2026-09-02: they
// were defined in this file but never referenced from any screen or test.
// The dashboard is the only support surface, and it builds its own ticket
// list directly from `IssueModel`. If a future screen needs a similar
// widget, copy from git history (commit 98ec25a1 removed the last copy).
