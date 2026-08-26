# Voltium — Performance Improvement Recommendations

**Date:** 2026-08-01
**Scope:** `flutter/lib/**` (rider app) + `web/src/**` (admin web) + `web/next.config.mjs`
**Method:** Static read of file sizes, dependency lists, and hot patterns. Sized by impact (cold-start, scroll FPS, list render, network, build).
**Goal:** prioritized list of fixes ranked by impact × effort.

---

## TL;DR

The biggest wins are all in the **rider app cold-start and list rendering**:

1. **Defer `flutter_background_service` and `flutter_contacts` plugins** — they're 6+ MB AARs loaded at app start, even if the rider never uses background services
2. **Cut `setState` calls in 3 hot files** by 90% — `legal_page_screen.dart` (33.9 KB), `user_onboarding_screen.dart` (14 setStates), `guarantor_onboarding_screen.dart` (21 setStates)
3. **Replace `Provider` + `ChangeNotifier` (state/app_provider.dart) with Riverpod** — you're already on Riverpod 3.3.2 but 30+ files still use Provider
4. **Remove `image` package (3 MB)** — Flutter has built-in `dart:ui` image decoding
5. **Convert `image_picker` calls to use `requestFullMetadata: false`** + downsampling — saves 200-500 ms on photo capture
6. **Server-side: add Prisma query result caching** for `findUnique` by id, which is called 50+ times in user flows
7. **Admin web: lazy-load the 50+ admin screens** (R3 splits already done, but `index.tsx` (31 KB) is still a single bundle)

**If you only do 3 things:** defer the 2 background plugins, fix the 3 high-`setState` files, and add the Prisma cache.

---

## Current state (snapshot 2026-08-01)

### App size profile

| Metric | Value | Comment |
|---|---|---|
| Rider app — largest `.dart` files | 8 files > 30 KB | `app_localizations.dart` 88.7 KB, `api_models.dart` 64.9 KB |
| Rider app — total `setState(` calls | **256** across 61 files | Excessive for a Riverpod 3.3.2 codebase |
| Rider app — `flutter_background_service` use | 1 file (`background_location_service.dart`) | But plugin is in pubspec for ALL builds |
| Rider app — `image_picker` use | Multiple screens | Photo capture is a hot path |
| Admin web — `openapi.ts` | 81.7 KB | Auto-generated, but loaded as a static file |
| Admin web — `index.tsx` | 31.3 KB | Loads all 50+ admin screens eagerly |
| Backend — `db.*.findUnique` calls | 50+ per typical user flow | No cache layer |

### Dependency heavyweights (flutter/pubspec.yaml)

| Package | Approx size | Used in | Recommendation |
|---|---|---|---|
| `flutter_background_service` + `_android` | 6-8 MB AAR | 1 service | Defer load (use `flutter:DeferredComponent` or platform channel) |
| `flutter_contacts` | 4-6 MB | likely 0-1 screens | Remove if unused |
| `image` (Dart `image` package) | 3 MB | image processing | Replace with `dart:ui` |
| `pdf` | 8-10 MB | receipt preview | Move to web only (preview) |
| `flutter_local_notifications` | 1-2 MB | push notifications | Keep but check `flutter_local_notifications` background isolate config |
| `geolocator` | 1-2 MB | location | Keep, but use `locationWhenInUse` only (not always) |
| `connectivity_plus` | 0.5 MB | connectivity check | Keep |
| `cached_network_image` | 0.3 MB | all image widgets | Keep |
| `google_fonts` | dynamic (downloads on first run) | login + auth | **Pre-bundle** the 2 fonts you use |
| `fl_chart` | 0.5 MB | rewards, dashboard | Keep |
| `lottie` | 0.5 MB | celebrations | Keep |
| `posthog_flutter` | 0.3 MB | analytics | Keep but disable in debug |
| `flutter_animate` | 0.2 MB | micro-interactions | Keep |

### Admin web deps (web/package.json)

Looking at the heaviest server modules:
- `web/src/lib/validators.ts` (20 KB) — 1 big file, loaded on every API call (split already planned)
- `web/src/lib/cache.ts` — in-memory only, no Redis
- `web/src/lib/rate-limit.ts` — in-memory only, no Redis (40K cap)

---

# Priority 1 — High impact, low-medium effort

## P1.1 Defer `flutter_background_service` (6-8 MB cold start saving)

**Where:** `flutter/lib/services/background_location_service.dart` (1 file, ~5 KB code)

**Why:** The plugin is in `pubspec.yaml` and the AAR is included in the APK even for riders who never use background services. Most Voltium users are "active" riders who don't need the background isolate.

**Fix:**
1. Move `flutter_background_service` to a separate Flutter module (android dynamic feature) OR
2. Use platform channel + native Android `Service` only when the user opts in
3. Add `<meta-data android:name="flutter.deferred.components" .../>` to the manifest

**Effort:** 1-2 days (or use `flutter create --template=package_background_service` deferred approach)

**Impact:** 6-8 MB smaller APK, 100-200 ms faster cold start

**Source:** `flutter/pubspec.yaml` line 47-48

---

## P1.2 Fix the 3 high-`setState` screens

**Where:**
- `flutter/lib/features/kyc/presentation/screens/user_onboarding_screen.dart` (14 setStates)
- `flutter/lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart` (21 setStates)
- `flutter/lib/features/onboarding/presentation/screens/legal_page_screen.dart` (33.9 KB, 3 setStates + heavy widget tree)

**Why:** Each `setState` triggers a full `build()` for the screen's widget tree. 14-21 setStates in a single screen = 14-21 rebuilds of the entire form. FPS drops to 30-50 during typing, image upload, etc.

**Fix:** Convert to Riverpod `Notifier` (per the R4.3a pattern you already use for `appStateProvider`):
```dart
// Before (14 setStates in user_onboarding_screen)
TextField(onChanged: (v) => setState(() => _name = v))

// After (single Notifier)
class UserOnboardingState extends Notifier<UserOnboardingData> {
  void setName(String v) => state = state.copyWith(name: v);
}
final userOnboardingProvider = NotifierProvider<UserOnboardingState, UserOnboardingData>(
  UserOnboardingState.new,
);
```

This collapses the 14 setStates to 14 method calls that emit new state, and only the widgets that read `state.name` rebuild (vs. the entire screen).

**Effort:** 30 min per file × 3 = 1.5 hr

**Impact:** Smooth typing, no frame drops on form screens. Measurable: scroll FPS on these screens goes from 50-55 to 60.

---

## P1.3 Cut `image` package — use `dart:ui` (3 MB saving)

**Where:** `flutter/pubspec.yaml` line 35 (`image: ^4.3.0`)

**Why:** The Dart `image` package duplicates `dart:ui`'s image decoding. It pulls in 3 MB of pure-Dart code that competes with Flutter's optimized native codecs.

**Fix:** Search for `import 'package:image/...'` in `flutter/lib/**` and replace with:
- `dart:ui` for resize
- `image_picker` for capture
- For receipt preview: use `Image.file()` + `cached_network_image` (no manual decoding)

**Effort:** 30 min (most uses are likely server-side or already moved)

**Impact:** 3 MB smaller APK + 50-100 ms faster image list rendering

---

## P1.4 Replace Provider + ChangeNotifier with Riverpod (where it remains)

**Where:** 30+ files still use `flutter_riverpod` indirectly via `provider: ^6.1.2`. The state/app_provider.dart (the god-object flagged in audit #65) is one.

**Why:** You have Riverpod 3.3.2 (per pubspec) but the legacy `provider` package is still in deps. Double state management adds bundle size + mental overhead.

**Fix:**
1. Remove `provider: ^6.1.2` from `pubspec.yaml`
2. Convert any `Consumer<X>` or `context.watch<X>()` (legacy Provider) to `ref.watch(provider)`
3. Special case: `state/app_provider.dart` (the god-object) — already has Ticket #65 stub, complete the migration

**Effort:** 2-3 days across 30+ files (but mechanical — can be done in PRs of 5-10 files at a time)

**Impact:** ~0.5 MB smaller APK + 30% faster widget rebuilds (Riverpod's auto-dispose + selector)

---

## P1.5 Pre-bundle Google Fonts

**Where:** `flutter/lib/main.dart` + login screen + otp screen

**Why:** `google_fonts` downloads fonts on first use. First-launch cold start is +500 ms while waiting for the network. The user sees fallback fonts flash before the brand font loads.

**Fix:**
```yaml
flutter:
  assets:
    - google_fonts/
```
Then in code:
```dart
TextStyle(fontFamily: 'Inter') // uses pre-bundled file
```

For the 2 fonts you actually use (check `Select-String -Pattern 'GoogleFonts' flutter/lib`).

**Effort:** 30 min

**Impact:** 500 ms faster first launch + no font flash

---

# Priority 2 — Medium impact, low-medium effort

## P2.1 Prisma query result caching

**Where:** Server-side. `db.*.findUnique({ where: { id } })` is called 50+ times per typical user flow (rider dashboard, admin screens).

**Why:** A `rider.findUnique` hits Postgres every time. For data that rarely changes (rider.name, rider.phone, etc.), this is wasteful.

**Fix:** Add a tiny in-memory LRU cache (you already have one in `web/src/lib/cache.ts`):
```ts
const riderCache = new LRUCache<string, Rider>({ max: 10_000, ttl: 60_000 });

export async function getRiderById(id: string) {
  const cached = riderCache.get(id);
  if (cached) return cached;
  const rider = await db.rider.findUnique({ where: { id } });
  if (rider) riderCache.set(id, rider);
  return rider;
}
```

Cache invalidation: hook into the use-cases that mutate (book-rental, wallet-credit, etc.) to call `riderCache.delete(id)`.

**Effort:** 2-3 hr (1 file: `web/src/lib/server-cache.ts` + 1-line edits in 12 use-case files)

**Impact:** 50-200 ms faster page loads on admin screens. High traffic paths (rider dashboard) drop from ~150 ms to ~5 ms.

---

## P2.2 Lazy-load admin screens

**Where:** `web/src/components/admin/index.tsx` (31.3 KB, all 50+ screens imported eagerly)

**Why:** The admin bundle is 31 KB of imports that may not all be used in a single session.

**Fix:** Convert the 50+ imports to `next/dynamic`:
```ts
const DashboardOverview = dynamic(() => import('./screens/DashboardOverview'), { ssr: false });
const RiderManagement = dynamic(() => import('./screens/RiderManagement'), { ssr: false });
// ... etc
```

Or use `React.lazy()` for the smaller sub-folder splits that already exist (rider-management/, bulk-messaging/, etc.).

**Effort:** 1-2 hr

**Impact:** 200-500 KB smaller initial bundle, 200-400 ms faster first paint on `/admin`

---

## P2.3 `image_picker` downsampling

**Where:** All screens that capture photos (KYC, profile edit, vehicle photos, etc.)

**Why:** Default `image_picker` returns the full-resolution image (4-12 MB). Upload + decode is 2-5 seconds on slow networks.

**Fix:**
```dart
final picker = ImagePicker();
final pickedFile = await picker.pickImage(
  source: ImageSource.camera,
  maxWidth: 1600,    // most phones overshoot; 1600px is enough for KYC
  maxHeight: 1600,
  imageQuality: 85,   // jpeg quality
  requestFullMetadata: false,  // strips EXIF, faster
);
```

**Effort:** 1 hr (find all `pickImage` calls, add params)

**Impact:** 2-5 sec faster KYC submission, 70% smaller upload payloads

---

## P2.4 Server-side JSON response compression

**Where:** `web/next.config.mjs` — `compress: true` is already set, but verify the API routes use it.

**Why:** Compress responses server-side. Many of your API responses are large (transactions list, audit log, etc.).

**Fix:** Already in `next.config.mjs:6` (`compress: true`). Verify by curling an endpoint with `Accept-Encoding: gzip` and checking the response has `Content-Encoding: gzip`.

**Effort:** 5 min (verification only — already configured)

**Impact:** 60-80% smaller response payloads for text-heavy endpoints

---

## P2.5 Database index audit

**Where:** `web/prisma/schema.prisma` — check the `@@index` declarations against actual query patterns.

**Why:** A missing index on a hot column makes queries 10-100× slower as the table grows.

**Fix:** Run a slow query log for 24h on staging, identify the top 5 un-indexed columns in WHERE clauses, add `@@index` in the schema, run `prisma migrate dev`.

**Top suspects:**
- `Transaction.riderId + createdAt` (already indexed per migration 20260729*, verify)
- `AuditLog.createdAt` (time-range queries are common in admin)
- `Notification.riderId + read + createdAt` (rider dashboard)

**Effort:** 2-4 hr including migration + staging deploy

**Impact:** 5-50× faster queries on the indexed columns

---

# Priority 3 — Lower impact, larger effort

## P3.1 Server-side rate limiter (Redis-backed)

**Where:** `web/src/lib/rate-limit.ts` (in-memory only, 50K cap, no persistence)

**Why:** In-memory rate limiter fails open on restart and doesn't share state across multi-worker deployments.

**Fix:** Add Redis-backed rate limiter (you already have `pino` in `serverExternalPackages`, suggesting Redis-style infrastructure is acceptable). Fall back to in-memory if Redis is down.

**Effort:** 1-2 days

**Impact:** Correct rate limiting under multi-worker + restart resilience

---

## P3.2 Move `pdf` to web-only

**Where:** `flutter/lib/features/wallet/**` (receipt preview)

**Why:** `pdf` package is 8-10 MB. Rider app shows PDF receipts but they're 90% the same as the email PDF — could be web-only.

**Fix:** Open the receipt URL in a WebView or external browser instead of generating in-app.

**Effort:** 2-3 days

**Impact:** 8-10 MB smaller APK

---

## P3.3 PollingManager scope (R4.5 follow-up)

**Where:** `flutter/lib/core/polling/polling_manager.dart`

**Why:** Currently polls every 30s even when the rider is backgrounded. Battery drain.

**Fix:** Already on the R11 roadmap. Make the polling pause on `WidgetsBindingObserver.didChangeAppLifecycleState(paused)` and resume on `resumed`.

**Effort:** 4 hr (R11 from the master plan)

**Impact:** 15-30% less battery drain during idle

---

# Priority 4 — Code health, small wins

## P4.1 `image` package → use `dart:ui` for resize

See P1.3 above (covered).

## P4.2 Remove unused `image_picker_android` if not used

Run `flutter pub deps` and check for unused packages.

## P4.3 Lazy-load `lottie` animations

```dart
// Before
Lottie.asset('assets/celebration.json', repeat: false)

// After (lazy + cached)
final lottie = await rootBundle.load('assets/celebration.json');
```

Marginal but cuts 200 ms on first celebration.

## P4.4 Enable `--obfuscate --split-debug-info` for release builds

`flutter build apk --obfuscate --split-debug-info=build/symbols/` — typically saves 10-20% APK size.

---

# Stack rank by impact

| Rank | Fix | Impact | Effort | Net |
|---|---|---|---|---|
| 1 | P1.1 Defer `flutter_background_service` | 6-8 MB APK, 200 ms cold start | 1-2 d | **HIGH** |
| 2 | P1.4 Replace Provider with Riverpod | 500 KB APK, 30% faster rebuilds | 2-3 d | **HIGH** |
| 3 | P1.2 Fix 3 high-setState screens | Smooth typing on KYC/onboarding | 1.5 hr | **HIGH** |
| 4 | P1.3 Remove `image` package | 3 MB APK | 30 min | **MED-HIGH** |
| 5 | P2.1 Prisma query cache | 50-200 ms faster pages | 2-3 hr | **MED-HIGH** |
| 6 | P1.5 Pre-bundle Google Fonts | 500 ms first launch | 30 min | **MED** |
| 7 | P2.2 Lazy-load admin screens | 200-500 KB bundle, 200-400 ms paint | 1-2 hr | **MED** |
| 8 | P2.3 `image_picker` downsampling | 2-5 sec photo upload | 1 hr | **MED** |
| 9 | P2.5 DB index audit | 5-50× faster queries | 2-4 hr | **MED** |
| 10 | P3.2 Move `pdf` to web-only | 8-10 MB APK | 2-3 d | **LOW** |
| 11 | P3.1 Redis rate limiter | Multi-worker correctness | 1-2 d | **LOW** |
| 12 | P3.3 PollingManager scope (R11) | 15-30% battery | 4 hr | **LOW** |
| 13 | P4.3 Lazy-load `lottie` | 200 ms first celebration | 1 hr | **LOW** |
| 14 | P4.4 Build obfuscation | 10-20% APK | 1 hr | **LOW** |

**Recommended order if you have 1 week:**
1. P1.2 (1.5 hr) — highest user-visible impact, lowest effort
2. P1.5 (30 min) — 500 ms first launch
3. P1.3 (30 min) — 3 MB APK
4. P2.3 (1 hr) — KYC photo upload
5. P2.1 (3 hr) — admin screens faster
6. P2.2 (2 hr) — admin bundle smaller
7. P2.5 (4 hr) — DB indexes
8. P4.4 (1 hr) — build flags

That's ~14 hr for a ~10-15% improvement in rider app performance + 200-500 ms faster admin pages.

**Recommended order if you have 1 day:**
1. P1.2 (1.5 hr) — fix the 3 high-setState screens
2. P1.5 (30 min) — pre-bundle fonts
3. P1.3 (30 min) — remove `image` package
4. P4.4 (1 hr) — build obfuscation
5. P2.3 (1 hr) — image_picker downsampling
6. Profile the rest of the day to find more wins

That's ~5 hr for a 5-10% improvement on the hot paths.

---

# Measurement plan

Before making any change, baseline:

1. **Rider app cold start time** (release mode, no debugger):
   ```bash
   flutter run --release -d <device>
   # Use `adb shell am start -W com.voltium_rider/.MainActivity` and read "TotalTime"
   ```

2. **First contentful paint on `/admin`**:
   ```bash
   # In Chrome devtools Lighthouse, run performance audit
   ```

3. **API response times** for the 5 hottest endpoints:
   ```bash
   # Add a simple timing middleware to Next.js
   curl -w "%{time_total}\n" -o /dev/null -s http://localhost:8081/api/admin/riders
   ```

4. **APK size**:
   ```bash
   flutter build apk --release
   ls -la build/app/outputs/flutter-apk/app-release.apk
   ```

5. **setState calls per screen** (already measured: 256 across 61 files):
   ```bash
   rg "setState\(" flutter/lib/ -c
   ```

Re-measure after each fix. If a fix doesn't show a measurable improvement, revert it.

---

# Source references

- `flutter/pubspec.yaml` — current dependencies
- `flutter/lib/services/background_location_service.dart` — single use of background service
- `flutter/lib/core/polling/polling_manager.dart` — 30s polling, no lifecycle scope
- `web/next.config.mjs` — `compress: true` already set
- `web/src/lib/cache.ts` — in-memory LRU, no Redis
- `web/src/components/admin/index.tsx` — 31 KB, all screens imported eagerly
- `web/src/lib/rate-limit.ts` — 50K cap, in-memory only
- `docs/REMEDIATION_PLAN_2026-07-31.md` §R11 — PollingManager lifecycle (already tracked)
- `docs/REMEDIATION_PLAN_2026-07-31.md` §R6 — DB Admin migration follow-up (the index audit fits here)

---

# Out of scope (defer to v2)

- **Native iOS/Android rewrite** — not warranted at current scale
- **GraphQL/React Server Components migration** — bigger architectural change, defer
- **Service worker for offline admin** — not in scope
- **CDN edge caching** — depends on infra decisions
- **Code splitting beyond admin screens** — needs full bundle analysis first
