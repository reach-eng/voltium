# Voltium `FOLLOWUP_TICKETS.md` — Doc-Fix Plan

**Date:** 2026-07-29
**Source file:** [`docs/FOLLOWUP_TICKETS.md`](./FOLLOWUP_TICKETS.md) (92 KB, 1838 lines, 53 tickets)
**Method:** Full file read. Verified the doc's 4 sections: Summary table, 53 ticket bodies, Trivial/cosmetic section, Filing checklist. Cross-checked against the 5 audit plans (DB, Design, Admin Web, Rider App, Infra, Security) and the SCOPE.md revision history.
**Audience:** the team only. PM/CTO not in the loop.
**Goal:** turn the doc from "wall of 53 tickets" into "ship-it-this-week P0 batches at the top, everything else organized for filing."

---

## TL;DR

`FOLLOWUP_TICKETS.md` is **structurally fine** — every one of the 53 tickets has a Problem, Goal/Acceptance criteria, Files to touch, and Notes section. The format is consistent. Checkboxes are copy-paste-ready for `gh issue create`. **The doc doesn't need a rewrite; it needs 4 surgical fixes.**

**The 4 real problems:**

1. **The "Filing checklist" at the bottom points to the wrong tickets as Phase 1 high-priority.** It lists #1, #2, #3, #6, #24 as Phase 1 — those are all Medium/Low priority tickets that predate the audit plans. **The actual Phase 1 P0s are Tickets #34-37 (Infra) + #44-47 (Security) = 8 P0s the team should ship this week.** A new reader who lands at the filing checklist gets the wrong order. This is the worst issue.

2. **No "Ship-it-this-week" callout at the top of the doc.** The 8 P0s are mentioned in two lines at the bottom of the Summary table (line 81-83), but a reader who scans the first 80 lines has no idea which 8 tickets are urgent. The Ryd→Voltium brand bug (#44) is customer-visible and buried in row 68 of the summary.

3. **No Table of Contents.** The doc is 1838 lines. No way to navigate. A reader who wants "all P0s" has to scan the summary.

4. **Stale source-count text.** Line 15 says "5 audit plans" (correct). Line 17 says "3 audit reviews" (stale — should be 5). Both lines need to match.

**Minimum-viable batch (PR-A, ~30 min focused, 0 risk):** rewrite the filing checklist with the correct P0 P1 P2 grouping + add a "Ship-it-this-week" callout at the top + fix the source-count text. **This is the small fix that ships in this turn.**

**Remaining PRs (PR-B through PR-D, all optional, 0 risk):** add a TOC, add a "P0 batch" section above the summary, add a Ticket index grouped by source plan. These are quality-of-life improvements; the doc is usable without them.

**Total estimated effort:** ~30 min for PR-A (shipped in this turn) + ~1-2 hours for the rest of the plan if/when the team wants to invest.

---

## Table of contents

1. [What's actually wrong](#1-whats-actually-wrong)
2. [What's NOT wrong (deliberately not changing)](#2-whats-not-wrong-deliberately-not-changing)
3. [Recommended PR sequence](#3-recommended-pr-sequence)
4. [PR-A (shipped in this turn): filing checklist + ship-it-this-week callout + source-count fix](#4-pr-a-shipped-in-this-turn-filing-checklist--ship-it-this-week-callout--source-count-fix)
5. [PR-B (optional): Table of Contents](#5-pr-b-optional-table-of-contents)
6. [PR-C (optional): "P0 batch" section above the summary](#6-pr-c-optional-p0-batch-section-above-the-summary)
7. [PR-D (optional): Ticket index grouped by source plan](#7-pr-d-optional-ticket-index-grouped-by-source-plan)
8. [What's NOT in this plan (deferred)](#8-whats-not-in-this-plan-deferred)
9. [Cross-references](#9-cross-references)

---

## 1. What's actually wrong

I read the full 1838-line file. **The 4 real problems, in order of impact:**

### 1.1 [P0 doc-quality] Filing checklist points to wrong tickets as Phase 1

**File:** `docs/FOLLOWUP_TICKETS.md:1838-1868`

**Current state:**

```markdown
### Phase 1 — High priority (file first, 5 tickets)
- [ ] **#1** [Phase 3 PR-B] Split `RiderManagement.tsx` (or close as superseded by Admin Web Plan PR-6)
- [ ] **#2** [Phase 4 PR-B] Outbox persistence — add `notifyOnFail` column or delete dead `JobQueue.enqueue`
- [ ] **#3** [Phase 5 PR-C] Rider app screen splits + complete `appDebug` migration
- [ ] **#6** [DB Audit 2.8] Split `RiderLifecycleStatus` enum
- [ ] **#24** [Admin Web 11.1] Review `middleware.ts` for trust-headers bug (potential security P0)
```

**The problem:** All 5 of these are **Medium priority** (per the Summary table on lines 25-27, 30, 48). **None of them are P0.** The actual P0 tickets the team should ship first are:

- **Infra batch (Tickets #34-37):** #34 fix `check-migration-safety.sh` no-op, #35 replace fake `check-secret-rotation.sh`, #36 encrypt `db-backup.sh`, #37 clean up Flutter CI keystore
- **Security batch (Tickets #44-47):** #44 Ryd→Voltium brand message, #45 redact PII in audit log, #46 fix dev OTP bypass, #47 fix cron-auth timing leak

That's 8 P0 tickets. **The current filing checklist buries all 8 in Phase 3 ("file as backlog").** A team member who follows the filing checklist would file 5 Medium-priority items first and the 8 P0s last. This is the inverse of what should happen.

**Why this is the worst issue:** the filing checklist is the doc's "action section" — a reader who is ready to file issues will follow it literally. Misordered priorities = misordered work.

**Why it happened:** the filing checklist predates the Infra and Security plan additions. The Infra tickets #34-37 and Security tickets #44-47 were added with the same Medium/Low priority labels in the Summary table (well, P0/P1 — but the filing checklist wasn't updated to match).

**Fix:** rewrite the filing checklist with a P0 P1 P2 grouping based on the Severity/Priority column in the Summary table.

### 1.2 [P1 doc-quality] No "Ship-it-this-week" callout at the top of the doc

**File:** `docs/FOLLOWUP_TICKETS.md:21-86` (Summary section)

**Current state:** the Summary section has a 54-row table. The 8 P0s are rows 58-61 (Infra) and 68-72 (Security). The 2 minimum-viable batch callouts are at line 81 and 83 — **the bottom of the Summary table**, after 75 rows of context.

**The problem:** a new reader who lands on the doc sees the title, the date, the source list, and the Summary table. They have to read 75+ rows of the Summary table to find the "minimum-viable batch" callout. **The customer-visible Ryd→Voltium brand bug (Ticket #44, a 5-min fix) is at row 68 of the summary table.**

**Fix:** add a "🚨 Ship-it-this-week" callout block at the top of the Summary section, before the table. List the 8 P0s by ticket number. This is what a new reader needs in their first 5 seconds.

### 1.3 [P2 doc-quality] No Table of Contents

**File:** `docs/FOLLOWUP_TICKETS.md` (whole file)

**The problem:** the doc is 1838 lines. There's no way to navigate. A reader who wants "all P0s" or "all Design System tickets" has to scan the Summary table or use grep.

**Fix:** add a TOC at the top with anchors to:
- Summary (the table itself)
- Phase 1: Ship-it-this-week P0s
- Tickets #1-#53 (grouped by source plan)
- Trivial/cosmetic items
- Filing checklist

The "grouped by source plan" is the key value-add — right now the doc has tickets in a flat numbered list, which makes it hard to find "all DB tickets" or "all Design System tickets."

### 1.4 [P3 doc-quality] Stale source-count text

**File:** `docs/FOLLOWUP_TICKETS.md:15, 17`

**Current state:**

- Line 15: "This doc is the consolidated backlog across all 7 sources above. The original 5 tickets (Phase 3-6 follow-ups) are preserved as Tickets #1-#5. New tickets from the 5 audit plans are added as #6-#53."
- Line 17: "These are the items identified during the Phase 0–7 remediation and the **3 audit reviews** that didn't make the release runway."

**The problem:** line 15 says "5 audit plans" (correct) but line 17 says "3 audit reviews" (stale). The 7 sources are: 1 Phase 7 + 6 audit plans (DB, Design, Admin Web, Rider App, Infra, Security). The body says "3 audit reviews" because at the time the original 5 tickets were written, only 3 audit plans existed.

**Fix:** change "3 audit reviews" to "6 audit reviews" on line 17.

### 1.5 Minor: Source-list header could be more explicit

**File:** `docs/FOLLOWUP_TICKETS.md:4-11`

The source list at the top is fine. The 7 sources are listed clearly. **No change needed.**

---

## 2. What's NOT wrong (deliberately not changing)

I want to be explicit about what this plan **does not change** so the team doesn't think the doc is in worse shape than it is.

### 2.1 The 53 ticket bodies are well-formatted

**Every one of the 53 tickets has:**
- Title with ticket number and source plan
- Metadata (Size/Priority/Owner/Labels for the Phase 3-6 tickets; Severity/Effort/Risk for the audit-plan tickets)
- Problem statement
- Goal or Acceptance criteria with checkboxes
- Files to touch
- Notes section

**The format is consistent enough** that `gh issue create --body "$(cat ticket.md)"` works on any of them. The 2 minor inconsistencies are:
- Phase 3-6 tickets use `**Size:**` / `**Priority:**` / `**Owner:**` / `**Labels:**` metadata.
- Audit-plan tickets use `**Source:**` / `**Severity:**` / `**Effort:**` / `**Risk:**` metadata.

**This inconsistency is OK.** The two formats emerged from two different authoring sessions and serve different purposes (Phase 3-6 are "tech debt"; audit-plan tickets are "P0 fixes from a specific audit finding"). The audit-plan format is more useful for filing. **Don't unify — the inconsistency is information, not noise.**

### 2.2 The Summary table is the right structure

The 54-row Summary table is the right way to surface "all tickets at a glance." Don't replace it with a flat list or a per-section summary. **The Summary table stays.**

### 2.3 The Trivial/cosmetic section is valuable

The "Trivial/cosmetic items (NOT individual tickets)" section at line 1684 captures the small audit-plan items that aren't worth a ticket. **Keep it.** It prevents "where did this finding go?" questions.

### 2.4 The 5 Phase 3-6 tickets are correctly Medium priority

Tickets #1-#5 are all Phase 3-6 follow-ups. They are code-health tickets (split a 1,213-line file, complete an `appDebug` migration, migrate 24 typography aliases). They are not P0s. **Their Medium priority is correct.** The fix is not to re-rank them; the fix is to fix the filing checklist (issue 1.1 above).

### 2.5 Don't restructure by priority

A common "fix" for a doc like this is to sort tickets by priority (P0 first, P1 next, P2 last). **Don't do that.** The numbered ticket system is the team's stable identifier — once we file `gh issue create`, the GitHub issue number is the canonical reference, and the Voltium ticket number maps to it. Reordering by priority would break the cross-references in SCOPE.md, the audit plans, and the GitHub issues themselves.

**If the team wants a "P0 first" reading order, use the Summary table's existing severity column or the new "Ship-it-this-week" callout (issue 1.2). Don't reorder the tickets themselves.**

---

## 3. Recommended PR sequence

| #   | PR                                                 | Severity  | Effort  | Risk | Notes                                                              |
| --- | -------------------------------------------------- | --------- | ------- | ---- | ------------------------------------------------------------------ |
| A   | Fix filing checklist + ship-it callout + source-count | P0 doc-quality | 30 min | none | **Shipped in this turn.** Solves the worst issue (misordered work). |
| B   | Add Table of Contents                              | P2 doc-quality | 30 min | none | Optional. Helps navigation.                                        |
| C   | Add "P0 batch" section above the Summary table     | P1 doc-quality | 30 min | none | Optional. The "ship-it-this-week" callout in PR-A covers most of it. |
| D   | Add ticket index grouped by source plan            | P2 doc-quality | 1 hr   | none | Optional. Helps filing — pick "all DB tickets" and you have 7.     |

**Total:** ~30 min focused for PR-A (this turn) + ~1-2 hours for PR-B through PR-D if/when the team wants to invest.

**Recommendation:** ship PR-A now (done). Defer PRs B-D to a v2 doc-quality pass.

---

## 4. PR-A (shipped in this turn): filing checklist + ship-it-this-week callout + source-count fix

**File:** `docs/FOLLOWUP_TICKETS.md`
**Effort:** 30 min
**Risk:** none
**Soak:** none (doc-only change)

**What this PR does:**

1. **Rewrite the "Filing checklist" section (line 1838-1868)** with a P0 P1 P2 grouping. Pull the priority labels directly from the Summary table's Priority/Severity column.

2. **Add a "🚨 Ship-it-this-week" callout block** at the top of the Summary section (before the table at line 21), listing the 8 P0s by ticket number with one-line descriptions.

3. **Fix the stale source-count text** on line 17: change "3 audit reviews" to "6 audit reviews."

**Concrete diff sketch (Filing checklist):**

```markdown
## Filing checklist

When the team is ready to file these as GitHub issues, follow the priority grouping below. The P0 batch ships-this-week regardless of filing order — file them as you implement them.

### Phase 1 — P0 ship-it-this-week (file FIRST, file with `gh issue create` and link the source plan)

**Infra batch (4 tickets, ~3-4 hours focused, 0 risk):**
- [ ] **#34** [Infra Plan PR-1] `check-migration-safety.sh` always exits 0 — destructive migrations pass silently
- [ ] **#35** [Infra Plan PR-2] Replace `check-secret-rotation.sh` fake check with a real rotation check
- [ ] **#36** [Infra Plan PR-3] `db-backup.sh` writes plaintext SQL dumps with PII — add encryption
- [ ] **#37** [Infra Plan PR-4] Flutter CI leaves release keystore on disk — cleanup post-job

**Security batch (4 tickets, ~1-2 hours focused, 0 risk — #44 is customer-visible):**
- [ ] **#44** [Security Plan PR-1, NEW] SMS OTP message says "Ryd" instead of "Voltium" — brand violation
- [ ] **#45** [Security Plan PR-2] `security-events.ts` audit log `details` not redacted — PII leaks
- [ ] **#46** [Security Plan PR-3] Dev OTP `'111111'` accepted for ANY phone without entry lookup
- [ ] **#47** [Security Plan PR-4] `cron-auth.ts` length-check leaks secret length via timing

**Single-ticket P0s (file alongside the batches above):**
- [ ] **#38** [Infra Plan PR-5] CI `coverage-gap` fails silently — `continue-on-error: true` masks regression
- [ ] **#39** [Infra Plan PR-6] PM2 timeouts too short for Next.js — graceful shutdown (24h soak)
- [ ] **#40** [Infra Plan PR-7] Deploy script rollback uses `git revert HEAD` — replace with tag-based rollback
- [ ] **#41** [Infra Plan PR-8] `ci-cd.yml` `deploy-staging` job is a no-op (fresh VM, no PM2 state)
- [ ] **#42** [Infra Plan PR-9] PM2 `instances: 1` means "zero-downtime" is not zero-downtime (48h soak)
- [ ] **#48** [Security Plan PR-5] `NODE_ENV` used for security gates — replace with `APP_ENV`
- [ ] **#49** [Security Plan PR-6] OTP compare uses `===` — non-constant-time timing attack
- [ ] **#50** [Security Plan PR-7] `ALLOW_DEV_PII_KEY` not rejected in production env schema
- [ ] **#51** [Security Plan PR-8] Rate limiter trusts `cf-connecting-ip`/`x-forwarded-for` unconditionally
- [ ] **#52** [Security Plan PR-9] Self-referral allowed + `exists` field leaks user enumeration
- [ ] **#53** [Security Plan PR-10] `info` security events (successful login) NOT audit-logged — SOC2 failure

### Phase 2 — Medium priority (file next, after P0s shipped)
- [ ] **#1** [Phase 3 PR-B] Split `RiderManagement.tsx` (or close as superseded by Admin Web Plan PR-6)
- [ ] **#2** [Phase 4 PR-B] Outbox persistence — add `notifyOnFail` column or delete dead `JobQueue.enqueue`
- [ ] **#3** [Phase 5 PR-C] Rider app screen splits + complete `appDebug` migration
- [ ] **#6** [DB Audit 2.8] Split `RiderLifecycleStatus` enum
- [ ] **#7** [DB Audit 2.10-2.12] Convert `pickupHub`/`currentPlan`/`teamLeader` to FKs
- [ ] **#8** [DB Audit 2.19-2.23] Convert `String` JSON-as-string columns to `Json`
- [ ] **#15** [Admin Web 1.3, 1.5] Consolidate `lib/rbac.ts` and `lib/permissions.ts`
- [ ] **#18** [Admin Web 2.2-2.6] Tidy remaining API client/middleware P2s
- [ ] **#20** [Admin Web 6.6] Split `index.tsx` admin home
- [ ] **#24** [Admin Web 11.1] Review `middleware.ts` for trust-headers bug duplication
- [ ] **#27** [Design System 11.3-11.6] Consolidate widgets
- [ ] **#28** [Design System 11.8] Move screen-specific widgets to features
- [ ] **#32** [Design System 6.6, 12.14] Add CI lint
- [ ] **#43** [Infra Plan PR-10] Deploy script cleanup batch (pipefail, audit, notifications, parallel builds)

### Phase 3 — Low priority / backlog (file as issues, tag with `P2-low`, tackle last)
- [ ] **#4, #5, #9, #10, #11, #12, #13, #14, #16, #17, #19, #21, #22, #23, #25, #26, #29, #30, #31, #33** (all other tickets)

### General checklist
- [ ] Set priority label: `P0-ship-this-week` for Phase 1, `P1-medium` for Phase 2, `P2-low` for Phase 3
- [ ] Set owner (or leave as `TBD` for the team to claim)
- [ ] Link each issue back to this doc + the source plan
- [ ] Add to the team's "post-release backlog" milestone
- [ ] Update `SCOPE.md` "Status as of 2026-07-29" section with the new issue numbers once filed
- [ ] Close any ticket that was already addressed (e.g., Ticket #3's Flutter primary color sub-task is closed by Phase 7)
- [ ] **Critical:** file the 19 P0s in Phase 1 first. Don't get distracted by the easier Phase 2/3 tickets.
```

**Concrete diff sketch (Ship-it-this-week callout at top of Summary):**

Insert before the Summary table:

```markdown
## 🚨 Ship-it-this-week (8 P0s, ~5 hours focused total)

**These 8 tickets are the highest-leverage items across the 53-ticket backlog. All are P0. All are zero-risk. The first one (#44) is customer-visible and takes 5 minutes.**

| # | Ticket | Source | Effort | Why now |
|---|---|---|---|---|
| #44 | Ryd → Voltium brand message in SMS OTP | Security | 5 min | **Customer-visible** — every OTP says the wrong brand |
| #46 | Dev OTP `'111111'` accepted for any phone | Security | 15 min | Dev bypass; log in as any phone |
| #47 | `cron-auth.ts` length-check timing leak | Security | 15 min | Secret-length exposed via timing |
| #34 | `check-migration-safety.sh` always exits 0 | Infra | 30 min | CI safety gate is a no-op |
| #37 | Flutter CI leaves keystore on disk | Infra | 15 min | Recoverable on self-hosted runners |
| #38 | CI `coverage-gap` silently passes | Infra | 15 min | `continue-on-error: true` masks regression |
| #36 | `db-backup.sh` writes plaintext SQL dumps | Infra | 1 hr | PII at rest in backups |
| #45 | `security-events.ts` audit log PII leak | Security | 30 min | GDPR — every security event leaks |

**Next 11 P0s** (Tickets #35, #39-#42, #48-#53): review the Filing checklist at the bottom of this doc.

---
```

**Concrete diff sketch (source-count fix):**

Line 17: change "the **3 audit reviews**" to "the **6 audit reviews**" (DB, Design, Admin Web, Rider App, Infra, Security).

**Acceptance criteria:**
- Filing checklist lists Phase 1 P0s first (Tickets #34, #35, #36, #37, #44, #45, #46, #47, #38, #39, #40, #41, #42, #48, #49, #50, #51, #52, #53 = 19 P0s).
- Phase 2 lists Medium-priority tickets.
- Phase 3 lists Low-priority tickets.
- "Ship-it-this-week" callout at the top of the Summary section lists 8 highest-leverage P0s.
- Line 17 says "6 audit reviews" (not 3).
- No ticket bodies are modified.
- The Summary table (54 rows) is unchanged.

**Reviewer focus notes:**
- The filing checklist is a doc-only change. No code, no tests. 5-min review.
- The 19 P0s in Phase 1 are the real fix. The team should file these first.
- #44 (Ryd→Voltium) is the single most-urgent ticket. It should be merged in 5 minutes, before any of the others.

---

## 5. PR-B (optional): Table of Contents

**File:** `docs/FOLLOWUP_TICKETS.md`
**Effort:** 30 min
**Risk:** none

**What this PR does:**

Add a TOC at the top of the doc, after the metadata block. Anchor links to:
- 🚨 Ship-it-this-week (the new callout from PR-A)
- Summary (the 54-row table)
- Tickets by source plan: Phase 3-6 (#1-5), DB Audit (#6-12), Design System (#13-14, #27-32), Admin Web (#15-26, #33), Infra (#34-43), Security (#44-53)
- Trivial/cosmetic items
- Filing checklist

**Acceptance criteria:**
- A new reader can navigate to any section in 2 clicks from the top of the doc.
- Anchor links work in GitHub-flavored markdown (i.e. when viewing the file in the GitHub UI).

**Reviewer focus notes:**
- Use `##` (h2) for the TOC entries. Don't introduce h1.
- Verify the anchor links resolve (GitHub auto-generates anchors from heading text; the source has special characters like ` ` and `:` and `/` that get normalized).

---

## 6. PR-C (optional): "P0 batch" section above the Summary table

**File:** `docs/FOLLOWUP_TICKETS.md:21-86`

This is largely subsumed by PR-A's "Ship-it-this-week" callout. **Recommendation: skip.** The callout in PR-A is sufficient.

**If the team wants a fuller P0 grouping (not just 8 ship-it-this-week, but all 19 P0s),** add a "P0 backlog (19 tickets)" section that lists all 19 with one-line summaries. **Defer to v2.**

---

## 7. PR-D (optional): Ticket index grouped by source plan

**File:** `docs/FOLLOWUP_TICKETS.md`

**What this PR does:**

Add a "Tickets by source plan" section near the top, with sub-sections:

- **Phase 3-6 follow-ups** (5 tickets: #1-5) — `RiderManagement` split, Outbox persistence, Rider app screen splits, Typography aliases, Color hues
- **DB Audit follow-ups** (7 tickets: #6-12) — `RiderLifecycleStatus` enum, FK conversions, JSON columns, etc.
- **Design System follow-ups** (8 tickets: #13-14, #27-32) — `DESIGN.md` delete, `design-tokens.json` extension, widget consolidation, CI lint
- **Admin Web follow-ups** (12 tickets: #15-26, #33) — RBAC consolidation, lib tidy, screen splits, server module splits
- **Rider App follow-ups** — (none — all Rider App findings are in audit-plan tickets, not separate from PRs)
- **Infra follow-ups** (10 tickets: #34-43) — migration safety, secret rotation, db-backup encryption, keystore cleanup, coverage-gap, PM2 timeouts, deploy rollback, deploy-staging fix, PM2 clustering, deploy cleanup
- **Security follow-ups** (10 tickets: #44-53) — Ryd→Voltium, PII redaction, dev OTP bypass, timing leak, APP_ENV, OTP timing, env schema, proxy headers, self-referral, SOC2 audit

**Acceptance criteria:**
- A new reader can find "all DB Audit tickets" or "all Security tickets" in one place.
- The ticket numbers don't change (cross-references in SCOPE.md, audit plans, and GitHub issues stay valid).

**Reviewer focus notes:**
- This is documentation-only. Low value, but useful for the filing workflow.
- The current summary table serves most of this purpose. This PR-D is for a "narrow" workflow (file all DB tickets in one PR cycle).

---

## 8. What's NOT in this plan (deferred)

### 8.1 Re-sorting tickets by priority

A common "fix" for a doc like this is to sort tickets by priority (P0 first, P1 next, P2 last). **Don't do that.** The numbered ticket system is the team's stable identifier. Reordering would break cross-references in SCOPE.md, the audit plans, and the GitHub issues themselves.

**Use the Summary table's Priority column or the new "Ship-it-this-week" callout (PR-A) for priority-based reading.**

### 8.2 Unifying ticket metadata format

The Phase 3-6 tickets use `**Size:**` / `**Priority:**` / `**Owner:**` / `**Labels:**` metadata. The audit-plan tickets use `**Source:**` / `**Severity:**` / `**Effort:**` / `**Risk:**` metadata. **Don't unify.** The inconsistency is information — Phase 3-6 tickets are "tech debt," audit-plan tickets are "P0 fixes from a specific audit finding." The two formats serve different purposes.

If the team really wants unification, propose a v2 metadata schema: `{ Source, Severity, Effort, Risk, Owner, Labels }` for all tickets. This is a v2 doc-quality pass.

### 8.3 Converting the doc to a database or per-ticket MD files

The doc is 92 KB, which is getting large. A common "fix" is to break it into per-ticket MD files (e.g. `docs/followup/001-split-rider-management.md`). **Don't do that.** The single-doc format is the team's source of truth for the backlog. Per-ticket files make filing harder (`gh issue create --body-file ./001-...` vs. copy-paste from the section). **Stay with one doc.**

If the team wants a script-generated per-ticket MD dump for `gh issue create --body-file` workflows, file a v2 ticket.

### 8.4 Auto-syncing to GitHub Issues

A common "fix" is to auto-create GitHub issues from the doc on every push. **Don't do that.** The doc is the team's editable source of truth; GitHub issues are the read-only result of filing. Auto-syncing loses the "edit locally, file when ready" workflow. **Stay manual.**

---

## 9. Cross-references

- **Source file:** [`docs/FOLLOWUP_TICKETS.md`](./FOLLOWUP_TICKETS.md) (92 KB, 53 tickets, 1838 lines)
- **Source plans** (the 7 source docs that generated the 53 tickets):
  - [`docs/RELEASE_READINESS_2026-07-29.md`](./RELEASE_READINESS_2026-07-29.md) — Phase 7 follow-ups (Tickets #1-5)
  - [`docs/DB_REMEDIATION_PLAN.md`](./DB_REMEDIATION_PLAN.md) — DB audit (Tickets #6-12)
  - [`docs/DESIGN_SYSTEM_PLAN.md`](./DESIGN_SYSTEM_PLAN.md) — Design system audit (Tickets #13-14, #27-32)
  - [`docs/ADMIN_WEB_PLAN.md`](./ADMIN_WEB_PLAN.md) — Admin web audit (Tickets #15-26, #33)
  - [`docs/RIDER_APP_PLAN.md`](./RIDER_APP_PLAN.md) — Rider app audit (all findings folded into Rider App PRs, no separate tickets)
  - [`docs/INFRASTRUCTURE_PLAN.md`](./INFRASTRUCTURE_PLAN.md) — Infrastructure audit (Tickets #34-43)
  - [`docs/SECURITY_PLAN.md`](./SECURITY_PLAN.md) — Auth/security audit (Tickets #44-53)
- **SCOPE.md:** `D:\voltium\SCOPE.md` — references the followup ticket numbers in its revision history and follow-up PRs
- **Release readiness:** `docs/RELEASE_READINESS_2026-07-29.md`
- **Existing dev/test artifacts:**
  - `docs/DEVICE_TEST_PLAYBOOK.md` — physical device test script
  - `docs/BUG_REPORT_TEMPLATE.md` — bug filing template
  - These are operational artifacts, not part of the FOLLOWUP_TICKETS doc.
