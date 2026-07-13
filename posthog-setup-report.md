<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Voltium EV Rider Flutter app. PostHog was already declared as a dependency (`posthog_flutter: ^5.28.0`) and `PosthogObserver()` was already wired into `MaterialApp`, but the SDK was never actually initialized — `PostHogService.initialize()` was a no-op. This run activates the full integration.

**What changed:**

- **`PostHogService`** — Replaced the stub `initialize()` with a real `Posthog().setup(config)` call using `String.fromEnvironment` compile-time constants for the project token and host. Added a `reset()` helper for logout.
- **`main.dart`** — No change needed; `PostHogService.initialize()` and `PosthogObserver()` were already called.
- **`AndroidManifest.xml`** — Added `com.posthog.posthog.AUTO_INIT = false` so the Android SDK defers to the Dart manual init.
- **`Info.plist`** — Added `com.posthog.posthog.AUTO_INIT = false` for iOS.
- **`build.gradle.kts`** — Changed `minSdk = flutter.minSdkVersion` to `minSdk = 23` (PostHog Android SDK minimum).
- **`flutter/.env`** — Created with `POSTHOG_API_KEY` and `POSTHOG_HOST` values (gitignore coverage applied automatically).
- **`AppProvider.logout()`** — Added `PostHogService.reset()` call to clear the PostHog identity on logout.
- **14 screens** — Added targeted `PostHogService.capture()` or `PostHogService.identify()` calls for the 14 business events below.

| Event | Description | File |
|-------|-------------|------|
| `otp_requested` | User submitted phone number and OTP was sent | `features/auth/presentation/screens/login_screen.dart` |
| `otp_resent` | User requested a new OTP after expiry | `features/auth/presentation/screens/otp_verification_screen.dart` |
| `otp_verified` | User verified OTP; `identify()` called with rider ID | `features/auth/presentation/screens/otp_verification_screen.dart` |
| `onboarding_completed` | User finished all onboarding slides | `features/onboarding/presentation/screens/onboarding_screen.dart` |
| `intent_of_use_submitted` | User selected delivery or personal intent | `features/kyc/presentation/screens/intent_of_use_screen.dart` |
| `kyc_submitted` | User submitted full KYC form with documents | `features/kyc/presentation/screens/user_onboarding_screen.dart` |
| `guarantor_form_submitted` | User submitted the guarantor onboarding form | `features/guarantor/presentation/screens/guarantor_onboarding_screen.dart` |
| `plan_selected` | User subscribed to a rental plan | `features/rentals/presentation/screens/choose_plan_screen.dart` |
| `wallet_top_up_initiated` | User confirmed amount and proceeded to proof upload | `features/wallet/presentation/screens/top_up_flow.dart` |
| `wallet_top_up_submitted` | User uploaded proof and submitted top-up request | `features/wallet/presentation/screens/top_up_flow.dart` |
| `pickup_completed` | User successfully completed vehicle pickup | `features/pickup/presentation/screens/pickup_success_screen.dart` |
| `rental_ended` | User submitted end-of-rental vehicle return | `features/rentals/presentation/screens/end_rental_screen.dart` |
| `emergency_sos_triggered` | User long-pressed the SOS button | `features/device_compliance/presentation/screens/emergency_sos_screen.dart` |
| `referral_shared` | User copied their referral code | `features/referrals/presentation/screens/referral_screen.dart` |

## Next steps

We've built a dashboard and 5 insights based on the events instrumented above:

- **Dashboard:** [Analytics basics (wizard)](https://us.posthog.com/project/509160/dashboard/1836900)
- **Auth funnel: OTP → Verified** — [https://us.posthog.com/project/509160/insights/mAOgM1BE](https://us.posthog.com/project/509160/insights/mAOgM1BE)
- **Rider activation funnel** (otp_verified → kyc → plan → pickup) — [https://us.posthog.com/project/509160/insights/vU3MVg2h](https://us.posthog.com/project/509160/insights/vU3MVg2h)
- **Daily OTP verifications** — [https://us.posthog.com/project/509160/insights/2vTp43n4](https://us.posthog.com/project/509160/insights/2vTp43n4)
- **Wallet top-ups over time** (initiated vs submitted) — [https://us.posthog.com/project/509160/insights/2EOCahyR](https://us.posthog.com/project/509160/insights/2EOCahyR)
- **KYC drop-off funnel** (intent → KYC → guarantor) — [https://us.posthog.com/project/509160/insights/XKCyzRfz](https://us.posthog.com/project/509160/insights/XKCyzRfz)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `POSTHOG_API_KEY` and `POSTHOG_HOST` to `flutter/.env.example` and any CI/CD environment variable configuration so collaborators know what values to set.
- [ ] Pass the env vars at build time: run the app with `flutter run --dart-define=POSTHOG_API_KEY=<token> --dart-define=POSTHOG_HOST=https://us.i.posthog.com` (or `--dart-define-from-file=.env`). Without these flags the token is empty and PostHog will silently skip initialization.
- [ ] Confirm the returning-visitor path also calls `identify` — currently `identify` is only called on a fresh OTP verification. A rider who reopens the app on an existing session will be anonymous until they verify again. Consider calling `PostHogService.identify()` from the app startup path where the cached rider is loaded (e.g. in `AppProvider` after restoring session from cache).

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-flutter/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
