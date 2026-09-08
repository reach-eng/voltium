# Audit: Dark Mode (+ fix plan)

**Date:** 2026-09-08
**Scope:** Flutter theming (`lib/theme/`, provider, wiring, selection UI,
per-feature brightness patterns, tests) → web theming (`next-themes`,
`globals.css`, toggle, per-screen `dark:`, charts, maps) → test gates.
**Method:** source-only (no docs read). Two audit-draft items were
re-checked against the live tree and corrected below (toast file is dead
code; sparkline/date-picker files no longer exist).

**Foundation is solid on both sides:** Flutter `ThemeColors` extension carries
full light/dark/amoled token sets with `lerp`/`copyWith`, `AppColors.of` has a
brightness fallback (`app_theme.dart:256-261`), `MaterialApp` wires
`theme`/`darkTheme`/`themeMode` + status-bar sync (`main.dart:228-267`),
provider persists + emits analytics, and token-diff + smoke tests exist. Web
uses `next-themes` (class strategy) + Tailwind v4 CSS-first with real `.dark`
variable overrides, most charts consume CSS vars, and a lint ratchet guards
regressions. Findings below are the holes around that core.

---

## Findings

### P1

**P1-1 · The contrast bug lives in a dead file — delete it.**
`widgets/toast_notifications.dart:197-234` (static light icon/border on dark
surfaces) sits inside `ToastService`, which is `@Deprecated` (line 6) with
**zero usages** outside its own file (grep-confirmed). The live path,
`utils/toast.dart:58-63`, uses solid `AppColors.success/error/primary/
warningDark` backgrounds + white icon/text in both modes — high-contrast and
correct in dark, no change needed. A second dead widget in the same file,
`AnimatedToast`/`_ToastItem` (`:244-336`, hardcoded white container), is
likewise unreferenced. The only test,
`test/widgets/toast_notifications_golden_test.dart`, pumps a placeholder
`SizedBox` and asserts nothing about toasts.
Fix: delete `toast_notifications.dart` + the placeholder golden test (+ its
png goldens if present). The contrast bug disappears with the file. 15min.

**P1-2 · Earnings chart card is hardcoded white** —
`features/wallet/widgets/earnings_chart.dart:22-24`
(`color: Colors.white`). Painter text adapts (`onSurface`/`onSurfaceVariant`,
`:55-56`), the container doesn't — white slab in dark mode.
Fix: `color: AppColors.of(context).card`. 5min. Test: extend the existing
earnings/widget golden with a dark pump (pattern below in Phase 1).

**P1-3 · KYC/state badges are light-only, and the ratchet can't see them** —
`web/src/lib/admin-ui.ts:20-34`. 12 of 13 entries are
`bg-*-100 text-*-800 border-*-300` with no `dark:` (only ONBOARDING/fallback
have it). Worse, the ratchet (`scripts/lint-dark-mode-tokens.js:77-80,120-127`)
only scans lines containing `className=`/backticks for `text-*-600` —
map-built strings like these are never scanned, so this class of bug is
permanently invisible to CI.
Fix: convert badges to the codebase pattern (`text-*-600 dark:text-*-400` +
translucent bg) and close the ratchet gap (Phase 2 offers two options).
45min.

**P1-4 · Light-locked `vf-*` tokens used in dark paths** —
`globals.css:46-55` defines `vf-surface*` once (no `.dark` override), and
they're consumed in dark mode: `ui/button.tsx:18`
(`bg-vf-surface-container` → #f5f7fa button on a dark page),
`rewards/AwardPointsForm.tsx:64-97` (`bg-vf-surface` inputs).
Fix: add `.dark` overrides for the used `vf-*` tokens (or swap call sites to
`bg-card`/`bg-muted`). 30min.

### P2

- **AMOLED theme is dead code.** `amoledTheme` has real tokens
  (`app_theme.dart:878-912`), `main.dart:266` reads `isAmoled`, but nothing
  calls `setAmoled`/`toggleAmoled` (defined only, `theme_provider.dart:96-103`;
  grep-confirmed zero call sites), it's not persisted, and the settings
  dialog offers only System/Light/Dark. Decision: wire a fourth radio +
  persist via `CacheService`, or delete ~60 tokens + provider surface.
  30min either way.
- **Web toggle can't return to system.** `theme-toggle.tsx:16` flips
  light↔dark explicitly; once touched, "follow system" is unreachable via UI
  (Flutter has the radio). next-themes supports `setTheme('system')` — add a
  third state (cycle system→light→dark, or a dropdown). 20min.
- **Canvas chart ignores theme.** `analytics-charts.tsx:65,110,128` hardcodes
  grid `#e2e8f0`, dot stroke `#fff`, labels `#64748b`. Read CSS vars via
  `getComputedStyle(document.documentElement)` with hardcoded fallbacks and
  re-run the draw effect on `resolvedTheme` (next-themes), mirroring how the
  recharts screens consume `var(--border)`/`var(--muted-foreground)`. 30min.
- **Small light-only leftovers (verified live):**
  `SecurityControls.tsx:139,148` (`hover:bg-slate-100`/`hover:text-slate-900`,
  no dark); `SosAlert.tsx:43` (`text-rose-500` — ~4:1 on dark bg, bump to
  `dark:text-rose-400`). Map status dots (`bg-emerald/amber/slate-500`,
  `fleetMapHelpers.ts:40-50`) and `auto-refresh.tsx` dots are solid swatches —
  fine as-is, no change. (Dropped from the draft: `date-picker.tsx` and
  `dashboard-cards.tsx` no longer exist; `RevenueTrendChart.tsx:35` already
  uses unique gradient IDs — the pattern to copy.)
- **Dark elevation flattening.** In dark tokens `surfaceBright ==
  surfaceSubtle == card == #1E293B` (`app_theme.dart:869-870`) — three
  elevation concepts collapse to one; only borders differentiate. Consider
  stepping them (`#1E293B/#232F45/#273449`) post-design-review. Decision only.
- **Dark e2e asserts nothing.** `login.spec.ts:111-117` screenshots dark mode
  but asserts no pixels — a fully white page would pass. Add one assertion
  (e.g. computed `body` background is dark `rgb(15, 23, 42)`) or drop the
  screenshots. 20min.

### Verified good (no action)

`AppColors.of` fallback, full dark token ramps (incl. `*Foreground` pairs),
typography color injection per brightness, shimmer/skeleton dark variants
(`shimmerBaseDark`, `shimmer_table.dart:53`), status-bar/nav-bar sync, theme
persistence + `theme_changed` analytics, web `.dark` variable set +
`suppressHydrationWarning` + shimmer `color-mix`, recharts-on-CSS-vars,
sonner theme passthrough, global-error media-query fallback, per-screen dark
goldens (rental/troubleshooter/rewards/referral/SOS), theme dialog +
toast-consistency tests, fleet-map badge `dark:` variants, ARB parity
untouched by any of this.

### Fix order

| # | Item | Effort |
|---|---|---|
| 1 | P1-1 delete dead toast file + placeholder test | 15min |
| 2 | P1-2 earnings card token (+ dark pump) | 10min |
| 3 | P1-3 badges + ratchet/test gap | 45min |
| 4 | P1-4 `vf-*` dark overrides | 30min |
| 5 | P2 batch (amoled decision, toggle-system, canvas vars, leftovers, e2e assert) | ~2h |

---

## Fix plan

Conventions: `flutter/` and `web/` roots as prefixed. After every phase:
`flutter analyze` on touched files; `npm run typecheck && npm run lint` in
`web/`. No migrations anywhere in this plan.

### Phase 0 — Safety baseline (10 min)

1. `git checkout -b fix/dark-mode-audit-2026-09-08` (tree is dirty — branch first).
2. Record baselines (all currently green):
   - `flutter test test/theme/ test/widgets/voltium_button_test.dart`
   - `node web/scripts/lint-dark-mode-tokens.js` (exit 0 expected)
   - `npx vitest --run web/tests/unit/admin-ui.test.ts
     web/tests/unit/design-tokens-extended.test.ts`

### Phase 1 — Flutter dead code + earnings card (30 min)

1. **P1-1:** delete `flutter/lib/widgets/toast_notifications.dart` (entire
   file: deprecated `ToastService`, `_ToastWidget`, `AnimatedToast`,
   `_ToastItem`). Delete `flutter/test/widgets/
   toast_notifications_golden_test.dart` (+ `goldens/
   toast_notifications_golden_test_default.png` if present — it asserts a
   placeholder `SizedBox`, not toasts). Grep for stray imports of either path
   and remove. No production code changes — the live `utils/toast.dart` path
   is untouched. Verify with `flutter analyze` + full `test/widgets/` run.
2. **P1-2:** `earnings_chart.dart:24` → `color: AppColors.of(context).card`.
   Add a dark pump to the existing earnings widget/golden test following the
   canonical pattern (`wrapForGolden(child, themeMode: ThemeMode.dark)` per
   `golden_test_helper.dart:26`; see `rental_details_screen_test.dart:52` for
   the shape). `flutter test` the file in both modes.

### Phase 2 — Web badges + ratchet gap (45 min)

1. **P1-3 badges** (`web/src/lib/admin-ui.ts:20-34`): rewrite each entry to
   the codebase pattern — e.g. `APPROVED:
   'border-emerald-500/20 text-emerald-600 bg-emerald-500/5
   dark:text-emerald-400'` (copy the exact triplets from
   `fleetMapHelpers.ts:53-63`, which is already correct). Keep
   `FALLBACK_COLOR` as the template.
2. **Close the CI gap** (pick one):
   - (a) Extend `scripts/lint-dark-mode-tokens.js` with a second pass that
     scans `*.ts` string-map files for `bg-(families)-100` without a
     `dark:` on the same entry; or
   - (b — recommended, simpler) extend the existing
     `web/tests/unit/admin-ui.test.ts` (already imports `getKycBadge`) with:
     `every KYC_COLOR_MAP value contains 'dark:'`. Pure unit test, runs in
     the normal suite, no lint-script surgery.
3. Run `npx vitest --run web/tests/unit/admin-ui.test.ts` + the lint script;
   eyeball one light + one dark screenshot of RiderManagement (badges render
   in `RiderRow`, `helpers.tsx`).

### Phase 3 — `vf-*` overrides + canvas chart (1h)

1. **P1-4:** in `globals.css`, inside the existing `.dark` block (`:90-109`
   region), add overrides for exactly the consumed tokens:
   `--color-vf-surface`, `--color-vf-surface-container`
   (→ dark card/muted equivalents, e.g. `#1e293b`/`#334155`), plus any other
   `vf-*` token with a non-`button.tsx`/AwardPointsForm consumer found via a
   final grep. Alternative (fewer tokens, more diffs): swap the three call
   sites to `bg-card`/`bg-muted`. Either is acceptable — do not do both.
   Verify: dark-mode screenshot of a `button.tsx` ghost button + the
   AwardPointsForm inputs.
2. **Canvas vars** (`analytics-charts.tsx`): add a tiny `useCssVar(name,
   fallback)` read via `getComputedStyle(document.documentElement)` for
   `--border` (grid), `--muted-foreground` (labels), `--card` (dot stroke);
   add `resolvedTheme` (next-themes `useTheme`) to the draw `useEffect` dep
   array so toggling repaints. Keep hardcoded fallbacks identical to today's
   values so light mode is pixel unchanged.

### Phase 4 — P2 batch (~2h, partly decisions)

1. **AMOLED:** product call first. Wire = fourth radio in
   `settings_screen.dart` dialog (keys `themeSystemRadio/Light/DarkRadio`
   show the pattern) + `CacheService` persist + test; delete = remove tokens
   (`:878-912`), provider `isAmoled/setAmoled/toggleAmoled/copyWith` field,
   `main.dart:266` branch. Do not half-do (a persisted-but-unsettable flag).
2. **Toggle→system:** change `theme-toggle.tsx` to cycle
   system→light→dark (icon reflects `resolvedTheme`, tooltip shows mode), or
   add a settings row. Update `login.spec.ts` toggle test accordingly.
3. **Leftovers:** `SecurityControls.tsx:139,148` →
   `dark:hover:bg-slate-700` (+ `dark:hover:text-slate-100` as needed);
   `SosAlert.tsx:43` → add `dark:text-rose-400`.
4. **e2e assert:** in `login.spec.ts` after the dark toggle, assert
   `document.body` computed background equals the dark token before
   screenshotting (one `expect`, kills the always-green test).
5. **Elevation tokens:** design-review decision only — file it, don't code it
   here.

### Verification matrix

| Gate | Command / check |
|---|---|
| Analyze + types + lint | `flutter analyze` (touched files); `npm run typecheck && npm run lint` in `web/` |
| Unit/widget | `test/theme/`, earnings tests (both modes), `admin-ui.test.ts` (+ new dark assertion), lint script exit 0 |
| Visual | dark screenshots: RiderManagement badges, ghost button, AwardPointsForm, earnings chart, canvas chart toggle repaint |
| Coverage | no drop vs Phase-0 baseline |

**Total: ~4h across 4 phases**, each independently shippable (Phases 1–2 are the P1 core at ~1.5h).
