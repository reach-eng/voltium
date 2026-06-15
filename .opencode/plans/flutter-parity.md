# Flutter ↔ Web App Parity Implementation Plan

## Current State Analysis

The Flutter app already has **most screens implemented** but they're not wired up in `auth_wrapper.dart`. The wrapper falls back to `AppShell` for 10+ states instead of showing dedicated screens.

### Screens That Already Exist (need wiring):

- `history_screen.dart` ✓
- `notification_center_screen.dart` ✓
- `emergency_sos_screen.dart` ✓
- `edit_profile_screen.dart` ✓
- `rental_details_screen.dart` ✓
- `top_up_amount_screen.dart` ✓
- `documents_screen.dart` ✓
- `referral_screen.dart` ✓
- `legal_screen.dart` ✓
- `rewards_screen.dart` ✓
- `app_settings_screen.dart` ✓
- `faq_screen.dart` ✓

### Screens That Are MISSING (need creation):

- `tl_details_screen.dart` ✗
- `vehicle_photos_screen.dart` ✗

---

## Phase 1: Create Missing Screens

### 1.1 Create `lib/screens/tl_details_screen.dart`

Match web `TlDetailsScreen.tsx`:

- TL hero card with photo (or icon fallback), name, role
- Call/Message buttons using `url_launcher`
- Employee ID display
- TL change request form (expandable)
- Submit ticket via `AppProvider.submitTicket()`

```dart
// Key structure:
class TlDetailsScreen extends StatefulWidget {
  final VoidCallback? onBack;
  const TlDetailsScreen({super.key, this.onBack});
}

// Uses rider?.teamLeaderName, rider?.teamLeaderPhone
// Falls back to 'Ravi Kumar' / '+91 98765 43210' if null
// Call button: url_launcher tel: protocol
// Message button: url_launcher sms: protocol
// Change request: TextField + submit to /api/support/tickets
```

### 1.2 Create `lib/screens/vehicle_photos_screen.dart`

Match web `VehiclePhotosScreen.tsx`:

- Vehicle ID card with registration number
- Info grid: Pickup Date, Pickup Hub
- Photo gallery grid (front, rear, left, right, with_vehicle)
- Use rider's pickupPhoto\* fields

```dart
// Key structure:
class VehiclePhotosScreen extends StatefulWidget {
  final VoidCallback? onBack;
  const VehiclePhotosScreen({super.key, this.onBack});
}

// Photos from rider: pickupPhotoFront, pickupPhotoBack, pickupPhotoLeft, pickupPhotoRight, pickupPhotoWithVehicle
// Show CachedImage for each photo with label
// Vehicle ID from rider.assignedVehicle
```

---

## Phase 2: Wire Up auth_wrapper.dart

### 2.1 Add missing AuthStates enum entries

In `lib/screens/auth_wrapper.dart`, the enum already has all needed states. The issue is the switch cases.

### 2.2 Replace fallback cases with actual screens

**Current code (lines 280-291):**

```dart
case AuthState.tlDetails:
case AuthState.endRental:
case AuthState.faq:
case AuthState.vehiclePhotos:
case AuthState.topUpPurpose:
case AuthState.topUpUpi:
case AuthState.topUpReceipt:
case AuthState.referralDetails:
case AuthState.legalPage:
case AuthState.myDocuments:
  currentScreen = const AppShell(key: ValueKey('dashboard_fallback'));
  break;
```

**Replace with:**

```dart
case AuthState.tlDetails:
  currentScreen = TlDetailsScreen(
    key: const ValueKey('tlDetails'),
    onBack: () => _navigateToLocal(AuthState.dashboard),
  );
  break;

case AuthState.endRental:
  currentScreen = EndRentalScreen(
    key: const ValueKey('endRental'),
    onBack: () => _navigateToLocal(AuthState.dashboard),
  );
  break;

case AuthState.faq:
  currentScreen = FaqScreen(
    key: const ValueKey('faq'),
    onBack: () => _navigateToLocal(AuthState.support),
  );
  break;

case AuthState.vehiclePhotos:
  currentScreen = VehiclePhotosScreen(
    key: const ValueKey('vehiclePhotos'),
    onBack: () => _navigateToLocal(AuthState.dashboard),
  );
  break;

case AuthState.topUpPurpose:
  currentScreen = TopUpPurposeScreen(
    key: const ValueKey('topUpPurpose'),
    onBack: () => _navigateToLocal(AuthState.dashboard),
    onNext: () => _navigateToLocal(AuthState.topUpAmount),
  );
  break;

case AuthState.topUpAmount:
  currentScreen = TopUpAmountScreen(
    key: const ValueKey('topUpAmount'),
    onBack: () => _navigateToLocal(AuthState.topUpPurpose),
    onProceed: () => _navigateToLocal(AuthState.topUpUpi),
  );
  break;

case AuthState.topUpUpi:
  currentScreen = TopUpUpiScreen(
    key: const ValueKey('topUpUpi'),
    onBack: () => _navigateToLocal(AuthState.topUpAmount),
    onProceed: () => _navigateToLocal(AuthState.topUpReceipt),
  );
  break;

case AuthState.topUpReceipt:
  currentScreen = TopUpReceiptScreen(
    key: const ValueKey('topUpReceipt'),
    onBack: () => _navigateToLocal(AuthState.dashboard),
  );
  break;

case AuthState.referralDetails:
  currentScreen = ReferralScreen(
    key: const ValueKey('referralDetails'),
    onBack: () => _navigateToLocal(AuthState.dashboard),
  );
  break;

case AuthState.legalPage:
  currentScreen = LegalPageScreen(
    key: const ValueKey('legalPage'),
    onBack: () => _navigateToLocal(AuthState.dashboard),
  );
  break;

case AuthState.myDocuments:
  currentScreen = DocumentsScreen(
    key: const ValueKey('myDocuments'),
    onBack: () => _navigateToLocal(AuthState.dashboard),
  );
  break;
```

### 2.3 Add missing AuthState enum entry

Add `topUpAmount` to the enum (between `topUpPurpose` and `topUpUpi`):

```dart
enum AuthState {
  // ... existing ...
  topUpPurpose,
  topUpAmount,     // ADD THIS
  topUpUpi,
  topUpReceipt,
  // ...
}
```

### 2.4 Add imports for new screens

At the top of `auth_wrapper.dart`, add:

```dart
import 'tl_details_screen.dart';
import 'vehicle_photos_screen.dart';
```

---

## Phase 3: Fix Button Handlers in Existing Screens

### 3.1 `active_dashboard_screen.dart`

**Notification bell (line ~157):**

```dart
// Before:
InkWell(
  onTap: () {},
  // ...
)

// After:
InkWell(
  onTap: () {
    context.read<AppProvider>().setAuthState(AuthState.notifications);
  },
  // ...
)
```

Need to expose `setAuthState` in `AppProvider` or use a callback pattern.

**History button (in wallet card):**
Find the history button and wire it to:

```dart
onTap: () {
  context.read<AppProvider>().setAuthState(AuthState.history);
}
```

**Call Team Leader button (in TL section):**

```dart
// Before:
onPressed: () {}

// After:
onPressed: () {
  context.read<AppProvider>().setAuthState(AuthState.tlDetails);
}
```

**TL phone number:**
Replace hardcoded `'+91 98765 43210'` with `rider?.teamLeaderPhone ?? '+91 98765 43210'`

**Battery level:**
Replace hardcoded `72%` with `rider?.batteryPercent?.toStringAsFixed(0) ?? '100'`

### 3.2 `wallet_screen.dart`

**History button:**
Find the history button and wire it to navigate to `HistoryScreen`:

```dart
onTap: () {
  final rider = provider.rider;
  if (rider != null) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => HistoryScreen(riderId: rider.id),
      ),
    );
  }
}
```

### 3.3 `profile_screen.dart`

Already imports the screens. Need to wire up the quick links:

**Edit Profile:**

```dart
onTap: () {
  Navigator.push(
    context,
    MaterialPageRoute(builder: (context) => const EditProfileScreen()),
  );
}
```

**Emergency SOS:**

```dart
onTap: () {
  Navigator.push(
    context,
    MaterialPageRoute(builder: (context) => const EmergencySOSScreen()),
  );
}
```

**Notifications:**

```dart
onTap: () {
  Navigator.push(
    context,
    MaterialPageRoute(builder: (context) => const NotificationCenterScreen()),
  );
}
```

---

## Phase 4: Fix Navigation Flows

### 4.1 Top-up Flow (4 steps)

**Current Flutter:** Purpose → UPI → Receipt (3 steps)
**Web app:** Purpose → Amount → UPI → Receipt (4 steps)

In `top_up_purpose_screen.dart`, change `onNext` to navigate to `TopUpAmountScreen` instead of `TopUpUpiScreen`.

In `top_up_amount_screen.dart`, add `onProceed` callback that navigates to `TopUpUpiScreen` with the selected amount.

### 4.2 Plan Success Navigation

**Current Flutter:** Plan success → Pre-Dashboard
**Web app:** Plan success → Pickup Hub

In `plan_success_screen.dart`, change `onNext` to navigate to `AuthState.pickupHub` instead of `AuthState.preDashboard`.

---

## Phase 5: Add Missing AppProvider Methods

### 5.1 `setAuthState` method

Add to `lib/providers/app_provider.dart`:

```dart
void setAuthState(AuthState state) {
  // This needs to communicate back to AuthWrapper
  // Option A: Use a ValueNotifier<AuthState>
  // Option B: Use a callback passed from AuthWrapper
}
```

### 5.2 `submitTicket` method

Add to `lib/providers/app_provider.dart`:

```dart
Future<void> submitTicket({
  required String category,
  required String subject,
  required String message,
  String priority = 'MEDIUM',
}) async {
  final rider = _rider;
  if (rider == null) throw Exception('No rider logged in');

  await ApiService().createTicket(
    riderId: rider.id,
    category: category,
    subject: subject,
    message: message,
    priority: priority,
  );
}
```

### 5.3 `createTicket` in ApiService

Add to `lib/services/api_service.dart`:

```dart
Future<Map<String, dynamic>> createTicket({
  required String riderId,
  required String category,
  required String subject,
  required String message,
  String priority = 'MEDIUM',
}) async {
  return post('/api/support/tickets', body: {
    'riderId': riderId,
    'category': category,
    'subject': subject,
    'message': message,
    'priority': priority,
  });
}
```

---

## Phase 6: Add Missing Rider Model Fields

### 6.1 Add to `lib/models/rider_model.dart`

```dart
// Team Leader fields
final String? teamLeaderName;
final String? teamLeaderPhone;
final String? teamLeaderEmployeeId;

// Battery
final double? batteryPercent;

// In fromJson:
teamLeaderName: json['teamLeaderName'],
teamLeaderPhone: json['teamLeaderPhone'],
teamLeaderEmployeeId: json['teamLeaderEmployeeId'],
batteryPercent: (json['batteryPercent'] as num?)?.toDouble(),

// In toJson:
'teamLeaderName': teamLeaderName,
'teamLeaderPhone': teamLeaderPhone,
'teamLeaderEmployeeId': teamLeaderEmployeeId,
'batteryPercent': batteryPercent,

// In copyWith: add these fields too
```

---

## Implementation Order

1. **Create 2 missing screens** (tl_details_screen.dart, vehicle_photos_screen.dart)
2. **Add missing fields to RiderModel** (teamLeaderName, teamLeaderPhone, batteryPercent)
3. **Add missing methods to AppProvider/ApiService** (setAuthState, submitTicket, createTicket)
4. **Wire up auth_wrapper.dart** (replace all fallback cases with actual screens)
5. **Fix button handlers** in active_dashboard_screen.dart, wallet_screen.dart, profile_screen.dart
6. **Fix navigation flows** (top-up 4 steps, plan success → pickup hub)

---

## Files to Modify

| File                                       | Changes                                                           |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `lib/screens/tl_details_screen.dart`       | CREATE                                                            |
| `lib/screens/vehicle_photos_screen.dart`   | CREATE                                                            |
| `lib/screens/auth_wrapper.dart`            | Wire up 10+ AuthStates, add imports, add topUpAmount enum         |
| `lib/screens/active_dashboard_screen.dart` | Fix notification bell, history, call TL buttons, hardcoded values |
| `lib/screens/wallet_screen.dart`           | Fix history button                                                |
| `lib/screens/profile_screen.dart`          | Wire up edit profile, emergency, notifications links              |
| `lib/screens/plan_success_screen.dart`     | Change navigation to pickupHub                                    |
| `lib/screens/top_up_purpose_screen.dart`   | Change navigation to topUpAmount                                  |
| `lib/models/rider_model.dart`              | Add teamLeaderName, teamLeaderPhone, batteryPercent fields        |
| `lib/providers/app_provider.dart`          | Add setAuthState, submitTicket methods                            |
| `lib/services/api_service.dart`            | Add createTicket method                                           |
