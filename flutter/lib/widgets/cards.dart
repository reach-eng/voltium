/// PR-127 (DS-C-3) — re-export shim for the card widgets module.
///
/// The canonical card widgets now live under `lib/widgets/cards/`
/// (this file's children). The old import path
/// `package:voltium_rider/widgets/cards.dart` is preserved by this
/// re-export so existing callers don't need to change.
///
/// New code should import from
/// `package:voltium_rider/widgets/cards/cards.dart` (or the
/// individual `cards/base_card.dart`, `cards/interactive_card.dart`,
/// `cards/dashboard_card.dart` files as the consolidation lands
/// in follow-up PRs).
library;

export 'cards/cards.dart';
