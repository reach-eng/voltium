# Hindi translator notes

The keys added by the 7-PR audit batch (commits `d10e81ba` through
`5a67868f`) currently carry real Hindi placeholders, not English
fallbacks. The placeholders were written by hand with the goal of
being usable in the rider app while a human translator refines
them; they are not authoritative.

This document lists the 18 keys a Hindi translator should review
before the next release that targets a Hindi-locale build.

## Review workflow

For each key, the translator should:
1. Read the English `value` (in `lib/l10n/app_en.arb`).
2. Read the existing Hindi `value` (in `lib/l10n/app_hi.arb`).
3. Pick the better of the two, or write a fresh translation.
4. Update `lib/l10n/app_hi.arb` in place.
5. Run `flutter gen-l10n` and `flutter analyze` to confirm the
   build still passes.
6. Optional: update this doc to mark the key as reviewed.

## Attempted MyMemory pass — what it found

I ran an automated MyMemory (`en-GB` → `hi-IN`) pass over these
18 keys. The output was mixed:

- **Better than the original** in a few cases (e.g.
  `toastPickupSubmitFailed` came back as
  "आपका पिकअप सबमिट नहीं किया जा सका। कृपया फिर से कोशिश करें",
  which uses a more natural verb than the placeholder's
  "पुनः प्रयास करें").
- **No real change** in most cases — MyMemory's output was
  semantically equivalent to the placeholder.
- **Worse than the original** in a few cases — most importantly:
  - `pickupHub_enterValid10Digit` came back as
    "10 अंकों वाला मान्य पैन नंबर दर्ज करें", which inserts
    "PAN नंबर" (PAN number) where the source is a 10-digit
    **phone number**. The placeholder "10-अंकीय नंबर" is
    correct; the MyMemory output is a hallucination.
  - `pickupHub_fetchVehiclesFailed` came back as
    "गाड़ियों को लाने में विफल:। {error}", which has a
    double-punctuation (Hindi full stop followed by a colon).
    The placeholder is correct.
  - `pickupHub_otpVerifyFailed` came back with the placeholder's
    "OTP" spelled out as "ओटीपी (OTP)", which is the wrong
    transliteration direction (the app's existing convention is
    to keep the Latin "OTP" inside Hindi copy).

I did **not** apply the MyMemory output. The file is at the
post-PR #3 state (rough placeholders, but correct enough for
rider use today).

## Keys to review

| Key | English value (from `app_en.arb`) | Current Hindi (placeholder) | Notes |
| --- | --- | --- | --- |
| `toastKycCacheRestoreFailed` | "Could not restore your previous draft. Please start fresh." | "पिछला ड्राफ़्ट पुनर्स्थापित नहीं हो सका। कृपया फिर से शुरू करें।" | "ड्राफ़्ट" is informal — could be more formal. |
| `toastPickupSubmitFailed` | "Could not submit your pickup. Please try again." | "पिकअप सबमिट नहीं हो सका। कृपया पुनः प्रयास करें।" | "पुनः प्रयास करें" is the formal "try again" — fine. |
| `toastTlChangeFailed` | "Could not submit your Team Leader change request. Please try again." | "टीम लीडर बदलने का अनुरोध सबमिट नहीं हो सका। कृपया पुनः प्रयास करें।" | Tone check — this is a support-surface message, may benefit from a more empathetic verb. |
| `toastHubLoadFailed` | "Could not load the pickup hub list. Please check your connection and try again." | "पिकअप हब सूची लोड नहीं हो सकी। कृपया अपना कनेक्शन जाँचें और पुनः प्रयास करें।" | "पिकअप हब" / "सूची" — fine. |
| `rateUs_noHandler` | "Couldn't open the Play Store. Please try again from a device with the Play Store app." | "Play Store नहीं खोला जा सका। कृपया Play Store ऐप वाले डिवाइस से फिर से प्रयास करें।" | "Play Store" kept in Latin — should probably be "प्ले स्टोर" in pure Hindi. |
| `rateUs_launchFailed` | "Couldn't open the Play Store. Please try again." | "Play Store नहीं खोला जा सका। कृपया पुनः प्रयास करें।" | Same as above. |
| `pickupHub_enterValid10Digit` | "Enter a valid 10-digit number" | "कृपया मान्य 10-अंकीय नंबर दर्ज करें" | **Do not** use MyMemory's "PAN नंबर" — it's a 10-digit phone, not a PAN. |
| `pickupHub_emergencyContactSameAsPhone` | "Emergency contact cannot be the same as your phone number" | "आपातकालीन संपर्क आपके फ़ोन नंबर के समान नहीं हो सकता" | Fine. |
| `pickupHub_emergencyContactSameAsGuarantor` | "Emergency contact cannot be the same as guarantor phone number" | "आपातकालीन संपर्क गारंटर के फ़ोन नंबर के समान नहीं हो सकता" | "फ़ोन" with nukta — consistent with the other entry. |
| `pickupHub_otpSent` | "OTP sent to emergency contact" | "आपातकालीन संपर्क पर OTP भेजा गया" | "OTP" in Latin — consistent with `pickupHub_invalidOtp` below. |
| `pickupHub_failedToSendOtp` | "Failed to send OTP. Please try again. {error}" | "OTP भेजने में विफल। कृपया पुनः प्रयास करें। {error}" | The `{error}` placeholder is interpolated at runtime; keep it adjacent to the message. |
| `pickupHub_enter6DigitOtp` | "Enter 6-digit OTP" | "6-अंकीय OTP दर्ज करें" | Already concise. |
| `pickupHub_invalidOtp` | "Invalid OTP. Please try again." | "अमान्य OTP। कृपया पुनः प्रयास करें।" | Fine. |
| `pickupHub_verified` | "Emergency contact verified successfully ✓" | "आपातकालीन संपर्क सफलतापूर्वक सत्यापित ✓" | The ✓ glyph is intentional copy, not a localization artefact — keep it. |
| `pickupHub_otpVerifyFailed` | "OTP verification failed. Please try again." | "OTP सत्यापन विफल। कृपया पुनः प्रयास करें।" | **Do not** transliterate "OTP" to "ओटीपी" — the codebase's other entries use Latin "OTP" inside Hindi. |
| `pickupHub_photoUploaded` | "Photo uploaded successfully" | "फ़ोटो सफलतापूर्वक अपलोड हो गई" | "अपलोड" is a common loanword — fine. |
| `pickupHub_photoUploadFailed` | "Upload failed. Please check your connection and try again." | "अपलोड विफल। कृपया अपना कनेक्शन जाँचें और पुनः प्रयास करें।" | Fine. |
| `pickupHub_fetchVehiclesFailed` | "Failed to fetch vehicles: {error}" | "वाहन लोड करने में विफल: {error}" | **Do not** use MyMemory's "गाड़ियों को लाने में विफल" — that's "bring" (not "load/fetch") and uses a different noun. |

## Verifying a translator pass

After updating `lib/l10n/app_hi.arb`:

```bash
cd flutter
flutter gen-l10n
flutter analyze lib/l10n
```

The `description` field on each `@key: { description: ... }` block
should keep its existing English text — that field is shown to
the translator in IDE tooling, not to the rider. The English
copy in `lib/l10n/app_en.arb` is the source of truth and should
not change unless the product copy changes too.

The Hindi pass is owned by the human translator. The next agent
should not re-run MyMemory or another MT system over these keys
without first checking this document — the previous MT pass
produced two known-bad outputs that this file flags above.
