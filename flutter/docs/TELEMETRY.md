# Telemetry Architecture (2026-08-21)

> PR-11 (2026-08-21): one page, one rule. **Flutter code talks to
> `MonitoringService`. Nothing else.**

## TL;DR

- `lib/services/monitoring_service.dart` is the **canonical telemetry
  interface** for the Flutter app.
- It owns local debug logging, PII masking, and the call into the
  PostHog SDK wrapper.
- Flutter code MUST NOT import `package:posthog_flutter/...` or call
  `PostHogService.*` directly. Use `MonitoringService.logEvent` /
  `logScreen` / `identifyUser` / `resetUser` / `logInfo` / `logError`.
- `lib/services/analytics_service.dart` is a thin typed-enum wrapper
  around `MonitoringService`. It exists so screens can use
  `AnalyticsEvent.loginSuccess` instead of string literals.
- `lib/core/observability/posthog_service.dart` is the **SDK adapter**.
  It is the only place that imports `posthog_flutter`. Treat it as a
  private implementation detail of `MonitoringService`.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Flutter feature code (screens, providers, lifecycle hooks)        │
│                                                                  │
│   AnalyticsService.track(AnalyticsEvent.foo, params)             │
│   MonitoringService.logEvent('foo', parameters: params)          │
│   MonitoringService.logScreen('foo_screen')                      │
│   MonitoringService.identifyUser(riderId)                        │
│   MonitoringService.resetUser()                                  │
│   MonitoringService.logError(e, stack, reason: 'foo')            │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ (PR-11: AnalyticsService routes here;
                                 │  screens/providers can call either)
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  MonitoringService  (lib/services/monitoring_service.dart)        │
│                                                                  │
│  • owns appDebug(...)  (local log, PII-masked)                   │
│  • owns PII masking for log values (phone, email regexes)         │
│  • owns routing events/screens/identity to PostHogService         │
│  • owns the boot order (calls PostHogService.initialize)          │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  PostHogService  (lib/core/observability/posthog_service.dart)   │
│                                                                  │
│  • the ONLY file that imports `package:posthog_flutter/...`      │
│  • PII-scrubs property KEYS (phone, email, otp, aadhaar, pan,    │
│    password — anything containing these substrings is replaced    │
│    with `[SCRUBBED]`)                                             │
│  • fire-and-forget: capture / screen / identify / reset          │
│  • swallows errors with a debug log on failure (PR audit P3-1)   │
└──────────────────────────────────────────────────────────────────┘
```

## What Flutter code should call

| Need | Call | Notes |
|------|------|-------|
| Typed event (login, button tap, etc.) | `AnalyticsService().track(AnalyticsEvent.loginSuccess, params)` | `AnalyticsService` itself routes to `MonitoringService.logEvent` |
| Ad-hoc / untyped event | `MonitoringService.logEvent('foo', parameters: ...)` | Prefer typed `AnalyticsEvent` enum values when one exists |
| Screen view | `AnalyticsService().trackScreen(name, params)` or `MonitoringService.logScreen(name, parameters: ...)` | Both fire the typed `screenViewed` event AND the PostHog screen() call |
| User identity (after login) | `AnalyticsService().trackLogin(riderId, true)` or `MonitoringService.identifyUser(riderId)` | riderId is hashed before leaving Flutter (PostHog stores the hash, not the raw id) |
| Set user properties | `AnalyticsService().setUserProperties(riderId, props)` or `MonitoringService.identifyUser(riderId, properties: props)` | Same hash-on-the-way-out rule |
| Logout / clear identity | `AnalyticsService().clearUser()` or `MonitoringService.resetUser()` | |
| Local debug log | `MonitoringService.logInfo(message)` or `MonitoringService.logError(e, stack, reason: ...)` | PII-masked, local-only (PostHog catches its own errors at the SDK boundary) |
| Performance trace | `PerformanceService.startTrace(name)` / `stopTrace(name)` | `PerformanceService` already routes through `MonitoringService.logInfo` |

## What Flutter code MUST NOT do

- **Direct PostHog calls** — every `import 'package:posthog_flutter/...'`
  outside `posthog_service.dart` is a code smell. There are 50+ legacy
  call sites in feature screens (`PostHogService.capture(...)`) that
  are tolerated for now and will be migrated in a follow-up.
- **Direct `PostHogService.*` calls** from `AnalyticsService` — that's
  PR-11's whole point. `AnalyticsService` is now a thin wrapper.
- **Manual PII scrubbing in callers** — let `MonitoringService` and
  `PostHogService` do it. Adding per-call scrubbers in screens
  duplicates the policy and drifts over time.

## Open follow-up (deferred past PR-11)

- Migrate the 50+ legacy `PostHogService.capture(...)` call sites in
  feature screens to `MonitoringService.logEvent(...)`. Mechanical
  edit; one PR; no behavior change.
- The Firebase Performance SDK is **not currently used** in Flutter
  code — `PerformanceService` is a local-only stopwatch that reports
  traces through `MonitoringService.logInfo`. If the team adopts
  Firebase Performance later, the SDK wrapper lives in
  `lib/services/performance_service.dart` and routes through
  `MonitoringService` (same pattern as PostHog).
