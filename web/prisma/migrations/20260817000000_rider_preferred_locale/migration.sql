-- LANGUAGE-AUDIT (2026-08-16) #6: persist the rider's chosen language
-- on the server so the preference survives reinstall / new device.
-- Stores a BCP-47 language tag (e.g. `en`, `hi`) without the country
-- variant — Flutter's `Locale(languageCode)` round-trips cleanly.
-- NULL means "no explicit choice; fall back to system locale on the
-- client". The mobile app's `LocaleNotifier._loadSavedLocale()`
-- already handles the NULL case correctly.
--
-- The companion change in `web/src/lib/validators.ts` adds
-- `preferredLocale` to `updateProfileSchema`. The use-case in
-- `rider.use-cases.ts` writes through `SAFE_RIDER_FIELDS` (added in
-- the same PR). The mobile app's `LocaleNotifier.setLocale()` calls
-- `PUT /api/rider/profile` so the choice syncs on every change.

ALTER TABLE "riders"
  ADD COLUMN "preferredLocale" VARCHAR(8);
