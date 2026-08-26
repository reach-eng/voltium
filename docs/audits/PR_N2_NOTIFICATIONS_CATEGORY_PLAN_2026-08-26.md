# PR-N2 — Notification `category` field (Web + Flutter)

**Branch off:** `fix/phase6d-api-hardening` (same as PR-N1)
**Target:** the structural fix for F-1 + F-2 from `NOTIFICATION_DATA_POPULATION_2026-08-26.md`. The remaining i18n bug: KYC/Maintenance tab filters + icon/label mapping fall back to **English keyword matching** on the notification title, which means Hindi-titled notifications never reach their category tab and always render with the wrong icon/label. PR-N1 wired the i18n strings; PR-N2 fixes the data shape that drives them.
**Effort estimate:** 2-3 days (server migration + Flutter refactor + tests + rollout)
**Prerequisite:** PR-N1 merged.

---

## 0. The headline

The KYC and Maintenance tab filters at `flutter/lib/features/notifications/presentation/screens/notifications_screen.dart:78-95` and the icon/label mapping at lines 689-747 all do `title.toLowerCase().contains('kyc' | 'verification' | ...)` keyword matching. This breaks for any non-English title, which is normal — the server is i18n-aware and the admin sends whatever language the rider is using.

**The fix:** add a structured `category` field to the server `Notification` model, set it at every notification create-site, and switch the client filters + icon mapping to use it. The client is then locale-agnostic and the server becomes the single source of truth for "what kind of notification is this?".

This is the **only structural change** in PR-N1/PR-N2. Everything else is wiring.

---

## 1. What we're shipping

| Layer | Change | Effort |
|---|---|---|
| Prisma schema | New `NotificationCategory` enum + nullable `category` column on `Notification` | 30 min |
| Migration | Add column, add index, backfill from existing `type` + title keywords | 1-2 h (incl. backfill script) |
| Notification service | New `CATEGORY_MAP` + `category` derivation in `createAndSend` | 1 h |
| Repository | `sendToRider` + `sendToAll` accept and set `category` | 30 min |
| Use cases | `sendToSingleRider` / `sendToAllRiders` / `sendToSpecificRiders` set `category` derived from `type` | 30 min |
| Outbox dispatcher | `WALLET_TOPUP_*` + `DEPOSIT_*` branch sets `category: 'PAYMENT'` | 15 min |
| Announcement broadcast job | Sets `category: 'ANNOUNCEMENT'` | 15 min |
| API response | `GET /api/rider/notifications` includes `category` field | 15 min |
| Flutter model | New `NotificationCategory` enum + nullable `category` on `AppNotification` + parser | 1 h |
| Flutter UI | Replace KYC/Maintenance tab filters with `n.category == NotificationCategory.kyc` | 30 min |
| Flutter UI | Replace `_getCategoryInfo` keyword matching with category lookup | 30 min |
| Tests | Server: enum + backfill + create-site category coverage. Client: 3 widget tests + parser test | 4-6 h |
| Rollout | Backward-compatible: `category` is nullable, clients that don't read it ignore it | 30 min setup |
| **Total** | | **2-3 days** |

---

## 2. Server: Prisma schema

### 2.1 Add the enum

File: `web/prisma/schema.prisma` — insert after `NotificationType` (line 1504) and before `NotificationPriority` (line 1506):

```prisma
enum NotificationCategory {
  PAYMENT
  KYC
  MAINTENANCE
  ANNOUNCEMENT
  SYSTEM

  @@map("notification_category")
}
```

**Why this set of 5?** It mirrors the 5 client tabs (All / Payments / KYC / Maintenance / Announcements). "All" is the absence of a filter, not a category. "SYSTEM" is the catch-all for the dozens of internal/admin/system events that don't fit the other four (e.g. support replies, shift reminders, birthday wishes that aren't really "announcements", and any new internal type added in the future). The 5 values cover every existing use-case with one explicit "I don't know where this belongs" bucket.

### 2.2 Add the column to `Notification`

File: `web/prisma/schema.prisma` line 583-602. Add a nullable column after `type`:

```prisma
model Notification {
  id        String               @id @default(cuid())
  riderId   String
  title     String
  message   String
  type      NotificationType
  // PR-N2 (2026-08-26): explicit category for client tab filtering.
  // Nullable to keep PR-N1-released clients working. Backfilled by
  // the PR-N2 migration. Set at every create-site going forward.
  category  NotificationCategory?
  priority  NotificationPriority @default(NORMAL)
  deepLink  String?
  isRead    Boolean              @default(false)
  createdAt DateTime             @default(now())

  rider     Rider                @relation(fields: [riderId], references: [id], onDelete: Cascade)

  @@index([riderId, isRead])
  @@index([riderId, createdAt])
  @@index([riderId, isRead, createdAt])
  @@index([riderId, category, createdAt]) // PR-N2: per-tab feed query
  @@map("notifications")
}
```

The new composite index `[riderId, category, createdAt]` is the index the client queries when a rider opens a single tab. Without it, the tab query is `O(n log n)` over all notifications for the rider. With it, the query is `O(log n + k)` where `k` is the page size.

### 2.3 Migration

New migration: `web/prisma/migrations/20260826120000_add_notification_category/migration.sql`

```sql
-- Step 1: create the enum
CREATE TYPE "notification_category" AS ENUM (
  'PAYMENT', 'KYC', 'MAINTENANCE', 'ANNOUNCEMENT', 'SYSTEM'
);

-- Step 2: add the nullable column
ALTER TABLE "notifications"
  ADD COLUMN "category" "notification_category";

-- Step 3: add the composite index (CONCURRENTLY not needed — table is small)
CREATE INDEX "notifications_riderId_category_createdAt_idx"
  ON "notifications"("riderId", "category", "createdAt" DESC);

-- Step 4: backfill from existing data
-- Same algorithm the client uses today (type + title keyword match).
-- Encoded as one UPDATE per source so each row can be reasoned about.
UPDATE "notifications" SET "category" = 'PAYMENT'
  WHERE "type" = 'PAYMENT';

UPDATE "notifications" SET "category" = 'KYC'
  WHERE "type" = 'SYSTEM'
    AND ("title" ILIKE '%kyc%'
      OR "title" ILIKE '%verification%'
      OR "title" ILIKE '%document%');

UPDATE "notifications" SET "category" = 'MAINTENANCE'
  WHERE "type" IN ('VEHICLE', 'SOS')
    AND ("title" ILIKE '%service%'
      OR "title" ILIKE '%maintenance%'
      OR "title" ILIKE '%vehicle%'
      OR "title" ILIKE '%battery%'
      OR "title" ILIKE '%swap%');

UPDATE "notifications" SET "category" = 'ANNOUNCEMENT'
  WHERE "type" = 'PROMOTION'
     OR "title" ILIKE '%reward%'
     OR "title" ILIKE '%offer%'
     OR "title" ILIKE '%announcement%';

-- Step 5: SYSTEM is the default for anything still NULL.
-- This intentionally only fills the NULL bucket — preserves any
-- classification the previous UPDATEs already made.
UPDATE "notifications" SET "category" = 'SYSTEM'
  WHERE "category" IS NULL;
```

**Important:** the migration runs as one transaction per `UPDATE`. On a 100k-row table this is sub-second on PostgreSQL with the existing `[riderId, createdAt]` index helping the WHERE clauses. If the table has >1M rows, see Appendix A for the chunked alternative.

**The migration is forward-only.** The category column becomes NOT NULL in a follow-up migration (deferred to PR-N3 — see Appendix B). For PR-N2 the column is nullable so any buggy backfill can be re-run.

---

## 3. Server: notification service (chokepoint #1)

File: `web/src/lib/notification-service.ts`

### 3.1 Add a CATEGORY_MAP

Mirror the existing TYPE_MAP at line 46-52. Insert immediately after it:

```typescript
const CATEGORY_MAP: Record<string, 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'> = {
  KYC_UPDATE: 'KYC',
  SUPPORT_REPLY: 'SYSTEM',
  PAYMENT_DUE: 'PAYMENT',
  REWARD: 'ANNOUNCEMENT',
  SHIFT_REMINDER: 'SYSTEM',
  BIRTHDAY_WISH: 'ANNOUNCEMENT',
  REFERRAL_REWARD: 'ANNOUNCEMENT',
  MANDATORY_UPDATE: 'SYSTEM',
  WALLET_LOW: 'PAYMENT',
};
```

### 3.2 Update `createAndSend` to derive category from type

At line 38, extend the signature with an optional `category` parameter that callers can pass explicitly, or fall back to the map:

```typescript
async createAndSend(
  riderId: string,
  title: string,
  message: string,
  type: string,
  data: Record<string, string> = {},
  category?: 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'
): Promise<...> {
  // ... existing TYPE_MAP + sanitizedType derivation unchanged ...

  const derivedCategory = category
    ?? CATEGORY_MAP[rawUpper]
    ?? deriveCategoryFromTitle(title);  // last-resort fallback for unknown types

  // ... existing try { ... } block:
  await db.notification.create({
    data: {
      riderId,
      title,
      message,
      type: sanitizedType,
      category: derivedCategory,
    },
  });
  // ...
}
```

`deriveCategoryFromTitle` is a tiny helper, extracted so the same algorithm lives in one place. See Appendix C for the implementation. It is a final safety net — the 5 explicit `notify*` methods below should always pass a category, but if a new caller invokes `createAndSend` with an unknown type, the title-keyword fallback keeps the row categorized.

### 3.3 Update each notify* method

Six methods, six explicit categories. All use `this.createAndSend(... , category)` with a literal so the call-site reads clearly:

| Method | Category | Why |
|---|---|---|
| `notifyKycStatusChange` (line 115) | `'KYC'` | always |
| `notifySupportReply` (line 128) | `'SYSTEM'` | support replies are an internal channel; no client tab for them |
| `notifyPaymentReminder` (line 161) | `'PAYMENT'` | always |
| `notifyRewardMilestone` (line 190) | `'ANNOUNCEMENT'` | the client Announcements tab already collects these via `promo` type |
| `notifyBirthdayWish` (line 202) | `'ANNOUNCEMENT'` | same — rider-facing birthday wish belongs in the Announcements tab |
| `notifyShiftReminder` (line 218) | `'SYSTEM'` | internal scheduling; no client tab for it |
| `notifyMandatoryUpdate` (line 227) | (no row written — overlay only, unchanged) |
| `notifyWalletBalanceLow` (line 235) | (no row written — overlay only, unchanged) |

Each method gets one new line — the explicit `category` argument:

```typescript
// notifyKycStatusChange
return this.createAndSend(riderId, title, message, 'KYC_UPDATE', {
  screen: 'KYC_STATUS', status,
}, 'KYC');
```

The other 5 follow the same pattern.

---

## 4. Server: repository (chokepoint #2)

File: `web/src/server/modules/notifications/notification.repository.ts`

### 4.1 `sendToRider` (line 18)

Add an optional `category` param. Default to the type-based derivation if not passed:

```typescript
async sendToRider(
  riderDbId: string,
  title: string,
  message: string,
  type: string = 'INFO',
  category?: 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'
) {
  return db.notification.create({
    data: {
      riderDbId,
      title,
      message,
      type: type as 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM',
      category: category ?? deriveCategoryFromTitle(title),
      isRead: false,
    },
  });
}
```

### 4.2 `sendToAll` (line 30)

Same treatment, plumbed through `createMany`:

```typescript
async sendToAll(
  title: string,
  message: string,
  type: string = 'INFO',
  category?: 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'
) {
  const categoryValue = category ?? deriveCategoryFromTitle(title);
  // ... rest unchanged, but add category: categoryValue to each row
}
```

---

## 5. Server: use cases (admin paths)

File: `web/src/server/modules/notifications/notification.use-cases.ts`

### 5.1 `sendToRider` (line 21) and `sendToAll` (line 25)

Thin wrappers — pass `category` through:

```typescript
async sendToRider(
  riderDbId: string,
  title: string,
  message: string,
  type?: string,
  category?: 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'
) {
  return notificationRepository.sendToRider(riderDbId, title, message, type, category);
},

async sendToAll(
  title: string,
  message: string,
  type?: string,
  category?: 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'
) {
  return notificationRepository.sendToAll(title, message, type, category);
},
```

### 5.2 `sendToSingleRider` (line 120)

Currently writes a row directly with `db.notification.create`. Switch to `notificationRepository.sendToRider` so the category derivation is consistent, or add `category` to the inline create. The cleaner option is to call the repository:

```typescript
async sendToSingleRider(
  riderId: string,
  title: string,
  message: string,
  type: string,
  actorId: string,
  category?: 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'
) {
  const rider = await getCachedRider(...);
  if (!rider) throw new Error('Rider not found');

  const notification = await notificationRepository.sendToRider(
    riderId, title, message, type, category
  );
  // ... rest of the FCM + audit log block unchanged
}
```

### 5.3 `sendToAllRiders` (line 171) and `sendToSpecificRiders` (line 239)

Same treatment — add a `category` param and pass it through to `notificationRepository.sendToAll` or inline `createMany`. The admin "send to all" UI picks the category from a select widget; the route validates it matches one of the 5 enum values.

---

## 6. Server: outbox dispatcher

File: `web/src/server/workers/jobs/notification-dispatch.job.ts`

### 6.1 WALLET_TOPUP / DEPOSIT branch (line 154-184)

These four event types all share one create-call. Add `category: 'PAYMENT'`:

```typescript
case 'WALLET_TOPUP_APPROVED':
case 'WALLET_TOPUP_REJECTED':
case 'DEPOSIT_APPROVED':
case 'DEPOSIT_REJECTED': {
  const eventType = String(payload.type);
  try {
    await db.notification.create({
      data: {
        riderId: payload.riderId as string,
        type: 'PAYMENT',
        category: 'PAYMENT', // PR-N2
        title: (payload.title as string) ?? eventType.replace(/_/g, ' '),
        message: (payload.body as string) ?? eventType.replace(/_/g, ' '),
      },
    });
  } catch (err) { ... }
  return { delivered: true, channel: 'in-app' };
}
```

### 6.2 Announcement broadcast job

File: `web/src/server/workers/jobs/announcement-broadcast.job.ts:115`

The job writes a notification row for each rider. Add `category: 'ANNOUNCEMENT'` to the inline create.

### 6.3 Orphan event consumer

File: `web/src/server/workers/jobs/orphan-event-consumer.job.ts:72, 96`

Two `notificationService.createAndSend` call sites. Both need a category argument. The event type drives the category:
- `REFERRAL_REWARD` → `'ANNOUNCEMENT'`
- All other orphan events → `'SYSTEM'` (default in CATEGORY_MAP)

The cleanest path: leave the call as-is and let `CATEGORY_MAP` handle the derivation. Verify by reading the call sites — if they pass a `type` argument that maps to one of the 5 categories, the service already does the right thing.

---

## 7. Server: API response

File: `web/src/app/api/rider/notifications/route.ts`

The `GET` handler returns the result of `notificationUseCases.listNotifications()` which is the raw Prisma result. The Prisma result already includes every column on the model, so the new `category` field flows through automatically. **No code change needed here** — but verify the response shape with an integration test (see §11).

The `notificationDelivery` table does not need a `category` column — that table is about FCM delivery channels, not user-visible filtering.

---

## 8. Server: route validation

File: `web/src/app/api/admin/notifications/...`

Wherever the admin "send notification" route accepts a `category` param (new in PR-N2), validate it against the 5-value enum. Use the existing Zod `z.enum(['PAYMENT','KYC','MAINTENANCE','ANNOUNCEMENT','SYSTEM'])` pattern that already exists for the other enums in `web/src/lib/validators.ts`.

If the admin UI doesn't yet have a category dropdown, the simpler path is: derive the category from the existing `type` dropdown server-side (e.g. `type=PAYMENT` → `category=PAYMENT`). This keeps the admin UI unchanged and is the right call for PR-N2; the dedicated category UI can come later.

---

## 9. Client: Dart model

File: `flutter/lib/models/notification_model.dart`

### 9.1 New enum

Add after the existing `AppNotificationType` enum (line 13-29):

```dart
/// PR-N2 (2026-08-26): explicit category for tab filtering.
/// Mirrors the server `NotificationCategory` enum in
/// `web/prisma/schema.prisma`. Optional for backward
/// compatibility with PR-N1-release builds.
enum NotificationCategory {
  payment,
  kyc,
  maintenance,
  announcement,
  system,
}
```

### 9.2 Extend `AppNotification`

Add a nullable field (line 32-51, the class definition):

```dart
@JsonSerializable(createFactory: false)
class AppNotification {
  final String id;
  final String title;
  final String message;
  final AppNotificationType type;
  final NotificationCategory? category;  // PR-N2
  final DateTime createdAt;
  final bool isRead;
  final String? actionUrl;
  final Map<String, dynamic>? data;

  AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.createdAt,
    this.category,                       // PR-N2
    this.isRead = false,
    this.actionUrl,
    this.data,
  });

  AppNotification copyWith({bool? isRead, NotificationCategory? category}) {
    return AppNotification(
      id: id,
      title: title,
      message: message,
      type: type,
      createdAt: createdAt,
      category: category ?? this.category,
      isRead: isRead ?? this.isRead,
      actionUrl: actionUrl,
      data: data,
    );
  }
  // ... rest unchanged
}
```

### 9.3 Update `fromJson`

Add the category parse at line 68-84:

```dart
factory AppNotification.fromJson(Map<String, dynamic> json) =>
    AppNotification(
      id: json['id']?.toString() ??
          DateTime.now().millisecondsSinceEpoch.toString(),
      title: json['title']?.toString() ?? '',
      message: json['message']?.toString() ?? json['body']?.toString() ?? '',
      type: _parseType(json['type']),
      category: _parseCategory(json['category']),
      createdAt: DateTime.tryParse(
            json['createdAt']?.toString() ??
                json['timestamp']?.toString() ??
                '',
          ) ??
          DateTime.now(),
      isRead: json['isRead'] ?? false,
      actionUrl: json['actionUrl']?.toString(),
      data: json['data'] as Map<String, dynamic>?,
    );

/// PR-N2: tolerant of unknown / missing values.
static NotificationCategory? _parseCategory(dynamic raw) {
  if (raw == null) return null;
  final name = raw.toString().toLowerCase();
  for (final v in NotificationCategory.values) {
    if (v.name == name) return v;
  }
  return null; // unknown server value → treat as "no category"
}
```

### 9.4 Regenerate JSON serialization

After editing the model, run `dart run build_runner build --delete-conflicting-outputs` to regenerate `notification_model.g.dart`. The `category` field is `String?` in the JSON but `NotificationCategory?` in Dart; the generated serializer handles the enum-to-string conversion automatically.

---

## 10. Client: UI rewrite

File: `flutter/lib/features/notifications/presentation/screens/notifications_screen.dart`

### 10.1 KYC tab filter (lines 78-84)

Replace the keyword match with a structured category check:

```dart
case NotificationTab.kyc:
  // PR-N2 (2026-08-26): structured category check replaces
  // the title-keyword match that broke for Hindi-titled
  // notifications. Fall back to keyword for legacy rows
  // (server pre-PR-N2, or pre-backfill) — those have
  // `category == null`.
  return all.where((n) {
    if (n.category == NotificationCategory.kyc) return true;
    if (n.category == null && n.type == AppNotificationType.system) {
      final t = n.title.toLowerCase();
      return t.contains('kyc') ||
          t.contains('verification') ||
          t.contains('document');
    }
    return false;
  }).toList();
```

### 10.2 Maintenance tab filter (lines 90-95)

Same treatment:

```dart
case NotificationTab.maintenance:
  return all.where((n) {
    if (n.category == NotificationCategory.maintenance) return true;
    if (n.category == AppNotificationType.vehicle) return true; // legacy
    if (n.category == null && n.type == AppNotificationType.system) {
      final t = n.title.toLowerCase();
      return t.contains('service') || t.contains('maintenance');
    }
    return false;
  }).toList();
```

### 10.3 Payments tab filter (lines 58-69)

The Payments tab already uses the structured `AppNotificationType.payment` enum, so the **correctness is already fine**. But it should ALSO check `category` first so Hindi-titled payment notifications route correctly:

```dart
case NotificationTab.payments:
  return all.where((n) {
    if (n.category == NotificationCategory.payment) return true;
    // Legacy fallback: structured enum + older aliases
    return n.type == AppNotificationType.payment ||
        n.type == AppNotificationType.paymentReceived ||
        n.type == AppNotificationType.paymentSent;
  }).toList();
```

### 10.4 Announcements tab filter (lines 96-106)

Same — promote `category` to the primary check:

```dart
case NotificationTab.announcements:
  return all.where((n) {
    if (n.category == NotificationCategory.announcement) return true;
    return n.type == AppNotificationType.promo ||
        n.type == AppNotificationType.promotion;
  }).toList();
```

### 10.5 `_getCategoryInfo` (lines 689-747)

Replace the 14-keyword waterfall with a structured switch:

```dart
({IconData icon, Color color, Color bgColor, String label}) _getCategoryInfo(
  BuildContext context,
  AppNotification notif,
) {
  final colors = AppColors.of(context);
  final category = notif.category;
  if (category != null) {
    switch (category) {
      case NotificationCategory.payment:
        return (
          icon: Icons.currency_rupee,
          color: AppColors.success,
          bgColor: colors.successLight,
          label: 'Payment'
        );
      case NotificationCategory.kyc:
        return (
          icon: Icons.shield_outlined,
          color: AppColors.accentPurple,
          bgColor: AppColors.accentPurple.withValues(alpha: 0.15),
          label: 'KYC'
        );
      case NotificationCategory.maintenance:
        return (
          icon: Icons.build_outlined,
          color: AppColors.primary,
          bgColor: colors.primarySurface,
          label: 'Maintenance'
        );
      case NotificationCategory.announcement:
        return (
          icon: Icons.campaign_outlined,
          color: AppColors.accentPurple,
          bgColor: AppColors.accentPurple.withValues(alpha: 0.15),
          label: 'Announcement'
        );
      case NotificationCategory.system:
        return (
          icon: Icons.notifications_outlined,
          color: colors.onSurfaceVariant,
          bgColor: colors.iconBackground,
          label: 'General'
        );
    }
  }
  // Legacy fallback for rows with category == null
  // (server pre-PR-N2 or unbackfilled). The same 14-keyword
  // algorithm as before — only reached for legacy rows.
  final title = notif.title.toLowerCase();
  if (notif.type == AppNotificationType.paymentReceived ||
      notif.type == AppNotificationType.paymentSent ||
      title.contains('payment') || title.contains('wallet') ||
      title.contains('top') || title.contains('rent')) {
    return (icon: Icons.currency_rupee, color: AppColors.success,
            bgColor: colors.successLight, label: 'Payment');
  }
  if (title.contains('kyc') || title.contains('verification') ||
      title.contains('document')) {
    return (icon: Icons.shield_outlined, color: AppColors.accentPurple,
            bgColor: AppColors.accentPurple.withValues(alpha: 0.15), label: 'KYC');
  }
  if (title.contains('service') || title.contains('maintenance') ||
      title.contains('vehicle') || title.contains('battery') ||
      title.contains('swap')) {
    return (icon: Icons.build_outlined, color: AppColors.primary,
            bgColor: colors.primarySurface, label: 'Maintenance');
  }
  if (notif.type == AppNotificationType.promo ||
      title.contains('reward') || title.contains('offer') ||
      title.contains('announcement')) {
    return (icon: Icons.campaign_outlined, color: AppColors.accentPurple,
            bgColor: AppColors.accentPurple.withValues(alpha: 0.15), label: 'Announcement');
  }
  return (icon: Icons.notifications_outlined, color: colors.onSurfaceVariant,
          bgColor: colors.iconBackground, label: 'General');
}
```

This is a 2x-size increase but the `if (category != null)` fast path means the keyword waterfall only runs for legacy rows, which should be a small fraction of the data after the backfill runs.

### 10.6 Remove the `txtnotifNoMatchHint` dev hint

The ARB key `txtnotifNoMatchHint` (en line 2013, hi line 859) was added by a prior agent as a dev-only hint acknowledging the title-keyword filter limitation. With structured categories, the limitation is gone. **Remove the key from both ARB files** and any wiring. The plan's PR-N1 §Appendix B deferred this decision — PR-N2 makes the call.

### 10.7 No change to dead code

The dead `notification_provider.dart`, `notification_cards.dart`, and `domain/entity.dart` are not touched by PR-N2. Their deletion is PR-N4 cleanup, not part of this work. Do NOT include them in this PR to keep the diff focused.

---

## 11. Tests

### 11.1 Server: enum + backfill coverage

`web/tests/unit/notifications/notification-category.test.ts` (new):

```typescript
import { describe, it, expect } from 'vitest';
import { CATEGORY_MAP, deriveCategoryFromTitle } from '@/lib/notification-service';

describe('NotificationCategory derivation', () => {
  it('PAYMENT_DUE maps to PAYMENT', () => {
    expect(CATEGORY_MAP.PAYMENT_DUE).toBe('PAYMENT');
  });
  it('KYC_UPDATE maps to KYC', () => {
    expect(CATEGORY_MAP.KYC_UPDATE).toBe('KYC');
  });
  it('REWARD maps to ANNOUNCEMENT', () => {
    expect(CATEGORY_MAP.REWARD).toBe('ANNOUNCEMENT');
  });
  it('SHIFT_REMINDER maps to SYSTEM', () => {
    expect(CATEGORY_MAP.SHIFT_REMINDER).toBe('SYSTEM');
  });

  describe('deriveCategoryFromTitle (English title-keyword fallback)', () => {
    it('top-up notifications go to PAYMENT', () => {
      expect(deriveCategoryFromTitle('Wallet top-up successful'))
        .toBe('PAYMENT');
    });
    it('KYC notifications go to KYC', () => {
      expect(deriveCategoryFromTitle('KYC Approved!'))
        .toBe('KYC');
    });
    it('maintenance notifications go to MAINTENANCE', () => {
      expect(deriveCategoryFromTitle('Vehicle service due'))
        .toBe('MAINTENANCE');
    });
    it('reward notifications go to ANNOUNCEMENT', () => {
      expect(deriveCategoryFromTitle('Reward Earned!'))
        .toBe('ANNOUNCEMENT');
    });
    it('unknown titles go to SYSTEM', () => {
      expect(deriveCategoryFromTitle('Important account notice'))
        .toBe('SYSTEM');
    });
    it('Hindi titles go to SYSTEM (not categorized — limitation acknowledged)', () => {
      // Without explicit `category` from the caller, a Hindi title
      // can only fall through to SYSTEM via the keyword waterfall.
      // The PR-N2 fix relies on the EXPLICIT category being passed
      // at every create-site; this test documents the fallback.
      expect(deriveCategoryFromTitle('दस्तावेज़ सत्यापन पूरा हुआ'))
        .toBe('SYSTEM');
    });
  });
});
```

### 11.2 Server: create-site category coverage

For each of the 6 `notify*` methods in `notification-service.ts`, add a unit test that asserts the created `Notification` row has the correct `category`:

```typescript
describe('notifyKycStatusChange', () => {
  it('sets category to KYC', async () => {
    await notificationService.notifyKycStatusChange('rider-1', 'APPROVED');
    const row = await db.notification.findFirst({ where: { riderId: 'rider-1' } });
    expect(row.category).toBe('KYC');
  });
});
```

(Repeat for `notifySupportReply`→`SYSTEM`, `notifyPaymentReminder`→`PAYMENT`, `notifyRewardMilestone`→`ANNOUNCEMENT`, `notifyBirthdayWish`→`ANNOUNCEMENT`, `notifyShiftReminder`→`SYSTEM`.)

The test runs against a Postgres test database (already used by `npm run test:unit` and the existing integration tests). The `db.notification.create` call inside `createAndSend` writes the category, and the test reads it back.

### 11.3 Server: migration backfill verification

`web/tests/integration/notifications/backfill.test.ts` (new):

```typescript
it('backfills legacy PAYMENT rows', async () => {
  await db.notification.create({ data: { riderId, title: 'Top-up', message: '', type: 'PAYMENT' } });
  await runBackfillMigration();
  const row = await db.notification.findFirst({ where: { riderId } });
  expect(row.category).toBe('PAYMENT');
});
it('backfills legacy KYC rows by title keyword', async () => {
  await db.notification.create({ data: { riderId, title: 'KYC Approved!', message: '', type: 'SYSTEM' } });
  await runBackfillMigration();
  const row = await db.notification.findFirst({ where: { riderId } });
  expect(row.category).toBe('KYC');
});
// + 4 more tests for MAINTENANCE, ANNOUNCEMENT, SYSTEM default, Hindi-title-to-SYSTEM
```

### 11.4 Server: API response shape

`web/tests/api-routes.test.ts` (existing file, add new test):

```typescript
it('GET /api/rider/notifications includes category field', async () => {
  await createRiderWithNotifications();
  const res = await request(app).get('/api/rider/notifications').set('Cookie', riderSessionCookie);
  const body = res.body.data.notifications[0];
  expect(body).toHaveProperty('category');
  expect(['PAYMENT', 'KYC', 'MAINTENANCE', 'ANNOUNCEMENT', 'SYSTEM', null])
    .toContain(body.category);
});
```

### 11.5 Client: parser test

`flutter/test/models/notification_model_test.dart` (new file):

```dart
test('parses category from server JSON', () {
  final json = {'id':'1','title':'t','message':'m','type':'PAYMENT','category':'PAYMENT','createdAt':'2026-08-26T10:00:00Z','isRead':false};
  final n = AppNotification.fromJson(json);
  expect(n.category, NotificationCategory.payment);
});

test('returns null for missing category (legacy rows)', () {
  final json = {'id':'1','title':'t','message':'m','type':'INFO','createdAt':'2026-08-26T10:00:00Z','isRead':false};
  final n = AppNotification.fromJson(json);
  expect(n.category, isNull);
});

test('returns null for unknown category values', () {
  final json = {'id':'1','title':'t','message':'m','type':'INFO','category':'FUTURE_VALUE','createdAt':'2026-08-26T10:00:00Z','isRead':false};
  final n = AppNotification.fromJson(json);
  expect(n.category, isNull);
});

test('preserves all 5 server enum values', () {
  for (final v in ['PAYMENT', 'KYC', 'MAINTENANCE', 'ANNOUNCEMENT', 'SYSTEM']) {
    final json = {'id':'1','title':'t','message':'m','type':'INFO','category':v,'createdAt':'2026-08-26T10:00:00Z','isRead':false};
    final n = AppNotification.fromJson(json);
    expect(n.category, isNotNull, reason: 'category $v should parse');
  }
});
```

### 11.6 Client: Hindi-titled notification reaches the right tab

`flutter/test/features/notifications/notifications_screen_hindi_test.dart` (new file):

```dart
testWidgets('Hindi-titled KYC notification appears in KYC tab', (tester) async {
  final notif = AppNotification(
    id: 'kyc-1',
    title: 'दस्तावेज़ सत्यापन पूरा हुआ',
    message: 'आप अब वाहन लेने जा सकते हैं',
    type: AppNotificationType.system,
    category: NotificationCategory.kyc,  // PR-N2
    createdAt: DateTime.now(),
  );
  await tester.pumpWidget(_harness(const Locale('hi'), [notif]));
  // All tab shows the notification
  expect(find.text('दस्तावेज़ सत्यापन पूरा हुआ'), findsOneWidget);
  // Switch to KYC tab
  await tester.tap(find.text('केवाईसी'));
  await tester.pumpAndSettle();
  // Still visible — the structured category routed it correctly
  expect(find.text('दस्तावेज़ सत्यापन पूरा हुआ'), findsOneWidget);
});

testWidgets('Hindi-titled payment notification gets the right icon', (tester) async {
  final notif = AppNotification(
    id: 'pay-1',
    title: '₹500 का टॉप-अप सफल',
    message: '',
    type: AppNotificationType.payment,
    category: NotificationCategory.payment,
    createdAt: DateTime.now(),
  );
  await tester.pumpWidget(_harness(const Locale('hi'), [notif]));
  // The label is "PAYMENT" in English (label not localized in PR-N1)
  // but the icon should be the green rupee, not the gray bell
  final cardFinder = find.byKey(const Key('notificationCard'));
  expect(cardFinder, findsOneWidget);
  // (Icon assertion via golden test or by reading widget tree)
});
```

### 11.7 Client: e2e re-run

Run `flutter/integration_test/e2e_individual/09_notifications_test.dart` to confirm no regression. The test uses `findsAtLeastNWidgets(1)` style assertions, so it should be label-agnostic and pass unchanged.

### 11.8 Coverage

Confirm the 85% line-coverage gate still holds:
- `npm run test:coverage:merge` — must report ≥85% lines on changed files
- `bash scripts/flutter-coverage.sh` — must report ≥85% lines on changed files

If the new test files don't push the overall coverage above 85%, add a few more edge-case tests (clock skew, null fields, etc.) — but the existing test infrastructure should be more than enough.

---

## 12. Rollout + compatibility

### 12.1 Backward compatibility

The `category` column is **nullable** in PR-N2. This means:

- PR-N1-release client builds that don't know about `category` ignore the field — no client crash.
- The new model file with `NotificationCategory?` tolerates `category: null` in the JSON — falls back to the legacy keyword path.
- The server's `category: undefined` from a PR-N1-release sender is treated as "no category" by the server, which still works because the column is nullable.

Net: PR-N2 is **deployed independently** of the client. The server can ship first, the client catches up later. No coordinated release needed.

### 12.2 Deployment order

1. **Deploy the Prisma migration.** Adds the column with a default of `NULL`. Backfill runs synchronously in the same migration. For 100k rows: ~1-2 seconds. For 1M+ rows: see Appendix A.
2. **Deploy the server with the new create-site category setting.** All new notifications have `category` set. Existing client builds see the field but ignore it.
3. **Deploy the Flutter client (PR-N2 build).** The new model + filters engage. The backfilled data flows through.
4. **PR-N3 follow-up** (Appendix B): make `category` NOT NULL. Out of scope for PR-N2.

### 12.3 Rollback

If the server release causes a regression (extremely unlikely — the column is additive and nullable):

1. `ALTER TABLE notifications DROP COLUMN category;` — drops the column.
2. `DROP TYPE notification_category;` — drops the enum.
3. Revert the server code commit.
4. Client keeps working — `AppNotification.fromJson` tolerates missing `category` and returns `null`.

The Prisma migration is forward-only in spirit but Prisma supports manual `DROP` migrations if rollback is needed.

### 12.4 Feature flag (optional)

If you want a safer rollout, gate the new model field with a feature flag:

```typescript
// server: in the GET handler
const responseNotifications = notifications.map((n) => ({
  ...n,
  category: process.env.FEATURE_NOTIFICATION_CATEGORY === 'true' ? n.category : undefined,
}));
```

This lets you ship the migration + backfill to staging first, verify, then flip the env var. **Not required** for PR-N2 — the additive shape is safe enough — but the option is there if the team wants extra caution.

---

## 13. Execution order (8 steps, each shippable alone)

Each step is independently committable. Run the full suite after each.

1. **Step 1 — Schema + migration only** (1-2 h)
   - Edit `web/prisma/schema.prisma`: add `NotificationCategory` enum, `category` field, composite index
   - Generate migration: `npx prisma migrate dev --name add_notification_category`
   - Edit the generated migration to add the backfill `UPDATE` statements
   - Run `npm run db:deploy` against a local dev DB to verify the migration
   - Commit: `feat(notifications): add NotificationCategory enum + backfill migration`
   - **Verify:** `npx prisma studio` shows the new column with a 5-value enum. Backfill `UPDATE` statements ran without error. Sample rows have `category` populated.

2. **Step 2 — Service + repository + use cases** (2-3 h)
   - Edit `web/src/lib/notification-service.ts`: add `CATEGORY_MAP`, update `createAndSend` signature, add `category` arg to each `notify*` method
   - Edit `web/src/server/modules/notifications/notification.repository.ts`: add `category` param to `sendToRider` and `sendToAll`
   - Edit `web/src/server/modules/notifications/notification.use-cases.ts`: thread `category` through `sendToRider`, `sendToAll`, `sendToSingleRider`, `sendToAllRiders`, `sendToSpecificRiders`
   - Edit `web/src/server/workers/jobs/notification-dispatch.job.ts`: add `category: 'PAYMENT'` to the WALLET/DEPOSIT branch
   - Edit `web/src/server/workers/jobs/announcement-broadcast.job.ts`: add `category: 'ANNOUNCEMENT'`
   - Commit: `feat(notifications): set category at every create-site`
   - **Verify:** `npm run test:unit` passes. New `notification-category.test.ts` passes.

3. **Step 3 — Server unit + integration tests** (2-3 h)
   - Add `web/tests/unit/notifications/notification-category.test.ts`
   - Add 6 tests asserting each `notify*` method sets the right category
   - Add `web/tests/integration/notifications/backfill.test.ts` verifying the migration backfill
   - Commit: `test(notifications): cover category derivation and backfill`
   - **Verify:** `npm run test:unit` and `npm run test:integration` pass. Coverage ≥85% on changed files.

4. **Step 4 — Flutter model** (1 h)
   - Add `NotificationCategory` enum to `flutter/lib/models/notification_model.dart`
   - Add `category` field to `AppNotification`
   - Update `fromJson` with `_parseCategory`
   - Run `dart run build_runner build --delete-conflicting-outputs`
   - Commit: `feat(notifications): add NotificationCategory to client model`
   - **Verify:** `flutter test test/models/notification_model_test.dart` passes.

5. **Step 5 — Flutter UI** (1-2 h)
   - Update `notifications_screen.dart`:
     - Lines 58-69 (Payments filter): promote `category` to primary check
     - Lines 78-95 (KYC + Maintenance filters): promote `category` to primary check
     - Lines 96-106 (Announcements filter): promote `category` to primary check
     - Lines 689-747 (`_getCategoryInfo`): switch on `category` first, keyword fallback second
   - Remove `txtnotifNoMatchHint` from both ARB files (no longer needed)
   - Commit: `feat(notifications): use structured category for tab filters and icon mapping`
   - **Verify:** Manual test in Hindi locale — a KYC notification titled in Hindi appears in the KYC tab with the right icon. Manual test in English locale — no regression.

6. **Step 6 — Flutter tests** (2-3 h)
   - Add `flutter/test/models/notification_model_test.dart` (parser tests)
   - Add `flutter/test/features/notifications/notifications_screen_hindi_test.dart` (Hindi-titled notification reaches the right tab)
   - Commit: `test(notifications): cover category parser and Hindi tab routing`
   - **Verify:** `flutter test` passes. `flutter analyze` 0 new issues.

7. **Step 7 — E2E + coverage** (1 h)
   - Run `flutter/integration_test/e2e_individual/09_notifications_test.dart` — must still pass
   - Run `npm run test:coverage:merge` — must report ≥85%
   - Run `bash scripts/flutter-coverage.sh` — must report ≥85%
   - Commit any test-only changes (e.g. test infra updates)
   - **Verify:** All green.

8. **Step 8 — PR + deploy** (1 h)
   - Push branch + open PR
   - PR title: `feat(notifications): add structured category field for tab filtering (PR-N2)`
   - PR body: link to `NOTIFICATION_DATA_POPULATION_2026-08-26.md`, this plan, and PR-N1
   - **Verify:** CI green. Reviewer focus: the migration is the riskiest piece; everything else is additive.

**Total: ~10-15 hours of focused work over 2-3 days.**

---

## 14. Files touched (summary)

| File | Action | Lines changed |
|---|---|---|
| `web/prisma/schema.prisma` | edit (add enum + column + index) | +12 |
| `web/prisma/migrations/20260826120000_add_notification_category/migration.sql` | new (generated, then edited with backfill) | +~50 |
| `web/src/lib/notification-service.ts` | edit (CATEGORY_MAP + createAndSend signature + 6 notify* methods) | +~50, -~5 |
| `web/src/server/modules/notifications/notification.repository.ts` | edit (2 methods get `category` param) | +~15, -~2 |
| `web/src/server/modules/notifications/notification.use-cases.ts` | edit (5 methods thread `category`) | +~30, -~10 |
| `web/src/server/workers/jobs/notification-dispatch.job.ts` | edit (1 site) | +1 |
| `web/src/server/workers/jobs/announcement-broadcast.job.ts` | edit (1 site) | +1 |
| `flutter/lib/models/notification_model.dart` | edit (enum + field + parser) | +~25, -~2 |
| `flutter/lib/models/notification_model.g.dart` | regenerated | +~10 |
| `flutter/lib/features/notifications/presentation/screens/notifications_screen.dart` | edit (4 filter sites + 1 lookup) | +~70, -~30 |
| `flutter/lib/l10n/app_en.arb` | edit (remove `txtnotifNoMatchHint`) | -2 |
| `flutter/lib/l10n/app_hi.arb` | edit (remove `txtnotifNoMatchHint`) | -2 |
| `web/tests/unit/notifications/notification-category.test.ts` | new | +~80 |
| `web/tests/unit/notifications/notify-category-coverage.test.ts` | new | +~150 |
| `web/tests/integration/notifications/backfill.test.ts` | new | +~120 |
| `web/tests/api-routes.test.ts` | edit (1 new test) | +~25 |
| `flutter/test/models/notification_model_test.dart` | new | +~60 |
| `flutter/test/features/notifications/notifications_screen_hindi_test.dart` | new | +~100 |

**Net diff estimate: +~800 lines, -~50 lines across 17 files.**

---

## 15. Acceptance criteria (reviewer focus)

A reviewer should be able to verify PR-N2 in 10 minutes:

1. **Schema review (5 min)**
   - `npx prisma studio` shows the `Notification` table with a `category` column (enum, nullable)
   - A query like `SELECT type, category, count(*) FROM notifications GROUP BY 1,2` shows roughly the expected distribution
   - The composite index `[riderId, category, createdAt]` exists in the indexes list

2. **Server test review (3 min)**
   - `notification-category.test.ts` covers all 6 `notify*` methods + the title-keyword fallback
   - `backfill.test.ts` covers the 5 backfill buckets + Hindi-title-to-SYSTEM
   - `api-routes.test.ts` confirms the response shape includes `category`

3. **Manual client test (2 min)**
   - On a Hindi device, open Notifications → receive a test KYC notification titled in Hindi → tap the KYC tab → notification is visible. Compare to the All tab — same set, no extras.
   - On an English device, the same flow still works.
   - On either device, mark-as-read / delete / mark-all-read / clear-read still work.

4. **Static checks**
   - `flutter analyze` → 0 new issues
   - `npm run test:unit` → all existing + new tests pass
   - `npm run test:integration` → all existing + new tests pass
   - `npm run test:coverage:merge` → ≥85% on changed files
   - `flutter test` → all existing + new tests pass
   - `bash scripts/flutter-coverage.sh` → ≥85% on changed files

5. **No regression**
   - Existing notifications e2e (`09_notifications_test.dart`) still passes
   - Existing dashboard bell still shows the right count
   - Existing pull-to-refresh still works
   - Logout still wipes notification state

6. **Out-of-scope checks**
   - PR-N2 does NOT touch the dead `notification_provider.dart` / `notification_cards.dart` / `domain/entity.dart`
   - PR-N2 does NOT change PR-N1's ARB work (only removes `txtnotifNoMatchHint` which is the documented cleanup from PR-N1's appendix)
   - PR-N2 does NOT add a NOT NULL constraint on `category` — that is PR-N3

---

## 16. Out of scope (deferred to other PRs)

- **NOT NULL constraint on `category`** — PR-N3, after a release cycle of observation. See Appendix B.
- **Localized category labels** ("Payment" / "भुगतान", "KYC" / "केवाईसी", etc.) — A future i18n pass on `_getCategoryInfo`. The current labels in PR-N2 are still English-only on the category-icon line; the tab labels were already localized in PR-N1. Defer to keep PR-N2 focused.
- **Admin UI for category selection** — Admin "send notification" flow currently derives category from `type` server-side. A dedicated category dropdown would be cleaner. Out of scope for PR-N2.
- **Dead code deletion** (`notification_provider.dart` / `notification_cards.dart` / `domain/entity.dart`) — PR-N4 cleanup. Independent of this work.
- **Per-rider notification preferences** — "Only show me KYC notifications in the All tab; hide them from category tabs" — future feature, not in scope.
- **Notification grouping** ("Group same-category notifications from today into one row") — future UX, not in scope.

---

## 17. Risk

**Risk:** medium. The migration backfill runs against existing data; a bug in the SQL could mis-classify rows. The client-side `_getCategoryInfo` is a 2x-size increase; more room for bugs in the keyword fallback.

**Mitigations:**
- The backfill `UPDATE` statements are deterministic — re-running them is idempotent (rows with an already-correct category won't be re-updated by the `WHERE` clauses that include the right-hand type).
- The migration is in a transaction. If it fails, the column is dropped and we retry.
- The category column is nullable. A bad backfill leaves a row with `category = NULL`, which the client treats as "legacy" and falls back to keyword matching. Worst case = current behavior.
- The new test suite covers both the happy path and the Hindi-title edge case explicitly.

**Rollback cost:** low. One `ALTER TABLE ... DROP COLUMN` + revert the server code. The client tolerates the missing field.

---

## Appendix A — chunked backfill for >1M rows

If the `notifications` table is large (e.g. >1M rows), the synchronous backfill in the migration will hold a lock longer than is healthy for a production deploy. Use this chunked alternative:

```sql
-- Step 4a: PAYMENT
DO $$
DECLARE
  last_id TEXT;
BEGIN
  LOOP
    UPDATE "notifications" SET "category" = 'PAYMENT'
      WHERE "category" IS NULL AND "type" = 'PAYMENT'
        AND "id" > COALESCE(last_id, '')
      ORDER BY "id" ASC LIMIT 5000;
    last_id := (SELECT MAX(id) FROM "notifications" WHERE "category" = 'PAYMENT' AND "id" > COALESCE(last_id, ''));
    EXIT WHEN NOT FOUND OR last_id IS NULL;
    PERFORM pg_sleep(0.05);
  END LOOP;
END $$;

-- Repeat the chunked block for KYC, MAINTENANCE, ANNOUNCEMENT, SYSTEM
```

This is 5-10 minutes per million rows with the sleep. Run in a maintenance window or behind a feature flag.

---

## Appendix B — PR-N3 (deferred): make `category` NOT NULL

After a full release cycle of PR-N2, the backfill is verified and every new notification is created with `category` set. Add a follow-up migration:

```sql
-- 1. Verify no NULL rows exist
SELECT count(*) FROM "notifications" WHERE "category" IS NULL;
-- (must return 0)

-- 2. Make the column NOT NULL
ALTER TABLE "notifications"
  ALTER COLUMN "category" SET NOT NULL;
```

This is the final hardening. After PR-N3, the column is guaranteed populated on every row, and the client's `_parseCategory` null-check can be relaxed (or kept as a safety net — `NotificationCategory?` is fine forever, it's just optional paranoia).

---

## Appendix C — `deriveCategoryFromTitle` implementation

The helper used in §3.2 and §4. Lives in `web/src/lib/notification-service.ts` (or a new `web/src/lib/notification-category.ts` if the team prefers a dedicated file).

```typescript
const CATEGORY_KEYWORDS: Record<'PAYMENT'|'KYC'|'MAINTENANCE'|'ANNOUNCEMENT', RegExp[]> = {
  PAYMENT: [/\bpayment\b/i, /\bwallet\b/i, /\btop[\s-]?up\b/i, /\brent\b/i, /\bdeposit\b/i, /\brefund\b/i, /₹/],
  KYC: [/\bkyc\b/i, /\bverification\b/i, /\bverif(y|ied|ication)\b/i, /\bdocument\b/i, /\baadhaar\b/i, /\bpan\b/i],
  MAINTENANCE: [/\bservice\b/i, /\bmaintenance\b/i, /\bvehicle\b/i, /\bbattery\b/i, /\bswap\b/i, /\binspect(ion)?\b/i],
  ANNOUNCEMENT: [/\breward\b/i, /\boffer\b/i, /\bannouncement\b/i, /\bpromotion\b/i, /\bcoupon\b/i, /\bgift\b/i],
};

export function deriveCategoryFromTitle(title: string): 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM' {
  for (const [category, patterns] of Object.entries(CATEGORY_KEYWORDS) as Array<[keyof typeof CATEGORY_KEYWORDS, RegExp[]]>) {
    if (patterns.some((p) => p.test(title))) return category;
  }
  return 'SYSTEM';
}
```

The 4-bucket priority order is intentional: **PAYMENT > KYC > MAINTENANCE > ANNOUNCEMENT > SYSTEM**. A title like "Payment for KYC verification" matches PAYMENT first, which is what the rider cares about.

**Known limitation:** Hindi titles match nothing in any bucket and fall through to SYSTEM. This is documented in the test (§11.1) and is the reason every `notify*` method must pass an explicit `category` argument. The fallback exists only for safety, not for correctness.

---

## Appendix D — quick reference for the executor

```powershell
# 0. Pre-flight
cd D:\voltium
git checkout fix/phase6d-api-hardening
git checkout -b feat/notifications-category

# 1. Schema + migration
#    Edit web/prisma/schema.prisma (NotificationCategory enum + field + index)
#    Generate the migration:
cd web
npx prisma migrate dev --name add_notification_category --create-only
#    Edit the generated migration.sql to add the backfill UPDATE statements
#    Apply:
npx prisma migrate dev
npm run db:deploy

# 2. Server code
#    Edit web/src/lib/notification-service.ts (CATEGORY_MAP + createAndSend + 6 notify* methods)
#    Edit web/src/server/modules/notifications/notification.repository.ts (2 methods get category param)
#    Edit web/src/server/modules/notifications/notification.use-cases.ts (5 methods thread category)
#    Edit web/src/server/workers/jobs/notification-dispatch.job.ts (PAYMENT category on the 4-event branch)
#    Edit web/src/server/workers/jobs/announcement-broadcast.job.ts (ANNOUNCEMENT category)

# 3. Server tests
#    Create web/tests/unit/notifications/notification-category.test.ts
#    Create web/tests/unit/notifications/notify-category-coverage.test.ts
#    Create web/tests/integration/notifications/backfill.test.ts
#    Edit web/tests/api-routes.test.ts (add 1 test for response shape)
npm run test:unit
npm run test:integration
npm run test:coverage:merge

# 4. Client model
cd ..\flutter
#    Edit flutter/lib/models/notification_model.dart (NotificationCategory enum + field + parser)
dart run build_runner build --delete-conflicting-outputs

# 5. Client UI
#    Edit flutter/lib/features/notifications/presentation/screens/notifications_screen.dart
#    (4 filter sites + _getCategoryInfo)
#    Edit flutter/lib/l10n/app_en.arb + app_hi.arb (remove txtnotifNoMatchHint)

# 6. Client tests
#    Create flutter/test/models/notification_model_test.dart
#    Create flutter/test/features/notifications/notifications_screen_hindi_test.dart
flutter test
flutter analyze

# 7. E2E
#    Run on a Hindi emulator:
bash flutter/integration_test/e2e_individual/run_phased_tests.sh emulator-5554
#    Or just the 09 test:
flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/09_notifications_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true
bash scripts/flutter-coverage.sh

# 8. Commit + PR
cd ..
git add -A
git commit -m "feat(notifications): add structured category field for tab filtering (PR-N2)"
git push -u origin feat/notifications-category
gh pr create --title "feat(notifications): add structured category field for tab filtering (PR-N2)" --body "Closes the structural half of F-1+F-2. See NOTIFICATION_DATA_POPULATION_2026-08-26.md and PR_N2_NOTIFICATIONS_CATEGORY_PLAN_2026-08-26.md."
```

---

**End of plan. PR-N2 is the last of the three notifications PRs (PR-N1 i18n wiring + this structural fix). After it ships, the notifications feature is fully locale-correct and ready for the next release.**
